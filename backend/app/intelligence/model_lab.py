"""Reproducible mining of dimensional warehouse facts with saved evidence."""
import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4
import joblib
import numpy as np
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score, accuracy_score, average_precision_score, precision_recall_curve, silhouette_score
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from threadpoolctl import threadpool_limits
from app.config import DATA_DIR, WAREHOUSE_PATH
from app.intelligence.stream_classifier import FEATURES, feature_matrix

WAREHOUSE_SQL = '''SELECT f.tx_id, f.step_number AS step, t.type_name AS type,
    f.amount, f.orig_balance_delta, f.dest_balance_delta, f.is_fraud_actual AS label
    FROM fact_transactions f JOIN dim_transaction_type t ON f.type_key=t.type_key
    ORDER BY f.step_number, f.tx_id'''


def warehouse_frame(con):
    frame = con.execute(WAREHOUSE_SQL).fetchdf()
    before = len(frame)
    numeric = ['amount', 'orig_balance_delta', 'dest_balance_delta', 'step']
    if before:
        frame = frame[np.isfinite(frame[numeric].to_numpy(dtype=float)).all(axis=1) & (frame.amount >= 0) & (frame.step >= 1)]
    valid = len(frame)
    frame = frame.drop_duplicates(['step', 'type', 'amount', 'orig_balance_delta', 'dest_balance_delta', 'label'])
    return frame, {'warehouse_rows': before, 'invalid_excluded': before-valid,
                   'duplicate_signatures_excluded': valid-len(frame), 'unique_rows': len(frame)}


def metrics_for(y, prediction):
    tn, fp, fn, tp = confusion_matrix(y, prediction, labels=[0, 1]).ravel()
    return {'accuracy': float(accuracy_score(y, prediction)),
            'precision': float(precision_score(y, prediction, zero_division=0)),
            'recall': float(recall_score(y, prediction, zero_division=0)),
            'f1': float(f1_score(y, prediction, zero_division=0)),
            'tn': int(tn), 'fp': int(fp), 'fn': int(fn), 'tp': int(tp)}


def artifact_path():
    namespace = hashlib.sha256(str(WAREHOUSE_PATH.resolve()).encode()).hexdigest()[:12]
    return DATA_DIR / 'models' / f'{namespace}-cart.joblib'


def saved_report(con, kind):
    row = con.execute('SELECT report_json FROM mining_runs WHERE kind=? ORDER BY created_at DESC, run_id DESC LIMIT 1', [kind]).fetchone()
    return json.loads(row[0]) if row else None


def train_tree(con, classifier, depth=4, min_leaf=5, test_fraction=0.25, criterion='gini'):
    frame, quality = warehouse_frame(con)
    frame = frame[frame.label.isin([0, 1])].copy()
    steps = np.sort(frame.step.unique())
    if len(frame) < 40 or len(steps) < 4:
        raise ValueError('At least 40 labelled observations across four simulation steps are required.')
    split_index = max(1, min(len(steps)-1, int(len(steps)*(1-test_fraction))))
    cutoff = int(steps[split_index])
    train, test = frame[frame.step < cutoff], frame[frame.step >= cutoff]
    if train.label.nunique() < 2:
        raise ValueError('Earlier training steps need both fraud and non-fraud labels. Import more labelled data.')
    x_train, x_test = feature_matrix(train), feature_matrix(test)
    y_train, y_test = train.label.astype(int).to_numpy(), test.label.astype(int).to_numpy()
    model = DecisionTreeClassifier(max_depth=depth, min_samples_leaf=min_leaf,
                                   criterion=criterion, class_weight='balanced', random_state=42)
    model.fit(x_train, y_train)
    prediction = model.predict(x_test)
    probability = model.predict_proba(x_test)[:, list(model.classes_).index(1)]
    result = metrics_for(y_test, prediction)
    result['average_precision'] = float(average_precision_score(y_test, probability)) if y_test.sum() else None
    precision, recall, _ = precision_recall_curve(y_test, probability) if y_test.sum() else ([], [], [])
    version = f'cart-{uuid4().hex[:10]}'
    tree = model.tree_

    def node(i):
        leaf = tree.children_left[i] == tree.children_right[i]
        predicted = int(model.classes_[np.argmax(tree.value[i][0])])
        item = {'id': int(i), 'samples': int(tree.n_node_samples[i]), 'impurity': round(float(tree.impurity[i]), 4),
                'prediction': predicted, 'leaf': bool(leaf)}
        if not leaf:
            item.update(feature=FEATURES[tree.feature[i]], threshold=round(float(tree.threshold[i]), 3),
                        left=node(tree.children_left[i]), right=node(tree.children_right[i]))
        return item

    report = {'run_id': version, 'kind': 'classification', 'algorithm': 'CART decision tree',
              'created_at': datetime.now(timezone.utc).isoformat(), 'source_sql': WAREHOUSE_SQL,
              'settings': {'max_depth': depth, 'min_samples_leaf': min_leaf, 'test_fraction': test_fraction,
                           'criterion': criterion, 'class_weight': 'balanced', 'random_state': 42},
              'quality': quality, 'labelled_rows': len(frame),
              'split': {'cutoff_step': cutoff, 'train_rows': len(train), 'test_rows': len(test),
                        'train_fraud': int(y_train.sum()), 'test_fraud': int(y_test.sum()),
                        'train_start': int(train.step.min()), 'train_end': int(train.step.max()),
                        'test_start': int(test.step.min()), 'test_end': int(test.step.max())},
              'metrics': result, 'baseline': metrics_for(y_test, np.zeros(len(y_test), dtype=int)),
              'train_metrics': metrics_for(y_train, model.predict(x_train)), 'tree': node(0),
              'tree_text': export_text(model, feature_names=FEATURES),
              'feature_importance': [{'feature': f, 'importance': float(v)} for f, v in zip(FEATURES, model.feature_importances_)],
              'pr_curve': [{'recall': float(r), 'precision': float(p)} for r, p in zip(recall, precision)],
              'warnings': ['Balance changes are post-transaction features: this model supports retrospective review.',
                           'Replay events are not an independent benchmark; use the saved chronological test results.',
                           'Decision-tree scores are class-weighted leaf estimates, not calibrated fraud probabilities.']}
    if int(y_test.sum()) < 10:
        report['warnings'].append(f'Only {int(y_test.sum())} fraud labels in the test window. Metrics are unstable on this small sample.')
    if not y_test.sum():
        report['warnings'].append('No fraud labels in the test window: fraud-detection performance cannot be established.')
    elif result['recall'] == 0:
        report['warnings'].append('The tree missed every fraud label in this test window. Review feature coverage and collect more representative labelled data before relying on it.')
    if result['tp'] + result['fp'] == 0:
        report['warnings'].append('No test rows were flagged. Precision is reported as zero by convention, not evidence of a useful detector.')
    path = artifact_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    joblib.dump({'model': model, 'version': version}, temporary)
    con.execute('BEGIN TRANSACTION')
    try:
        con.execute('INSERT INTO mining_runs(run_id,kind,report_json) VALUES (?,?,?)', [version, 'classification', json.dumps(report)])
        con.executemany('INSERT INTO fact_model_evaluations VALUES (?,?,?,?,?)',
                        [(version, int(tx), int(y), int(p), float(score)) for tx, y, p, score in zip(test.tx_id, y_test, prediction, probability)])
        temporary.replace(path)
        con.execute('COMMIT')
    except Exception:
        con.execute('ROLLBACK')
        raise
    classifier.activate(model, version)
    con.execute('CHECKPOINT')
    return report


