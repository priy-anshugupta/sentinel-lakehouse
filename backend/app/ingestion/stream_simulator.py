import asyncio
import os
import pandas as pd
from typing import AsyncGenerator, Optional, Union, Callable, Dict, Any

class StreamSimulator:
    def __init__(self, csv_path: str, batch_size: int = 1, drift_injection_step: int = 350):
        self.csv_path = csv_path
        self.batch_size = batch_size
        self.drift_injection_step = drift_injection_step
        self._current_step = 1
        self._current_index = 0
        self._is_injected = False
        self._drift_armed = False
        self._total_yielded = 0
        self._df: Optional[pd.DataFrame] = None
    
    @property
    def current_step(self) -> int:
        return self._current_step
        
    @property
    def is_injected(self) -> bool:
        return self._is_injected
        
    @property
    def total_yielded(self) -> int:
        return self._total_yielded

    def arm_drift(self):
        self._drift_armed = True
        self._is_injected = True

    def reset(self):
        self._current_step = 1
        self._current_index = 0
        self._is_injected = False
        self._drift_armed = False
        self._total_yielded = 0
        self._df = None

    def inject_drift(self, row: dict, current_step: int) -> dict:
        # Trigger if past drift step OR if user explicitly armed drift
        if (current_step >= self.drift_injection_step or self._drift_armed) and row.get('isFraud') == 1:
            row['type'] = 'TRANSFER'
            original_amount = float(row.get('amount', 0.0))
            row['amount'] = round(original_amount * 0.4, 2)
            
            # Partial drain: new balance = old_balance - new_amount (leaving ~85% remaining)
            if 'oldbalanceOrg' in row and 'newbalanceOrig' in row:
                row['newbalanceOrig'] = round(max(0.0, float(row['oldbalanceOrg']) - float(row['amount'])), 2)
            
            self._is_injected = True
        return row

    def _ensure_loaded(self):
        if self._df is None or len(self._df) == 0:
            if not os.path.exists(self.csv_path):
                raise FileNotFoundError(f"CSV file not found: {self.csv_path}")
            self._df = pd.read_csv(self.csv_path)
            if 'step' in self._df.columns:
                self._df = self._df.sort_values(by='step').reset_index(drop=True)

    async def replay(self, speed: Union[int, float, Dict[str, Any], Callable[[], float]] = 200) -> AsyncGenerator[list[dict], None]:
        self._ensure_loaded()
        total_rows = len(self._df)
        if total_rows == 0:
            return

        while True:
            # Check bounds and loop seamlessly from step 1 to 744
            if self._current_index >= total_rows:
                self._current_index = 0
                self._current_step = 1

            end_idx = min(self._current_index + self.batch_size, total_rows)
            chunk = self._df.iloc[self._current_index:end_idx]
            self._current_index = end_idx

            batch = []
            for _, row in chunk.iterrows():
                row_dict = row.to_dict()
                step = int(row_dict.get('step', self._current_step))
                self._current_step = step
                
                row_dict = self.inject_drift(row_dict, self._current_step)
                batch.append(row_dict)

            if batch:
                self._total_yielded += len(batch)
                yield batch

            # Dynamic speed evaluation without task recreation
            if callable(speed):
                curr_speed = speed()
            elif isinstance(speed, dict):
                curr_speed = speed.get('val', 200)
            else:
                curr_speed = speed

            delay_ms = float(curr_speed) if curr_speed and curr_speed > 0 else 200.0
            delay_sec = max(0.005, delay_ms / 1000.0)
            await asyncio.sleep(delay_sec)
