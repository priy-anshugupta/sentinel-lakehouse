import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Code2, 
  Sparkles, 
  Filter, 
  Info,
  Maximize2,
  Minimize2
} from 'lucide-react';

const GLOSSARY_TERMS = [
  { 
    term: 'Concept Drift', 
    category: 'Machine Learning', 
    definition: "When fraudsters change their attack strategy, causing the AI model's accuracy to drop because it was trained on old patterns.", 
    technical: 'A change in the statistical properties of the target variable (P(y|x)) that the model tries to predict. Detected using ADWIN or EDDM algorithms.' 
  },
  { 
    term: 'Hoeffding Tree', 
    category: 'Machine Learning', 
    definition: 'An AI decision tree that learns from each transaction one-by-one in real time, without needing to store all past data in memory.', 
    technical: 'An incremental decision tree classifier that uses the Hoeffding bound to determine the minimum number of samples needed to split a node with statistical confidence.' 
  },
  { 
    term: 'Rolling Accuracy', 
    category: 'Machine Learning', 
    definition: "The model's accuracy measured over the most recent 500 transactions (not all-time), so it reflects current performance.", 
    technical: 'A sliding window metric (window=500) that computes accuracy only on the most recent N predictions, discarding older ones.' 
  },
  { 
    term: 'F1-Score', 
    category: 'Machine Learning', 
    definition: 'A combined score measuring how well the AI catches fraud without raising too many false alarms. Higher is better.', 
    technical: 'The harmonic mean of Precision and Recall: F1 = 2 × (P × R) / (P + R). Balances false positives and false negatives.' 
  },
  { 
    term: 'Prequential Evaluation', 
    category: 'Machine Learning', 
    definition: 'The model predicts first, then checks if it was right, then learns. This ensures we measure real performance, not memorization.', 
    technical: 'Also called Test-Then-Train: each sample is first used for testing (prediction), then for training (model update).' 
  },
  { 
    term: 'ADWIN', 
    category: 'Streaming', 
    definition: 'An automatic alarm that watches the model\'s error rate. If errors suddenly increase, it sounds the alarm: "The fraudsters changed their trick!"', 
    technical: 'ADaptive WINdowing: maintains a variable-length window of recent errors and detects distributional changes using the Hoeffding bound.' 
  },
  { 
    term: 'WebSocket', 
    category: 'Streaming', 
    definition: 'A live, always-on connection between the server and your browser. Transactions flow through it in real time without page refreshes.', 
    technical: 'A full-duplex communication protocol over a single TCP connection, enabling real-time bidirectional data transfer.' 
  },
  { 
    term: 'Step', 
    category: 'Streaming', 
    definition: 'One hour of simulated bank time. The full dataset has 744 steps = 31 days (31 × 24 hours).', 
    technical: 'A discrete time unit in the PaySim simulation framework representing one hour of financial activity.' 
  },
  { 
    term: 'Star Schema', 
    category: 'Data Warehouse', 
    definition: 'A database design where one central Facts table (all transactions) is connected to smaller Dimension tables (accounts, dates, types).', 
    technical: 'A Kimball-style dimensional model with a denormalized fact table at the center and conformed dimension tables connected via surrogate integer keys.' 
  },
  { 
    term: 'DuckDB', 
    category: 'Data Warehouse', 
    definition: 'A super-fast database engine that runs inside your application. It answers analytical queries (sums, averages, groupings) in milliseconds.', 
    technical: 'An embedded columnar OLAP database with vectorized query execution, supporting full SQL with zero external dependencies.' 
  },
  { 
    term: 'Fact Table', 
    category: 'Data Warehouse', 
    definition: 'The main table storing every single transaction with its amount, fraud flag, and timestamps. This is where all the numbers live.', 
    technical: 'fact_transactions: the central grain-level table containing quantitative measures (amount, is_fraud, balance_delta) and foreign keys to dimension tables.' 
  },
  { 
    term: 'Dimension Table', 
    category: 'Data Warehouse', 
    definition: 'Smaller tables that describe context: Who sent the money? What type of transaction? What time of day? These add meaning to the numbers.', 
    technical: 'Conformed dimensions (dim_account, dim_time, dim_transaction_type) providing descriptive attributes for slicing and filtering.' 
  },
  { 
    term: 'ETL', 
    category: 'Data Warehouse', 
    definition: 'Extract, Transform, Load — the process of taking raw transaction data, cleaning it up, and storing it neatly in the database.', 
    technical: 'A data pipeline that extracts raw PaySim records, transforms them (type encoding, balance calculations), and loads into the DuckDB star schema.' 
  },
  { 
    term: 'Roll-Up', 
    category: 'OLAP Operations', 
    definition: 'Combining small time periods into bigger summaries. Like going from daily reports → weekly reports → monthly reports.', 
    technical: 'An OLAP aggregation operation that climbs up a dimension hierarchy, applying aggregate functions (SUM, COUNT, AVG) at each level.' 
  },
  { 
    term: 'Drill-Down', 
    category: 'OLAP Operations', 
    definition: 'The opposite of Roll-Up. Breaking a monthly summary back into weeks, then into individual days for detailed inspection.', 
    technical: 'Navigating down the dimension hierarchy from coarse to fine granularity, decomposing aggregates into constituent detail records.' 
  },
  { 
    term: 'Slice', 
    category: 'OLAP Operations', 
    definition: 'Filtering the data to show only one specific category. Like saying: "Show me ONLY transfer transactions" or "Show me ONLY nighttime activity."', 
    technical: 'Selecting a single value along one dimension of the OLAP cube, producing a (N-1)-dimensional sub-cube.' 
  },
  { 
    term: 'Dice', 
    category: 'OLAP Operations', 
    definition: 'Filtering on multiple categories at once. Like saying: "Show me transfers AND cash-outs, but only during weeks 2 to 4."', 
    technical: 'Selecting specific values along two or more dimensions simultaneously, producing a smaller sub-cube bounded by the selection criteria.' 
  },
  { 
    term: 'Pivot', 
    category: 'OLAP Operations', 
    definition: 'Rotating the view. Swapping rows and columns to see the same data from a different angle.', 
    technical: 'A rotation of the data cube axes, transposing row and column dimensions to provide an alternative analytical perspective.' 
  },
  { 
    term: 'FP-Growth', 
    category: 'Rule Mining', 
    definition: 'An algorithm that automatically finds patterns like: "IF Transfer + Evening + Partial Drain → Usually Fraud."', 
    technical: 'Frequent Pattern Growth: a tree-based algorithm for mining frequent itemsets without candidate generation, more efficient than Apriori.' 
  },
  { 
    term: 'Support', 
    category: 'Rule Mining', 
    definition: 'How common a pattern is. If support is 4.2%, this pattern appears in 4.2 out of every 100 transactions.', 
    technical: 'The proportion of transactions in the dataset that contain the itemset: support(X) = count(X) / |D|.' 
  },
  { 
    term: 'Confidence', 
    category: 'Rule Mining', 
    definition: 'How reliable a pattern is. If confidence is 94%, then 94 out of 100 times this combination appears, it turns out to be fraud.', 
    technical: 'The conditional probability P(Y|X) = support(X∪Y) / support(X). Measures rule reliability.' 
  },
  { 
    term: 'Lift', 
    category: 'Rule Mining', 
    definition: 'How much more suspicious this pattern is compared to random chance. A lift of 11x means this pattern is 11 times more dangerous than normal.', 
    technical: 'lift(X→Y) = confidence(X→Y) / support(Y). Values > 1 indicate positive correlation.' 
  },
  { 
    term: 'Emerged Rule', 
    category: 'Rule Mining', 
    definition: 'A brand new fraud pattern that appeared AFTER the drift — the new trick that thieves started using.', 
    technical: 'An association rule present in the post-drift window but absent from the pre-drift window, indicating a novel behavioral pattern.' 
  },
  { 
    term: 'Extinct Rule', 
    category: 'Rule Mining', 
    definition: 'An old fraud pattern that disappeared AFTER the drift — the old trick that thieves abandoned because it was getting caught.', 
    technical: 'An association rule present in the pre-drift window but absent from the post-drift window, indicating an abandoned attack vector.' 
  },
];

