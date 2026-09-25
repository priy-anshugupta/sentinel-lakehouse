from river import drift
import time
import logging

logger = logging.getLogger(__name__)

class DriftDetector:
    def __init__(self, delta: float = 0.002, min_burn_in: int = 100):
        try:
            self.adwin = drift.ADWIN(delta=delta)
            self.delta = delta
            self.min_burn_in = min_burn_in
            self.total_updates = 0
            self.drift_events = []  # list of dicts with drift info
            self._pre_drift_errors = []  # rolling errors before drift for stats
        except Exception as e:
            logger.error(f"Failed to initialize DriftDetector: {e}")
            raise
    
    def update(self, error: int, current_step: int) -> dict | None:
        try:
            self.total_updates += 1
            self._pre_drift_errors.append(error)
            
            # Keep a rolling buffer of last 1000 errors for pre-drift stats
            if len(self._pre_drift_errors) > 1000:
                self._pre_drift_errors.pop(0)
            
            self.adwin.update(error)
            
            if self.adwin.drift_detected and self.total_updates > self.min_burn_in:
                pre_len = max(len(self._pre_drift_errors[-200:-50]), 1)
                post_len = max(len(self._pre_drift_errors[-50:]), 1)
                
                event = {
                    'drift_step': current_step,
                    'detected_at': time.time(),
                    'estimation': round(self.adwin.estimation, 4),
                    'width': self.adwin.width,
                    'total_samples': self.adwin.total,
                    'error_rate_before': round(sum(self._pre_drift_errors[-200:-50]) / pre_len, 4),
                    'error_rate_after': round(sum(self._pre_drift_errors[-50:]) / post_len, 4),
                }
                self.drift_events.append(event)
                return event
            return None
        except Exception as e:
            logger.error(f"Error updating drift detector: {e}")
            return None
    
    def reset(self):
        self.__init__(delta=self.delta, min_burn_in=self.min_burn_in)
