import pandas as pd
import logging

logger = logging.getLogger(__name__)

AMOUNT_BINS = {
    "MICRO": (0, 1_000),
    "LOW": (1_000, 50_000),
    "MEDIUM": (50_000, 200_000),
    "HIGH": (200_000, 1_000_000),
    "VERY_HIGH": (1_000_000, float("inf"))
}

TIME_BINS = {
    "LATE_NIGHT": (0, 6),
    "MORNING": (6, 12),
    "AFTERNOON": (12, 18),
    "EVENING": (18, 24)
}

def get_amount_bin(amount: float) -> str:
    for label, (low, high) in AMOUNT_BINS.items():
        if low <= amount < high:
            return label
    return "VERY_HIGH"

def get_time_bin(hour: int) -> str:
    for label, (low, high) in TIME_BINS.items():
        if low <= hour < high:
            return label
    return "EVENING"

def get_drain_type(old_bal: float, new_bal: float) -> str:
    if old_bal > 0 and new_bal == 0:
        return "FULL_DRAIN"
    elif old_bal > 0 and 0 < new_bal <= old_bal * 0.1:
        return "HEAVY_DRAIN"
    elif old_bal > 0 and new_bal > old_bal * 0.1:
        return "PARTIAL"
    elif old_bal == 0 and new_bal == 0:
        return "ZERO_BALANCE"
    elif new_bal > old_bal:
        return "DEPOSIT"
    return "UNKNOWN"


def discretize_transaction(row: dict) -> dict:
    """Discretizes a transaction dict into categorical items matching PRD."""
    try:
        amount = float(row.get('amount', 0))
        hour = int(row.get('step', 0)) % 24
        
        if 'oldbalanceOrg' in row and 'newbalanceOrig' in row:
            old_bal = float(row.get('oldbalanceOrg', 0))
            new_bal = float(row.get('newbalanceOrig', 0))
        else:
            old_bal = 0.0
            new_bal = 0.0

        amount_bin = get_amount_bin(amount)
        time_period = get_time_bin(hour)
        drain_type = get_drain_type(old_bal, new_bal)
        
        return {
            'type': str(row.get('type', 'UNKNOWN')).upper(),
            'amount_bin': amount_bin,
            'time_period': time_period,
            'drain_type': drain_type
        }
    except Exception as e:
        logger.error(f"Error discretizing transaction: {e}")
        return {}


def discretize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Discretizes a DataFrame and returns one-hot encoded format suitable for FP-Growth."""
    try:
        if df.empty:
            return pd.DataFrame()
            
        discretized_rows = []
        for _, row in df.iterrows():
            d_row = discretize_transaction(row.to_dict())
            if 'isFraud' in row:
                d_row['isFraud'] = 'FRAUD' if int(row['isFraud']) == 1 else 'LEGIT'
            discretized_rows.append(d_row)
            
        df_disc = pd.DataFrame(discretized_rows)
        if df_disc.empty:
            return df_disc
            
        # One-hot encode the categorical variables
        df_encoded = pd.get_dummies(df_disc, prefix_sep='=')
        
        # FP-Growth in mlxtend requires boolean values
        df_encoded = df_encoded.astype(bool)
        
        return df_encoded
    except Exception as e:
        logger.error(f"Error discretizing dataframe: {e}")
        return pd.DataFrame()
