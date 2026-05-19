/**
 * dashboard.tsx
 *
 * Full-tab Analytics Dashboard Options Page (`tabs/dashboard.html`).
 * Provides high-density local-first insights using raw SVG chart grids,
 * screen-reader tables, and zero network calls.
 *
 * Features integrated local-first Productivity Classification manager.
 */

import React, { useEffect, useState, useMemo } from "react";
import "./dashboard.css";
import { getLocalTodayDateString, getStartOfDayTimestamp } from "../utils/date-utils";
import { downsampleTimeline, computeBarCoordinates, computeLineCoordinates } from "../analytics/selectors/transforms";
import { validateProductivityRule, type ProductivityRule, type ProductivityCategory } from "../analytics/productivity-rules";
import type { HistoricalStatsResponse, RuntimeMessage } from "../types/tracking";

class DashboardErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Dashboard caught error:", error, errorInfo);
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: "white", backgroundColor: "#b91c1c", minHeight: "100vh" }}>
          <h2>Dashboard Crashed!</h2>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 20 }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 20 }}>{this.state.error?.stack}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: 10 }}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Formatting utility for durations
function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  
  if (hrs > 0) {
    const remainingMins = min % 60;
    return `${hrs}h ${remainingMins}m`;
  }
  return `${min}m`;
}

