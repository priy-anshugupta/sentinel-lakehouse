import subprocess
import os

commits = [
    {
        "files": [".gitignore"],
        "msg": "chore: initialize repository structure and gitignore"
    },
    {
        "files": ["PRD.md"],
        "msg": "docs: add initial product requirements and system specifications"
    },
    {
        "files": ["backend/requirements.txt", "backend/app/config.py", "backend/app/__init__.py"],
        "msg": "feat(backend): configure application environment and dependencies"
    },
    {
        "files": ["backend/app/warehouse/ddl.py", "backend/app/warehouse/__init__.py"],
        "msg": "feat(warehouse): define Kimball star schema DDL for DuckDB"
    },
    {
        "files": ["backend/app/warehouse/connection.py"],
        "msg": "feat(warehouse): implement DuckDB database connection and lifecycle manager"
    },
    {
        "files": ["backend/app/warehouse/etl.py"],
        "msg": "feat(warehouse): build ETL pipeline for time dimensions and account caching"
    },
    {
        "files": ["backend/app/warehouse/data_quality.py"],
        "msg": "feat(warehouse): add schema and referential integrity validation checks"
    },
    {
        "files": ["backend/app/warehouse/olap_queries.py"],
        "msg": "feat(warehouse): implement multi-dimensional OLAP aggregation queries"
    },
    {
        "files": ["backend/app/warehouse/etl_runner.py"],
        "msg": "feat(warehouse): add standalone ETL runner and batch orchestrator"
    },
    {
        "files": ["backend/data/paysim.csv"],
        "msg": "feat(dataset): bundle curated PaySim financial streaming dataset"
    },
    {
        "files": ["backend/data/sentinel_warehouse.duckdb"],
        "msg": "feat(warehouse): bundle pre-warmed columnar warehouse database"
    },
    {
        "files": ["backend/app/ingestion/stream_simulator.py", "backend/app/ingestion/__init__.py"],
        "msg": "feat(ingestion): implement StreamSimulator with circular event replay"
    },
    {
        "files": ["backend/app/intelligence/stream_classifier.py", "backend/app/intelligence/__init__.py"],
        "msg": "feat(ml): implement incremental Hoeffding Tree classifier with River"
    },
    {
        "files": ["backend/app/intelligence/drift_detector.py"],
        "msg": "feat(drift): build ADWIN adaptive window concept drift detector"
    },
    {
        "files": ["backend/app/intelligence/rule_miner.py"],
        "msg": "feat(mining): implement unsupervised FP-Growth frequent itemset miner"
    },
    {
        "files": ["backend/app/ingestion/manual_scorer.py"],
        "msg": "feat(scoring): implement prequential manual transaction scoring pipeline"
    },
    {
        "files": ["backend/app/routes/__init__.py", "backend/app/main.py"],
        "msg": "feat(api): initialize FastAPI application with stateful lifespan"
    },
    {
        "files": ["backend/app/routes/health.py"],
        "msg": "feat(api): implement telemetry health and KPI analytics routes"
    },
    {
        "files": ["backend/app/routes/stream_ws.py"],
        "msg": "feat(api): build real-time WebSocket transaction streaming endpoint"
    },
    {
        "files": ["backend/app/routes/stream_control.py"],
        "msg": "feat(api): add stream speed and synthetic drift injection controls"
    },
    {
        "files": ["backend/app/routes/olap.py"],
        "msg": "feat(api): implement multi-dimensional DuckDB OLAP analytical routes"
    },
    {
        "files": ["backend/app/routes/mining.py"],
        "msg": "feat(api): add association rule mining and drift event query routes"
    },
    {
        "files": ["backend/app/routes/warehouse_admin.py", "backend/app/routes/ingest.py"],
        "msg": "feat(api): implement warehouse administrative inspection and table endpoints"
    },
    {
        "files": [
            "frontend/package.json", 
            "frontend/package-lock.json", 
            "frontend/vite.config.js", 
            "frontend/tailwind.config.js", 
            "frontend/postcss.config.js", 
            "frontend/index.html"
        ],
        "msg": "feat(frontend): initialize Vite React application with Tailwind CSS"
    },
    {
        "files": [
            "frontend/src/config/theme.js", 
            "frontend/src/index.css", 
            "frontend/src/lib/constants.js", 
            "frontend/src/lib/formatters.js"
        ],
        "msg": "feat(frontend): establish precision cartography design system and UI tokens"
    },
    {
        "files": [
            "frontend/src/components/shared/MetricCard.jsx",
            "frontend/src/components/shared/Skeleton.jsx",
            "frontend/src/components/shared/StatusDot.jsx",
            "frontend/src/components/shared/EmptyState.jsx",
            "frontend/src/components/shared/HelpTooltip.jsx",
            "frontend/src/components/layout/PageShell.jsx",
            "frontend/src/components/layout/Sidebar.jsx",
            "frontend/src/components/layout/TopBar.jsx"
        ],
        "msg": "feat(frontend): build shared UI primitives, layout shell, and help tooltips"
    },
    {
        "files": [
            "frontend/src/hooks/useWebSocket.js",
            "frontend/src/hooks/useStreamState.js",
            "frontend/src/hooks/useOlapQuery.js",
            "frontend/src/lib/api.js"
        ],
        "msg": "feat(frontend): implement useWebSocket, stream telemetry, and OLAP query hooks"
    },
    {
        "files": [
            "frontend/src/pages/CommandCenter.jsx",
            "frontend/src/components/charts/AccuracyTimeline.jsx",
            "frontend/src/components/charts/FraudHeatmap.jsx",
            "frontend/src/components/charts/OlapBarChart.jsx"
        ],
        "msg": "feat(frontend): implement CommandCenter analytical dashboard"
    },
    {
        "files": ["frontend/src/pages/StreamMonitor.jsx"],
        "msg": "feat(frontend): build Live Stream Monitor with millisecond latency ticker"
    },
    {
        "files": [
            "frontend/src/pages/OlapStudio.jsx",
            "frontend/src/components/charts/OlapCube3D.jsx"
        ],
        "msg": "feat(frontend): implement 3D OLAP Cube Studio with dimensional hierarchy fusion"
    },
    {
        "files": ["frontend/src/pages/RuleExplainer.jsx"],
        "msg": "feat(frontend): build RuleExplainer forensic drift narrative console"
    },
    {
        "files": [
            "frontend/src/pages/WarehouseAdmin.jsx",
            "frontend/src/components/warehouse/StarSchemaDiagram.jsx",
            "frontend/src/pages/IngestLab.jsx"
        ],
        "msg": "feat(frontend): implement WarehouseAdmin star schema visualizer and IngestLab"
    },
    {
        "files": [
            "frontend/src/context/RoleContext.jsx",
            "frontend/src/App.jsx",
            "frontend/src/main.jsx"
        ],
        "msg": "feat(rbac): implement role-based access control and session management"
    },
    {
        "files": [
            "frontend/src/lib/queryParser.js",
            "frontend/src/pages/ReportBuilder.jsx"
        ],
        "msg": "feat(reports): build plain-English natural language OLAP report builder"
    },
    {
        "files": ["frontend/src/pages/Glossary.jsx"],
        "msg": "feat(help): add searchable 24-term banking glossary and contextual tooltips"
    },
    {
        "files": ["frontend/src/pages/LoginPage.jsx"],
        "msg": "feat(auth): implement enterprise homepage with in-card credentials and 1-click signup"
    },
    {
        "files": ["README.md"],
        "msg": "docs: add comprehensive enterprise lakehouse documentation and architecture guide"
    }
]

def run():
    print("Starting commit generation...")
    count = 0
    for c in commits:
        files = c["files"]
        existing = [f for f in files if os.path.exists(f)]
        if not existing:
            continue
        # Add files
        subprocess.run(["git", "add"] + existing, check=True)
        # Check if anything is staged
        diff_res = subprocess.run(["git", "diff", "--cached", "--quiet"])
        if diff_res.returncode != 0: # has staged changes
            subprocess.run(["git", "commit", "-m", c["msg"]], check=True)
            count += 1
            print(f"[{count}] Committed: {c['msg']}")
        else:
            print(f"Skipping empty commit for: {c['msg']}")
            
    # Check if any remaining files need to be committed
    subprocess.run(["git", "add", "."], check=True)
    diff_res = subprocess.run(["git", "diff", "--cached", "--quiet"])
    if diff_res.returncode != 0:
        subprocess.run(["git", "commit", "-m", "chore: finalize repository artifacts and configuration"], check=True)
        count += 1
        print(f"[{count}] Committed remaining files")
        
    print(f"\nSuccessfully created {count} commits!")

if __name__ == "__main__":
    run()
