# Sentinel

**Preparing the team PPT? Read [the updated project and presentation guide](PROJECT_README_FOR_PPT.md).** It covers the implementation as of 5 October 2026, including roles, DWM, mining algorithms, visualizations, the demo flow, limitations, slide outline and viva answers.

Sentinel is a **banking risk analytics demonstration** built with React, FastAPI, DuckDB, scikit-learn and River (optional drift monitoring). It replays synthetic PaySim transactions, scores them with a warehouse-trained CART decision tree, stores them at transaction grain in a dimensional warehouse, and lets managers inspect confirmed fraud, model flags, and changes over simulated time.

The included warehouse contains a **small ingested sample**. PaySim's full public dataset is larger, but this repository does not contain all of it. Row counts change when the local simulation or importer runs. PaySim amounts are denominated in an unspecified local currency, so the UI displays **local units**, not ₹ or dollars. Each `step` represents a simulated hour; these are not calendar dates.

## What a banker can do

- **Overview:** see confirmed fraud, model flags, alert precision, recall, weekly patterns, and recent transactions from the warehouse. It refreshes every 15 seconds while visible; “Latest flagged” searches the full warehouse rather than just the newest rows.
- **Reports:** type a supported question such as “Show one month of transaction data” or choose a common report. Review the interpreted OLAP operation, its scope, warehouse totals, SQL, and exportable results.
- **Explore data:** choose roll-up, drill-down, slice, dice or pivot explicitly; group by simulated month, week, day or hour; filter transaction types, step ranges and day/night; inspect SQL and export results. Month and week both drill into day, then hour, since a 30-day month does not contain whole simulation weeks.
- **Dataset & warehouse:** inspect the source sample, dictionary, warehouse counts, ETL quality and a visual star schema.
- **Model lab:** train CART on earlier labelled warehouse steps, evaluate on later steps, inspect a tree diagram and confusion matrix, compare with a non-fraud baseline, and export saved evidence. K-means shows scaled behaviour groups through a PCA projection, silhouette score and elbow plot. Apriori exposes support, confidence and lift. Model lab and training are available to data engineers. Managers and investigators use business reports and plain-language pattern comparisons.
- **Transaction monitor:** replay synthetic events through the saved decision tree and see predictions beside known dataset labels. The in-app notification bell checks the warehouse for new review leads, confirmed sample labels, and model drift across dashboards. Preview buttons demonstrate the alerts without writing data.
- **Pattern analysis:** read a plain-language account of a detected model change, compare equal windows around it, and inspect mined associations when thresholds are met. The page follows the newest saved event and checks for new detections every 10 seconds while open; manual event selection pauses that follow mode. Alerts from the live monitor and CSV import are saved here.
- **Warehouse health:** inspect row counts, schema columns, and data quality checks.
- **Import data:** score one transaction or ingest PaySim-format CSV as an engineer.

The app separates **confirmed fraud** (the PaySim label) from **flagged for review** (the model prediction). In the supplied sample, these diverge considerably, so a flag should never be described as proof of fraud. No case-management, investigation disposition, suspicious-activity filing, or real banking integration is implemented.

## Why a dimensional warehouse

`fact_transactions` has one row per ingested transaction. It holds measures and prediction outcomes, with keys to `dim_time`, `dim_transaction_type`, and origin/destination `dim_account`. This grain lets a manager ask useful questions such as “Did confirmed cash-out fraud rise by week?” and drill from a weekly total into days without counting the same transaction twice. `fact_drift_events` records model-change events separately. The app uses DuckDB to aggregate these facts across dimensions; the analyst-facing pages expose the SQL so figures can be checked.

