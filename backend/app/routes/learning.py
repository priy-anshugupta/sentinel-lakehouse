import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
import pandas as pd
from app.auth import request_user
from app.config import PAYSIM_CSV_PATH
from app.warehouse.connection import get_connection
from app.warehouse.data_quality import run_quality_checks
from app.intelligence.model_lab import saved_report, train_tree, cluster_warehouse, warehouse_frame
from app.intelligence.discretizer import discretize_dataframe
from app.intelligence.rule_miner import mine_window_rules, format_rule
from datetime import datetime, timezone
from uuid import uuid4

router = APIRouter(prefix='/api/learning')


class TrainingSettings(BaseModel):
    max_depth: int = Field(default=4, ge=2, le=8)
    min_samples_leaf: int = Field(default=5, ge=1, le=50)
    test_fraction: float = Field(default=.25, ge=.15, le=.4)
    criterion: str = 'gini'


class ClusterSettings(BaseModel):
    k: int = Field(default=3, ge=2, le=6)


class RuleSettings(BaseModel):
    min_support: float = Field(default=.01, ge=.001, le=.5)
    min_confidence: float = Field(default=.5, ge=.1, le=1)
    min_lift: float = Field(default=1.2, ge=1, le=20)


def require_training_role(request):
    user = request_user(request)
    if not user or user['role'] != 'DATA_ENGINEER':
        raise HTTPException(403, 'Data engineer access is required to train models.')


@router.get('/status')
async def status(request: Request):
    con = get_connection()
    classifier = request.app.state.classifier
    runs = con.execute('SELECT run_id,kind,created_at FROM mining_runs ORDER BY created_at DESC LIMIT 15').fetchall()
    return {'active_version': classifier.version, 'algorithm': 'CART decision tree',
            'classification': saved_report(con, 'classification'), 'clustering': saved_report(con, 'clustering'),
            'association': saved_report(con, 'association'),
            'history': [{'run_id': r[0], 'kind': r[1], 'created_at': str(r[2])} for r in runs],
            'warehouse_rows': con.execute('SELECT count(*) FROM fact_transactions').fetchone()[0]}


@router.post('/train')
async def train(request: Request, params: TrainingSettings):
    require_training_role(request)
    if params.criterion not in ('gini', 'entropy'):
        raise HTTPException(422, 'Choose gini or entropy')
    try:
        # This endpoint deliberately stays on the event loop: the app shares one DuckDB connection.
        report = train_tree(get_connection(), request.app.state.classifier, params.max_depth,
                            params.min_samples_leaf, params.test_fraction, params.criterion)
        request.app.state.drift_detector.reset()
        return report
    except ValueError as error:
        raise HTTPException(400, str(error)) from error


@router.post('/cluster')
async def cluster(request: Request, params: ClusterSettings):
    require_training_role(request)
    try:
        return cluster_warehouse(get_connection(), params.k)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error