type RangeType = "today" | "7days" | "30days";

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<"analytics" | "rules" | "settings">("analytics");
  const [range, setRange] = useState<RangeType>("7days");
  const [stats, setStats] = useState<HistoricalStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Settings & Database Purge modal states
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [isPurging, setIsPurging] = useState(false);

  // Productivity Rules Tab States
  const [customRules, setCustomRules] = useState<ProductivityRule[]>([]);
  const [defaultRules, setDefaultRules] = useState<ProductivityRule[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [ruleTypeFilter, setRuleTypeFilter] = useState<"all" | "default" | "custom">("all");

  // Form States for custom rules creation
  const [newDomain, setNewDomain] = useState("");
  const [newCategory, setNewCategory] = useState<ProductivityCategory>("productive");
  const [newPriority, setNewPriority] = useState("10");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // 1. Core range calculation
  const rangeTimestamps = useMemo(() => {
    const now = Date.now();
    const todayStr = getLocalTodayDateString();
    const todayStart = getStartOfDayTimestamp(todayStr);

    switch (range) {
      case "today":
        return { startMs: todayStart, endMs: now };
      case "7days":
        return { startMs: todayStart - 6 * 24 * 60 * 60 * 1000, endMs: now };
      case "30days":
        return { startMs: todayStart - 29 * 24 * 60 * 60 * 1000, endMs: now };
    }
  }, [range]);

  // 2. Fetch stats asynchronously via Chrome runtime message passing
  const fetchStats = React.useCallback(() => {
    setIsLoading(true);
    chrome.runtime.sendMessage(
      {
        type: "GET_HISTORICAL_STATS",
        version: 1,
        startMs: rangeTimestamps.startMs,
        endMs: rangeTimestamps.endMs
      } satisfies RuntimeMessage,
      (response: HistoricalStatsResponse) => {
        setIsLoading(false);
        if (response) {
          setStats(response);
        }
      }
    );
  }, [rangeTimestamps]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 3. Fetch rules at mount or when active tab switches to "rules"
  const fetchRules = React.useCallback(() => {
    chrome.runtime.sendMessage(
      { type: "GET_PRODUCTIVITY_RULES", version: 1 } satisfies RuntimeMessage,
      (response: { success: boolean; customRules: ProductivityRule[]; defaultRules: ProductivityRule[]; error?: string }) => {
        if (response && response.success) {
          setCustomRules(response.customRules);
          setDefaultRules(response.defaultRules);
        }
      }
    );
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules, activeTab]);

  // 4. Memoized Transform coordinate projections
  const totalTrackedDuration = stats?.metrics.totalDurationMs ?? 0;
  const isDatabaseEmpty = totalTrackedDuration === 0;

  // Downsampled timeline data for coordinates drawing (max 14 columns)
  const processedTimeline = useMemo(() => {
    if (!stats || !stats.timeline) return [];
    return downsampleTimeline(stats.timeline, 14);
  }, [stats]);

  // Pure SVG coordinate points (memoized to prevent resize layout thrashing)
  const barChartCoordinates = useMemo(() => {
    return computeBarCoordinates(processedTimeline, 720, 240, {
      top: 20,
      bottom: 30,
      left: 40,
      right: 20
    });
  }, [processedTimeline]);

  const lineChartCoordinates = useMemo(() => {
    return computeLineCoordinates(processedTimeline, 720, 240, {
      top: 20,
      bottom: 30,
      left: 40,
      right: 20
    });
  }, [processedTimeline]);

  // Domain table limits (virtual limit to top 15 domains maximum to prevent DOM overhead)
  const filteredDomains = useMemo(() => {
    if (!stats || !stats.topDomains) return [];
    return stats.topDomains.slice(0, 15);
  }, [stats]);

  const maxDomainMs = useMemo(() => {
    if (filteredDomains.length === 0) return 0;
    return Math.max(...filteredDomains.map(d => d.durationMs), 1);
  }, [filteredDomains]);

  // ─── Productivity Overview Math ───
  const productiveMs = stats?.metrics.productiveDurationMs ?? 0;
  const distractingMs = stats?.metrics.distractingDurationMs ?? 0;
  const neutralMs = stats?.metrics.neutralDurationMs ?? 0;
  const unknownMs = stats?.metrics.unknownDurationMs ?? 0;
  const productivityScore = stats?.metrics.productivityScore ?? 0;

  const totalClassifiedMs = productiveMs + distractingMs + neutralMs + unknownMs;

  const productivePct = totalClassifiedMs > 0 ? (productiveMs / totalClassifiedMs) * 100 : 0;
  const distractingPct = totalClassifiedMs > 0 ? (distractingMs / totalClassifiedMs) * 100 : 0;
  const neutralPct = totalClassifiedMs > 0 ? (neutralMs / totalClassifiedMs) * 100 : 0;
  const unknownPct = totalClassifiedMs > 0 ? (unknownMs / totalClassifiedMs) * 100 : 0;

  // Conic gradient angle calculation for score circle
  const scoreAngle = `${(productivityScore / 100) * 360}deg`;

  // ─── Productivity Rules Processing ───
  const allDisplayRules = useMemo(() => {
    const defaultMapped = (defaultRules || []).map(r => ({ ...r, isCustom: false }));
    const customMapped = (customRules || []).map(r => ({ ...r, isCustom: true }));
    
    // Custom overrides override defaults of the same domain in display listing
    const customDomainSet = new Set((customRules || []).map(r => r.domain));
    const filteredDefaults = defaultMapped.filter(r => !customDomainSet.has(r.domain));

    return [...customMapped, ...filteredDefaults].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.domain.localeCompare(b.domain);
    });
  }, [customRules, defaultRules]);

  const searchedRules = useMemo(() => {
    return allDisplayRules.filter(rule => {
      const matchesSearch = rule.domain.includes(searchQuery.toLowerCase());
      const matchesFilter = 
        ruleTypeFilter === "all" ||
        (ruleTypeFilter === "custom" && rule.isCustom) ||
        (ruleTypeFilter === "default" && !rule.isCustom);
      return matchesSearch && matchesFilter;
    });
  }, [allDisplayRules, searchQuery, ruleTypeFilter]);

  // ─── Form Submission Handlers ───
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const priorityInt = parseInt(newPriority, 10);
    const candidateRule: ProductivityRule = {
      domain: newDomain.trim().toLowerCase(),
      category: newCategory,
      priority: isNaN(priorityInt) ? 1 : priorityInt,
      createdAt: Date.now()
    };

    // Strict validation
    const validationError = validateProductivityRule(candidateRule);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    // Check for duplicates in customRules list
    const updatedRules = customRules.filter(r => r.domain !== candidateRule.domain);
    updatedRules.push(candidateRule);

    chrome.runtime.sendMessage(
      {
        type: "SAVE_PRODUCTIVITY_RULES",
        version: 1,
        rules: updatedRules
      } satisfies RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        if (res && res.success) {
          setCustomRules(updatedRules);
          setFormSuccess(`Rule for '${candidateRule.domain}' added successfully.`);
          setNewDomain("");
          setNewPriority("10");
          fetchStats(); // Update live statistics metrics on rule change
        } else {
          setFormError(res?.error ?? "Failed to save rule in storage.");
        }
      }
    );
  };

  const handleDeleteRule = (domain: string) => {
    const updatedRules = customRules.filter(r => r.domain !== domain);

    chrome.runtime.sendMessage(
      {
        type: "SAVE_PRODUCTIVITY_RULES",
        version: 1,
        rules: updatedRules
      } satisfies RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        if (res && res.success) {
          setCustomRules(updatedRules);
          fetchStats();
        } else {
          alert(res?.error ?? "Failed to delete custom rule.");
        }
      }
    );
  };

  const handleResetRules = () => {
    if (!confirm("Are you sure you want to reset all custom rules? This restores the built-in catalog defaults.")) return;
    
    chrome.runtime.sendMessage(
      { type: "RESET_PRODUCTIVITY_RULES", version: 1 } satisfies RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        if (res && res.success) {
          setCustomRules([]);
          fetchStats();
        } else {
          alert(res?.error ?? "Failed to reset rules.");
        }
      }
    );
  };

  const handleExecutePurge = () => {
    if (purgeConfirmText !== "PURGE") return;
    setIsPurging(true);
    chrome.runtime.sendMessage(
      { type: "PURGE_ALL_DATA", version: 1 } satisfies RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        setIsPurging(false);
        setShowPurgeModal(false);
        setPurgeConfirmText("");
        if (res && res.success) {
          alert("All local database records, rules, and cache keys have been permanently purged.");
          // Refresh statistics
          fetchStats();
          // Reload custom/default rules lists
          fetchRules();
        } else {
          alert(`Failed to purge database: ${res?.error ?? "Unknown error"}`);
        }
      }
    );
  };

  const handleExportRules = () => {
    const payload = JSON.stringify({
      schema: "web-swap-productivity-rules",
      version: 1,
      exportedAt: Date.now(),
      rules: customRules
    }, null, 2);

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `web_swap_custom_rules_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportRules = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = event.target?.result as string;
        const parsed = JSON.parse(rawJson);

        if (parsed.schema !== "web-swap-productivity-rules" || parsed.version !== 1 || !Array.isArray(parsed.rules)) {
          alert("Invalid schema file. Must be a valid web-swap rules configuration.");
          return;
        }

        // Validate every rule in the array
        const importedRules: ProductivityRule[] = [];
        for (const rule of parsed.rules) {
          const check = validateProductivityRule(rule);
          if (check) {
            alert(`Validation failed for rule '${rule?.domain}': ${check}`);
            return;
          }
          importedRules.push({
            domain: rule.domain,
            category: rule.category,
            priority: rule.priority,
            createdAt: rule.createdAt ?? Date.now()
          });
        }

        if (confirm(`Importing ${importedRules.length} custom rules. Overwrite existing custom rules?`)) {
          chrome.runtime.sendMessage(
            {
              type: "SAVE_PRODUCTIVITY_RULES",
              version: 1,
              rules: importedRules
            },
            (res: { success: boolean; error?: string }) => {
              if (res && res.success) {
                setCustomRules(importedRules);
                fetchStats();
                alert("Rules imported successfully!");
              } else {
                alert(res?.error ?? "Failed to save imported rules.");
              }
            }
          );
        }
      } catch (err) {
        alert("Failed to parse JSON file structure. Verify the file contents.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset file input
  };

  return (
    <DashboardErrorBoundary>
      <div className="dashboard-wrapper">
        {/* Header Controls */}
        <header className="dashboard-header" role="banner">
        <div className="brand-section">
          <h1>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20V10" />
              <path d="M18 20V4" />
              <path d="M6 20v-4" />
            </svg>
            Local Browse Analytics
          </h1>
          <p>Privacy-first. Secure local tracking dashboard.</p>
        </div>

        {/* Tab switch navigation */}
        <nav className="dashboard-nav" aria-label="Main sections">
          <button
            className={`nav-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            Overview & Analytics
          </button>
          <button
            className={`nav-tab-btn ${activeTab === "rules" ? "active" : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            Productivity Rules
          </button>
          <button
            className={`nav-tab-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Settings & Privacy
          </button>
        </nav>

        {/* Date Filters (Only shown when activeTab is overview) */}
        {activeTab === "analytics" && (
          <nav aria-label="Dashboard range selection">
            <div className="filter-group">
              <button
                className={`filter-btn ${range === "today" ? "active" : ""}`}
                onClick={() => setRange("today")}
                aria-pressed={range === "today"}
              >
                Today
              </button>
              <button
                className={`filter-btn ${range === "7days" ? "active" : ""}`}
                onClick={() => setRange("7days")}
                aria-pressed={range === "7days"}
              >
                Last 7 Days
              </button>
              <button
                className={`filter-btn ${range === "30days" ? "active" : ""}`}
                onClick={() => setRange("30days")}
                aria-pressed={range === "30days"}
              >
                Last 30 Days
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Fresh install Onboarding preset displays */}
      {!isLoading && isDatabaseEmpty && activeTab === "analytics" && (
        <section className="welcome-preset" aria-label="First-time installation guide">
          <div className="welcome-info">
            <h2>👋 Welcome to your Browse Analytics Dashboard!</h2>
            <p>Your tracking engine is fully initialized. Start browsing your favorite websites to capture premium statistics safely on-device.</p>
          </div>
          <div className="status-indicator">
            <span className="status-dot-indicator" aria-hidden="true"></span>
            <span>Real-time tracking active</span>
          </div>
        </section>
      )}

      {/* TABS CONTROLLER CONTAINER */}
      {activeTab === "analytics" && (
        <>
          {/* Derived Metric Cards Grid */}
          <section className="metrics-grid" aria-label="Browsing overview cards">
            <div className="metric-card">
              <span className="metric-label" id="lbl-tracked">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Total Tracked Time
              </span>
              <span className="metric-value" aria-labelledby="lbl-tracked">
                {isLoading ? "---" : formatDuration(totalTrackedDuration)}
              </span>
              <span className="metric-desc">Aggregated duration for active range</span>
            </div>

            <div className="metric-card">
              <span className="metric-label" id="lbl-focus">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                Focus Hours
              </span>
              <span className="metric-value" aria-labelledby="lbl-focus">
                {isLoading ? "---" : `${stats?.metrics.focusHours ?? 0}h`}
              </span>
              <span className="metric-desc">Total productive browsing time</span>
            </div>

            <div className="metric-card">
              <span className="metric-label" id="lbl-visits">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m12 3-1.912 5.886H3.82l4.912 3.57L6.82 18.342 12 14.772l5.18 3.57-1.912-5.886 4.912-3.57h-6.268z" />
                </svg>
                Total Visits
              </span>
              <span className="metric-value" aria-labelledby="lbl-visits">
                {isLoading ? "---" : stats?.metrics.totalVisits ?? 0}
              </span>
              <span className="metric-desc">Sum of all navigation transitions</span>
            </div>

            <div className="metric-card">
              <span className="metric-label" id="lbl-unique">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Unique Hostnames
              </span>
              <span className="metric-value" aria-labelledby="lbl-unique">
                {isLoading ? "---" : stats?.metrics.uniqueDomainsCount ?? 0}
              </span>
              <span className="metric-desc">Individual domains logged</span>
            </div>
          </section>

          {/* Productivity Distribution Banner */}
          {!isLoading && !isDatabaseEmpty && (
            <section 
              className="productivity-overview-card" 
              aria-label="Productivity breakdown diagnostics"
              style={{ "--score-angle": scoreAngle } as React.CSSProperties}
            >
              <div className="productivity-overview-header">
                <div className="productivity-score-display">
                  <div className="productivity-score-circle" role="img" aria-label={`Productivity score is ${productivityScore} percent`}>
                    <span className="productivity-score-text">{productivityScore}%</span>
                  </div>
                  <div className="welcome-info">
                    <h2 style={{ fontSize: "15px", fontWeight: 600 }}>Productivity Score</h2>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Ratio of productive vs distracting domain activities</p>
                  </div>
                </div>
                <div className="status-indicator">
                  <span className="badge-category productive">Focus Mode Stable</span>
                </div>
              </div>

              {/* Stacked Percentage bar */}
              <div className="productivity-overview-bar" aria-hidden="true">
                <div className="prod-bar-segment productive" style={{ width: `${productivePct}%` }} title={`Productive: ${productivePct.toFixed(1)}%`}></div>
                <div className="prod-bar-segment distracting" style={{ width: `${distractingPct}%` }} title={`Distracting: ${distractingPct.toFixed(1)}%`}></div>
                <div className="prod-bar-segment neutral" style={{ width: `${neutralPct}%` }} title={`Neutral: ${neutralPct.toFixed(1)}%`}></div>
                <div className="prod-bar-segment unknown" style={{ width: `${unknownPct}%` }} title={`Unknown: ${unknownPct.toFixed(1)}%`}></div>
              </div>

              {/* Interactive Legend */}
              <div className="productivity-legend">
                <div className="legend-item">
                  <span className="legend-color productive" aria-hidden="true"></span>
                  <div className="legend-meta">
                    <span className="legend-label">Productive</span>
                    <span className="legend-value">{formatDuration(productiveMs)} ({productivePct.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="legend-item">
                  <span className="legend-color distracting" aria-hidden="true"></span>
                  <div className="legend-meta">
                    <span className="legend-label">Distracting</span>
                    <span className="legend-value">{formatDuration(distractingMs)} ({distractingPct.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="legend-item">
                  <span className="legend-color neutral" aria-hidden="true"></span>
                  <div className="legend-meta">
                    <span className="legend-label">Neutral</span>
                    <span className="legend-value">{formatDuration(neutralMs)} ({neutralPct.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="legend-item">
                  <span className="legend-color unknown" aria-hidden="true"></span>
                  <div className="legend-meta">
                    <span className="legend-label">Unclassified</span>
                    <span className="legend-value">{formatDuration(unknownMs)} ({unknownPct.toFixed(0)}%)</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Main Visualizations section */}
          <div className="visualization-section">
            {/* Left Column: Visual SVG Chart */}
            <section className="vis-card" aria-label="Browsing history timeline chart">
              <div className="vis-card-title">
                Browsing Timeline
                <span>{range === "today" ? "Hourly intervals" : "Daily aggregates"}</span>
              </div>

              {isLoading ? (
                <div className="vis-empty" role="status">
                  <p className="vis-empty-title">Loading stats data...</p>
                </div>
              ) : isDatabaseEmpty ? (
                <div className="vis-empty">
                  <div className="vis-empty-icon" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="17" x2="9" y2="10" />
                      <line x1="15" y1="17" x2="15" y2="7" />
                    </svg>
                  </div>
                  <p className="vis-empty-title">No Timeline Data Found</p>
                  <p className="vis-empty-desc">Your history timeline is blank. Browse the web to generate historical metrics.</p>
                </div>
              ) : (
                <div className="chart-container">
                  {/* Screen reader table summary for accessibility */}
                  <table className="sr-only" aria-label="Browsing duration history table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedTimeline.map((item) => (
                        <tr key={item.date}>
                          <td>{item.date}</td>
                          <td>{formatDuration(item.durationMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Inline raw SVG coordinates chart */}
                  <svg className="chart-svg" viewBox="0 0 720 240" role="img" aria-label="Visual timeline chart showing browsing duration trend.">
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Y-axis gridlines */}
                    <line x1="40" y1="20" x2="700" y2="20" className="chart-grid-line" />
                    <line x1="40" y1="95" x2="700" y2="95" className="chart-grid-line" />
                    <line x1="40" y1="170" x2="700" y2="170" className="chart-grid-line" />
                    <line x1="40" y1="210" x2="700" y2="210" stroke="var(--border-subtle)" strokeWidth="1.5" />

                    {/* Y-axis labels */}
                    <text x="12" y="24" className="chart-axis-text">Max</text>
                    <text x="12" y="100" className="chart-axis-text">Mid</text>
                    <text x="12" y="174" className="chart-axis-text">Min</text>

                    {/* Bar components or line elements based on size */}
                    {range === "today" ? (
                      /* Today utilizes line charts */
                      <>
                        <path
                          className="chart-area"
                          d={`
                            M ${lineChartCoordinates[0]?.x ?? 40} 210
                            ${lineChartCoordinates.map(c => `L ${c.x} ${c.y}`).join(" ")}
                            L ${lineChartCoordinates[lineChartCoordinates.length - 1]?.x ?? 700} 210
                            Z
                          `}
                        />
                        <path
                          className="chart-line"
                          d={lineChartCoordinates.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")}
                        />
                        {lineChartCoordinates.map((c, idx) => (
                          <circle
                            key={idx}
                            cx={c.x}
                            cy={c.y}
                            r="4"
                            className="chart-point"
                            role="img"
                            aria-label={`Time: ${c.rawDate}, Duration: ${c.valueLabel}`}
                          />
                        ))}
                      </>
                    ) : (
                      /* Longer ranges utilize clean bar columns */
                      barChartCoordinates.map((bar, idx) => (
                        <g key={idx}>
                          <rect
                            x={bar.x}
                            y={bar.y}
                            width={bar.width}
                            height={bar.height}
                            className="chart-bar"
                            role="img"
                            aria-label={`Date: ${bar.rawDate}, Duration: ${bar.valueLabel}`}
                          />
                          <text
                            x={bar.x + bar.width / 2}
                            y="225"
                            textAnchor="middle"
                            className="chart-axis-text"
                          >
                            {bar.label}
                          </text>
                        </g>
                      ))
                    )}
                  </svg>
                </div>
              )}
            </section>

            {/* Right Column: Top Domains Table Leaderboard */}
            <section className="vis-card" aria-label="Top active domain listings">
              <div className="vis-card-title">
                Top Domains
                <span>Sorted by duration</span>
              </div>

              {isLoading ? (
                <div className="vis-empty" role="status">
                  <p className="vis-empty-title">Loading domains...</p>
                </div>
              ) : isDatabaseEmpty ? (
                <div className="vis-empty">
                  <div className="vis-empty-icon" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      <path d="M2 12h20" />
                    </svg>
                  </div>
                  <p className="vis-empty-title">No Activity Yet</p>
                  <p className="vis-empty-desc">Your visited domains listing will populate dynamically once tracking records are written.</p>
                </div>
              ) : (
                <div className="leaderboard-list">
                  {filteredDomains.map((item, idx) => {
                    const fillWidth = maxDomainMs > 0 ? (item.durationMs / maxDomainMs) * 100 : 0;
                    
                    return (
                      <div className="leaderboard-row" key={item.domain}>
                        <div className="leaderboard-meta">
                          <span className="leaderboard-name" title={item.domain}>
                            #{idx + 1} {item.domain}
                          </span>
                          <span className="leaderboard-time">
                            {formatDuration(item.durationMs)} ({item.visitCount} visits)
                          </span>
                        </div>
                        <div className="leaderboard-bar-track" aria-hidden="true">
                          <div
                            className="leaderboard-bar-fill"
                            style={{ width: `${fillWidth}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      )}


        {activeTab === "rules" && (
          /* PRODUCTIVITY RULES TAB PANEL */
          <section className="rules-manager-layout" aria-label="Productivity classification preferences">
            <div className="rules-sidebar">
              <div className="rules-card">
                <h3>Add Custom Rule</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Override the semantic analysis engine with your own domain classification.
                </p>

                {formError && (
                  <div className="rules-form-alert error" role="alert">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="rules-form-alert success" role="status">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    {formSuccess}
                  </div>
                )}

                <form className="rules-form" onSubmit={handleAddRule}>
                  <div className="form-group">
                    <label htmlFor="domain-input">Domain (e.g. youtube.com)</label>
                    <input
                      id="domain-input"
                      type="text"
                      className="form-input"
                      placeholder="Enter hostname..."
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="category-select">Classification Category</label>
                    <select
                      id="category-select"
                      className="form-input"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as ProductivityCategory)}
                      required
                    >
                      <option value="productive">Productive (Deep Work)</option>
                      <option value="distracting">Distracting (Entertainment)</option>
                      <option value="neutral">Neutral (Utilities)</option>
                      <option value="unknown">Unknown (Unclassified)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="priority-input">Evaluation Priority</label>
                    <input
                      id="priority-input"
                      type="number"
                      className="form-input"
                      min="1"
                      max="100"
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      required
                    />
                    <small style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "var(--text-secondary)" }}>
                      Higher numbers override lower priority rules (Defaults run at Priority 1)
                    </small>
                  </div>

                  <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "6px" }}>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Save Custom Rule
                  </button>
                </form>
              </div>

              <div className="rules-card">
                <h3>Portability</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Export your meticulously crafted custom ruleset to a JSON file for backup or import to another device.
                </p>
                <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                  <button type="button" className="btn-secondary" onClick={handleExportRules} style={{ justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "6px" }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export Ruleset (.json)
                  </button>
                  <label className="btn-secondary" style={{ display: "flex", justifyContent: "center", cursor: "pointer", margin: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "6px" }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Import Ruleset
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImportRules} />
                  </label>
                </div>
              </div>
            </div>

            <div className="rules-main">
              <div className="rules-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <h3>Active Classifications</h3>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                      Showing both custom overrides and default baseline engine rules.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search domains..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: "200px" }}
                      aria-label="Search rules by domain"
                    />
                    <select
                      className="form-input"
                      value={ruleTypeFilter}
                      onChange={(e) => setRuleTypeFilter(e.target.value as "all" | "default" | "custom")}
                      aria-label="Filter rules by type"
                      style={{ width: "130px" }}
                    >
                      <option value="all">All Types</option>
                      <option value="custom">Custom Only</option>
                      <option value="default">Default Only</option>
                    </select>
                  </div>
                </div>

                <div className="rules-table-container">
                  <table className="rules-table">
                    <thead>
                      <tr>
                        <th>Domain Match</th>
                        <th>Classification</th>
                        <th>Priority</th>
                        <th>Source</th>
                        <th style={{ width: "80px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedRules.length === 0 ? (
                        <tr>
                          <td colSpan={5}>
                            <div className="vis-empty" style={{ minHeight: "150px" }}>
                              <p className="vis-empty-title">No Rules Found</p>
                              <p className="vis-empty-desc">Adjust your search or filter settings.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        searchedRules.map((rule) => (
                          <tr key={`${rule.domain}-${rule.isCustom ? 'custom' : 'default'}`}>
                            <td style={{ fontFamily: "ui-monospace, monospace", fontSize: "13px" }}>
                              {rule.domain}
                            </td>
                            <td>
                              <span className={`badge-category ${rule.category}`}>
                                {rule.category.charAt(0).toUpperCase() + rule.category.slice(1)}
                              </span>
                            </td>
                            <td>
                              {rule.priority}
                            </td>
                            <td>
                              {rule.isCustom ? (
                                <span className="source-badge custom" title="User overridden rule">Custom</span>
                              ) : (
                                <span className="source-badge default" title="Pre-bundled system rule">System</span>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              {rule.isCustom ? (
                                <button
                                  type="button"
                                  className="btn-delete-rule"
                                  onClick={() => handleDeleteRule(rule.domain)}
                                  title={`Remove custom override for ${rule.domain}`}
                                  aria-label={`Delete custom rule for ${rule.domain}`}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                  </svg>
                                </button>
                              ) : (
                                <span style={{ color: "var(--text-secondary)", fontSize: "12px", fontStyle: "italic" }}>Read-only</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {customRules.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button type="button" className="btn-danger-outline" onClick={handleResetRules}>
                      Reset All Custom Rules
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="settings-panel-layout" aria-label="Settings and Data Control">
            <div className="settings-card">
              <h3>🔒 Privacy & Local-First Policy</h3>
              <p>
                Your browsing activity is processed and stored <strong>entirely on your local machine</strong>.
                No server connections are made, no telemetry is reported, and no analytical logs ever leave your device.
              </p>
            </div>

            <div className="settings-card">
              <h3>💾 Local Storage Behavior</h3>
              <p>
                The extension uses highly-efficient IndexedDB and Chrome Extension local storage APIs.
                All tracking state runs asynchronously in service worker background threads with zero UI blocking.
                Please note that uninstalling this extension via the browser will automatically delete all stored on-device analytics databases.
              </p>
            </div>

            <div className="settings-card danger-zone">
              <h4>⚠️ Danger Zone: Permanent Purge</h4>
              <p style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
                Purging the on-device database is destructive and irreversible. This will instantly wipe all website session logs,
                daily domain indicators, customized classification rules, volatile ring-buffered caches, and active state keys.
              </p>
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  setShowPurgeModal(true);
                  setPurgeConfirmText("");
                }}
                aria-haspopup="dialog"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "4px" }}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Purge On-Device Database
              </button>
            </div>
          </section>
        )}

        {/* MULTI-STEP CONFIRMATION MODAL OVERLAY */}
        {showPurgeModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="purge-modal-title">
            <div className="modal-content">
              <h3 id="purge-modal-title" className="modal-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Confirm Permanent Purge
              </h3>
              <p className="modal-desc">
                This action is destructive and <strong>absolutely irreversible</strong>. Your on-device data will be permanently wiped.
                To proceed, please type <strong>PURGE</strong> in the input field below to authorize this request:
              </p>
              <input
                type="text"
                className="modal-input"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value.toUpperCase())}
                placeholder="Type PURGE to delete"
                disabled={isPurging}
                autoFocus
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => {
                    setShowPurgeModal(false);
                    setPurgeConfirmText("");
                  }}
                  disabled={isPurging}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-modal-confirm"
                  onClick={handleExecutePurge}
                  disabled={purgeConfirmText !== "PURGE" || isPurging}
                >
                  {isPurging ? "Purging..." : "Confirm Purge"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <footer className="dashboard-footer" role="contentinfo">
          <div className="status-indicator">
            <span
              className={`status-dot-indicator ${stats?.trackingPaused ? "paused" : ""}`}
              aria-hidden="true"
            ></span>
            <span>
              {stats?.trackingPaused ? "Tracking paused" : "Real-time tracking active"}
            </span>
          </div>
          <div>
            <span>Data freshness: {stats ? `Last synced locally at ${new Date(stats.snapshotGeneratedAt).toLocaleTimeString()}` : "Not synced"}</span>
            <span style={{ marginLeft: "16px" }}>v1.0.0</span>
          </div>
        </footer>
      </div>
    </DashboardErrorBoundary>
  );
}
