"""Persist detected changes so the monitor and pattern analysis use the same event."""


def store_drift_event(con, drift_info: dict, *, is_injected: bool = False) -> int:
    step = int(drift_info["drift_step"])
    row = con.execute(
        """
        INSERT INTO fact_drift_events
          (detected_at_step, pre_window_start, pre_window_end,
           post_window_start, post_window_end, error_rate_before,
           error_rate_after, is_injected, rules_json, model_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING drift_id
        """,
        (
            step, max(0, step - 200), step, step, step + 200,
            float(drift_info.get("error_rate_before", 0.0)),
            float(drift_info.get("error_rate_after", 0.0)),
            is_injected, "{}", drift_info.get('model_version','legacy-online'),
        ),
    ).fetchone()
    return int(row[0])
