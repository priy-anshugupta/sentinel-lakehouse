import pandas as pd
from mlxtend.frequent_patterns import fpgrowth, association_rules
import logging

logger = logging.getLogger(__name__)

def mine_window_rules(encoded_df: pd.DataFrame, min_support: float = 0.05, min_confidence: float = 0.5) -> pd.DataFrame:
    """Mines association rules from a one-hot encoded dataframe."""
    try:
        if encoded_df.empty:
            return pd.DataFrame()
            
        frequent_itemsets = fpgrowth(encoded_df, min_support=min_support, use_colnames=True)
        
        if frequent_itemsets.empty:
            return pd.DataFrame()
            
        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=min_confidence)
        return rules
    except Exception as e:
        logger.error(f"Error mining window rules: {e}")
        return pd.DataFrame()

def mine_drift_rules(con, drift_step: int, window_size: int = 200, min_support: float = 0.01, min_confidence: float = 0.5, min_lift: float = 1.5) -> dict:
    """Mines pre-drift and post-drift rules and computes the differences."""
    from .discretizer import discretize_dataframe
    
    try:
        # Query DuckDB for pre/post windows
        query = f"""
            SELECT f.amount, f.step_number AS step, dtt.type_name AS type,
                   f.orig_balance_delta, f.is_fraud_actual
            FROM fact_transactions f
            LEFT JOIN dim_transaction_type dtt ON f.type_key = dtt.type_key
            WHERE f.step_number >= {max(0, drift_step - window_size)} AND f.step_number < {drift_step}
        """
        pre_df = con.execute(query).df()
        
        query = f"""
            SELECT f.amount, f.step_number AS step, dtt.type_name AS type,
                   f.orig_balance_delta, f.is_fraud_actual
            FROM fact_transactions f
            LEFT JOIN dim_transaction_type dtt ON f.type_key = dtt.type_key
            WHERE f.step_number >= {drift_step} AND f.step_number < {drift_step + window_size}
        """
        post_df = con.execute(query).df()
        
        # Discretize
        pre_encoded = discretize_dataframe(pre_df)
        post_encoded = discretize_dataframe(post_df)
        
        # Mine rules
        pre_rules = mine_window_rules(pre_encoded, min_support, min_confidence)
        post_rules = mine_window_rules(post_encoded, min_support, min_confidence)
        
        # Compute diff
        return compute_rule_diff(pre_rules, post_rules, min_lift)
    except Exception as e:
        logger.error(f"Error mining drift rules: {e}")
        return {'emerged': [], 'extinct': [], 'shifted': [], 'summary': {}}

def format_rule(rule_row) -> dict:
    """Formats a pandas rule row into a JSON-serializable dictionary."""
    return {
        'antecedents': list(rule_row['antecedents']),
        'consequents': list(rule_row['consequents']),
        'support': float(rule_row['support']),
        'confidence': float(rule_row['confidence']),
        'lift': float(rule_row['lift'])
    }

def get_rule_id(rule_row) -> str:
    """Generates a unique ID for a rule based on antecedents and consequents."""
    ant = sorted(list(rule_row['antecedents']))
    con = sorted(list(rule_row['consequents']))
    return f"{','.join(ant)} -> {','.join(con)}"

def compute_rule_diff(pre_rules: pd.DataFrame, post_rules: pd.DataFrame, min_lift: float = 1.0) -> dict:
    """Computes the difference between two rule sets to identify drift semantics."""
    try:
        emerged = []
        extinct = []
        shifted = []
        
        # Filter by lift and fraud consequents if rules are not empty
        def filter_rules(rules_df):
            if rules_df.empty:
                return {}
            
            rules_df = rules_df[rules_df['lift'] >= min_lift]
            rule_dict = {}
            for _, row in rules_df.iterrows():
                consequents = list(row['consequents'])
                # Consider rules where consequent implies Fraud if available, or just general rules
                if any('FRAUD' in str(c).upper() for c in consequents):
                    rid = get_rule_id(row)
                    rule_dict[rid] = format_rule(row)
            return rule_dict

        pre_dict = filter_rules(pre_rules)
        post_dict = filter_rules(post_rules)
        
        pre_keys = set(pre_dict.keys())
        post_keys = set(post_dict.keys())
        
        for k in post_keys - pre_keys:
            emerged.append(post_dict[k])
            
        for k in pre_keys - post_keys:
            extinct.append(pre_dict[k])
            
        for k in pre_keys.intersection(post_keys):
            pre_r = pre_dict[k]
            post_r = post_dict[k]
            # Check for significant shift in confidence or lift
            if abs(pre_r['confidence'] - post_r['confidence']) > 0.1 or abs(pre_r['lift'] - post_r['lift']) > 0.5:
                shifted.append({
                    'rule': pre_r, # Include base rule structure
                    'pre_support': pre_r['support'],
                    'post_support': post_r['support'],
                    'pre_confidence': pre_r['confidence'],
                    'post_confidence': post_r['confidence'],
                    'pre_lift': pre_r['lift'],
                    'post_lift': post_r['lift']
                })
                
        # Sort by lift
        emerged.sort(key=lambda x: x['lift'], reverse=True)
        extinct.sort(key=lambda x: x['lift'], reverse=True)
        shifted.sort(key=lambda x: abs(x['post_lift'] - x['pre_lift']), reverse=True)
        
        return {
            'emerged': emerged[:10], # Top 10
            'extinct': extinct[:10],
            'shifted': shifted[:10],
            'summary': {
                'total_emerged': len(emerged),
                'total_extinct': len(extinct),
                'total_shifted': len(shifted)
            }
        }
    except Exception as e:
        logger.error(f"Error computing rule diff: {e}")
        return {'emerged': [], 'extinct': [], 'shifted': [], 'summary': {}}

def generate_narrative(rule_diff: dict, drift_step: int) -> str:
    """Generates a plain-English narrative for the detected drift."""
    try:
        emerged = rule_diff.get('emerged', [])
        extinct = rule_diff.get('extinct', [])
        
        narrative_parts = [f"Concept drift detected around step {drift_step}."]
        
        if emerged:
            top_emerged = emerged[0]
            ant_str = " AND ".join(top_emerged['antecedents'])
            con_str = " AND ".join(top_emerged['consequents'])
            narrative_parts.append(
                f"A new prominent fraud pattern emerged: When {ant_str}, it often leads to {con_str} "
                f"(Confidence: {top_emerged['confidence']:.2f}, Lift: {top_emerged['lift']:.2f})."
            )
            
        if extinct:
            top_extinct = extinct[0]
            ant_str = " AND ".join(top_extinct['antecedents'])
            narrative_parts.append(
                f"Previously seen fraud patterns involving {ant_str} have become significantly less common."
            )
            
        if not emerged and not extinct:
            narrative_parts.append("The drift did not produce easily extractable categorical rules, suggesting a subtle statistical shift rather than a categorical pattern change.")
            
        return " ".join(narrative_parts)
    except Exception as e:
        logger.error(f"Error generating narrative: {e}")
        return f"Concept drift detected around step {drift_step}, but narrative generation failed."
