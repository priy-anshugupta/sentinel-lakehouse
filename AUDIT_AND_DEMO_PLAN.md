# Sentinel audit and DWM demonstration plan

Audit date: 2 October 2026. Scope: local React/FastAPI project, synthetic PaySim dataset, dimensional warehouse, mining and role workflows.

## Findings and changes

| Finding | Priority | Required change |
| --- | --- | --- |
| Hoeffding tree and hand-written scores obscure the syllabus classifier | High | Use an explicit CART decision tree, show the tree and settings |
| CSV warm start followed by replay is not an independent benchmark | High | Train from warehouse facts; reserve later simulation steps for testing |
| Model and training results disappear on restart | High | Persist a local model artifact and versioned evaluation in DuckDB |
| Mining results lack an approachable visual explanation | High | Add clustering with PCA projection, group summaries and silhouette score |
| Dataset semantics are hard to discover | High | Dataset profile, class distribution, sample rows, dictionary and source link |
| OLAP controls hide slice/dice/pivot, and month/week boundaries overlap | High | Explicit operations; month → day → hour drill hierarchy with scoped totals |
| Time dimension excludes step 744 and has fixed coverage | High | Populate missing time keys dynamically and use consistent one-based days/weeks |
| CSV ingestion accepts invalid values and loses source account IDs on replay | High | Validate rows, preserve account IDs, retain unknown labels |
| Old and new predictions can be mistaken for one model | High | Version new predictions; retain and label historical results |
| Dashboard relies heavily on tables and plain cards | Medium | Add volume trends, composition chart, activity heatmap and model summary |
| Continuous learning wording does not fit a batch decision tree | Medium | Explicit controlled retraining; drift remains an optional monitoring extension |

## Demonstration sequence

1. Sign in and open Dataset & warehouse: explain one row, synthetic source, labels and star schema.
2. Explore data: aggregate by day, roll up to week, slice one transaction type, dice type/time and pivot the result.
3. Model lab: train CART on earlier labelled warehouse steps, evaluate on later steps, inspect confusion matrix and tree branches.
4. Behaviour groups: run K-means on warehouse features without labels; inspect PCA plot and group summaries. These groups are not fraud verdicts.
5. Overview: explain volume, confirmed labels, historical model flags and the active model version.
6. Transaction monitor: replay sample events, observe versioned predictions and notifications. Retraining is explicit, not self-training on predictions.

## Boundaries

- No syllabus document or marking rubric is present. CART, K-means and Apriori are common teaching algorithms; exact syllabus alignment still needs the teacher's topic list.
- The sample is small and synthetic; held-out fraud counts must be shown beside metrics. No production-bank accuracy claim is justified.
- Balance changes are known after a transaction, so classification is retrospective review, not pre-authorisation blocking.
- Replay repeats synthetic records. Deduplicated feature signatures are used for mining; warehouse dashboards count ingestions.
- Regression is omitted because this task has a categorical target. Live bank connectivity and an AI API key are unnecessary for this local demonstration.

## Implementation verification

- 15 backend workflow checks cover role boundaries, chronological splits, saved model restoration, fixed tree weights during scoring, clustering memberships, CSV validation, step 744/750 coverage, OLAP reconciliation, notifications and idempotent bundled-sample loading.
- 9 frontend checks cover local report interpretation, drift wording and alert semantics.
- Frontend production build succeeds. Browser checks cover investigator/engineer sign-in, overview, model evidence, clustering, dataset profile and OLAP.
- The runtime warehouse retains its original 1,880 ingestions and adds 1,391 missing bundled sample records: 3,271 fact rows, 2,841 distinct mining signatures. It includes historical simulation variants; the CSV itself contains 2,838 rows and 23 fraud labels.
- Default CART test snapshot: train steps 1–558, test 559–744; 747 test rows with 8 fraud labels. Found 7, missed 1, raised 26 false alarms. Precision 21.2%, recall 87.5%, F1 34.1%. These are sample results, not bank validation.
- K-means: 3 groups, silhouette 0.361 on this snapshot. Apriori: 17 rules meet default thresholds.
- A restart exposed DuckDB 1.5.x WAL replay failure. An intact DB/WAL backup was retained in ignored `backend/data/recovery-20261002`; attachment from an in-memory default database recovered all original rows. Startup now uses that attachment approach and checkpoints schema/mining changes.
- Historical flags are not reclassified silently; they retain the legacy model version. New model scores use the saved CART version.
- Final server restart verified active model `cart-368c03fd61` and unchanged 3,271 warehouse rows. Browser verification confirmed filtered pivot columns, dataset star schema and restored model evidence. Dashboard preview: `docs/screenshots/model-lab.png`.

## References

- https://scikit-learn.org/stable/modules/tree.html
- https://scikit-learn.org/stable/modules/clustering.html
- https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/grain/
- https://github.com/EdgarLopezPhD/PaySim
