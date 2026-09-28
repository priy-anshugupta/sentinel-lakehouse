# Sentinel

Sentinel is a **banking risk analytics demonstration** built with React, FastAPI, DuckDB, and River. It replays synthetic PaySim transactions, scores them with an online classifier, stores them at transaction grain in a dimensional warehouse, and lets managers inspect confirmed fraud, model flags, and changes over simulated time.

The included warehouse contains a **small ingested sample**. PaySim's full public dataset is larger, but this repository does not contain all of it. Row counts change when the local simulation or importer runs. PaySim amounts are denominated in an unspecified local currency, so the UI displays **local units**, not ₹ or dollars. Each `step` represents a simulated hour; these are not calendar dates.

## What a banker can do

- **Overview:** see confirmed fraud, model flags, alert precision, recall, weekly patterns, and recent transactions from one warehouse snapshot.
- **Reports:** type a supported question such as “Show one month of transaction data” or choose a common report. Review the interpreted OLAP operation, its scope, warehouse totals, SQL, and exportable results.
- **Explore data:** group by simulated month, week, day, or hour; filter by transaction type or day/night; drill into finer periods; inspect the SQL and export rows.
- **Transaction monitor:** replay synthetic events through the online classifier and see predictions beside known dataset labels.
- **Pattern analysis:** compare equal windows around a recorded drift event and inspect mined associations when thresholds are met.
- **Warehouse health:** inspect row counts, schema columns, and data quality checks.
- **Import data:** score one transaction or ingest PaySim-format CSV as an engineer.

The app separates **confirmed fraud** (the PaySim label) from **flagged for review** (the model prediction). In the supplied sample, these diverge considerably, so a flag should never be described as proof of fraud. No case-management, investigation disposition, suspicious-activity filing, or real banking integration is implemented.

## Why a dimensional warehouse

`fact_transactions` has one row per ingested transaction. It holds measures and prediction outcomes, with keys to `dim_time`, `dim_transaction_type`, and origin/destination `dim_account`. This grain lets a manager ask useful questions such as “Did confirmed cash-out fraud rise by week?” and drill from a weekly total into days without counting the same transaction twice. `fact_drift_events` records model-change events separately. The app uses DuckDB to aggregate these facts across dimensions; the analyst-facing pages expose the SQL so figures can be checked.

This follows the [Kimball dimensional modeling techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/). The decision to expose source, grain, and quality alongside risk figures is informed by the [Basel Committee's risk-data reporting principles](https://www.bis.org/publ/bcbs239.pdf). The dataset semantics come from the [PaySim dataset description](https://www.kaggle.com/datasets/ealaxi/paysim1).

### Question to OLAP example

“Show one month of transaction data” is interpreted as a **ROLLUP to a 30-day simulation month** over steps 1–720. The API filters those steps and groups the transaction fact table using a fixed SQL expression. “Show cash-out fraud by week for the first month” adds a transaction-type **slice**, then rolls up by simulation week over the same step range. “Last 7 days” ends at the warehouse's latest ingested step. The Reports page shows this interpretation and warns when only part of a requested range is present. The language interface uses a constrained, auditable grammar; unsupported dimensions produce an explanation rather than a guessed answer. A simulation month is not a calendar month.

## Run locally

Requirements: Python 3.10+ and Node.js 18+.

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` and `/ws` to FastAPI.

### Demo sign-in

| Role | Email | Password |
| --- | --- | --- |
| Branch manager | `manager@sentinel.demo` | `SentinelDemo!2026` |
| Fraud investigator | `investigator@sentinel.demo` | `SentinelDemo!2026` |
| Data engineer | `engineer@sentinel.demo` | `SentinelDemo!2026` |

These are **local demo accounts**, checked on the server. The password can be changed with `SENTINEL_DEMO_PASSWORD`. Tokens expire after eight hours and are kept in browser session storage. Set `SENTINEL_SESSION_SECRET` to a long random value if sessions must survive a server restart; otherwise the app generates a new secret on startup. `SENTINEL_DEMO_AUTH=0` disables the built-in accounts. Production deployment requires an organisation identity provider, secure transport, persistent user management, audit logs, and a full security review. The default demo accounts must not be exposed on a public network.

### API checks

`GET /api/health` is public. Other API endpoints require a bearer token from `POST /api/auth/login`. Manager users can view aggregate analytics and reports; investigator users can also access monitoring and pattern analysis; engineer users can access import and warehouse endpoints. WebSocket replay requires an investigator or engineer token.

## Project structure

- `backend/app/warehouse/ddl.py`: star schema
- `backend/app/warehouse/etl.py`: dimension resolution and fact loading
- `backend/app/warehouse/olap_queries.py`: grouped and drill-down queries
- `backend/app/routes/health.py`: warehouse-backed overview and metrics
- `backend/app/routes/mining.py`: drift comparisons and rule mining
- `backend/app/auth.py`: local demo authentication and signed sessions
- `frontend/src/pages`: banker-facing workflows
- `frontend/public/images/bank-operations.png`: homepage image

## Known limits

- This is a demonstration over synthetic mobile-money data, not a validated fraud control for a bank.
- The online model warms from the included CSV. Replaying the same sample is useful for product demonstration but is **not** an independent performance benchmark.
- Association rules may return no result at the selected thresholds. The UI shows that honestly and retains the observed before/after counts.
- The embedded DuckDB connection and in-memory simulator are designed for a single local process, not concurrent production ingestion.
- The bundled sample may cover less than 30 simulated days. A one-month query returns the rows available in that interval and labels partial coverage; it does not invent missing days.
- On first run, the bundled warehouse is copied to ignored `backend/data/sentinel_runtime.duckdb`. The running app writes there, keeping the tracked seed intact. Set `SENTINEL_WAREHOUSE_PATH` to use a different writable file.
- The legacy `PRD.md`, `PPT.md`, and `TEAM_PROJECT_GUIDE.md` describe earlier concepts; this README describes the implemented app.