@router.get('/dataset')
async def dataset():
    con = get_connection()
    source = pd.read_csv(PAYSIM_CSV_PATH)
    frame, quality = warehouse_frame(con)
    totals = con.execute('''SELECT count(*), coalesce(sum(is_fraud_actual),0),
        count(*) FILTER (WHERE is_fraud_actual IS NULL), min(step_number),max(step_number) FROM fact_transactions''').fetchone()
    types = con.execute('''SELECT t.type_name AS type,count(*) AS transactions,
        coalesce(sum(f.is_fraud_actual),0) AS confirmed,coalesce(sum(f.amount),0) AS amount
        FROM fact_transactions f JOIN dim_transaction_type t ON f.type_key=t.type_key GROUP BY 1 ORDER BY 2 DESC''').fetchdf().to_dict('records')
    sample = con.execute('''SELECT f.tx_id,f.step_number AS step,t.type_name AS type,f.amount,
        f.orig_balance_delta,f.dest_balance_delta,f.is_fraud_actual AS label,f.model_version
        FROM fact_transactions f JOIN dim_transaction_type t ON f.type_key=t.type_key ORDER BY f.tx_id DESC LIMIT 8''').fetchdf()
    sample = sample.astype(object).where(pd.notnull(sample), None).to_dict('records')
    tables = {name: con.execute(f'SELECT count(*) FROM {name}').fetchone()[0]
              for name in ['fact_transactions', 'dim_time', 'dim_account', 'dim_transaction_type']}
    batches = con.execute('SELECT source,created_at,total,valid,rejected FROM ingestion_runs ORDER BY created_at DESC LIMIT 8').fetchall()
    return {'source': {'name': 'PaySim synthetic mobile-money sample', 'rows': len(source),
                       'fraud': int(source.isFraud.sum()) if 'isFraud' in source else None,
                       'first_step': int(source.step.min()) if len(source) else None,
                       'last_step': int(source.step.max()) if len(source) else None,
                       'columns': list(source.columns), 'url': 'https://github.com/EdgarLopezPhD/PaySim'},
            'warehouse': {'rows': int(totals[0]), 'confirmed': int(totals[1]), 'pending_labels': int(totals[2]),
                          'first_step': totals[3], 'last_step': totals[4]},
            'mining_quality': quality, 'by_type': types, 'sample': sample, 'tables': tables,
            'quality': run_quality_checks(con),
            'batches': [{'source':r[0], 'created_at':str(r[1]), 'total':r[2], 'valid':r[3], 'rejected':r[4]} for r in batches],
            'dictionary': [
                {'field':'step', 'meaning':'One simulated hour. Day 1 is steps 1–24; these are not calendar dates.'},
                {'field':'type', 'meaning':'Payment, transfer, cash out, debit or cash in.'},
                {'field':'amount', 'meaning':'Transaction value in unspecified local currency units.'},
                {'field':'nameOrig / nameDest', 'meaning':'Synthetic origin and destination account identifiers; not model features.'},
                {'field':'oldbalance* / newbalance*', 'meaning':'Account balances before and after a transaction; warehouse stores their changes.'},
                {'field':'isFraud', 'meaning':'Known synthetic fraud label: 1 = fraud, 0 = non-fraud. Missing labels stay pending.'},
                {'field':'isFlaggedFraud', 'meaning':'Source-system flag, separate from the label. Excluded from model features.'},
                {'field':'model_version', 'meaning':'Which fitted model scored an ingested row. Legacy flags retain their original version.'}],
            'grain': 'One fact row per ingestion of a transaction. Replaying the sample adds new ingestions.',
            'deduplication': 'Mining excludes identical step/type/amount/balance-change/label signatures. This is a demo safeguard, not a bank transaction identity.'}


@router.post('/rules')
async def rules(request: Request, params: RuleSettings):
    require_training_role(request)
    con = get_connection()
    frame, quality = warehouse_frame(con)
    if len(frame) < 20:
        raise HTTPException(400, 'At least 20 valid transactions are needed to mine associations.')
    if len(frame) > 20000:
        frame = frame.sample(20000, random_state=42)
    frame = frame.rename(columns={'label': 'is_fraud_actual'})
    mined = mine_window_rules(discretize_dataframe(frame), params.min_support, params.min_confidence)
    results = []
    if not mined.empty:
        for _, row in mined.sort_values(['lift', 'support'], ascending=False).iterrows():
            if row['lift'] >= params.min_lift and not any(str(item).startswith('isFraud=') for item in row['antecedents']):
                results.append(format_rule(row))
    report = {'run_id': f'apriori-{uuid4().hex[:10]}', 'kind': 'association', 'algorithm': 'Apriori',
              'created_at': datetime.now(timezone.utc).isoformat(), 'rows': len(frame),
              'settings': params.model_dump(), 'quality': quality, 'rules': results[:30], 'matching_rules': len(results),
              'explanation': 'Support is the share of all rows containing both sides. Confidence is the share of matching left-side rows also containing the right side. Lift compares that confidence with the overall right-side frequency. Association does not prove causation.'}
    con.execute('INSERT INTO mining_runs(run_id,kind,report_json) VALUES (?,?,?)', [report['run_id'], 'association', json.dumps(report)])
    con.execute('CHECKPOINT')
    return report
