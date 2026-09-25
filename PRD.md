# SENTINEL — Product Requirements Document (PRD)

**Concept-Drift-Aware Financial Fraud Pattern Miner & Columnar OLAP Data Warehouse**

| Field | Detail |
|:---|:---|
| **Version** | 1.0.0 |
| **Status** | Implementation-Ready |
| **Team** | Priyanshu Gupta (24101B0037) · Ronak Boddu (24101B0044) · Nikhat Momin (24101B0054) |
| **Course** | Data Warehousing & Mining (DWM) |
| **Stack** | FastAPI · React (Vite) · DuckDB · river · mlxtend · Recharts |
| **Dataset** | PaySim — 6,362,620 synthetic financial transactions |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Space & Motivation](#2-problem-space--motivation)
3. [Product Vision & Principles](#3-product-vision--principles)
4. [System Architecture](#4-system-architecture)
5. [Data Pipeline: OLTP → ETL → Warehouse → OLAP → Mining](#5-data-pipeline)
6. [Star Schema & Dimensional Model](#6-star-schema--dimensional-model)
7. [Data Mining Algorithms & Workflows](#7-data-mining-algorithms--workflows)
8. [Design System & Visual Identity](#8-design-system--visual-identity)
9. [Screen-by-Screen Feature Specification](#9-screen-by-screen-feature-specification)
10. [User Journeys & Interaction Flows](#10-user-journeys--interaction-flows)
11. [API Specification](#11-api-specification)
12. [Performance Requirements & KPIs](#12-performance-requirements--kpis)
13. [Security, Permissions & Audit](#13-security-permissions--audit)
14. [Scalability & Future Extensions](#14-scalability--future-extensions)
15. [Edge Cases & Error Handling](#15-edge-cases--error-handling)
16. [Accessibility](#16-accessibility)
17. [Acceptance Criteria](#17-acceptance-criteria)
18. [Implementation Timeline](#18-implementation-timeline)
19. [Glossary](#19-glossary)

---

## 1. Executive Summary

SENTINEL is an end-to-end financial fraud intelligence platform that unifies **Data Warehousing** (Star Schema, ETL, OLAP cubes) with **Data Mining** (incremental classification, concept drift detection, association rule mining) into a single, web-based analytical command center.

Unlike static fraud classifiers that degrade silently as adversaries evolve, SENTINEL:

- **Adapts** — An incremental Hoeffding Tree learns from every transaction without batch retraining
- **Detects** — ADWIN monitors rolling error variance and flags the exact moment fraud tactics shift
- **Explains** — FP-Growth mines pre-drift and post-drift warehouse windows and surfaces the specific feature combinations that changed
- **Warehouses** — Every transaction is persisted into a columnar Star Schema (DuckDB) enabling sub-second OLAP drill-downs across millions of records
- **Visualizes** — A React dashboard delivers live streaming feeds, interactive OLAP exploration, and side-by-side drift rule comparisons

The platform processes the PaySim dataset (6.36 million transactions, ~493 MB) and supports three live ingestion modes: automated stream replay, manual single-transaction scoring, and batch CSV upload.

---

## 2. Problem Space & Motivation

### 2.1 The Three Failures of Static Fraud Systems

| Failure | Description | SENTINEL's Solution |
|:---|:---|:---|
| **Silent Model Staleness** | A batch-trained classifier assumes fraud patterns are fixed. When fraudsters pivot (e.g., from large CASH_OUT drains to micro TRANSFER splitting), the model's precision decays without any alert. | Hoeffding Tree updates incrementally per-transaction; ADWIN statistically monitors error drift and triggers alerts autonomously. |
| **Explanation Void** | Even when performance degradation is noticed, there is no mechanism to answer *"What specifically changed in the fraud pattern?"* | FP-Growth mines association rules on sliced pre/post-drift warehouse windows and computes Support, Confidence, and Lift deltas. |
| **No Analytical Backbone** | Standard ML pipelines process data ephemerally in memory. There is no persistent dimensional warehouse for historical OLAP auditing, pattern discovery, or regulatory compliance queries. | DuckDB Star Schema stores all transactions with conformed dimensions, supporting Roll-Up, Drill-Down, Slice, Dice, and Pivot operations. |

### 2.2 Academic Alignment (DWM Syllabus Coverage)

| Syllabus Unit | Topic | Where It Appears in SENTINEL |
|:---|:---|:---|
| Unit 1 | Data Preprocessing & Discretization | Numeric-to-categorical binning pipeline (amount → LOW/MED/HIGH) |
| Unit 2 | Data Warehousing & Star Schema | `fact_transactions` + `dim_time` + `dim_account` + `dim_transaction_type` |
| Unit 3 | OLAP Operations | Roll-Up, Drill-Down, Slice, Dice, Pivot via DuckDB SQL |
| Unit 4 | Association Rule Mining | FP-Growth / Apriori with Support, Confidence, Lift computation |
| Unit 5 | Classification | Decision Tree (Hoeffding variant for streaming) |
| Unit 6 | Clustering / Stream Mining | ADWIN sliding-window drift detection on error streams |

---

## 3. Product Vision & Principles

### 3.1 Vision Statement

> SENTINEL transforms fraud detection from a **static prediction task** into a **living analytical process** — one that warehouses every signal, adapts to every adversarial shift, and explains every pattern change in human-readable terms.

### 3.2 Design Principles

| # | Principle | Implication |
|:---|:---|:---|
| P1 | **Transparency over black boxes** | Every prediction, drift event, and mined rule is traceable back to raw warehouse data. The SQL query behind every OLAP view is visible. |
| P2 | **Warehouse-first, not notebook-first** | All mining algorithms read from the DuckDB Star Schema, not from raw CSVs. The warehouse is the single source of truth. |
| P3 | **Explain the shift, don't just flag it** | A drift alert without explanation is useless. SENTINEL always pairs detection with a before/after rule comparison. |
| P4 | **Interactive proof, not static slides** | Examiners interact with live OLAP controls, inject drift in real time, and watch the system recover. Nothing is pre-recorded. |
| P5 | **Dense but scannable** | Dashboards pack maximum information density without clutter. Every pixel earns its place through clear typographic hierarchy and deliberate whitespace. |

---

## 4. System Architecture

### 4.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SENTINEL — System Architecture                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                    TIER 4: PRESENTATION LAYER                            │   │
│  │                                                                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │ Command  │ │  OLAP    │ │  Drift   │ │  Rule    │ │   Schema &   │   │   │
│  │  │ Center   │ │  Studio  │ │ Monitor  │ │ Explainer│ │   Admin      │   │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │   │
│  │       │             │            │             │              │           │   │
│  │  React.js (Vite) + Tailwind CSS + Recharts + Lucide Icons               │   │
│  └──────────────────────────────────┬───────────────────────────────────────┘   │
│                                     │                                           │
│                          REST + WebSocket (JSON)                                │
│                                     │                                           │
│  ┌──────────────────────────────────┴───────────────────────────────────────┐   │
│  │                    TIER 3: APPLICATION LAYER                             │   │
│  │                                                                          │   │
│  │  FastAPI (Python 3.11, async/await, uvicorn)                            │   │
│  │                                                                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │   │
│  │  │  Streaming   │  │   OLAP      │  │   Mining    │  │  Ingestion   │   │   │
│  │  │  Engine      │  │   Query     │  │   Engine    │  │  Router      │   │   │
│  │  │  (WebSocket) │  │   Builder   │  │  (FP-Growth)│  │  (REST)      │   │   │
│  │  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘   │   │
│  │         │                 │                 │                │           │   │
│  └─────────┼─────────────────┼─────────────────┼────────────────┼──────────┘   │
│            │                 │                 │                │               │
│  ┌─────────┼─────────────────┼─────────────────┼────────────────┼──────────┐   │
│  │         ▼                 ▼                 ▼                ▼          │   │
│  │                    TIER 2: INTELLIGENCE LAYER                           │   │
│  │                                                                         │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐    │   │
│  │  │  river            │  │  ADWIN Drift     │  │  mlxtend           │    │   │
│  │  │  HoeffdingTree    │  │  Detector        │  │  FP-Growth Engine  │    │   │
│  │  │  Classifier       │  │  (Error Monitor) │  │  + Discretizer     │    │   │
│  │  └──────────────────┘  └──────────────────┘  └────────────────────┘    │   │
│  │                                                                         │   │
│  └─────────────────────────────────┬───────────────────────────────────────┘   │
│                                    │                                           │
│  ┌─────────────────────────────────┴───────────────────────────────────────┐   │
│  │                    TIER 1: STORAGE LAYER                                │   │
│  │                                                                         │   │
│  │                    DuckDB (Embedded Columnar OLAP)                      │   │
│  │                                                                         │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐  │   │
│  │  │                     ┌─────────────┐                               │  │   │
│  │  │    ┌────────────┐   │    fact_     │   ┌──────────────────┐       │  │   │
│  │  │    │  dim_time   │──│transactions │──│dim_transaction_type│       │  │   │
│  │  │    └────────────┘   │             │   └──────────────────┘       │  │   │
│  │  │                     │             │                               │  │   │
│  │  │    ┌────────────┐   │             │   ┌──────────────────┐       │  │   │
│  │  │    │dim_account │──│             │──│ fact_drift_events │       │  │   │
│  │  │    └────────────┘   └─────────────┘   └──────────────────┘       │  │   │
│  │  └───────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                         │   │
│  │                    warehouse.duckdb (~110 MB compressed)                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow Sequence

```
PaySim CSV ──► Streaming Simulator (Python Generator)
                        │
                ┌───────┴───────┐
                ▼               ▼
         river Model      DuckDB ETL
      (predict + learn)  (transform + load)
                │               │
                ▼               │
         ADWIN Monitor          │
         (error tracking)       │
                │               │
         ┌──────┴──────┐        │
         │ DRIFT?      │        │
         │ YES ──► FP-Growth ◄──┘  (queries pre/post windows from DuckDB)
         │ NO  ──► continue     │
         └─────────────┘        │
                                ▼
                        WebSocket Push ──► React UI
```

### 4.3 Folder Structure

```
sentinel/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app, CORS, lifespan events
│   │   ├── config.py                # Environment variables, constants
│   │   ├── models/
│   │   │   ├── schemas.py           # Pydantic request/response models
│   │   │   └── enums.py             # Transaction types, drift states
│   │   ├── warehouse/
│   │   │   ├── __init__.py
│   │   │   ├── connection.py        # DuckDB connection pool / singleton
│   │   │   ├── ddl.py               # CREATE TABLE statements (Star Schema)
│   │   │   ├── etl.py               # Extract-Transform-Load pipeline
│   │   │   ├── olap_queries.py      # Rollup, Drilldown, Slice, Dice, Pivot
│   │   │   └── data_quality.py      # Null checks, orphan FK detection
│   │   ├── intelligence/
│   │   │   ├── __init__.py
│   │   │   ├── stream_classifier.py # river HoeffdingTree wrapper
│   │   │   ├── drift_detector.py    # ADWIN wrapper + drift event logger
│   │   │   ├── discretizer.py       # Numeric → categorical binning
│   │   │   └── rule_miner.py        # FP-Growth + rule diff engine
│   │   ├── ingestion/
│   │   │   ├── __init__.py
│   │   │   ├── stream_simulator.py  # Chronological PaySim replayer
│   │   │   ├── manual_scorer.py     # Single-transaction risk endpoint
│   │   │   └── csv_uploader.py      # Batch CSV ingest + validation
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── stream_ws.py         # WebSocket: live stream + drift alerts
│   │   │   ├── olap.py              # REST: OLAP query endpoints
│   │   │   ├── mining.py            # REST: FP-Growth trigger + rule diffs
│   │   │   ├── ingest.py            # REST: manual TX + CSV upload
│   │   │   ├── warehouse_admin.py   # REST: schema info, table stats, ETL log
│   │   │   └── health.py            # Health check + system metrics
│   │   └── utils/
│   │       ├── logger.py            # Structured JSON logging
│   │       └── validators.py        # Input sanitization
│   ├── data/
│   │   └── PS_20174392719_1491204167654_log.csv   # PaySim dataset
│   ├── warehouse.duckdb             # Generated warehouse file
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                  # Root layout + router
│   │   ├── config/
│   │   │   └── theme.js             # Design tokens (colors, spacing, typography)
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js      # WebSocket connection manager
│   │   │   ├── useOlapQuery.js      # OLAP fetch + cache hook
│   │   │   └── useStreamState.js    # Stream control state machine
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx      # Navigation rail
│   │   │   │   ├── TopBar.jsx       # Breadcrumb + global controls
│   │   │   │   └── PageShell.jsx    # Content wrapper with scroll
│   │   │   ├── charts/
│   │   │   │   ├── AccuracyTimeline.jsx    # Live accuracy + drift markers
│   │   │   │   ├── OlapBarChart.jsx        # Grouped/stacked bar for OLAP
│   │   │   │   ├── FraudHeatmap.jsx        # Time × Type fraud density
│   │   │   │   └── RuleStrengthRadar.jsx   # Radar chart for rule metrics
│   │   │   ├── olap/
│   │   │   │   ├── FilterBar.jsx           # Slice/Dice dimension controls
│   │   │   │   ├── GranularityToggle.jsx   # Hour/Day/Week roll-up selector
│   │   │   │   ├── PivotTable.jsx          # Cross-tabulation matrix
│   │   │   │   └── SqlInspector.jsx        # Expandable SQL query viewer
│   │   │   ├── stream/
│   │   │   │   ├── StreamControls.jsx      # Play/Pause/Reset/Speed
│   │   │   │   ├── TransactionTicker.jsx   # Live scrolling TX feed
│   │   │   │   ├── DriftBadge.jsx          # Animated drift alert
│   │   │   │   └── InjectButton.jsx        # "Inject Fraud Shift" trigger
│   │   │   ├── mining/
│   │   │   │   ├── RuleCard.jsx            # Single association rule display
│   │   │   │   ├── RuleDiffPanel.jsx       # Pre vs Post side-by-side
│   │   │   │   ├── SupportSlider.jsx       # Min support threshold
│   │   │   │   └── DriftNarrative.jsx      # Plain-English explanation
│   │   │   ├── ingest/
│   │   │   │   ├── ManualTxForm.jsx        # Single transaction scorer
│   │   │   │   └── CsvDropzone.jsx         # Drag-and-drop CSV uploader
│   │   │   └── shared/
│   │   │       ├── MetricCard.jsx          # KPI stat card
│   │   │       ├── StatusDot.jsx           # Online/offline indicator
│   │   │       ├── EmptyState.jsx          # Illustrated empty placeholders
│   │   │       └── Skeleton.jsx            # Loading shimmer
│   │   ├── pages/
│   │   │   ├── CommandCenter.jsx     # Tab 1: Executive dashboard
│   │   │   ├── OlapStudio.jsx        # Tab 2: Interactive OLAP explorer
│   │   │   ├── StreamMonitor.jsx     # Tab 3: Live stream + drift
│   │   │   ├── RuleExplainer.jsx     # Tab 4: FP-Growth rule diffing
│   │   │   ├── WarehouseAdmin.jsx    # Tab 5: Schema viewer + ETL health
│   │   │   └── IngestLab.jsx         # Tab 6: Manual TX + CSV upload
│   │   └── lib/
│   │       ├── api.js                # Axios/fetch wrapper
│   │       ├── formatters.js         # Number, currency, date formatters
│   │       └── constants.js          # Route paths, WebSocket URL
│   ├── public/
│   │   └── sentinel-logo.svg
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── docs/
│   ├── PRD.md                        # This document
│   └── VIVA_GUIDE.md                 # Examiner Q&A cheat sheet
│
└── README.md
```

---

## 5. Data Pipeline

### 5.1 Pipeline Stages

The complete data flow is organized into five sequential stages:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  STAGE 1    │    │  STAGE 2    │    │  STAGE 3    │    │  STAGE 4    │    │  STAGE 5    │
│  INGEST     │───►│  TRANSFORM  │───►│  LOAD       │───►│  ANALYZE    │───►│  MINE       │
│  (Extract)  │    │  (ETL)      │    │  (Warehouse)│    │  (OLAP)     │    │  (Patterns) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

#### Stage 1: Extraction (Ingestion)

Three concurrent ingestion vectors feed into the pipeline:

| Vector | Source | Trigger | Throughput |
|:---|:---|:---|:---|
| **Stream Replay** | PaySim CSV, read row-by-row via Python generator | User clicks "Start Stream" | 50–1000 tx/sec (configurable) |
| **Manual Form** | User-submitted transaction via React form | User clicks "Score Transaction" | 1 tx per submission |
| **CSV Upload** | User-uploaded `.csv` file via drag-and-drop | User drops file | Batch of 10–10,000 rows |

**Stream Replay Implementation:**
```python
# backend/app/ingestion/stream_simulator.py
import pandas as pd
from typing import AsyncGenerator

async def replay_paysim(
    csv_path: str,
    batch_size: int = 50,
    speed_multiplier: float = 1.0
) -> AsyncGenerator[list[dict], None]:
    """
    Yields batches of transactions in chronological order (sorted by 'step').
    Simulates real-time delay between steps based on speed_multiplier.
    """
    chunks = pd.read_csv(csv_path, chunksize=batch_size)
    for chunk in chunks:
        chunk = chunk.sort_values("step")
        yield chunk.to_dict(orient="records")
        await asyncio.sleep(batch_size / (100 * speed_multiplier))
```

#### Stage 2: Transformation (ETL)

Each raw transaction record undergoes the following transformations before warehouse loading:

| Step | Operation | Input | Output |
|:---|:---|:---|:---|
| T1 | **Surrogate Key Generation** | `step` integer | `time_key` FK via lookup/insert into `dim_time` |
| T2 | **Account Type Inference** | `nameOrig` / `nameDest` prefix | `account_type`: `'C'` (Customer, prefix `C`) or `'M'` (Merchant, prefix `M`) |
| T3 | **Balance Delta Computation** | `oldbalanceOrg`, `newbalanceOrig` | `orig_balance_delta = newbalanceOrig - oldbalanceOrg` |
| T4 | **Null Imputation** | Missing `newbalanceDest` | Default to `0.0` with `is_imputed` flag |
| T5 | **Fraud Prediction** | Feature vector | `is_fraud_pred` via river Hoeffding Tree |
| T6 | **Error Computation** | `isFraud`, `is_fraud_pred` | `prediction_error = abs(isFraud - is_fraud_pred)` |
| T7 | **Discretization** (for mining only) | `amount`, `step`, balance deltas | Categorical bins (`LOW`/`MED`/`HIGH`, `NIGHT`/`DAY`, `FULL_DRAIN`/`PARTIAL`) |

**Discretization Bins (Stage T7):**

```python
# backend/app/intelligence/discretizer.py

AMOUNT_BINS = {
    "MICRO":     (0,        1_000),
    "LOW":       (1_000,    50_000),
    "MEDIUM":    (50_000,   200_000),
    "HIGH":      (200_000,  1_000_000),
    "VERY_HIGH": (1_000_000, float("inf"))
}

TIME_BINS = {
    "LATE_NIGHT":    (0, 6),     # steps 0-5 within a 24-hour cycle
    "MORNING":       (6, 12),
    "AFTERNOON":     (12, 18),
    "EVENING":       (18, 24)
}

BALANCE_DRAIN_CATEGORIES = {
    "FULL_DRAIN":     lambda old, new: old > 0 and new == 0,
    "HEAVY_DRAIN":    lambda old, new: old > 0 and 0 < new <= old * 0.1,
    "PARTIAL":        lambda old, new: old > 0 and new > old * 0.1,
    "ZERO_BALANCE":   lambda old, new: old == 0 and new == 0,
    "DEPOSIT":        lambda old, new: new > old
}
```

#### Stage 3: Loading (Warehouse Insertion)

Transformed records are inserted into DuckDB Star Schema tables:

```sql
-- Bulk insert into fact table (parameterized)
INSERT INTO fact_transactions (
    time_key, orig_acc_key, dest_acc_key, type_key,
    amount, orig_balance_delta, dest_balance_delta,
    is_fraud_actual, is_fraud_pred, prediction_error, step_number
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
```

**Load Strategy:**
- **Micro-batches:** Accumulate 50 transactions in memory, then execute a single bulk `INSERT` (reduces DuckDB I/O overhead).
- **Dimension Upserts:** Before inserting facts, check if the dimension key exists. If not, insert a new dimension row and return the surrogate key.
- **Transaction Safety:** Each micro-batch is wrapped in a `BEGIN`/`COMMIT` block to ensure atomicity.

#### Stage 4: OLAP Analysis

Once data resides in the warehouse, the OLAP query engine serves interactive analytical requests from the React frontend. Detailed in Section 6.

#### Stage 5: Pattern Mining

Triggered on drift events. FP-Growth extracts rules from warehouse-sliced windows. Detailed in Section 7.

---

## 6. Star Schema & Dimensional Model

### 6.1 Entity-Relationship Diagram

```
                                    ┌────────────────────────────┐
                                    │          dim_time           │
                                    ├────────────────────────────┤
                                    │ time_key        INTEGER PK │
                                    │ step            INTEGER    │
                                    │ hour_of_day     TINYINT    │
                                    │ period_of_day   VARCHAR    │
                                    │ day_number      SMALLINT   │
                                    │ day_of_week     VARCHAR    │
                                    │ week_number     SMALLINT   │
                                    │ is_night        BOOLEAN    │
                                    │ is_weekend      BOOLEAN    │
                                    └──────────┬─────────────────┘
                                               │
                                               │ FK: time_key
                                               │
┌────────────────────────────┐    ┌────────────┴─────────────────────────────┐    ┌─────────────────────────────┐
│   dim_transaction_type     │    │            fact_transactions              │    │        dim_account          │
├────────────────────────────┤    ├────────────────────────────────────────────┤    ├─────────────────────────────┤
│ type_key     INTEGER PK    │    │ tx_id              BIGINT PK (auto-inc)  │    │ acc_key      INTEGER PK     │
│ type_name    VARCHAR       │◄───┤ time_key           INTEGER FK            │───►│ account_id   VARCHAR        │
│ type_code    CHAR(2)       │    │ type_key           INTEGER FK            │    │ account_type VARCHAR        │
│ risk_weight  DECIMAL(3,2)  │    │ orig_acc_key       INTEGER FK            │    │ name_prefix  CHAR(1)        │
│ is_cashout   BOOLEAN       │    │ dest_acc_key       INTEGER FK            │    │ first_seen_step INTEGER     │
│ description  VARCHAR       │    │ amount             DECIMAL(15,2)         │    │ risk_tier    VARCHAR        │
└────────────────────────────┘    │ orig_balance_delta DECIMAL(15,2)         │    └─────────────────────────────┘
                                  │ dest_balance_delta DECIMAL(15,2)         │
                                  │ is_fraud_actual    BOOLEAN               │
                                  │ is_fraud_pred      BOOLEAN               │
                                  │ fraud_probability  DECIMAL(5,4)          │
                                  │ prediction_error   TINYINT               │
                                  │ step_number        INTEGER               │
                                  │ ingested_at        TIMESTAMP             │
                                  └──────────────────────────────────────────┘

                              ┌──────────────────────────────────────────┐
                              │          fact_drift_events               │
                              ├──────────────────────────────────────────┤
                              │ drift_id          INTEGER PK (auto-inc) │
                              │ detected_at_step  INTEGER               │
                              │ detected_at_ts    TIMESTAMP             │
                              │ pre_window_start  INTEGER               │
                              │ pre_window_end    INTEGER               │
                              │ post_window_start INTEGER               │
                              │ post_window_end   INTEGER               │
                              │ error_rate_before DECIMAL(5,4)          │
                              │ error_rate_after  DECIMAL(5,4)          │
                              │ is_injected       BOOLEAN               │
                              │ rules_json        JSON                  │
                              └──────────────────────────────────────────┘
```

### 6.2 DDL Statements

```sql
-- backend/app/warehouse/ddl.py

CREATE TABLE IF NOT EXISTS dim_time (
    time_key        INTEGER PRIMARY KEY,
    step            INTEGER NOT NULL,
    hour_of_day     TINYINT NOT NULL,      -- 0-23 (step % 24)
    period_of_day   VARCHAR NOT NULL,      -- 'LATE_NIGHT','MORNING','AFTERNOON','EVENING'
    day_number      SMALLINT NOT NULL,     -- step / 24 (0-indexed day)
    day_of_week     VARCHAR NOT NULL,      -- 'Mon','Tue',...
    week_number     SMALLINT NOT NULL,     -- day_number / 7
    is_night        BOOLEAN NOT NULL,      -- hour_of_day < 6
    is_weekend      BOOLEAN NOT NULL       -- day_of_week IN ('Sat','Sun')
);

CREATE TABLE IF NOT EXISTS dim_account (
    acc_key         INTEGER PRIMARY KEY,
    account_id      VARCHAR NOT NULL UNIQUE,
    account_type    VARCHAR NOT NULL,      -- 'Customer' or 'Merchant'
    name_prefix     CHAR(1) NOT NULL,      -- 'C' or 'M'
    first_seen_step INTEGER DEFAULT 0,
    risk_tier       VARCHAR DEFAULT 'UNKNOWN'  -- 'LOW','MEDIUM','HIGH','UNKNOWN'
);

CREATE TABLE IF NOT EXISTS dim_transaction_type (
    type_key        INTEGER PRIMARY KEY,
    type_name       VARCHAR NOT NULL UNIQUE,   -- 'PAYMENT','TRANSFER','CASH_OUT','DEBIT','CASH_IN'
    type_code       CHAR(2) NOT NULL,          -- 'PA','TR','CO','DE','CI'
    risk_weight     DECIMAL(3,2) DEFAULT 0.50,
    is_cashout      BOOLEAN DEFAULT FALSE,
    description     VARCHAR
);

CREATE TABLE IF NOT EXISTS fact_transactions (
    tx_id               BIGINT PRIMARY KEY DEFAULT nextval('tx_seq'),
    time_key            INTEGER NOT NULL REFERENCES dim_time(time_key),
    type_key            INTEGER NOT NULL REFERENCES dim_transaction_type(type_key),
    orig_acc_key        INTEGER NOT NULL REFERENCES dim_account(acc_key),
    dest_acc_key        INTEGER NOT NULL REFERENCES dim_account(acc_key),
    amount              DECIMAL(15,2) NOT NULL,
    orig_balance_delta  DECIMAL(15,2),
    dest_balance_delta  DECIMAL(15,2),
    is_fraud_actual     BOOLEAN NOT NULL DEFAULT FALSE,
    is_fraud_pred       BOOLEAN NOT NULL DEFAULT FALSE,
    fraud_probability   DECIMAL(5,4) DEFAULT 0.0,
    prediction_error    TINYINT DEFAULT 0,
    step_number         INTEGER NOT NULL,
    ingested_at         TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS fact_drift_events (
    drift_id            INTEGER PRIMARY KEY DEFAULT nextval('drift_seq'),
    detected_at_step    INTEGER NOT NULL,
    detected_at_ts      TIMESTAMP DEFAULT current_timestamp,
    pre_window_start    INTEGER NOT NULL,
    pre_window_end      INTEGER NOT NULL,
    post_window_start   INTEGER NOT NULL,
    post_window_end     INTEGER NOT NULL,
    error_rate_before   DECIMAL(5,4),
    error_rate_after    DECIMAL(5,4),
    is_injected         BOOLEAN DEFAULT FALSE,
    rules_json          JSON
);

-- Seed dimension: transaction types
INSERT INTO dim_transaction_type VALUES
    (1, 'PAYMENT',  'PA', 0.15, FALSE, 'Standard payment to merchant'),
    (2, 'TRANSFER', 'TR', 0.65, FALSE, 'Person-to-person money transfer'),
    (3, 'CASH_OUT', 'CO', 0.85, TRUE,  'Cash withdrawal via agent'),
    (4, 'DEBIT',    'DE', 0.20, FALSE, 'Direct debit from account'),
    (5, 'CASH_IN',  'CI', 0.05, FALSE, 'Cash deposit via agent');
```

### 6.3 OLAP Query Library

Every OLAP operation is backed by a named, parameterized SQL query. The frontend's OLAP Studio calls these via REST endpoints, and the generated SQL is displayed in the **SQL Inspector** panel.

#### Roll-Up (Hourly → Daily → Weekly)

```sql
-- Granularity: 'hour' | 'day' | 'week'

-- HOURLY granularity (most detailed)
SELECT
    dt.hour_of_day     AS time_bucket,
    dt.period_of_day   AS period,
    COUNT(*)           AS tx_count,
    SUM(f.amount)      AS total_volume,
    SUM(CASE WHEN f.is_fraud_actual THEN 1 ELSE 0 END) AS fraud_count,
    ROUND(AVG(f.amount), 2) AS avg_amount
FROM fact_transactions f
JOIN dim_time dt ON f.time_key = dt.time_key
GROUP BY dt.hour_of_day, dt.period_of_day
ORDER BY dt.hour_of_day;

-- DAILY granularity (roll-up from hourly)
SELECT
    dt.day_number      AS time_bucket,
    dt.day_of_week     AS day_name,
    COUNT(*)           AS tx_count,
    SUM(f.amount)      AS total_volume,
    SUM(CASE WHEN f.is_fraud_actual THEN 1 ELSE 0 END) AS fraud_count
FROM fact_transactions f
JOIN dim_time dt ON f.time_key = dt.time_key
GROUP BY dt.day_number, dt.day_of_week
ORDER BY dt.day_number;

-- WEEKLY granularity (further roll-up)
SELECT
    dt.week_number     AS time_bucket,
    COUNT(*)           AS tx_count,
    SUM(f.amount)      AS total_volume,
    SUM(CASE WHEN f.is_fraud_actual THEN 1 ELSE 0 END) AS fraud_count
FROM fact_transactions f
JOIN dim_time dt ON f.time_key = dt.time_key
GROUP BY dt.week_number
ORDER BY dt.week_number;
```

#### Drill-Down (Week → Day → Hour)

Drill-down is the inverse of roll-up. When a user clicks a specific week bar in the chart, the frontend sends a request for day-level data filtered to that week:

```sql
-- User clicked Week 3 → Drill down to days in Week 3
SELECT
    dt.day_number,
    dt.day_of_week,
    COUNT(*) AS tx_count,
    SUM(f.amount) AS total_volume,
    SUM(CASE WHEN f.is_fraud_actual THEN 1 ELSE 0 END) AS fraud_count
FROM fact_transactions f
JOIN dim_time dt ON f.time_key = dt.time_key
WHERE dt.week_number = 3  -- parameterized
GROUP BY dt.day_number, dt.day_of_week
ORDER BY dt.day_number;

-- User then clicks Day 15 → Drill down to hours in Day 15
SELECT
    dt.hour_of_day,
    dt.period_of_day,
    COUNT(*) AS tx_count,
    SUM(f.amount) AS total_volume,
    SUM(CASE WHEN f.is_fraud_actual THEN 1 ELSE 0 END) AS fraud_count
FROM fact_transactions f
JOIN dim_time dt ON f.time_key = dt.time_key
WHERE dt.day_number = 15  -- parameterized
GROUP BY dt.hour_of_day, dt.period_of_day
ORDER BY dt.hour_of_day;
```

#### Slice (Fix One Dimension)

```sql
-- Slice: Show only TRANSFER transactions across all time
SELECT
    dt.day_number,
    COUNT(*) AS tx_count,
    SUM(f.amount) AS total_volume,
    SUM(CASE WHEN f.is_fraud_actual THEN 1 ELSE 0 END) AS fraud_count
FROM fact_transactions f
JOIN dim_time dt ON f.time_key = dt.time_key
JOIN dim_transaction_type dtt ON f.type_key = dtt.type_key
WHERE dtt.type_name = 'TRANSFER'    -- single dimension fixed
GROUP BY dt.day_number
ORDER BY dt.day_number;
```

#### Dice (Multi-Dimension Filter)

```sql
-- Dice: TRANSFER + CASH_OUT, fraud only, night-time only
SELECT
    dt.day_number,
    dtt.type_name,
    COUNT(*) AS tx_count,
    SUM(f.amount) AS total_volume
FROM fact_transactions f
JOIN dim_time dt ON f.time_key = dt.time_key
JOIN dim_transaction_type dtt ON f.type_key = dtt.type_key
WHERE dtt.type_name IN ('TRANSFER', 'CASH_OUT')   -- dimension 1
  AND f.is_fraud_actual = TRUE                      -- dimension 2
  AND dt.is_night = TRUE                            -- dimension 3
GROUP BY dt.day_number, dtt.type_name
ORDER BY dt.day_number;
```

#### Pivot (Cross-Tabulation)

```sql
-- DuckDB native PIVOT: Transaction types as columns, days as rows
PIVOT (
    SELECT
        dt.day_of_week,
        dtt.type_name,
        f.amount
    FROM fact_transactions f
    JOIN dim_time dt ON f.time_key = dt.time_key
    JOIN dim_transaction_type dtt ON f.type_key = dtt.type_key
)
ON type_name
USING SUM(amount)
GROUP BY day_of_week;
```

---

## 7. Data Mining Algorithms & Workflows

### 7.1 Algorithm 1: Hoeffding Tree (Incremental Classification)

| Property | Value |
|:---|:---|
| **Algorithm** | Very Fast Decision Tree (VFDT) / Hoeffding Tree |
| **Library** | `river.tree.HoeffdingTreeClassifier` |
| **Learning Mode** | Fully incremental — `learn_one(x, y)` per transaction |
| **Features Used** | `type` (one-hot), `amount`, `oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest`, `newbalanceDest`, `balance_delta_orig`, `balance_delta_dest` |
| **Target** | `isFraud` (binary: 0 or 1) |

**Core Training Loop:**
```python
from river import tree, metrics

model = tree.HoeffdingTreeClassifier(
    grace_period=200,        # min samples before considering a split
    split_confidence=1e-5,   # delta for Hoeffding bound
    leaf_prediction="nb"     # Naive Bayes at leaves for early predictions
)

rolling_accuracy = metrics.Rolling(metrics.Accuracy(), window_size=500)

def process_transaction(features: dict, label: int):
    # 1. Predict BEFORE learning (test-then-train protocol)
    y_pred = model.predict_one(features)
    y_prob = model.predict_proba_one(features).get(1, 0.0)
    
    # 2. Update metrics
    rolling_accuracy.update(label, y_pred)
    
    # 3. Learn from this example
    model.learn_one(features, label)
    
    # 4. Compute error for ADWIN
    error = int(y_pred != label)
    
    return y_pred, y_prob, error, rolling_accuracy.get()
```

### 7.2 Algorithm 2: ADWIN (Drift Detection)

| Property | Value |
|:---|:---|
| **Algorithm** | Adaptive Windowing (ADWIN) |
| **Library** | `river.drift.ADWIN` |
| **Input** | Binary prediction error stream (0 = correct, 1 = wrong) |
| **Output** | `drift_detected` flag + internal window statistics |
| **Sensitivity** | `delta=0.002` (configurable; lower = more sensitive) |

**Integration:**
```python
from river import drift

adwin = drift.ADWIN(delta=0.002)

def check_drift(error: int, current_step: int) -> dict | None:
    adwin.update(error)
    
    if adwin.drift_detected:
        return {
            "drift_step": current_step,
            "estimation": adwin.estimation,     # current mean error
            "width": adwin.width,               # current window size
            "total_samples": adwin.total,
        }
    return None
```

**Controlled Drift Injection Protocol:**

At a predefined step (configurable, default: step 350), the stream simulator modifies the fraud generation logic:

| Phase | Steps | Fraud Behavior |
|:---|:---|:---|
| **Pre-Drift** | 0 – 349 | Fraud = high-value `CASH_OUT` (amount > 200K) that fully drains origin account (newBalanceOrig = 0) |
| **Post-Drift** | 350+ | Fraud = medium-value `TRANSFER` (50K–200K) to newly created accounts, with origin balance only partially drained |

```python
# backend/app/ingestion/stream_simulator.py

def inject_drift(row: dict, step: int, injection_point: int = 350) -> dict:
    """Modifies fraudulent transactions after injection_point to simulate
    adversarial concept drift."""
    if not row["isFraud"] or step < injection_point:
        return row  # no modification
    
    # Post-drift: change fraud from CASH_OUT to TRANSFER pattern
    row["type"] = "TRANSFER"
    row["amount"] = row["amount"] * 0.4        # reduce to medium range
    row["newbalanceOrig"] = row["oldbalanceOrg"] * 0.15  # partial drain only
    return row
```

### 7.3 Algorithm 3: FP-Growth (Association Rule Mining)

| Property | Value |
|:---|:---|
| **Algorithm** | FP-Growth (Frequent Pattern Growth) |
| **Library** | `mlxtend.frequent_patterns.fpgrowth` + `association_rules` |
| **Input** | One-hot encoded discretized transactions from DuckDB window slices |
| **Output** | Association rules with consequent `isFraud_YES` |
| **Key Metrics** | Support, Confidence, Lift |

**Workflow on Drift Event:**

```python
# backend/app/intelligence/rule_miner.py
import pandas as pd
from mlxtend.frequent_patterns import fpgrowth, association_rules

def mine_drift_rules(
    con,                    # DuckDB connection
    drift_step: int,
    window_size: int = 200,
    min_support: float = 0.01,
    min_confidence: float = 0.5,
    min_lift: float = 1.5
) -> dict:
    """
    1. Query DuckDB for pre-drift and post-drift transaction windows
    2. Discretize continuous features into categorical bins
    3. Run FP-Growth independently on each window
    4. Compare rule sets and compute deltas
    """
    
    # Step 1: Query warehouse windows
    pre_df = con.execute("""
        SELECT f.amount, f.orig_balance_delta, f.is_fraud_actual,
               dtt.type_name, dt.period_of_day, dt.is_night
        FROM fact_transactions f
        JOIN dim_time dt ON f.time_key = dt.time_key
        JOIN dim_transaction_type dtt ON f.type_key = dtt.type_key
        WHERE f.step_number BETWEEN ? AND ?
          AND f.is_fraud_actual = TRUE
    """, [drift_step - window_size, drift_step]).fetchdf()
    
    post_df = con.execute("""
        SELECT f.amount, f.orig_balance_delta, f.is_fraud_actual,
               dtt.type_name, dt.period_of_day, dt.is_night
        FROM fact_transactions f
        JOIN dim_time dt ON f.time_key = dt.time_key
        JOIN dim_transaction_type dtt ON f.type_key = dtt.type_key
        WHERE f.step_number BETWEEN ? AND ?
          AND f.is_fraud_actual = TRUE
    """, [drift_step, drift_step + window_size]).fetchdf()
    
    # Step 2: Discretize
    pre_encoded = discretize_and_encode(pre_df)
    post_encoded = discretize_and_encode(post_df)
    
    # Step 3: Mine rules
    pre_rules = _mine_window(pre_encoded, min_support, min_confidence)
    post_rules = _mine_window(post_encoded, min_support, min_confidence)
    
    # Step 4: Diff
    return compute_rule_diff(pre_rules, post_rules, min_lift)


def _mine_window(encoded_df, min_support, min_confidence):
    freq_items = fpgrowth(encoded_df, min_support=min_support, use_colnames=True)
    rules = association_rules(freq_items, metric="confidence", min_threshold=min_confidence)
    return rules


def compute_rule_diff(pre_rules, post_rules, min_lift):
    """Categorize rules into EMERGED, EXTINCT, and SHIFTED."""
    pre_sigs = set(pre_rules["antecedents"].apply(frozenset))
    post_sigs = set(post_rules["antecedents"].apply(frozenset))
    
    emerged = post_sigs - pre_sigs    # New patterns
    extinct = pre_sigs - post_sigs    # Disappeared patterns
    common = pre_sigs & post_sigs     # Patterns in both (check for lift/conf shifts)
    
    return {
        "emerged": _format_rules(post_rules, emerged),
        "extinct": _format_rules(pre_rules, extinct),
        "shifted": _compute_shifts(pre_rules, post_rules, common),
        "summary": {
            "total_pre_rules": len(pre_rules),
            "total_post_rules": len(post_rules),
            "new_patterns": len(emerged),
            "lost_patterns": len(extinct)
        }
    }
```

### 7.4 Mining Metrics Reference

| Metric | Formula | Interpretation |
|:---|:---|:---|
| **Support(A → B)** | P(A ∩ B) / N | How frequently this pattern occurs in all transactions |
| **Confidence(A → B)** | P(A ∩ B) / P(A) | When A happens, how often does B (fraud) also happen? |
| **Lift(A → B)** | Confidence(A → B) / Support(B) | Is the association genuine? Lift > 1 = positively correlated; Lift = 1 = random; Lift < 1 = negatively correlated |

---

## 8. Design System & Visual Identity

### 8.1 Brand Concept: "Precision Cartography"

SENTINEL's visual identity draws from **topographic mapping** and **architectural blueprints** — the idea that fraud analysts are cartographers mapping shifting terrain. This avoids the clichéd dark-purple "AI/cyber" aesthetic and instead establishes a visual language rooted in **precision, clarity, and measured authority**.

**Mood:** A Swiss bank's internal command room designed by Dieter Rams — functional, quiet confidence, no decoration for its own sake.

### 8.2 Color System

| Token | Hex | Usage |
|:---|:---|:---|
| **Ink** | `#1A1D23` | Primary text, headings, sidebar background |
| **Graphite** | `#2D3748` | Secondary text, table headers |
| **Slate** | `#64748B` | Tertiary text, labels, metadata |
| **Fog** | `#94A3B8` | Disabled states, borders, axis labels |
| **Paper** | `#F8FAFC` | Page background (main content area) |
| **Canvas** | `#FFFFFF` | Card surfaces, modal backgrounds |
| **Bone** | `#F1F5F9` | Alternating table row background, dividers |
| **Copper** | `#C2703E` | Primary accent — interactive elements, selected states, chart emphasis. A warm metallic tone that reads as "premium financial" without trending into fintech blue. |
| **Copper-Light** | `#F4E8DD` | Hover states, light accent backgrounds |
| **Copper-Dark** | `#8B4D2B` | Active/pressed states |
| **Verdict-Safe** | `#16A34A` | Legitimate transactions, healthy metrics, positive deltas |
| **Verdict-Warn** | `#D97706` | Elevated risk, caution states, medium-priority alerts |
| **Verdict-Threat** | `#DC2626` | Confirmed fraud, drift alerts, critical errors |
| **Verdict-Threat-Light** | `#FEF2F2` | Fraud card background tint |
| **Signal-Blue** | `#2563EB` | Informational badges, links, OLAP chart secondary |
| **Signal-Blue-Light** | `#EFF6FF` | Info banner backgrounds |

### 8.3 Typography

| Level | Font | Weight | Size | Letter Spacing | Usage |
|:---|:---|:---|:---|:---|:---|
| **Display** | Inter | 700 (Bold) | 28px / 1.75rem | -0.02em | Page titles |
| **H1** | Inter | 600 (Semi) | 22px / 1.375rem | -0.015em | Section headings |
| **H2** | Inter | 600 | 18px / 1.125rem | -0.01em | Card titles |
| **H3** | Inter | 500 (Medium) | 15px / 0.9375rem | 0 | Sub-section labels |
| **Body** | Inter | 400 (Regular) | 14px / 0.875rem | 0 | Paragraph text, table cells |
| **Caption** | Inter | 400 | 12px / 0.75rem | 0.01em | Labels, timestamps, axis ticks |
| **Mono** | JetBrains Mono | 400 | 13px / 0.8125rem | 0 | SQL queries, code, amounts, IDs |
| **Metric-Large** | Inter | 700 | 36px / 2.25rem | -0.03em | KPI hero numbers |
| **Metric-Small** | Inter | 600 | 20px / 1.25rem | -0.02em | Card metric values |

### 8.4 Spacing & Layout Grid

| Token | Value | Usage |
|:---|:---|:---|
| `space-1` | 4px | Inline padding, icon-to-text gap |
| `space-2` | 8px | Tight spacing within components |
| `space-3` | 12px | Standard internal padding |
| `space-4` | 16px | Card padding, form field gaps |
| `space-5` | 20px | Section spacing |
| `space-6` | 24px | Card-to-card gap |
| `space-8` | 32px | Page margin, major section breaks |

**Layout Grid:**
- **Sidebar:** Fixed width 240px (collapsed: 64px, icon-only)
- **Content Area:** Fluid, min-width 768px, max-width 1440px, centered
- **Card Grid:** CSS Grid with `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))` and `gap: 24px`

### 8.5 Component Design Tokens

#### Cards
```
Background:     Canvas (#FFFFFF)
Border:         1px solid Bone (#F1F5F9)
Border-radius:  12px
Shadow:         0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)
Shadow-hover:   0 4px 12px rgba(0,0,0,0.06)
Padding:        20px
```

#### Buttons
```
Primary:        bg Copper (#C2703E), text Canvas, hover Copper-Dark
Secondary:      bg transparent, border 1px Fog, text Graphite, hover bg Bone
Danger:         bg Verdict-Threat, text Canvas
Ghost:          bg transparent, text Slate, hover bg Bone
Border-radius:  8px
Height:         36px (sm), 40px (md), 44px (lg)
Font:           Inter 500, 14px
```

#### Badges / Tags
```
Border-radius:  6px
Padding:        2px 8px
Font:           Inter 500, 11px, uppercase, letter-spacing 0.05em
Variants:       Safe (green bg/text), Warn (amber), Threat (red), Info (blue), Neutral (slate)
```

#### Data Tables
```
Header:         bg Ink (#1A1D23), text Canvas, font Inter 600 12px uppercase
Row-even:       bg Canvas
Row-odd:        bg Bone
Row-hover:      bg Copper-Light (#F4E8DD)
Cell padding:   12px 16px
Font:           Inter 400 14px (text), JetBrains Mono 400 13px (numbers/IDs)
```

### 8.6 Iconography

Use **Lucide React** icon set exclusively. 16px for inline, 20px for buttons, 24px for navigation.

| Concept | Icon |
|:---|:---|
| Stream / Live | `Activity` |
| Drift Alert | `AlertTriangle` |
| OLAP Cube | `Box` |
| Roll-Up | `ChevronUp` |
| Drill-Down | `ChevronDown` |
| Slice | `Scissors` |
| Dice | `Dices` |
| Pivot | `RotateCcw` |
| Association Rule | `Network` |
| Warehouse | `Database` |
| Upload CSV | `Upload` |
| Fraud | `ShieldAlert` |
| Safe | `ShieldCheck` |
| Settings | `Settings` |
| Schema | `GitBranch` |

### 8.7 Chart Style Guide

All charts use **Recharts** with these overrides:

```javascript
// frontend/src/config/theme.js
export const CHART_THEME = {
  colors: {
    primary: '#C2703E',       // Copper — main data series
    secondary: '#2563EB',     // Signal-Blue — comparison series
    fraud: '#DC2626',         // Threat red
    safe: '#16A34A',          // Verdict green
    grid: '#F1F5F9',          // Bone
    axis: '#94A3B8',          // Fog
    driftLine: '#DC2626',     // Red dashed vertical for drift markers
  },
  axis: {
    tickFont: { family: 'Inter', size: 11, fill: '#94A3B8' },
    strokeDasharray: '3 3',
    stroke: '#F1F5F9',
  },
  tooltip: {
    background: '#1A1D23',
    text: '#F8FAFC',
    borderRadius: 8,
    border: 'none',
    fontSize: 12,
    fontFamily: 'Inter',
  },
  animation: {
    duration: 400,
    easing: 'ease-out',
  },
};
```

### 8.8 Motion & Transitions

| Element | Property | Duration | Easing |
|:---|:---|:---|:---|
| Card hover shadow | `box-shadow` | 200ms | `ease-out` |
| Button hover | `background-color` | 150ms | `ease` |
| Page transition | `opacity`, `transform(translateY)` | 250ms | `ease-out` |
| Chart data update | SVG path morph | 400ms | `ease-out` |
| Drift alert badge | `scale` + `opacity` pulse | 600ms | `cubic-bezier(0.4, 0, 0.2, 1)` repeating |
| Sidebar collapse | `width` | 200ms | `ease-in-out` |
| Skeleton shimmer | `background-position` gradient | 1500ms | `linear` infinite |
| Toast notification | Slide-in from right | 300ms | `spring(1, 80, 10)` |

---

## 9. Screen-by-Screen Feature Specification

### 9.1 Global Layout

```
┌──────┬──────────────────────────────────────────────────────────────┐
│      │  ┌─ TopBar ──────────────────────────────────────────────┐  │
│  S   │  │ ☰ SENTINEL   Breadcrumb: Command Center > Overview   │  │
│  I   │  │                                    [🔴 Live] [⚙]     │  │
│  D   │  └──────────────────────────────────────────────────────┘  │
│  E   │                                                            │
│  B   │  ┌─ Content Area ──────────────────────────────────────┐  │
│  A   │  │                                                      │  │
│  R   │  │  (Page-specific content rendered here)               │  │
│      │  │                                                      │  │
│      │  │                                                      │  │
│      │  │                                                      │  │
│      │  └──────────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────────────┘
```

**Sidebar Navigation Items:**
1. `Activity` — **Command Center** (executive dashboard)
2. `Box` — **OLAP Studio** (interactive warehouse explorer)
3. `Activity` — **Stream Monitor** (live stream + drift)
4. `Network` — **Rule Explainer** (FP-Growth rule diffing)
5. `Database` — **Warehouse Admin** (schema + ETL health + data quality)
6. `Upload` — **Ingest Lab** (manual TX + CSV upload)

**TopBar:**
- Left: Hamburger toggle (collapse sidebar) + SENTINEL wordmark + breadcrumb trail
- Right: Live status indicator (green dot + "LIVE" when stream is active, grey "IDLE" otherwise) + Settings gear icon

---

### 9.2 Screen 1: Command Center (Executive Dashboard)

**Purpose:** High-level KPI overview showing the health of the entire pipeline at a glance. This is the landing page.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  COMMAND CENTER                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Total TX │ │ Fraud    │ │ Model    │ │ Drift    │ │ Warehouse│     │
│  │ 6.36M    │ │ Rate     │ │ Accuracy │ │ Events   │ │ Size     │     │
│  │ ▲ +2.4K  │ │ 1.29%    │ │ 97.4%    │ │ 3        │ │ 112 MB   │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                                          │
│  ┌──────────────────────────────────┐ ┌─────────────────────────────┐   │
│  │ ACCURACY OVER TIME               │ │ FRAUD BY TRANSACTION TYPE   │   │
│  │                                   │ │                             │   │
│  │  98%─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─      │ │  ██████ CASH_OUT  4,097    │   │
│  │       \          /               │ │  ████   TRANSFER  1,399    │   │
│  │  90%   \   ▼▼  /  ← ADWIN       │ │  ██     PAYMENT     194    │   │
│  │         \ DRIFT/     recovery    │ │  █      DEBIT        42    │   │
│  │  82%     ─────                   │ │                             │   │
│  │  ───────────────────────► step   │ │                             │   │
│  └──────────────────────────────────┘ └─────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────┐ ┌─────────────────────────────┐   │
│  │ RECENT DRIFT EVENTS              │ │ LATEST EMERGED RULES        │   │
│  │                                   │ │                             │   │
│  │ 🔴 Drift #3 at Step 482          │ │ {TRANSFER, MEDIUM,          │   │
│  │    Error: 0.02 → 0.18            │ │  PARTIAL_DRAIN}             │   │
│  │    3 new rules emerged           │ │  → isFraud                  │   │
│  │                                   │ │  Conf: 94% | Lift: 6.1     │   │
│  │ 🟡 Drift #2 at Step 350          │ │                             │   │
│  │    Error: 0.03 → 0.22 (injected) │ │ {CASH_OUT, VERY_HIGH,      │   │
│  │    5 new rules, 2 extinct        │ │  NIGHT, FULL_DRAIN}         │   │
│  └──────────────────────────────────┘ │  → isFraud                  │   │
│                                       │  Conf: 91% | Lift: 8.4      │   │
│                                       │  [STATUS: EXTINCT] ❌        │   │
│                                       └─────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Metric Cards (Top Row):**

| Card | Primary Value | Delta | Subtext | Color |
|:---|:---|:---|:---|:---|
| Total Transactions | `6,362,620` | `+2,412 this session` | From `fact_transactions` COUNT | Copper |
| Fraud Rate | `1.29%` | `▲ +0.4% after drift` | Fraud count / Total count | Threat (red) |
| Model Accuracy | `97.4%` | Rolling 500-window | From river metrics | Safe (green) if > 95%, Warn if 90-95%, Threat if < 90% |
| Drift Events | `3` | `1 injected, 2 natural` | From `fact_drift_events` | Signal-Blue |
| Warehouse Size | `112 MB` | DuckDB file size | Physical disk footprint | Slate |

**Charts:**
- **Accuracy Over Time (left):** Recharts `AreaChart` with `monotone` curve. X = step, Y = rolling accuracy (0-100%). Red dashed `ReferenceLine` at each drift point with a tooltip showing drift details.
- **Fraud by Transaction Type (right):** Horizontal `BarChart` sorted descending by fraud count. Each bar colored by type-specific risk weight.

**Cards (Bottom Row):**
- **Recent Drift Events:** Chronological list of drift events from `fact_drift_events`. Each row shows drift step, error rate change, and count of emerged/extinct rules. Clickable → navigates to Rule Explainer filtered to that drift event.
- **Latest Emerged Rules:** Top 3 strongest newly emerged association rules from the most recent drift event. Shows antecedent items as tags, consequent (always `isFraud`), and Confidence/Lift metrics.

---

### 9.3 Screen 2: OLAP Studio

**Purpose:** Interactive multi-dimensional analytical workspace. The examiner can perform all 5 OLAP operations here.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  OLAP STUDIO                                                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ Operation Selector (pill toggle) ─────────────────────────────────┐ │
│  │  [Roll-Up]  [Drill-Down]  [Slice]  [Dice]  [Pivot]                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─ Filter Bar ──────────────────────────────────────────────────────┐  │
│  │ Transaction Type: [All ▾]  │ Fraud Only: [○ Yes ● No]            │  │
│  │ Time Period:      [●Night ○Day ○All]  │  Granularity: [Hour▾]    │  │
│  │ Step Range:       [ ═══════════●════ ] 0 ──────── 744            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Visualization Area ──────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  (Dynamic chart or pivot table rendered based on active operation  │  │
│  │   and current filter state)                                        │  │
│  │                                                                    │  │
│  │  Height: 400px                                                     │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ SQL Inspector (collapsible) ─────────────────────────────────────┐  │
│  │  ▶ View Generated SQL                                   ⏱ 14ms   │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ SELECT dt.day_number, COUNT(*), SUM(f.amount)             │   │  │
│  │  │ FROM fact_transactions f                                  │   │  │
│  │  │ JOIN dim_time dt ON f.time_key = dt.time_key              │   │  │
│  │  │ WHERE dt.is_night = TRUE                                  │   │  │
│  │  │ GROUP BY ROLLUP(dt.day_number)                            │   │  │
│  │  │ ORDER BY dt.day_number;                                   │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Results Data Table ──────────────────────────────────────────────┐  │
│  │ Day │ TX Count │ Total Volume │ Fraud Count │ Fraud Rate         │  │
│  │ Mon │ 912,450  │ ₹2.4B        │ 1,204       │ 0.13%              │  │
│  │ Tue │ 905,221  │ ₹2.3B        │ 1,189       │ 0.13%              │  │
│  │ ... │ ...      │ ...          │ ...         │ ...                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Operation Selector:**
A horizontal row of 5 pill-shaped toggles. The active pill is filled with Copper background. Each selection reconfigures the Filter Bar and Visualization Area.

| Operation | Filter Bar State | Visualization | Chart Click Behavior |
|:---|:---|:---|:---|
| **Roll-Up** | Granularity selector enabled (Hour → Day → Week). Type/Fraud filters available. | Grouped BarChart or AreaChart. Clicking "Day" granularity aggregates hourly data. | Clicking a bar does nothing (already aggregated). |
| **Drill-Down** | Granularity starts at Week. Type/Fraud filters available. | BarChart at Week level initially. | Clicking a Week bar → drills into Day bars for that week. Clicking a Day bar → drills into Hour bars for that day. Breadcrumb trail shows: `All Weeks > Week 3 > Day 15`. Back button to un-drill. |
| **Slice** | Single dimension dropdown (Type or Time or Fraud) + value selector. Other filters disabled. | AreaChart or BarChart showing the sliced dimension across remaining axes. | Standard tooltip on hover. |
| **Dice** | All filters active simultaneously. Multiple type checkboxes, fraud toggle, time period. | Stacked BarChart with multiple series. | Hover reveals per-type breakdown. |
| **Pivot** | Row dimension selector + Column dimension selector + Measure selector (COUNT, SUM amount). | PivotTable component — a cross-tabulation HTML table with colored cells (heatmap intensity based on values). | Cells are clickable → shows detail transactions in a slide-out drawer. |

**SQL Inspector:**
- Collapsed by default (shows only header: "▶ View Generated SQL" + query execution time badge)
- Expanded on click: shows the exact DuckDB SQL query that produced the current visualization
- Syntax-highlighted using a lightweight inline highlighter (SQL keywords in Copper, strings in green)
- Copy-to-clipboard button on hover

---

### 9.4 Screen 3: Stream Monitor

**Purpose:** Live streaming simulation, real-time model performance tracking, and drift detection.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  STREAM MONITOR                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ Control Bar ─────────────────────────────────────────────────────┐  │
│  │ [▶ Start] [⏸ Pause] [↻ Reset]   Speed: [═══●═══] 200 tx/s      │  │
│  │                                                                    │  │
│  │ [⚠️ Inject Fraud Shift]                      Step: 342 / 744     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ Accuracy │ │ F1-Score │ │ Processed│ │ Errors   │                   │
│  │ 97.4%    │ │ 0.847    │ │ 34,200   │ │ 891      │                   │
│  │ ● LIVE   │ │ ● LIVE   │ │ ● LIVE   │ │ ● LIVE   │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                          │
│  ┌─ Accuracy Timeline ───────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  100%─                                                             │  │
│  │       ████████████████████                                         │  │
│  │  95%─                    ███                                       │  │
│  │                             █                                      │  │
│  │  90%─                       █    ┌──────────────┐                  │  │
│  │                              █   │ 🔴 DRIFT #1  │                  │  │
│  │  85%─                        █   │ Step: 342    │                  │  │
│  │                               ██ │ Err: 0.02→18│                  │  │
│  │  80%─                          ██└──────────────┘██████████        │  │
│  │  ───────────────────────────────┼──────────────────────── step     │  │
│  │                                 ┆ (red dashed line)                │  │
│  │  Height: 300px                                                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Live Transaction Ticker ─────────────────────────────────────────┐  │
│  │ ● step:344  TRANSFER  ₹84,200   C→M   Pred: FRAUD 🔴  94.2%     │  │
│  │ ● step:344  PAYMENT   ₹1,230    C→M   Pred: SAFE  🟢   2.1%     │  │
│  │ ● step:343  CASH_OUT  ₹205,000  C→C   Pred: FRAUD 🔴  97.8%     │  │
│  │ ● step:343  TRANSFER  ₹45,100   C→M   Pred: SAFE  🟢   8.3%     │  │
│  │ ● step:343  PAYMENT   ₹890      C→M   Pred: SAFE  🟢   0.4%     │  │
│  │ (auto-scrolling, latest at top, max 50 visible rows)              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Drift Alert Banner (shown only when drift detected) ─────────── ┐  │
│  │ ⚠️  CONCEPT DRIFT DETECTED at Step 342                           │  │
│  │                                                                    │  │
│  │ Error variance shifted from 0.021 to 0.183 (p < 0.001)           │  │
│  │ ADWIN window resized from 1,204 to 342 samples                   │  │
│  │                                                                    │  │
│  │ Mining pre/post rules...  [████████░░] 80%                        │  │
│  │                                         [View Rule Diff →]        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Stream Controls:**
- **Start/Pause/Reset:** Toggle buttons with clear active state (Start = green outline when running, Pause = amber)
- **Speed Slider:** Range input from 10 tx/sec to 1000 tx/sec. Label updates in real time. Default: 200 tx/sec
- **Inject Fraud Shift:** Amber warning-colored button. On click, shows a confirmation dialog: *"This will simulate an adversarial shift at the current step. The ADWIN detector should flag this within 50-100 subsequent steps."* Confirm → backend shifts fraud pattern mid-stream. Button changes to "Shift Injected ✓" (disabled) after injection.
- **Step Counter:** Current step / total steps, displayed as mono-spaced countdown

**Accuracy Timeline:**
- Recharts `AreaChart` with smooth `monotone` interpolation
- Gradient fill under the line (Copper-Light fading to transparent)
- Red dashed `ReferenceLine` at each detected drift step
- Tooltip on hover shows exact step, accuracy, F1, error rate
- The chart auto-scrolls to follow the latest data point (keeps latest 500 steps visible, with horizontal scroll for history)

**Transaction Ticker:**
- A scrolling feed styled like a financial terminal
- Each row shows: status dot (green = safe prediction, red = fraud prediction), step number, transaction type badge, amount (mono-spaced right-aligned), account flow (C→M or C→C), prediction verdict, and fraud probability percentage
- Auto-scrolls with newest at top; pauses auto-scroll when user hovers
- Maximum 50 visible rows (virtualized list for performance)

**Drift Alert Banner:**
- Hidden by default
- Slides down from below the Accuracy Timeline when ADWIN fires
- Background: `Verdict-Threat-Light` (#FEF2F2) with left border 4px `Verdict-Threat`
- Shows: drift step, error rate delta, ADWIN window stats
- Progress bar while FP-Growth runs on the pre/post windows
- "View Rule Diff →" link navigates to Rule Explainer page filtered to this drift event

---

### 9.5 Screen 4: Rule Explainer

**Purpose:** The core Data Mining innovation — visual comparison of association rules before and after concept drift.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  RULE EXPLAINER                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ Drift Event Selector ────────────────────────────────────────────┐  │
│  │ Select Drift Event: [Drift #2 – Step 350 (Injected)  ▾]          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Mining Controls ─────────────────────────────────────────────────┐  │
│  │ Min Support: [═══●═══] 0.01     Min Confidence: [════●══] 0.50   │  │
│  │ Min Lift:    [═══●═══] 1.5      Window Size:    [═══●═══] 200    │  │
│  │                                              [🔄 Re-Mine Rules]  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Summary Bar ─────────────────────────────────────────────────────┐  │
│  │ Pre-Drift Rules: 12 │ Post-Drift Rules: 15 │ ⭐ Emerged: 5 │     │  │
│  │ ❌ Extinct: 3 │ 🔄 Shifted: 4                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ PRE-DRIFT (Steps 150→350) ───┐ ┌─ POST-DRIFT (Steps 350→550) ──┐  │
│  │                                 │ │                                │  │
│  │ ┌─ Rule Card ────────────────┐ │ │ ┌─ Rule Card ───────────────┐ │  │
│  │ │ {CASH_OUT, HIGH,           │ │ │ │ {TRANSFER, MEDIUM,        │ │  │
│  │ │  FULL_DRAIN}               │ │ │ │  PARTIAL_DRAIN,           │ │  │
│  │ │  → isFraud                 │ │ │ │  NEW_ACCOUNT}             │ │  │
│  │ │                            │ │ │ │  → isFraud                │ │  │
│  │ │ Sup: 4.2%  Conf: 91.5%    │ │ │ │                           │ │  │
│  │ │ Lift: 8.4                  │ │ │ │ Sup: 6.8%  Conf: 94.2%   │ │  │
│  │ │ ❌ EXTINCT AFTER DRIFT     │ │ │ │ Lift: 11.2               │ │  │
│  │ └────────────────────────────┘ │ │ │ ⭐ NEWLY EMERGED          │ │  │
│  │                                 │ │ └───────────────────────────┘ │  │
│  │ ┌─ Rule Card ────────────────┐ │ │                                │  │
│  │ │ {CASH_OUT, VERY_HIGH,      │ │ │ ┌─ Rule Card ───────────────┐ │  │
│  │ │  NIGHT}                    │ │ │ │ {TRANSFER, LOW,            │ │  │
│  │ │  → isFraud                 │ │ │ │  EVENING}                 │ │  │
│  │ │                            │ │ │ │  → isFraud                │ │  │
│  │ │ Sup: 2.1%  Conf: 88.3%    │ │ │ │                           │ │  │
│  │ │ Lift: 7.1                  │ │ │ │ Sup: 3.4%  Conf: 82.7%   │ │  │
│  │ │ ❌ EXTINCT AFTER DRIFT     │ │ │ │ Lift: 5.9                │ │  │
│  │ └────────────────────────────┘ │ │ │ ⭐ NEWLY EMERGED          │ │  │
│  │                                 │ │ └───────────────────────────┘ │  │
│  └─────────────────────────────────┘ └────────────────────────────────┘  │
│                                                                          │
│  ┌─ Drift Narrative ─────────────────────────────────────────────────┐  │
│  │ 📝 PLAIN-ENGLISH DRIFT EXPLANATION                                │  │
│  │                                                                    │  │
│  │ Before Step 350, fraud was concentrated in high-value CASH_OUT    │  │
│  │ transactions (>₹200K) that completely drained the sender's        │  │
│  │ account, typically occurring at night.                             │  │
│  │                                                                    │  │
│  │ After Step 350, fraud shifted to medium-value TRANSFER            │  │
│  │ transactions (₹50K–₹200K) targeting newly created accounts,      │  │
│  │ with only partial balance drainage, spread across evening hours.  │  │
│  │                                                                    │  │
│  │ Key signal: The FULL_DRAIN → PARTIAL_DRAIN shift suggests         │  │
│  │ adversaries are deliberately leaving residual balances to avoid   │  │
│  │ zero-balance detection heuristics.                                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Rule Cards:**
- Background: Canvas white with left border accent (Extinct = 4px red, Emerged = 4px Copper, Shifted = 4px amber)
- Antecedent items displayed as inline Badges/Tags (`TRANSFER` in blue, `HIGH` in amber, `FULL_DRAIN` in red)
- Consequent always shown as `→ isFraud` in mono font
- Metrics row: Support, Confidence, Lift in a horizontal metric strip
- Status badge at bottom: `EXTINCT` (red), `EMERGED` (copper/gold star), `SHIFTED ▲12%` (amber with delta)

**Mining Controls:**
- **Min Support Slider:** Range 0.001 to 0.1, step 0.005. Default: 0.01
- **Min Confidence Slider:** Range 0.3 to 0.99, step 0.05. Default: 0.50
- **Min Lift Slider:** Range 1.0 to 10.0, step 0.5. Default: 1.5
- **Window Size Slider:** Range 50 to 500, step 50. Default: 200
- **Re-Mine Rules Button:** Triggers a new FP-Growth execution with updated parameters. Shows a brief loading skeleton while mining runs (~1-3 seconds).

**Drift Narrative:**
- A card at the bottom with a `Bone` background and subtle border
- Auto-generated plain-English summary constructed from the rule diff data (template-based string interpolation, not LLM)
- Template: *"Before Step {drift_step}, fraud was concentrated in {top_pre_rule_description}. After Step {drift_step}, fraud shifted to {top_post_rule_description}."*

---

### 9.6 Screen 5: Warehouse Admin

**Purpose:** Schema inspection, ETL pipeline health, data quality monitoring, and table statistics.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WAREHOUSE ADMIN                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ Tab Bar ─────────────────────────────────────────────────────────┐  │
│  │  [Schema Viewer]  [ETL Monitor]  [Data Quality]  [Table Stats]   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  === Schema Viewer Tab ===                                               │
│  ┌─ Interactive ER Diagram ──────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Visual boxes for each table connected by FK lines.               │  │
│  │  Clicking a table box expands its column definitions below.       │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Column Data Dictionary ──────────────────────────────────────────┐  │
│  │ Table: fact_transactions                                          │  │
│  │ ┌──────────────────┬───────────┬──────────┬────────────────────┐  │  │
│  │ │ Column           │ Type      │ Nullable │ Description        │  │  │
│  │ │ tx_id            │ BIGINT    │ NO       │ Auto-increment PK  │  │  │
│  │ │ time_key         │ INTEGER   │ NO       │ FK → dim_time      │  │  │
│  │ │ amount           │ DEC(15,2) │ NO       │ Transaction amount │  │  │
│  │ │ is_fraud_actual  │ BOOLEAN   │ NO       │ Ground truth label │  │  │
│  │ │ ...              │ ...       │ ...      │ ...                │  │  │
│  │ └──────────────────┴───────────┴──────────┴────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Discretization Legend ───────────────────────────────────────────┐  │
│  │ This table shows how continuous values are binned for FP-Growth: │  │
│  │ ┌───────────┬─────────────┬──────────────────────────────────┐   │  │
│  │ │ Feature   │ Bin Name    │ Range / Condition                │   │  │
│  │ │ amount    │ MICRO       │ ₹0 – ₹1,000                    │   │  │
│  │ │ amount    │ LOW         │ ₹1,000 – ₹50,000               │   │  │
│  │ │ amount    │ MEDIUM      │ ₹50,000 – ₹200,000             │   │  │
│  │ │ amount    │ HIGH        │ ₹200,000 – ₹1,000,000          │   │  │
│  │ │ amount    │ VERY_HIGH   │ > ₹1,000,000                   │   │  │
│  │ │ balance   │ FULL_DRAIN  │ old > 0 AND new = 0             │   │  │
│  │ │ balance   │ PARTIAL     │ old > 0 AND new > old × 0.1     │   │  │
│  │ │ time      │ LATE_NIGHT  │ hour 0–5                        │   │  │
│  │ │ time      │ MORNING     │ hour 6–11                       │   │  │
│  │ │ time      │ AFTERNOON   │ hour 12–17                      │   │  │
│  │ │ time      │ EVENING     │ hour 18–23                      │   │  │
│  │ └───────────┴─────────────┴──────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  === ETL Monitor Tab ===                                                 │
│  ┌─ Pipeline Health ─────────────────────────────────────────────────┐  │
│  │ ● Extract:   IDLE   │ Last run: 2s ago   │ Records: 50 batch    │  │
│  │ ● Transform: IDLE   │ Last run: 2s ago   │ Errors: 0            │  │
│  │ ● Load:      IDLE   │ Last run: 2s ago   │ Inserted: 50         │  │
│  │ ● Overall:   ✅ HEALTHY                                          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  === Data Quality Tab ===                                                │
│  ┌─ Quality Checks ─────────────────────────────────────────────────┐  │
│  │ ✅ Null Check: 0 null values in required columns                 │  │
│  │ ✅ Orphan FK Check: 0 orphan foreign keys detected               │  │
│  │ ✅ Amount Sanity: 0 negative amounts                             │  │
│  │ ⚠️ Balance Anomaly: 142 transactions where newBalance > oldBal   │  │
│  │    + amount (possible data quality issue in PaySim source)       │  │
│  │ ✅ Duplicate Check: 0 duplicate tx_ids                           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  === Table Stats Tab ===                                                 │
│  ┌─ Table Row Counts ───────────────────────────────────────────────┐  │
│  │ fact_transactions      │ 6,362,620 rows  │ 98.2 MB              │  │
│  │ dim_time               │ 744 rows        │ 12 KB                │  │
│  │ dim_account            │ 12,408 rows     │ 340 KB               │  │
│  │ dim_transaction_type   │ 5 rows          │ 1 KB                 │  │
│  │ fact_drift_events      │ 3 rows          │ 2 KB                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 9.7 Screen 6: Ingest Lab

**Purpose:** Manual transaction scoring and batch CSV upload for live demonstration.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  INGEST LAB                                                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ Tab Bar ─────────────────────────────────────────────────────────┐  │
│  │  [Score Single Transaction]  [Upload CSV Batch]                   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  === Single Transaction Tab ===                                          │
│  ┌─ Transaction Form ────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │ Transaction Type:  [TRANSFER ▾]                                   │  │
│  │ Amount:            [₹ 84,200      ]                               │  │
│  │ Sender Old Bal:    [₹ 120,000     ]                               │  │
│  │ Sender New Bal:    [₹ 35,800      ]                               │  │
│  │ Receiver Old Bal:  [₹ 0           ]                               │  │
│  │ Receiver New Bal:  [₹ 84,200      ]                               │  │
│  │ Ground Truth:      [○ Fraud  ○ Legit  ● Unknown]                 │  │
│  │                                                                    │  │
│  │                            [🔍 Score Transaction]                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Prediction Result (shown after scoring) ─────────────────────────┐  │
│  │                                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  🔴 FRAUD RISK: 94.2%                                      │  │  │
│  │  │                                                             │  │  │
│  │  │  Verdict:     HIGH RISK — Likely Fraudulent                │  │  │
│  │  │  Model:       Hoeffding Tree (v1, 34,200 samples learned)  │  │  │
│  │  │  Warehouse:   ✅ Inserted as tx_id #6,362,621               │  │  │
│  │  │  ADWIN:       No drift triggered                            │  │  │
│  │  │  Latency:     4ms (inference) + 2ms (DuckDB insert)        │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  === CSV Upload Tab ===                                                  │
│  ┌─ Dropzone ────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │      ┌──────────────────────────────────────┐                     │  │
│  │      │                                      │                     │  │
│  │      │   📁 Drag & drop a .csv file here    │                     │  │
│  │      │        or click to browse            │                     │  │
│  │      │                                      │                     │  │
│  │      │   Accepted: .csv (max 10 MB)         │                     │  │
│  │      │   Required columns: step, type,      │                     │  │
│  │      │   amount, oldbalanceOrg, ...         │                     │  │
│  │      └──────────────────────────────────────┘                     │  │
│  │                                                                    │  │
│  │  Upload Results:                                                   │  │
│  │  ✅ 500 rows parsed                                               │  │
│  │  ✅ 500 rows validated (0 rejected)                               │  │
│  │  ✅ 500 rows scored by Hoeffding Tree                             │  │
│  │  ✅ 500 rows loaded into fact_transactions                        │  │
│  │  🔴 12 flagged as FRAUD (2.4% fraud rate in batch)               │  │
│  │  ⚪ No drift detected during batch processing                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 10. User Journeys & Interaction Flows

### 10.1 Journey A: The Full Demo (Viva/Presentation Flow)

```
Professor sits down → Student opens SENTINEL in browser
    │
    ├─ 1. COMMAND CENTER loads showing pre-loaded warehouse stats
    │      "Sir, the warehouse has 6.3 million transactions in a Star Schema"
    │
    ├─ 2. Navigate to OLAP STUDIO
    │      Student clicks Roll-Up → shows weekly fraud totals
    │      Student clicks Drill-Down → clicks Week 3 → sees daily breakdown → clicks Day 15 → hourly
    │      Student clicks Slice → selects CASH_OUT only
    │      Student clicks Dice → checks TRANSFER+CASH_OUT, Fraud Only, Night Only
    │      Student clicks Pivot → shows Type × Day cross-tabulation matrix
    │      SQL Inspector shows the exact DuckDB query for each operation
    │      "Sir, every OLAP operation runs on DuckDB in under 20ms"
    │
    ├─ 3. Navigate to STREAM MONITOR
    │      Student clicks Start Stream → transactions begin flowing at 200 tx/s
    │      Accuracy chart rises to ~97%
    │      Student clicks "Inject Fraud Shift"
    │      After ~50 steps, accuracy drops visibly
    │      ADWIN banner slides in: "DRIFT DETECTED at Step 342!"
    │      Accuracy recovers as Hoeffding Tree adapts
    │      "Sir, the model detected the drift automatically and recovered"
    │
    ├─ 4. Navigate to RULE EXPLAINER (via "View Rule Diff →" link in drift banner)
    │      Pre-drift rules show: {CASH_OUT, HIGH, FULL_DRAIN} → isFraud
    │      Post-drift rules show: {TRANSFER, MEDIUM, PARTIAL_DRAIN} → isFraud
    │      Student adjusts Min Support slider → rules update live
    │      Drift Narrative explains the shift in plain English
    │      "Sir, FP-Growth explains exactly how the fraud pattern changed"
    │
    ├─ 5. Navigate to INGEST LAB
    │      Professor gives parameters: "Try TRANSFER, ₹84,000"
    │      Student enters values, clicks Score
    │      Result: "FRAUD RISK: 94.2% — Inserted into warehouse as tx #6,362,621"
    │      "Sir, you can test any transaction live and it goes into the warehouse"
    │
    └─ 6. Navigate to WAREHOUSE ADMIN
           Show Schema Viewer → Star Schema diagram with all tables
           Show Data Quality → all checks passing
           Show Table Stats → row counts and sizes
           "Sir, the complete data dictionary and schema are documented here"
```

### 10.2 Journey B: CSV Batch Audit

```
Analyst has a suspicious batch of 500 new transactions
    │
    ├─ 1. Navigate to INGEST LAB → CSV Upload tab
    ├─ 2. Drag-and-drop the .csv file
    ├─ 3. System validates columns, scores all 500, loads into DuckDB
    ├─ 4. Results: "12 flagged as FRAUD (2.4% rate)"
    ├─ 5. Navigate to OLAP STUDIO → Dice: filter to just-uploaded batch + fraud only
    └─ 6. Drill-Down into the 12 flagged transactions for detailed review
```

---

## 11. API Specification

### 11.1 REST Endpoints

| Method | Endpoint | Description | Request | Response |
|:---|:---|:---|:---|:---|
| `GET` | `/api/health` | System health check | — | `{ status, warehouse_size, model_samples, uptime }` |
| `GET` | `/api/warehouse/stats` | Table row counts and sizes | — | `{ tables: [{ name, rows, size_mb }] }` |
| `GET` | `/api/warehouse/schema` | Column definitions for all tables | — | `{ tables: [{ name, columns: [{ name, type, nullable }] }] }` |
| `GET` | `/api/warehouse/quality` | Data quality check results | — | `{ checks: [{ name, status, detail }] }` |
| `GET` | `/api/olap/query` | Execute parameterized OLAP query | `?operation=rollup&granularity=day&type=CASH_OUT&fraud_only=true` | `{ data: [...], sql: "...", execution_ms: 14 }` |
| `GET` | `/api/olap/pivot` | Execute pivot cross-tabulation | `?row_dim=day_of_week&col_dim=type_name&measure=sum_amount` | `{ matrix: {...}, sql: "...", execution_ms: 22 }` |
| `POST` | `/api/ingest/single` | Score and ingest a single transaction | `TransactionInput` JSON body | `{ tx_id, fraud_probability, verdict, drift_detected, latency_ms }` |
| `POST` | `/api/ingest/csv` | Upload and process a CSV batch | `multipart/form-data` with `.csv` file | `{ total, valid, rejected, fraud_flagged, drift_triggered }` |
| `GET` | `/api/mining/drift-events` | List all recorded drift events | — | `{ events: [{ drift_id, step, error_before, error_after, rules_summary }] }` |
| `POST` | `/api/mining/rules` | Trigger FP-Growth on a specific drift event | `{ drift_id, min_support, min_confidence, min_lift, window_size }` | `{ emerged: [...], extinct: [...], shifted: [...], summary }` |
| `GET` | `/api/stream/status` | Current stream state | — | `{ state: "running"|"paused"|"idle", current_step, speed, total_processed }` |
| `POST` | `/api/stream/control` | Start, pause, reset, or inject drift | `{ action: "start"|"pause"|"reset"|"inject", speed?: number }` | `{ success, state }` |
| `GET` | `/api/metrics/kpis` | Dashboard KPI values | — | `{ total_tx, fraud_rate, accuracy, f1, drift_count, warehouse_mb }` |

### 11.2 WebSocket

| Endpoint | Direction | Message Format |
|:---|:---|:---|
| `ws://localhost:8000/ws/stream` | Server → Client | `{ type: "transaction", data: { step, type, amount, pred, prob, accuracy, f1 } }` |
| | Server → Client | `{ type: "drift", data: { step, error_before, error_after, width } }` |
| | Server → Client | `{ type: "rules_ready", data: { drift_id, emerged_count, extinct_count } }` |
| | Server → Client | `{ type: "metrics", data: { accuracy, f1, processed, errors } }` |
| | Client → Server | `{ action: "set_speed", speed: 500 }` (optional runtime speed adjustment) |

---

## 12. Performance Requirements & KPIs

### 12.1 System Performance Targets

| Metric | Target | Measurement Method |
|:---|:---|:---|
| **OLAP Query Latency** | < 50ms for any single OLAP operation on 6.3M rows | `execution_ms` field in API response |
| **DuckDB Full-Table Scan** | < 200ms for unfiltered COUNT(*) on `fact_transactions` | Timed SQL execution |
| **Pivot Query** | < 100ms for Type × Day pivot with SUM(amount) | Timed SQL execution |
| **ETL Insert Throughput** | ≥ 5,000 rows/sec bulk insert into DuckDB | Batch insert timing |
| **Single TX Scoring** | < 20ms end-to-end (inference + insert + response) | API response latency |
| **FP-Growth Mining** | < 5 seconds for window of 200 fraud transactions | Timed function call |
| **WebSocket Latency** | < 50ms from server emit to client render | Chrome DevTools WebSocket frame timing |
| **Frontend Initial Load** | < 2 seconds (including Vite HMR dev mode) | Lighthouse or manual timing |
| **Memory Usage (Backend)** | < 500 MB RSS during active streaming | `psutil` monitoring |
| **DuckDB File Size** | < 150 MB for full PaySim dataset | Filesystem check |

### 12.2 Model Performance KPIs

| KPI | Definition | Target |
|:---|:---|:---|
| **Rolling Accuracy** | Correct predictions / Total predictions (window = 500) | > 95% pre-drift, recovery to > 90% within 100 steps post-drift |
| **Rolling F1-Score** | Harmonic mean of precision and recall (window = 500) | > 0.80 |
| **Drift Detection Latency** | Steps between actual drift injection and ADWIN detection | < 100 steps |
| **False Drift Rate** | Drift alerts when no actual drift occurred | < 1 per 10,000 steps |
| **Rule Mining Relevance** | At least one emerged rule directly matches the injected pattern shift | Must match in at least 1 of top 3 emerged rules |

---

## 13. Security, Permissions & Audit

### 13.1 Security Posture

> [!NOTE]
> SENTINEL is an academic project running locally. Security measures are proportional to this context but follow best practices for defense-in-depth.

| Layer | Measure | Implementation |
|:---|:---|:---|
| **Input Validation** | All user inputs (manual TX form, CSV upload) are validated via Pydantic models with strict type enforcement | FastAPI Pydantic schemas with `Field(ge=0)` for amounts, enum constraints for transaction types |
| **CSV Upload Safety** | File type whitelist (`.csv` only), max size 10 MB, column schema validation before processing | `python-multipart` + pandas `read_csv` with `usecols` whitelist |
| **SQL Injection Prevention** | All DuckDB queries use parameterized bindings (`?` placeholders), never string interpolation | DuckDB `con.execute(query, params)` |
| **CORS** | Restricted to `localhost:5173` (Vite dev server) in development | FastAPI `CORSMiddleware` with explicit `allow_origins` |
| **Rate Limiting** | Basic throttle on CSV upload endpoint (max 5 uploads/minute) | In-memory counter middleware |
| **Error Handling** | Internal errors return generic messages to client; detailed errors logged server-side | FastAPI exception handlers with structured JSON logging |

### 13.2 Audit Logging

All significant system events are logged as structured JSON to `backend/logs/sentinel.jsonl`:

```json
{
  "timestamp": "2026-09-10T14:32:05.123Z",
  "level": "INFO",
  "event": "DRIFT_DETECTED",
  "data": {
    "drift_id": 2,
    "step": 350,
    "error_before": 0.021,
    "error_after": 0.183,
    "is_injected": true
  }
}
```

**Logged Events:**
- `STREAM_STARTED`, `STREAM_PAUSED`, `STREAM_RESET`
- `DRIFT_INJECTED` (user clicked inject button)
- `DRIFT_DETECTED` (ADWIN fired)
- `RULES_MINED` (FP-Growth completed with params and result summary)
- `TX_SCORED` (manual transaction scored with prediction)
- `CSV_UPLOADED` (batch uploaded with row counts)
- `OLAP_QUERY` (query type, parameters, execution time)
- `ETL_BATCH` (batch loaded into warehouse with row count)
- `ERROR` (any unhandled exception with traceback)

---

## 14. Scalability & Future Extensions

### 14.1 Designed Scalability (Current Architecture)

| Dimension | Current Capacity | Bottleneck | Upgrade Path |
|:---|:---|:---|:---|
| **Data Volume** | ~10M transactions (DuckDB single-file) | DuckDB file I/O | Switch to MotherDuck (cloud DuckDB) or ClickHouse |
| **Concurrent Users** | 1–5 (single uvicorn worker) | Python GIL + single WebSocket | Add uvicorn workers + Redis pub/sub for WebSocket fanout |
| **Stream Speed** | 1,000 tx/sec | Python generator + synchronous DuckDB writes | Async batch writer + Apache Kafka ingestion |
| **Mining Complexity** | 200-transaction windows | FP-Growth memory for large itemsets | Incremental FP-Growth or streaming pattern mining |

### 14.2 Potential Future Extensions

| Extension | Description | Complexity |
|:---|:---|:---|
| **Multi-Model Ensemble** | Run Adaptive Random Forest alongside Hoeffding Tree and compare drift sensitivity | Medium |
| **Real Kafka Integration** | Replace Python generator with Apache Kafka consumer for production-grade streaming | Medium |
| **LLM Drift Narratives** | Pass rule diffs to an LLM API (e.g., Gemini) for richer natural-language explanations | Low |
| **Graph-Based Fraud Rings** | Integrate GHOST NETWORK's community detection for structural fraud alongside temporal drift | High |
| **Slowly Changing Dimensions** | Implement SCD Type 2 on `dim_account` to track account risk tier changes over time | Medium |
| **Multi-Tenant Support** | Add user authentication (JWT) and role-based access control | Medium |
| **Export & Reporting** | PDF/CSV export of OLAP results, drift reports, and rule comparisons | Low |

---

## 15. Edge Cases & Error Handling

### 15.1 Data Edge Cases

| Scenario | Expected Behavior |
|:---|:---|
| PaySim CSV has missing `isFraud` labels | Treat as unlabeled. Run prediction but skip ADWIN update and accuracy computation. Log warning. |
| CSV upload with wrong column names | Reject with 400 error: `"Missing required columns: ['step', 'type', 'amount']. Found: ['...']. See expected schema."` |
| CSV upload with 0 fraud transactions in a batch | Process normally. FP-Growth will not be triggered (no fraud window to mine). |
| Very low min_support (e.g., 0.001) causes thousands of rules | Cap displayed rules at 50 most significant (sorted by Lift descending). Show warning: "Showing top 50 of 1,247 rules. Increase min_support for fewer results." |
| ADWIN fires at the very start of the stream (< 100 steps) | Suppress drift alert. ADWIN needs a minimum burn-in period. Log: "Drift signal suppressed: insufficient history (< 100 steps)." |
| User clicks "Inject Shift" twice | Second click is a no-op. Button is already disabled after first injection. |
| Manual TX form: negative amount | Pydantic validation rejects: `"amount must be ≥ 0"`. Form shows inline error. |
| Manual TX form: amount = 0 | Accept but flag as anomalous (zero-amount transactions are suspicious). |
| DuckDB file corruption | On startup, run `PRAGMA integrity_check`. If it fails, rebuild from PaySim CSV with full ETL. Show error page. |
| WebSocket disconnects mid-stream | React auto-reconnects with exponential backoff (1s, 2s, 4s, max 30s). Stream state is preserved server-side. |

### 15.2 UI States

Every data-dependent component must handle 4 states:

| State | Visual Treatment |
|:---|:---|
| **Loading** | Skeleton shimmer placeholder matching the component's final shape |
| **Empty** | Illustrated empty state with a message (e.g., "No drift events yet. Start the stream and inject a shift.") and a CTA button |
| **Error** | Red-tinted card with error icon, message, and "Retry" button |
| **Data** | Normal populated state with all interactive controls active |

---

## 16. Accessibility

| Requirement | Implementation |
|:---|:---|
| **Color Contrast** | All text meets WCAG 2.1 AA (4.5:1 ratio minimum). Verified: Ink on Paper = 15.4:1, Slate on Paper = 4.6:1 |
| **Keyboard Navigation** | All interactive elements (buttons, sliders, tabs, table rows) are focusable via Tab. Active focus ring: 2px Copper outline with 2px offset |
| **Screen Reader** | All charts have `aria-label` descriptions summarizing the data. Metric cards use `role="status"` with `aria-live="polite"` for live updates |
| **Motion Sensitivity** | Respect `prefers-reduced-motion` media query. Disable chart animations, ticker auto-scroll, and drift badge pulse |
| **Font Scaling** | All font sizes use `rem` units. Layout does not break at 200% browser zoom |
| **Touch Targets** | All buttons and interactive elements have minimum 44px × 44px touch target on mobile viewports |

---

## 17. Acceptance Criteria

### 17.1 Data Warehousing Acceptance

| # | Criterion | Pass Condition |
|:---|:---|:---|
| DW-1 | Star Schema is created in DuckDB with correct FK relationships | `PRAGMA table_info('fact_transactions')` returns all expected columns and types |
| DW-2 | ETL successfully loads all 6,362,620 PaySim records | `SELECT COUNT(*) FROM fact_transactions` = 6,362,620 |
| DW-3 | `dim_time` has correct temporal hierarchy | `SELECT DISTINCT hour_of_day FROM dim_time` returns 24 values (0-23) |
| DW-4 | `dim_transaction_type` is seeded with 5 types | `SELECT COUNT(*) FROM dim_transaction_type` = 5 |
| DW-5 | Roll-Up query produces correct aggregation | Weekly SUM(amount) = SUM of daily SUM(amount) values for that week |
| DW-6 | Drill-Down navigates correctly through hierarchy | Clicking Week 3 shows exactly the days belonging to Week 3 |
| DW-7 | Slice correctly isolates single dimension | `type_name='CASH_OUT'` slice returns 0 rows of other types |
| DW-8 | Dice applies multiple filters simultaneously | Result set matches manual SQL verification with all WHERE clauses |
| DW-9 | Pivot produces correct cross-tabulation | Cell values match individual `GROUP BY` queries |
| DW-10 | SQL Inspector shows the exact executed query | Displayed SQL can be copy-pasted into DuckDB CLI and produces identical results |

### 17.2 Data Mining Acceptance

| # | Criterion | Pass Condition |
|:---|:---|:---|
| DM-1 | Hoeffding Tree achieves > 95% rolling accuracy pre-drift | Accuracy timeline stays above 95% line for first 300 steps |
| DM-2 | ADWIN detects injected drift within 100 steps | Drift alert fires between step 350 and step 450 |
| DM-3 | No false drift alerts during stable phase | Zero drift events between step 50 and step 349 |
| DM-4 | FP-Growth produces at least 3 rules per window | Both pre-drift and post-drift rule sets are non-empty |
| DM-5 | Emerged rules match the injected pattern | At least one emerged rule contains `TRANSFER` (matching the injected shift from `CASH_OUT` to `TRANSFER`) |
| DM-6 | Extinct rules match the pre-drift pattern | At least one extinct rule contains `CASH_OUT` + `FULL_DRAIN` |
| DM-7 | Support, Confidence, Lift values are mathematically correct | Manual verification: pick one rule, compute metrics by hand from raw data, confirm match |
| DM-8 | Discretization bins are correctly applied | Verify: transaction with amount = 75,000 is binned as `MEDIUM` |
| DM-9 | Model accuracy recovers after drift | Rolling accuracy returns above 90% within 200 steps after drift detection |
| DM-10 | Drift narrative accurately describes the shift | Narrative mentions both the old pattern type and the new pattern type |

### 17.3 Web Application Acceptance

| # | Criterion | Pass Condition |
|:---|:---|:---|
| UI-1 | All 6 pages render without errors | No console errors on page load for any route |
| UI-2 | WebSocket connects and streams live data | Transaction ticker shows new rows arriving in real time |
| UI-3 | Stream controls (Start/Pause/Reset) work correctly | Pausing stops new data; resetting clears state and returns to step 0 |
| UI-4 | Manual TX form scores and inserts into warehouse | After scoring, `SELECT * FROM fact_transactions ORDER BY tx_id DESC LIMIT 1` returns the submitted transaction |
| UI-5 | CSV upload validates, processes, and reports results | Uploading a 500-row CSV shows correct counts for parsed, scored, and loaded |
| UI-6 | FP-Growth re-mining with adjusted sliders updates rules | Changing min_support from 0.01 to 0.05 reduces the number of displayed rules |
| UI-7 | Drift alert banner appears when drift is detected | Banner slides into view within 2 seconds of ADWIN detection |
| UI-8 | OLAP operations are visually distinct and interactive | Each of the 5 operations produces a different chart/table view |
| UI-9 | Application is responsive at 1280px, 1440px, and 1920px widths | Layout does not overflow or break at any of these viewport widths |
| UI-10 | Loading, empty, and error states display correctly | Disconnecting WebSocket shows reconnection state; empty drift list shows empty state illustration |

---

## 18. Implementation Timeline

| Week | Focus Area | Key Deliverables | Owner |
|:---|:---|:---|:---|
| **Week 1** | **Foundation & Warehouse** | DuckDB Star Schema DDL, ETL pipeline for full PaySim load, dim_time/dim_account/dim_transaction_type population, basic OLAP query library (all 5 operations verified in DuckDB CLI) | Priyanshu G., Ronak B. |
| **Week 2** | **Intelligence & Streaming** | river Hoeffding Tree integration, ADWIN drift detector, stream simulator with drift injection, discretizer module, FP-Growth rule miner with diff logic | Ronak B., Nikhat M. |
| **Week 3** | **API & Frontend Core** | FastAPI routes (all endpoints), WebSocket stream handler, React app scaffold (layout, routing, design system tokens), OLAP Studio page, Stream Monitor page | Priyanshu G., Nikhat M. |
| **Week 4** | **Polish & Integration** | Rule Explainer page, Ingest Lab (manual form + CSV dropzone), Warehouse Admin page, Command Center dashboard, end-to-end testing, demo rehearsal, documentation | All |

---

## 19. Glossary

| Term | Definition |
|:---|:---|
| **ADWIN** | Adaptive Windowing — a drift detection algorithm that dynamically resizes a sliding window based on statistical distribution changes |
| **Association Rule** | A pattern of the form {A, B} → {C} discovered in transactional data, measured by Support, Confidence, and Lift |
| **Concept Drift** | A change in the statistical distribution of the target variable over time, causing trained models to degrade |
| **Confidence** | The probability that the consequent occurs given that the antecedent occurred: P(B\|A) |
| **DuckDB** | An embedded, columnar, analytical SQL database engine optimized for OLAP workloads |
| **ETL** | Extract, Transform, Load — the process of moving data from sources into a data warehouse |
| **Fact Table** | The central table in a Star Schema containing quantitative measures (metrics) and foreign keys to dimension tables |
| **FP-Growth** | Frequent Pattern Growth — an association rule mining algorithm that uses an FP-Tree structure, requiring only 2 database scans |
| **Hoeffding Tree** | An incremental decision tree that uses the Hoeffding statistical bound to decide when to split on an attribute |
| **Lift** | The ratio of observed support to expected support assuming independence: Confidence(A→B) / Support(B). Lift > 1 indicates positive correlation |
| **OLAP** | Online Analytical Processing — multi-dimensional data analysis operations (Roll-Up, Drill-Down, Slice, Dice, Pivot) |
| **PaySim** | A synthetic mobile money transaction dataset simulating realistic financial fraud patterns (6.36M transactions) |
| **Star Schema** | A dimensional modeling pattern with a central fact table surrounded by denormalized dimension tables |
| **Support** | The frequency of a pattern in the dataset: P(A ∩ B) / N |
| **Surrogate Key** | An artificial, system-generated primary key (integer) used in dimension tables, decoupled from the natural/business key |

---

> **End of PRD — Version 1.0.0**
>
> *SENTINEL: Stream-Enabled Non-stationary Transaction Intelligence & Novel Explanation Layer*