def restore_or_train(con, classifier):
    report = saved_report(con, 'classification')
    path = artifact_path()
    if report and path.exists():
        try:
            artifact = joblib.load(path)
            if artifact['version'] == report['run_id']:
                classifier.activate(artifact['model'], artifact['version'])
                return
        except Exception:
            pass
    try:
        train_tree(con, classifier)
    except ValueError:
        pass


def cluster_warehouse(con, k=3):
    frame, quality = warehouse_frame(con)
    if len(frame) < max(20, k*5):
        raise ValueError('Import at least 20 distinct valid transactions before clustering.')
    if len(frame) > 20000:
        frame = frame.sample(20000, random_state=42).sort_values('tx_id')
    x = feature_matrix(frame)
    x[:, :3] = np.sign(x[:, :3]) * np.log1p(np.abs(x[:, :3]))
    with threadpool_limits(limits=1):
        scaled = StandardScaler().fit_transform(x)
        distinct = len(np.unique(scaled, axis=0))
        if distinct < k:
            raise ValueError('Fewer distinct feature vectors than requested clusters.')
        model = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = model.fit_predict(scaled)
        pca = PCA(n_components=2, random_state=42)
        projected = pca.fit_transform(scaled)
        silhouette = float(silhouette_score(scaled, labels, sample_size=min(2000, len(frame)), random_state=42)) if len(set(labels)) > 1 else None
        elbow = []
        for count in range(2, min(6, distinct)+1):
            fitted = KMeans(n_clusters=count, n_init=5, random_state=42).fit(scaled)
            elbow.append({'k': count, 'inertia': float(fitted.inertia_)})
    frame = frame.copy()
    frame['cluster'] = labels
    groups = []
    for group_id, group in frame.groupby('cluster'):
        known = group[group.label.isin([0, 1])]
        groups.append({'cluster': int(group_id), 'rows': len(group), 'median_amount': float(group.amount.median()),
                       'dominant_type': str(group.type.mode().iloc[0]), 'types': {str(t): int(n) for t, n in group.type.value_counts().items()},
                       'labelled_rows': len(known), 'confirmed': int(known.label.sum()) if len(known) else 0,
                       'mean_origin_change': float(group.orig_balance_delta.mean())})
    chosen = np.linspace(0, len(frame)-1, min(len(frame), 800), dtype=int)
    report = {'run_id': f'kmeans-{uuid4().hex[:10]}', 'kind': 'clustering', 'algorithm': 'K-means',
              'created_at': datetime.now(timezone.utc).isoformat(), 'k': k, 'quality': quality,
              'rows': len(frame), 'silhouette': silhouette, 'groups': groups, 'elbow': elbow,
              'explained_variance': float(pca.explained_variance_ratio_.sum()),
              'points': [{'x': float(projected[i, 0]), 'y': float(projected[i, 1]), 'cluster': int(labels[i]),
                          'tx_id': int(frame.iloc[i].tx_id), 'amount': float(frame.iloc[i].amount), 'type': str(frame.iloc[i].type)} for i in chosen],
              'source_sql': WAREHOUSE_SQL,
              'method': 'Signed log transform of amounts and balance changes; standard scaling; one-hot types; K-means without labels. PCA is only a 2D display.',
              'interpretation': 'Groups describe similar transactions. Fraud labels are inspected afterwards and never used to form clusters.'}
    con.execute('BEGIN TRANSACTION')
    try:
        con.execute('INSERT INTO mining_runs(run_id,kind,report_json) VALUES (?,?,?)', [report['run_id'], 'clustering', json.dumps(report)])
        con.executemany('INSERT INTO fact_cluster_assignments VALUES (?,?,?)', [(report['run_id'], int(tx), int(c)) for tx, c in zip(frame.tx_id, labels)])
        con.execute('COMMIT')
    except Exception:
        con.execute('ROLLBACK')
        raise
    con.execute('CHECKPOINT')
    return report
