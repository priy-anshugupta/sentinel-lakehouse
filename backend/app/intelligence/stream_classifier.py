"""Warehouse-trained CART classifier. The class name preserves ingest callers."""
from collections import deque
import numpy as np

TYPES = ['PAYMENT', 'TRANSFER', 'CASH_OUT', 'DEBIT', 'CASH_IN']
FEATURES = ['Amount', 'Origin balance change', 'Destination balance change'] + [f'Type: {t}' for t in TYPES]


def feature_matrix(frame):
    numeric = frame[['amount', 'orig_balance_delta', 'dest_balance_delta']].to_numpy(dtype=float)
    categories = np.column_stack([(frame['type'] == t).to_numpy(dtype=float) for t in TYPES])
    return np.column_stack([numeric, categories])


class RollingMetric:
    def __init__(self, kind):
        self.kind = kind
        self.values = deque(maxlen=500)

    def update(self, actual, prediction):
        self.values.append((actual, prediction))

    def get(self):
        if not self.values:
            return 0.0
        if self.kind == 'accuracy':
            return sum(a == p for a, p in self.values) / len(self.values)
        tp = sum(a == p == 1 for a, p in self.values)
        denominator = sum(a == 1 for a, _ in self.values) + sum(p == 1 for _, p in self.values)
        return 2 * tp / denominator if denominator else 0.0


class StreamClassifier:
    def __init__(self, warm_start=True):
        self.model = None
        self.version = None
        self.total_samples = 0
        self.rolling_accuracy = RollingMetric('accuracy')
        self.rolling_f1 = RollingMetric('f1')

    def activate(self, model, version):
        self.model, self.version = model, version
        self.total_samples = 0
        self.rolling_accuracy = RollingMetric('accuracy')
        self.rolling_f1 = RollingMetric('f1')

    def predict_and_learn(self, features, label=None):
        # Compatibility name only: CART weights never update during ingestion.
        if self.model is None:
            raise ValueError('Train a decision tree in Model lab before scoring transactions.')
        tx_type = str(features.get('type', '')).upper()
        values = [float(features.get('amount', 0)),
                  float(features.get('newbalanceOrig', 0)) - float(features.get('oldbalanceOrg', 0)),
                  float(features.get('newbalanceDest', 0)) - float(features.get('oldbalanceDest', 0))]
        values += [float(tx_type == t) for t in TYPES]
        x = np.array([values])
        if not np.isfinite(x).all() or values[0] < 0 or tx_type not in TYPES:
            raise ValueError('Invalid transaction features')
        probabilities = self.model.predict_proba(x)[0]
        class_index = list(self.model.classes_).index(1) if 1 in self.model.classes_ else None
        probability = float(probabilities[class_index]) if class_index is not None else 0.0
        prediction = int(self.model.predict(x)[0])
        error = None
        if label is not None:
            error = int(prediction != label)
            self.rolling_accuracy.update(label, prediction)
            self.rolling_f1.update(label, prediction)
            self.total_samples += 1
        return {'prediction': prediction, 'fraud_probability': round(probability, 4),
                'error': error, 'accuracy': self.rolling_accuracy.get() if self.total_samples else None,
                'f1': self.rolling_f1.get() if self.total_samples else None,
                'total_samples': self.total_samples, 'model_version': self.version}

    def reset(self):
        self.activate(self.model, self.version)
