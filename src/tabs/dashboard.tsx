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
  const [activeTab, setActiveTab] = useState<"analytics" | "rules">("analytics");
  const [range, setRange] = useState<RangeType>("7days");
  const [stats, setStats] = useState<HistoricalStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    const defaultMapped = defaultRules.map(r => ({ ...r, isCustom: false }));
    const customMapped = customRules.map(r => ({ ...r, isCustom: true }));
    
    // Custom overrides override defaults of the same domain in display listing
    const customDomainSet = new Set(customRules.map(r => r.domain));
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
      {activeTab === "analytics" ? (
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
      ) : (
        /* PRODUCTIVITY RULES TAB PANEL */
        <section className="rules-manager-layout" aria-label="Productivity classification preferences">
          {/* Rules List Column */}
          <div className="rules-list-panel">
            <div className="rules-panel-header">
              <input
                type="text"
                placeholder="Search domain rules..."
                className="search-rules-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search classification rules"
              />
              
              <div className="rules-type-filters" role="group" aria-label="Rules category type filters">
                <button
                  className={`rules-filter-btn ${ruleTypeFilter === "all" ? "active" : ""}`}
                  onClick={() => setRuleTypeFilter("all")}
                >
                  All ({allDisplayRules.length})
                </button>
                <button
                  className={`rules-filter-btn ${ruleTypeFilter === "default" ? "active" : ""}`}
                  onClick={() => setRuleTypeFilter("default")}
                >
                  Built-in
                </button>
                <button
                  className={`rules-filter-btn ${ruleTypeFilter === "custom" ? "active" : ""}`}
                  onClick={() => setRuleTypeFilter("custom")}
                >
                  Custom ({customRules.length})
                </button>
              </div>
            </div>

            <div className="rules-table-wrapper">
              <table className="rules-table">
                <thead>
                  <tr>
                    <th scope="col">Domain</th>
                    <th scope="col">Category</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Source</th>
                    <th scope="col" style={{ width: "60px", textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedRules.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "32px" }}>
                        No rules matching your filter selection.
                      </td>
                    </tr>
                  ) : (
                    searchedRules.map((rule) => (
                      <tr key={rule.domain}>
                        <td style={{ fontWeight: 500 }}>{rule.domain}</td>
                        <td>
                          <span className={`badge-category ${rule.category}`}>
                            {rule.category}
                          </span>
                        </td>
                        <td>{rule.priority}</td>
                        <td>
                          <span className="rule-source-tag">
                            {rule.isCustom ? "Custom" : "System"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            {rule.isCustom ? (
                              <button
                                className="btn-delete-rule"
                                onClick={() => handleDeleteRule(rule.domain)}
                                title={`Delete custom rule for ${rule.domain}`}
                                aria-label={`Delete custom rule for ${rule.domain}`}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                              </button>
                            ) : (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Locked</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Interactive action buttons */}
            <div className="rules-toolbar">
              <button className="btn-secondary-action" onClick={handleExportRules}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export JSON Rules
              </button>

              <div className="file-import-wrapper">
                <button className="btn-secondary-action">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Import JSON Rules
                </button>
                <input
                  type="file"
                  accept=".json"
                  className="file-import-input"
                  onChange={handleImportRules}
                  aria-label="Upload JSON productivity configurations"
                />
              </div>

              <button className="btn-secondary-action" onClick={handleResetRules} style={{ color: "#f87171" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Reset Custom Overrides
              </button>
            </div>
          </div>

          {/* Right Column: Custom Rule Creator Form Card */}
          <form className="rule-form-card" onSubmit={handleAddRule} aria-label="Add classification custom rule">
            <h2 className="rule-form-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Add Domain Override
            </h2>

            <div className="form-group">
              <label htmlFor="input-rule-domain" className="form-label">Domain Hostname</label>
              <input
                id="input-rule-domain"
                type="text"
                placeholder="e.g. music.youtube.com"
                className="form-input"
                value={newDomain}
                onChange={(e) => {
                  setNewDomain(e.target.value);
                  setFormError(null);
                  setFormSuccess(null);
                }}
                required
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.3 }}>
                Use lowercase hostnames without protocol prefixes (`https://`), slashes (`/`), or wildcards (`*`).
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="select-rule-cat" className="form-label">Category</label>
              <select
                id="select-rule-cat"
                className="form-input"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ProductivityCategory)}
                style={{ appearance: "none" }}
              >
                <option value="productive">Productive (Emerald)</option>
                <option value="distracting">Distracting (Crimson)</option>
                <option value="neutral">Neutral (Indigo)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="input-rule-priority" className="form-label">Override Priority (1 - 100)</label>
              <input
                id="input-rule-priority"
                type="number"
                min="1"
                max="100"
                className="form-input"
                value={newPriority}
                onChange={(e) => {
                  setNewPriority(e.target.value);
                  setFormError(null);
                  setFormSuccess(null);
                }}
                required
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.3 }}>
                Higher priorities override more generic domain matches. Subdomain specific rules win over broader hostnames.
              </span>
            </div>

            {formError && <div className="banner-form-error" role="alert">{formError}</div>}
            {formSuccess && <div className="banner-form-success" role="alert">{formSuccess}</div>}

            <button type="submit" className="btn-primary-form">
              Save Rule Override
            </button>
          </form>
        </section>
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
  );
}
