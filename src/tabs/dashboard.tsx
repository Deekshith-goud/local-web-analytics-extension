/**
 * dashboard.tsx
 *
 * Full-tab Analytics Dashboard Options Page (`tabs/dashboard.html`).
 * Provides high-density local-first insights using raw SVG chart grids,
 * screen-reader tables, and zero network calls.
 */

import React, { useEffect, useState, useMemo } from "react";
import "./dashboard.css";
import { getLocalTodayDateString, getStartOfDayTimestamp } from "../utils/date-utils";
import { downsampleTimeline, computeBarCoordinates, computeLineCoordinates } from "../analytics/selectors/transforms";
import type { HistoricalStatsResponse } from "../types/tracking";

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
  const [range, setRange] = useState<RangeType>("7days");
  const [stats, setStats] = useState<HistoricalStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  useEffect(() => {
    let active = true;
    setIsLoading(true);

    chrome.runtime.sendMessage(
      {
        type: "GET_HISTORICAL_STATS",
        version: 1,
        startMs: rangeTimestamps.startMs,
        endMs: rangeTimestamps.endMs
      },
      (response: HistoricalStatsResponse) => {
        if (!active) return;
        setIsLoading(false);
        if (response) {
          setStats(response);
        }
      }
    );

    return () => {
      active = false;
    };
  }, [rangeTimestamps]);

  // 3. Memoized Transform coordinate projections
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

        {/* Date Filters */}
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
      </header>

      {/* Fresh install Onboarding preset displays */}
      {!isLoading && isDatabaseEmpty && (
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
          <span className="metric-label" id="lbl-avg-session">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Average Session Length
          </span>
          <span className="metric-value" aria-labelledby="lbl-avg-session">
            {isLoading ? "---" : formatDuration(stats?.metrics.averageSessionMs ?? 0)}
          </span>
          <span className="metric-desc">Duration per individual swap</span>
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