const CATEGORIES = [
  'All',
  'Machine Learning',
  'Data Warehouse',
  'OLAP Operations',
  'Rule Mining',
  'Streaming',
];

const CATEGORY_STYLES = {
  'Machine Learning': {
    badge: 'bg-signalBlueLight text-signalBlue border-signalBlue/25',
    accent: 'bg-signalBlue',
    iconBg: 'bg-signalBlue/10',
  },
  'Data Warehouse': {
    badge: 'bg-paper text-slate border-slate/30',
    accent: 'bg-slate',
    iconBg: 'bg-slate/10',
  },
  'OLAP Operations': {
    badge: 'bg-copperLight text-copperDark border-copper/30',
    accent: 'bg-copper',
    iconBg: 'bg-copper/10',
  },
  'Rule Mining': {
    badge: 'bg-amber-50 text-warn border-warn/30',
    accent: 'bg-warn',
    iconBg: 'bg-warn/10',
  },
  'Streaming': {
    badge: 'bg-emerald-50 text-safe border-safe/30',
    accent: 'bg-safe',
    iconBg: 'bg-safe/10',
  },
};

export default function Glossary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedTerms, setExpandedTerms] = useState(() => new Set());

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts = { All: GLOSSARY_TERMS.length };
    GLOSSARY_TERMS.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, []);

  // Filter terms by search text (matching term name OR definition) and category
  const filteredTerms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return GLOSSARY_TERMS.filter((item) => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch =
        !query ||
        item.term.toLowerCase().includes(query) ||
        item.definition.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory]);

  const toggleTerm = (termName) => {
    setExpandedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(termName)) {
        next.delete(termName);
      } else {
        next.add(termName);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedTerms(new Set(filteredTerms.map((t) => t.term)));
  };

  const handleCollapseAll = () => {
    setExpandedTerms(new Set());
  };

  const areAllExpanded =
    filteredTerms.length > 0 &&
    filteredTerms.every((t) => expandedTerms.has(t.term));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-canvas border border-bone p-6 rounded-xl shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-copperLight flex items-center justify-center text-copper shrink-0 shadow-inner">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-ink tracking-tight">
                Glossary & Help Center
              </h1>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-paper border border-bone text-slate">
                {GLOSSARY_TERMS.length} Terms
              </span>
            </div>
            <p className="text-sm text-slate mt-1">
              Plain-English explanations of all technical terms used in the Sentinel platform
            </p>
          </div>
        </div>

        {/* Quick actions: Expand / Collapse All */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={areAllExpanded ? handleCollapseAll : handleExpandAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-bone bg-paper hover:bg-bone text-graphite transition-colors"
            title={areAllExpanded ? "Collapse all technical details" : "Expand all technical details"}
          >
            {areAllExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-copper" />
                <span>Collapse All</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-copper" />
                <span>Expand All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Search Bar & Controls */}
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a term (e.g. Concept Drift, Roll-Up, Confidence...)"
            className="w-full pl-10 pr-10 py-3 bg-canvas border border-bone rounded-xl text-ink placeholder-fog text-sm focus:outline-none focus:ring-2 focus:ring-copper/30 focus:border-copper transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-fog hover:text-ink transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 3. Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {CATEGORIES.map((category) => {
            const isActive = activeCategory === category;
            const count = categoryCounts[category] || 0;
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-copper text-white border-copper shadow-sm'
                    : 'bg-canvas text-slate border-bone hover:bg-paper hover:text-ink hover:border-bone'
                }`}
              >
                <span>{category}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-paper text-fog border border-bone'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Stats Bar */}
      <div className="flex items-center justify-between text-xs text-slate px-1">
        <span>
          Showing <strong className="text-ink font-semibold">{filteredTerms.length}</strong> of{' '}
          <strong className="text-ink font-semibold">{GLOSSARY_TERMS.length}</strong> terms
          {activeCategory !== 'All' && (
            <span> in <span className="text-copper font-medium">{activeCategory}</span></span>
          )}
          {searchQuery.trim() && (
            <span> matching &ldquo;<span className="text-copper font-medium">{searchQuery.trim()}</span>&rdquo;</span>
          )}
        </span>
        {(searchQuery.trim() || activeCategory !== 'All') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('All');
            }}
            className="text-copper hover:text-copperDark font-medium transition-colors"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* 4. Terms List */}
      {filteredTerms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTerms.map((item) => {
            const isExpanded = expandedTerms.has(item.term);
            const style = CATEGORY_STYLES[item.category] || {
              badge: 'bg-paper text-slate border-bone',
              accent: 'bg-copper',
              iconBg: 'bg-paper',
            };

            return (
              <div
                key={item.term}
                onClick={() => toggleTerm(item.term)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTerm(item.term);
                  }
                }}
                className={`bg-canvas border rounded-xl shadow-sm transition-all duration-200 overflow-hidden flex flex-col justify-between text-left cursor-pointer group ${
                  isExpanded
                    ? 'border-copper/40 ring-1 ring-copper/20'
                    : 'border-bone hover:border-copper/30 hover:shadow-md'
                }`}
              >
                {/* Card Top & Definition */}
                <div className="p-5 flex-1 flex flex-col">
                  {/* Card Header: Term name & Category badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-copper group-hover:text-copperDark transition-colors">
                        {item.term}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${style.badge}`}
                      >
                        {item.category}
                      </span>
                      <button
                        type="button"
                        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                        className="p-1 rounded-md text-fog hover:text-ink hover:bg-bone transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTerm(item.term);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-copper" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Plain-English Definition */}
                  <p className="text-sm text-graphite leading-relaxed flex-1">
                    {item.definition}
                  </p>

                  {/* Expand toggle label */}
                  <div className="mt-4 pt-2 flex items-center justify-between border-t border-bone/60 text-xs">
                    <span className="text-[11px] font-medium text-slate group-hover:text-copper transition-colors inline-flex items-center gap-1">
                      {isExpanded ? 'Hide technical detail' : 'View technical detail'}
                    </span>
                    <span className="text-[11px] text-fog font-mono">
                      {isExpanded ? '▼' : '►'}
                    </span>
                  </div>
                </div>

                {/* Expandable Technical Detail Section */}
                {isExpanded && (
                  <div
                    className="bg-paper border-t border-bone p-4 transition-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate mb-1.5">
                      <Code2 className="w-3.5 h-3.5 text-copper shrink-0" />
                      <span>Technical Detail</span>
                    </div>
                    <div className="p-3 bg-canvas border border-bone rounded-lg text-xs font-mono text-graphite leading-relaxed select-text">
                      {item.technical}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-canvas border border-dashed border-bone rounded-2xl p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-copperLight flex items-center justify-center text-copper mb-4">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-ink">No terms found</h3>
          <p className="text-xs text-slate mt-1 max-w-sm mx-auto">
            No terms matched &ldquo;{searchQuery}&rdquo; {activeCategory !== 'All' ? `in category "${activeCategory}"` : ''}.
            Try modifying your search or reset filters.
          </p>
          <div className="mt-5">
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-copper text-white text-xs font-semibold hover:bg-copperDark transition-colors shadow-sm"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      )}

      {/* Helpful Footer Banner */}
      <div className="bg-paper border border-bone rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-signalBlueLight text-signalBlue flex items-center justify-center shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <span>
            Need more deep-dive analytics? Check the <strong className="text-ink">OLAP Studio</strong> for multidimensional slice-and-dice, or <strong className="text-ink">Rule Explainer</strong> for association rules.
          </span>
        </div>
        <div className="shrink-0 font-mono text-[11px] text-fog">
          Sentinel Enterprise v1.2
        </div>
      </div>
    </div>
  );
}
