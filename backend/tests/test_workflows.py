"""Focused checks for the manager analytics and role boundary."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

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
        self.assertEqual(self.client.get("/api/mining/drift-events", headers=manager).status_code, 200)
        engineer = self.token("engineer@sentinel.demo")
        self.assertEqual(self.client.get("/api/warehouse/stats", headers=engineer).status_code, 200)

    def test_internal_tools_are_engineer_only(self):
        for email in ('manager@sentinel.demo','investigator@sentinel.demo'):
            headers=self.token(email)
            for path in ('/api/learning/status','/api/learning/dataset','/api/warehouse/stats'):
                self.assertEqual(self.client.get(path,headers=headers).status_code,403,path)
            self.assertEqual(self.client.post('/api/mining/rules',headers=headers,json={}).status_code,403)
            self.assertEqual(self.client.get('/api/metrics/overview',headers=headers).status_code,200)
            report=self.client.post('/api/olap/query',headers=headers,json={'operation':'ROLLUP','granularity':'WEEK'})
            self.assertEqual(report.status_code,200)
            self.assertEqual(report.json()['sql'],'')
        engineer=self.token('engineer@sentinel.demo')
        self.assertEqual(self.client.get('/api/learning/status',headers=engineer).status_code,200)

    def test_cart_holdout_persistence_and_role_boundary(self):
        from app.intelligence.model_lab import restore_or_train
        from app.intelligence.stream_classifier import StreamClassifier
        from app.warehouse.connection import get_connection
        manager = self.token('manager@sentinel.demo')
        self.assertEqual(self.client.post('/api/learning/train', headers=manager, json={}).status_code, 403)
        investigator = self.token('investigator@sentinel.demo')
        self.assertEqual(self.client.post('/api/learning/train', headers=investigator, json={}).status_code,403)
        engineer = self.token('engineer@sentinel.demo')
        response = self.client.post('/api/learning/train', headers=engineer, json={'max_depth':3})
        self.assertEqual(response.status_code, 200, response.text)
        report = response.json()
        self.assertLess(report['split']['train_end'], report['split']['test_start'])
        matrix = report['metrics']
        self.assertEqual(sum(matrix[key] for key in ('tn','fp','fn','tp')), report['split']['test_rows'])
        con = get_connection()
        saved = con.execute('SELECT count(*) FROM fact_model_evaluations WHERE run_id=?', [report['run_id']]).fetchone()[0]
        self.assertEqual(saved, report['split']['test_rows'])
        restored = StreamClassifier()
        restore_or_train(con, restored)
        self.assertEqual(restored.version, report['run_id'])
        self.assertEqual(restored.model.tree_.node_count, app.state.classifier.model.tree_.node_count)
        before = app.state.classifier.model.tree_.threshold.copy()
        app.state.classifier.predict_and_learn({'type':'TRANSFER','amount':200,'oldbalanceOrg':300,'newbalanceOrig':100}, label=1)
        self.assertTrue((before == app.state.classifier.model.tree_.threshold).all())

    def test_clustering_uses_no_label_features_and_saves_memberships(self):
        from app.warehouse.connection import get_connection
        investigator = self.token('investigator@sentinel.demo')
        engineer = self.token('engineer@sentinel.demo')
        response = self.client.post('/api/learning/cluster', headers=engineer, json={'k':3})
        self.assertEqual(response.status_code, 200, response.text)
        report = response.json()
        self.assertEqual(sum(g['rows'] for g in report['groups']), report['rows'])
        self.assertTrue(-1 <= report['silhouette'] <= 1)
        saved = get_connection().execute('SELECT count(*) FROM fact_cluster_assignments WHERE run_id=?', [report['run_id']]).fetchone()[0]
        self.assertEqual(saved, report['rows'])
        # Replacing known labels must not change the unsupervised mapping.
        from app.intelligence.stream_classifier import feature_matrix
        from app.intelligence.model_lab import warehouse_frame
        frame, _ = warehouse_frame(get_connection())
        original = feature_matrix(frame)
        frame['label'] = 1 - frame['label']
        self.assertTrue((original == feature_matrix(frame)).all())

    def test_csv_validation_final_step_and_pending_predictions(self):
        from app.warehouse.connection import get_connection
        engineer = self.token('engineer@sentinel.demo')
        csv = ('step,type,amount,oldbalanceOrg,newbalanceOrig,oldbalanceDest,newbalanceDest,isFraud,nameOrig,nameDest\n'
               '750,TRANSFER,100,200,100,0,100,,C_TEST_ORIG,C_TEST_DEST\n'
               '744,PAYMENT,-1,200,100,0,100,0,C_BAD,M_BAD\n'
               '744,PAYMENT,100,200,100,0,100,3,C_BAD,M_BAD\n')
        response = self.client.post('/api/ingest/csv', headers=engineer, files={'file':('validation.csv',csv,'text/csv')})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['valid'], 1)
        self.assertEqual(response.json()['rejected'], 2)
        con = get_connection()
        self.assertEqual(con.execute('SELECT count(*) FROM dim_time WHERE step IN (744,750)').fetchone()[0], 2)
        self.assertEqual(con.execute('SELECT day_number,hour_of_day FROM dim_time WHERE step=744').fetchone(), (31,23))
        self.assertEqual(con.execute('SELECT count(*) FROM dim_account WHERE account_id=?',['C_TEST_ORIG']).fetchone()[0],1)

    def test_pivot_and_dice_preserve_filtered_totals(self):
        from app.warehouse.connection import get_connection
        manager = self.token('manager@sentinel.demo')
        response = self.client.get('/api/olap/pivot', headers=manager, params={
            'row_dim':'day_number','col_dim':'type_name','measure':'tx_count',
            'type_filter':'CASH_OUT','step_range_start':1,'step_range_end':168})
        self.assertEqual(response.status_code,200,response.text)
        expected = get_connection().execute('''SELECT count(*) FROM fact_transactions f
            JOIN dim_transaction_type t ON f.type_key=t.type_key
            WHERE t.type_name='CASH_OUT' AND f.step_number BETWEEN 1 AND 168''').fetchone()[0]
        self.assertEqual(sum(sum(v or 0 for k,v in row.items() if k!='row_label') for row in response.json()['data']), expected)
        dice = self.client.post('/api/olap/query', headers=manager, json={
            'operation':'DICE','granularity':'DAY','type_filters':['CASH_OUT'],
            'step_range_start':1,'step_range_end':168})
        self.assertEqual(dice.status_code,200,dice.text)
        self.assertEqual(sum(r['tx_count'] for r in dice.json()['data']),expected)

    def test_dataset_and_association_evidence_are_warehouse_backed(self):
        engineer = self.token('engineer@sentinel.demo')
        dataset = self.client.get('/api/learning/dataset',headers=engineer)
        self.assertEqual(dataset.status_code,200,dataset.text)
        self.assertEqual(dataset.json()['warehouse']['rows'],dataset.json()['tables']['fact_transactions'])
        rules = self.client.post('/api/learning/rules',headers=engineer,json={})
        self.assertEqual(rules.status_code,200,rules.text)
        for rule in rules.json()['rules']:
            self.assertTrue(0 <= rule['support'] <= 1)
            self.assertTrue(0 <= rule['confidence'] <= 1)
            self.assertGreaterEqual(rule['lift'],1.2)
            self.assertFalse(any(item.startswith('isFraud=') for item in rule['antecedents']))

    def test_complete_bundled_sample_import_is_idempotent(self):
        engineer = self.token('engineer@sentinel.demo')
        manager = self.token('manager@sentinel.demo')
        self.assertEqual(self.client.post('/api/ingest/bundled',headers=manager,json={}).status_code,403)
        first = self.client.post('/api/ingest/bundled',headers=engineer,json={})
        self.assertEqual(first.status_code,200,first.text)
        rows = self.client.get('/api/learning/dataset',headers=engineer).json()['warehouse']['rows']
        second = self.client.post('/api/ingest/bundled',headers=engineer,json={})
        self.assertEqual(second.status_code,200,second.text)
        self.assertEqual(second.json()['valid'],0)
        self.assertEqual(self.client.get('/api/learning/dataset',headers=engineer).json()['warehouse']['rows'],rows)

    def test_new_alert_feed_uses_saved_transactions_and_drift(self):
        manager = self.token("manager@sentinel.demo")
        engineer = self.token("engineer@sentinel.demo")
        baseline = self.client.get("/api/alerts/changes", headers=manager)
        self.assertEqual(baseline.status_code, 200)
        self.assertEqual(baseline.json()["transactions"], [])
        cursor = baseline.json()

        with patch.object(app.state.classifier, "predict_and_learn", return_value={
            "prediction": 1, "fraud_probability": 0.92, "error": 0,
        }), patch.object(app.state.drift_detector, "update", return_value={
            "drift_step": 42, "error_rate_before": 0.02, "error_rate_after": 0.25,
        }):
            ingested = self.client.post("/api/ingest/single", headers=engineer, json={
                "step": 42, "type": "TRANSFER", "amount": 100.0,
                "oldbalanceOrg": 100.0, "newbalanceOrig": 0.0,
                "oldbalanceDest": 0.0, "newbalanceDest": 100.0, "isFraud": 1,
            })
        self.assertEqual(ingested.status_code, 200, ingested.text)
        changes = self.client.get("/api/alerts/changes", headers=manager, params={
            "after_tx_id": cursor["next_tx_id"],
            "after_drift_id": cursor["next_drift_id"],
        })
        self.assertEqual(changes.status_code, 200)
        self.assertEqual(changes.json()["transactions"][0]["tx_id"], ingested.json()["tx_id"])
        self.assertEqual(changes.json()["transactions"][0]["is_fraud_prediction"], 1)
        self.assertEqual(changes.json()["transactions"][0]["isFraud"], 1)
        self.assertEqual(changes.json()["drift_events"][0]["drift_id"], ingested.json()["drift_id"])

    def test_detected_change_is_saved_for_pattern_analysis(self):
        engineer = self.token("engineer@sentinel.demo")
        with patch.object(app.state.drift_detector, "update", return_value={
            "drift_step": 40, "error_rate_before": 0.05, "error_rate_after": 0.30,
        }):
            response = self.client.post("/api/ingest/single", headers=engineer, json={
                "step": 40, "type": "TRANSFER", "amount": 100.0,
                "oldbalanceOrg": 200.0, "newbalanceOrig": 100.0,
                "oldbalanceDest": 0.0, "newbalanceDest": 100.0, "isFraud": 1,
            })
        self.assertEqual(response.status_code, 200, response.text)
        event_id = response.json()["drift_id"]
        self.assertTrue(response.json()["drift_detected"])
        self.assertIsInstance(event_id, int)
        events = self.client.get("/api/mining/drift-events", headers=engineer).json()
        self.assertTrue(any(event["drift_id"] == event_id for event in events))
        self.assertEqual(events[0]["drift_id"], event_id)
        comparison = self.client.get(f"/api/mining/drift-comparison/{event_id}", headers=engineer)
        self.assertEqual(comparison.status_code, 200)
        self.assertEqual(comparison.json()["step"], 40)
        manager = self.token("manager@sentinel.demo")
        self.assertEqual(self.client.get(f"/api/mining/drift-comparison/{event_id}", headers=manager).status_code, 200)
        self.assertEqual(self.client.get("/api/warehouse/stats", headers=manager).status_code, 403)

    def test_latest_flagged_rows_search_the_whole_warehouse(self):
        manager = self.token("manager@sentinel.demo")
        recent = self.client.get("/api/stream/recent", headers=manager, params={"limit": 10}).json()["transactions"]
        flagged = self.client.get("/api/stream/recent", headers=manager, params={
            "limit": 10, "flagged_only": True,
        }).json()["transactions"]
        self.assertEqual(len(recent), 10)
        self.assertTrue(flagged)
        self.assertTrue(all(row["isFraudPrediction"] for row in flagged))
        self.assertEqual([row["tx_id"] for row in flagged], sorted((row["tx_id"] for row in flagged), reverse=True))

    def test_live_monitor_uses_the_warehouse_transaction_id(self):
        engineer = self.token("engineer@sentinel.demo")
        token = engineer["Authorization"].removeprefix("Bearer ")
        with self.client.websocket_connect(f"/ws/stream?token={token}") as socket:
            socket.send_json({"action": "start"})
            message = socket.receive_json()
            self.assertEqual(message["type"], "transaction")
            tx_id = message["data"]["tx_id"]
            self.assertIsInstance(tx_id, int)
        recent = self.client.get("/api/stream/recent", headers=engineer, params={"limit": 5}).json()["transactions"]
        self.assertIn(tx_id, [row["tx_id"] for row in recent])

    def test_unknown_label_does_not_train_or_become_not_fraud(self):
        from app.warehouse.connection import get_connection

        engineer = self.token("engineer@sentinel.demo")
        before_samples = app.state.classifier.total_samples
        response = self.client.post("/api/ingest/single", headers=engineer, json={
            "step": 41, "type": "TRANSFER", "amount": 200.0,
            "oldbalanceOrg": 400.0, "newbalanceOrig": 200.0,
            "oldbalanceDest": 0.0, "newbalanceDest": 200.0, "isFraud": None,
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(app.state.classifier.total_samples, before_samples)
        tx_id = response.json()["tx_id"]
        label, error = get_connection().execute(
            "SELECT is_fraud_actual, prediction_error FROM fact_transactions WHERE tx_id=?", [tx_id]
        ).fetchone()
        self.assertIsNone(label)
        self.assertIsNone(error)
        recent = self.client.get("/api/stream/recent", headers=engineer, params={"limit": 1}).json()["transactions"]
        self.assertEqual(recent[0]["tx_id"], tx_id)
        self.assertIsNone(recent[0]["is_fraud_actual"])

    def test_replay_reset_keeps_model_learning(self):
        investigator = self.token("investigator@sentinel.demo")
        before_samples = app.state.classifier.total_samples
        response = self.client.post("/api/stream/control", headers=investigator, json={"action": "RESET"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(app.state.classifier.total_samples, before_samples)

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
