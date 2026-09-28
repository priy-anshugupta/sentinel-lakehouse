"""Focused checks for the manager analytics and role boundary."""
import os
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

_data_dir = tempfile.TemporaryDirectory()
os.environ["SENTINEL_WAREHOUSE_PATH"] = str(Path(_data_dir.name) / "test.duckdb")

from app.main import app  # noqa: E402 - import after the temporary path is configured


class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        _data_dir.cleanup()

    def token(self, email):
        response = self.client.post("/api/auth/login", json={
            "email": email, "password": "SentinelDemo!2026"})
        self.assertEqual(response.status_code, 200)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_authentication_and_role_boundary(self):
        self.assertEqual(self.client.get("/api/metrics/overview").status_code, 401)
        bad = self.client.post("/api/auth/login", json={"email": "manager@sentinel.demo", "password": "wrong"})
        self.assertEqual(bad.status_code, 401)
        manager = self.token("manager@sentinel.demo")
        self.assertEqual(self.client.get("/api/warehouse/stats", headers=manager).status_code, 403)
        self.assertEqual(self.client.get("/api/mining/drift-events", headers=manager).status_code, 403)
        engineer = self.token("engineer@sentinel.demo")
        self.assertEqual(self.client.get("/api/warehouse/stats", headers=engineer).status_code, 200)

    def test_warehouse_totals_match_olap_and_week_zero_drill(self):
        manager = self.token("manager@sentinel.demo")
        overview = self.client.get("/api/metrics/overview", headers=manager).json()
        weekly = self.client.post("/api/olap/query", headers=manager, json={
            "operation": "ROLLUP", "granularity": "WEEK"}).json()["data"]
        self.assertEqual(overview["summary"]["transactions"], sum(row["tx_count"] for row in weekly))
        self.assertEqual(overview["summary"]["confirmed"], sum(row["fraud_count"] or 0 for row in weekly))
        if any(row["period"] == 0 for row in weekly):
            days = self.client.post("/api/olap/query", headers=manager, json={
                "operation": "DRILLDOWN", "granularity": "WEEK", "step_range_start": 0}).json()["data"]
            self.assertGreater(len(days), 0)

    def test_month_rollup_and_filtered_window_reconcile_to_facts(self):
        from app.warehouse.connection import get_connection

        manager = self.token("manager@sentinel.demo")
        con = get_connection()
        response = self.client.post("/api/olap/query", headers=manager, json={
            "operation": "ROLLUP", "granularity": "MONTH",
            "step_range_start": 1, "step_range_end": 720,
        })
        self.assertEqual(response.status_code, 200)
        rows = response.json()["data"]
        expected = con.execute("""
            SELECT count(*), coalesce(sum(is_fraud_actual), 0)
            FROM fact_transactions WHERE step_number BETWEEN 1 AND 720
        """).fetchone()
        self.assertEqual(sum(row["tx_count"] for row in rows), expected[0])
        self.assertEqual(sum(row["fraud_count"] or 0 for row in rows), expected[1])
        self.assertTrue(all(row["period"] == 1 for row in rows))

        scoped = self.client.post("/api/olap/query", headers=manager, json={
            "operation": "ROLLUP", "granularity": "WEEK",
            "type_filter": "CASH_OUT", "step_range_start": 1, "step_range_end": 168,
        })
        self.assertEqual(scoped.status_code, 200)
        expected_cashout = con.execute("""
            SELECT count(*) FROM fact_transactions f
            JOIN dim_transaction_type t ON f.type_key = t.type_key
            WHERE f.step_number BETWEEN 1 AND 168 AND t.type_name = 'CASH_OUT'
        """).fetchone()[0]
        self.assertEqual(sum(row["tx_count"] for row in scoped.json()["data"]), expected_cashout)

        drill = self.client.post("/api/olap/query", headers=manager, json={
            "operation": "DRILLDOWN", "granularity": "MONTH", "step_range_start": 1,
        })
        self.assertEqual(drill.status_code, 200)
        self.assertEqual(sum(row["tx_count"] for row in drill.json()["data"]), expected[0])


if __name__ == "__main__":
    unittest.main()