This follows the [Kimball dimensional modeling techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/). The decision to expose source, grain, and quality alongside risk figures is informed by the [Basel Committee's risk-data reporting principles](https://www.bis.org/publ/bcbs239.pdf). The dataset semantics come from the [PaySim dataset description](https://www.kaggle.com/datasets/ealaxi/paysim1).

### Question to OLAP example

“Show one month of transaction data” is interpreted as a **ROLLUP to a 30-day simulation month** over steps 1–720. The API filters those steps and groups the transaction fact table using a fixed SQL expression. “Show cash-out fraud by week for the first month” adds a transaction-type **slice**, then rolls up by simulation week over the same step range. “Last 7 days” ends at the warehouse's latest ingested step. The Reports page shows this interpretation and warns when only part of a requested range is present. The language interface uses a constrained, auditable grammar; unsupported dimensions produce an explanation rather than a guessed answer. A simulation month is not a calendar month.

### Model changes and AI keys

The main classifier is a **CART decision tree**, using Gini or entropy splits, limited depth, minimum leaf size and balanced class weights. It uses amount, origin/destination balance changes and one-hot transaction types from the dimensional warehouse. Account identifiers, known labels, source flags and past predictions are excluded from features. Balance changes are post-transaction attributes: this is retrospective review, not pre-authorisation blocking.

Training reserves later **distinct simulation steps** for testing; all records from one step stay on one side. Repeated step/type/amount/balance-change/label signatures are excluded from mining so replay does not duplicate evaluation observations. This is a demo safeguard, not a substitute for unique source transaction IDs. The UI shows exact fraud counts, false positives, false negatives, test metrics, class-weighted score limitations and sample-size warnings. Repeated tuning against the same test window is exploratory; a final benchmark needs an untouched independent dataset.

On first startup with enough labelled facts, the app trains a default tree. Later startups restore a local joblib artifact matching the saved warehouse run. Mining evidence is saved in `mining_runs`, `fact_model_evaluations` and `fact_cluster_assignments`; new transaction predictions carry `model_version`. Historical warehouse predictions retain `legacy-online` and are not silently rescored. Overview precision includes historical versions and flags with known labels; Model lab is the place for the active tree's held-out evaluation.

**The tree does not update itself after each transaction.** Known labels update recent replay metrics and the optional ADWIN error detector. Retraining is explicit in Model lab; activating a new tree resets the detector so a model replacement is not misreported as drift. The detector is in memory; the tree and training evidence persist. Arming a simulated shift changes subsequent fraud-labelled replay rows, and is visibly distinguished from a detected event. No drift event is guaranteed by the scenario.

K-means uses a signed log transformation, standard scaling and one-hot types, without fraud labels. The PCA plot is a display projection, not a classifier or currency axis; labelled fraud counts are inspected after grouping. Clustering and Apriori use at most a deterministic 20,000-row mining sample for this local demonstration. Apriori bins transaction attributes and mines itemsets up to length three; a rule expresses association, not causation. Empty rule results are displayed honestly.

**No external AI API or API key is required.** Reports use a constrained local language parser; explanations use actual warehouse statistics. The exact teacher's syllabus has not been supplied, so the chosen common teaching algorithms still need comparison with that list.

See [workspace roles and design decisions](docs/WORKSPACE_ROLES.md) for the current access matrix.

See [the audit and demonstration plan](AUDIT_AND_DEMO_PLAN.md) for findings and presentation sequence.

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

`GET /api/health` is public. Other API endpoints require a bearer token from `POST /api/auth/login`. Manager users view aggregate analytics, reports, transaction trends and Pattern Analysis. Investigators also control historical replay monitoring. Engineers access imports, warehouse administration, dataset structure and mining/training endpoints. SQL and technical diagnostics are shown only in the engineer workspace. WebSocket replay requires an investigator or engineer token.

## Verification

```powershell
cd backend
python -m unittest discover -s tests -v
```

```powershell
cd frontend
node --test src/lib/*.test.js
npm run build
```

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
- The bundled sample has few fraud labels. Saved chronological test results disclose that limitation. Replay metrics are **not** an independent performance benchmark.
- Association rules may return no result at the selected thresholds. The UI shows that honestly and retains the observed before/after counts.
- The embedded DuckDB connection and in-memory simulator are designed for a single local process, not concurrent production ingestion.
- The bundled sample may cover less than 30 simulated days. A one-month query returns the rows available in that interval and labels partial coverage; it does not invent missing days.
- On first run, the bundled warehouse is copied to ignored `backend/data/sentinel_runtime.duckdb`. The running app writes there, keeping the tracked seed intact. Set `SENTINEL_WAREHOUSE_PATH` to use a different writable file.
- The legacy `PRD.md`, `PPT.md`, and `TEAM_PROJECT_GUIDE.md` describe earlier concepts; this README describes the implemented app.
