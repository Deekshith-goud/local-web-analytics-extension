import React, { useMemo } from "react";
import "./AnalyticsTab.css";
import { ScoreIllustration, getProductivityLabel, type IconStyleType } from "../../components/ui/ScoreIllustration";


import { formatDuration } from "../../utils/format";
import { computeBarCoordinates } from "../../analytics/selectors/transforms";

interface AnalyticsTabProps {
  isLoading: boolean;
  isDatabaseEmpty: boolean;
  totalTrackedDuration: number;
  stats: unknown; // Using any for stats to avoid complex typing for now, or use AnalyticsStats
  range: "today" | "7days" | "30days";
  
  domainSort: "duration" | "visits";
  setDomainSort: (sort: "duration" | "visits") => void;
  activeChart: "total" | "productivity";
  setActiveChart: (chart: "total" | "productivity") => void;
  
  hoveredTooltip: {x: number, y: number, title: string, content: React.ReactNode} | null;
  setHoveredTooltip: (tooltip: {x: number, y: number, title: string, content: React.ReactNode} | null) => void;
  
  setShowAllDomainsModal: (show: boolean) => void;
  setShowCriteriaModal: (show: boolean) => void;
  
  iconStyle: IconStyleType;
  
  // Productivity data
  productivityScore: number;
  scoreAngle: string;
  
  productivePct: number;
  distractingPct: number;
  neutralPct: number;
  unknownPct: number;
  productiveMs: number;
  distractingMs: number;
  neutralMs: number;
  unknownMs: number;
  
  fetchDomainIntervals: (domain: string) => void;
  setShowMetricModal: (modal: "tracked" | "focus" | "visits" | null) => void;
}

export function AnalyticsTab({
  isLoading,
  isDatabaseEmpty,
  totalTrackedDuration,
  stats,
  range,
  domainSort,
  setDomainSort,
  activeChart,
  setActiveChart,
  hoveredTooltip,
  setHoveredTooltip,
  setShowAllDomainsModal,
  setShowCriteriaModal,
  iconStyle,
  productivityScore,
  scoreAngle,
  
  productivePct,
  distractingPct,
  neutralPct,
  unknownPct,
  productiveMs,
  distractingMs,
  neutralMs,
  unknownMs,
  fetchDomainIntervals,
  setShowMetricModal
}: AnalyticsTabProps) {

  // Process timeline data
  const processedTimeline = useMemo(() => {
    if (!stats) return [];
    if (range === "today") {
      // Use the pre-built 24-hour buckets from background
      // Returning all 24 hours prevents the chart from stretching early-day data into a giant blob.
      if (stats.hourlyTimeline && stats.hourlyTimeline.length > 0) {
        return stats.hourlyTimeline;
      }
      return [];
    }
    if (!stats.timeline) return [];
    return stats.timeline;
  }, [stats, range]);

  // Pure SVG coordinate points (memoized to prevent resize layout thrashing)
  const barChartCoordinates = useMemo(() => {
    return computeBarCoordinates(processedTimeline, 720, 240, {
      top: 20,
      bottom: 30,
      left: 40,
      right: 20
    });
  }, [processedTimeline]);

  // Domain table limits (virtual limit to top 15 domains maximum to prevent DOM overhead)
  const filteredDomains = useMemo(() => {
    if (!stats || !stats.topDomains) return [];
    const domains = [...stats.topDomains];
    if (domainSort === "visits") {
      domains.sort((a, b) => b.visitCount - a.visitCount);
    } else {
      domains.sort((a, b) => b.durationMs - a.durationMs);
    }
    return domains.slice(0, 15);
  }, [stats, domainSort]);

  const maxDomainMs = useMemo(() => {
    if (filteredDomains.length === 0) return 0;
    return Math.max(...filteredDomains.map(d => d.durationMs), 1);
  }, [filteredDomains]);

  const maxVisitCount = useMemo(() => {
    if (filteredDomains.length === 0) return 0;
    return Math.max(...filteredDomains.map(d => d.visitCount), 1);
  }, [filteredDomains]);

  // Max duration for the chart Y-axis
  const maxTimelineMs = useMemo(() => {
    if (processedTimeline.length === 0) return 1000;
    return Math.max(...processedTimeline.map((t: unknown) => t.durationMs), 1000);
  }, [processedTimeline]);

  const formatAxisLabel = (ms: number) => {
    if (ms <= 1000) return "0m"; // close to zero
    const minutes = Math.round(ms / 60000);
    if (minutes >= 60) return `${(ms / 3600000).toFixed(1)}h`;
    return `${minutes}m`;
  };

  const computeSmoothPath = (points: {x: number, y: number}[]) => {
    if (points.length === 0) return "";
    const firstPoint = points[0];
    if (!firstPoint) return "";
    if (points.length === 1) return `M ${firstPoint.x} ${firstPoint.y}`;
    
    let path = `M ${firstPoint.x} ${firstPoint.y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const cx = (p1.x + p2.x) / 2;
      path += ` C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  return (
    <div className="tab-panel">
      {/* Derived Metric Cards Grid */}
      <section className="metrics-grid" aria-label="Browsing overview cards">
        <div className="metric-card" style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '-15px', bottom: '-20px', width: '150px', height: '150px', opacity: 0.08, pointerEvents: 'none', color: 'var(--accent)', transform: 'rotate(-15deg)', WebkitMaskImage: 'linear-gradient(to top left, black 40%, transparent 90%)', maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div className="metric-icon purple" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
            {!isLoading && !isDatabaseEmpty && (
              <button 
                onClick={() => setShowMetricModal("tracked")}
                className="metric-details-btn"
                title="View detailed stats"
              >
                Details
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>
          <div className="metric-label" id="lbl-tracked" style={{ position: 'relative', zIndex: 1 }}>Total Tracked Time</div>
          <div className="metric-value" aria-labelledby="lbl-tracked" style={{ position: 'relative', zIndex: 1 }}>{isLoading ? "---" : formatDuration(totalTrackedDuration)}</div>
          <div className="metric-desc" style={{ position: 'relative', zIndex: 1 }}>Aggregated duration for active range</div>
        </div>

        <div className="metric-card" style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '-15px', bottom: '-20px', width: '150px', height: '150px', opacity: 0.08, pointerEvents: 'none', color: 'var(--green)', transform: 'rotate(10deg)', WebkitMaskImage: 'linear-gradient(to top left, black 40%, transparent 90%)', maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div className="metric-icon green" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            {!isLoading && !isDatabaseEmpty && (
              <button 
                onClick={() => setShowMetricModal("focus")}
                className="metric-details-btn"
                title="View detailed stats"
              >
                Details
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>
          <div className="metric-label" id="lbl-focus" style={{ position: 'relative', zIndex: 1 }}>Focus Hours</div>
          <div className="metric-value" aria-labelledby="lbl-focus" style={{ position: 'relative', zIndex: 1 }}>{isLoading ? "---" : `${stats?.metrics?.focusHours ?? 0}h`}</div>
          <div className="metric-desc" style={{ position: 'relative', zIndex: 1 }}>Total productive browsing time</div>
        </div>

        <div className="metric-card" style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '-15px', bottom: '-20px', width: '150px', height: '150px', opacity: 0.08, pointerEvents: 'none', color: '#3b82f6', transform: 'rotate(-5deg)', WebkitMaskImage: 'linear-gradient(to top left, black 40%, transparent 90%)', maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
            <path d="m12 3-1.912 5.886H3.82l4.912 3.57L6.82 18.342 12 14.772l5.18 3.57-1.912-5.886 4.912-3.57h-6.268z" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div className="metric-icon blue" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.886H3.82l4.912 3.57L6.82 18.342 12 14.772l5.18 3.57-1.912-5.886 4.912-3.57h-6.268z" /></svg>
            </div>
            {!isLoading && !isDatabaseEmpty && (
              <button 
                onClick={() => setShowMetricModal("visits")}
                className="metric-details-btn"
                title="View detailed stats"
              >
                Details
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>
          <div className="metric-label" id="lbl-visits" style={{ position: 'relative', zIndex: 1 }}>Total Visits</div>
          <div className="metric-value" aria-labelledby="lbl-visits" style={{ position: 'relative', zIndex: 1 }}>{isLoading ? "---" : stats?.metrics?.totalVisits ?? 0}</div>
          <div className="metric-desc" style={{ position: 'relative', zIndex: 1 }}>Sum of all navigation transitions</div>
        </div>

        <div className="metric-card" style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '-15px', bottom: '-20px', width: '150px', height: '150px', opacity: 0.08, pointerEvents: 'none', color: 'var(--orange)', transform: 'rotate(15deg)', WebkitMaskImage: 'linear-gradient(to top left, black 40%, transparent 90%)', maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div className="metric-icon orange" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            {!isLoading && !isDatabaseEmpty && (
              <button 
                onClick={() => setShowAllDomainsModal(true)}
                className="metric-details-btn"
                title="View all domains"
              >
                View All
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>
          <div className="metric-label" id="lbl-unique" style={{ position: 'relative', zIndex: 1 }}>Unique Hostnames</div>
          <div className="metric-value" aria-labelledby="lbl-unique" style={{ position: 'relative', zIndex: 1 }}>{isLoading ? "---" : stats?.metrics?.uniqueDomainsCount ?? 0}</div>
          <div className="metric-desc" style={{ position: 'relative', zIndex: 1 }}>Individual domains logged</div>
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
              <div className="productivity-score-circle" role="img" aria-label={`Productivity score ${productivityScore}%`}>
                <span className="productivity-score-text">{productivityScore}%</span>
              </div>
              <div className="productivity-score-info">
                <h2 style={{ display: 'flex', alignItems: 'center' }}>
                  Productivity Score 
                  <button 
                    onClick={() => setShowCriteriaModal(true)}
                    className="btn-icon" 
                    style={{ marginLeft: 6, opacity: 0.6, width: 20, height: 20, padding: 0 }}
                    title="View Score Criteria"
                    aria-label="View Score Criteria"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  </button>
                  <span className={`badge-category ${productivityScore >= 50 ? 'productive' : 'distracting'}`} style={{ fontSize: "11px", marginLeft: 8 }}>
                    {getProductivityLabel(productivityScore, iconStyle)}
                  </span>
                </h2>
                <p>Ratio of productive vs distracting domain activities</p>
              </div>
            </div>
            <div className={`prod-score-illus ${productivityScore >= 50 ? 'productive' : 'distracted'}`} aria-hidden="true">
              <ScoreIllustration score={productivityScore} iconStyle={iconStyle} />
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
          <div className="vis-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '74px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              {activeChart === "total" ? "Total Browsing Time" : "Productivity vs Distraction"}
              <span style={{ margin: 0 }}>{range === "today" ? "Hourly intervals" : "Daily aggregates"}</span>
            </div>
            
            <div style={{ flex: 1.5, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '64px' }}>
              {hoveredTooltip ? (
                <div style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  minWidth: '140px'
                }}>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {range === "today" ? `Time: ${hoveredTooltip.title}` : hoveredTooltip.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {hoveredTooltip.content}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', opacity: 0.5, fontStyle: 'italic' }}>
                  Hover over chart for details
                </div>
              )}
            </div>
            <div className="chart-tabs" style={{ display: 'flex', gap: '4px', fontSize: '12px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', flex: 1, justifyContent: 'flex-end', flexWrap: 'nowrap', whiteSpace: 'nowrap', overflow: 'hidden' }}>
               <button 
                 onClick={() => setActiveChart("total")} 
                 style={{ 
                   padding: '6px 10px', 
                   borderRadius: '6px', 
                   background: activeChart === "total" ? 'var(--bg-elevated)' : 'transparent', 
                   border: 'none', 
                   boxShadow: activeChart === "total" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                   color: activeChart === "total" ? 'var(--text-primary)' : 'var(--text-secondary)', 
                   cursor: 'pointer',
                   fontWeight: activeChart === "total" ? 600 : 400,
                   whiteSpace: 'nowrap'
                 }}
               >
                 Total Time
               </button>
               <button 
                 onClick={() => setActiveChart("productivity")} 
                 style={{ 
                   padding: '6px 10px', 
                   borderRadius: '6px', 
                   background: activeChart === "productivity" ? 'var(--bg-elevated)' : 'transparent', 
                   border: 'none', 
                   boxShadow: activeChart === "productivity" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                   color: activeChart === "productivity" ? 'var(--text-primary)' : 'var(--text-secondary)', 
                   cursor: 'pointer',
                   fontWeight: activeChart === "productivity" ? 600 : 400,
                   whiteSpace: 'nowrap'
                 }}
               >
                 Productivity
               </button>
            </div>
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
            <div className="chart-container" style={{ position: 'relative' }}>
              {activeChart === "total" && (
                <svg className="chart-svg" viewBox="0 0 720 240" role="img" aria-label="Visual timeline chart showing browsing duration trend.">
                  <defs>
                    <linearGradient id="capsuleBrandGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fca5a5" />
                      <stop offset="100%" stopColor="#fef08a" />
                    </linearGradient>
                    <linearGradient id="capsuleHighlightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#fcd34d" />
                    </linearGradient>
                  </defs>

                  {/* Y-axis gridlines */}
                  <line x1="40" y1="20" x2="700" y2="20" className="chart-grid-line" />
                  <line x1="40" y1="95" x2="700" y2="95" className="chart-grid-line" />
                  <line x1="40" y1="170" x2="700" y2="170" className="chart-grid-line" />
                  <line x1="40" y1="210" x2="700" y2="210" stroke="var(--border-subtle)" strokeWidth="1.5" />

                  {/* Y-axis labels */}
                  <text x="12" y="24" className="chart-axis-text">{formatAxisLabel(maxTimelineMs)}</text>
                  <text x="12" y="100" className="chart-axis-text">{formatAxisLabel(maxTimelineMs / 2)}</text>
                  <text x="12" y="174" className="chart-axis-text">0m</text>

                  {/* Capsule Bars for all ranges */}
                  {barChartCoordinates.map((bar, idx) => {
                     const maxBarHeight = Math.max(...barChartCoordinates.map(b => b.height));
                     const isMax = bar.height >= maxBarHeight * 0.99 && bar.height > 2; // Tolerance for floats
                     return (
                      <g key={idx}>
                        <rect
                          x={bar.x}
                          y={bar.y}
                          width={bar.width}
                          height={bar.height}
                          rx={bar.width / 2}
                          fill={isMax ? "url(#capsuleHighlightGradient)" : bar.height <= 2 ? "rgba(255, 255, 255, 0.05)" : "url(#capsuleBrandGradient)"}
                          className="chart-capsule"
                          style={{ transition: 'all 0.2s ease', cursor: 'pointer', opacity: 1 }}
                          onMouseEnter={() => setHoveredTooltip({
                            x: 0, y: 0,
                            title: bar.rawDate,
                            content: <div style={{fontWeight: 600, color: 'var(--text-primary)'}}>{bar.valueLabel} total</div>
                          })}
                          onMouseLeave={() => setHoveredTooltip(null)}
                        />
                        {(idx % Math.ceil(barChartCoordinates.length / 8) === 0 || idx === barChartCoordinates.length - 1) && (
                          <text
                            x={bar.x + bar.width / 2}
                            y="225"
                            textAnchor="middle"
                            className="chart-axis-text"
                          >
                            {bar.label}
                          </text>
                        )}
                        {isMax && (
                          <text x={bar.x + bar.width / 2} y={bar.y - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="10px" fontWeight="600">
                            Max
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}

              {activeChart === "productivity" && (
                <svg className="chart-svg" viewBox="0 0 720 240">
                  <defs>
                    <linearGradient id="prodArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="distArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <line x1="40" y1="20" x2="700" y2="20" className="chart-grid-line" />
                  <line x1="40" y1="95" x2="700" y2="95" className="chart-grid-line" />
                  <line x1="40" y1="170" x2="700" y2="170" className="chart-grid-line" />
                  <line x1="40" y1="210" x2="700" y2="210" stroke="var(--border-subtle)" strokeWidth="1.5" />

                  {(() => {
                    const maxCompMs = Math.max(...processedTimeline.map((t: unknown) => Math.max(t.productiveMs || 0, t.distractingMs || 0)), 1000);
                    const ptCount = processedTimeline.length;
                    const stepX = ptCount > 1 ? 660 / (ptCount - 1) : 660;
                    
                    const prodPoints = processedTimeline.map((item: unknown, idx: number) => ({
                      x: 40 + idx * stepX,
                      y: 210 - ((item.productiveMs || 0) / maxCompMs) * 190,
                      val: item.productiveMs || 0,
                      date: item.date
                    }));
                    
                    const distPoints = processedTimeline.map((item: unknown, idx: number) => ({
                      x: 40 + idx * stepX,
                      y: 210 - ((item.distractingMs || 0) / maxCompMs) * 190,
                      val: item.distractingMs || 0,
                      date: item.date
                    }));

                    const prodPath = computeSmoothPath(prodPoints);
                    const distPath = computeSmoothPath(distPoints);

                    return (
                      <>
                        {/* Y-axis labels */}
                        <text x="12" y="24" className="chart-axis-text">{formatAxisLabel(maxCompMs)}</text>
                        <text x="12" y="100" className="chart-axis-text">{formatAxisLabel(maxCompMs / 2)}</text>
                        <text x="12" y="174" className="chart-axis-text">0m</text>
                        
                        {/* Productivity Line & Area */}
                        {prodPoints.length > 0 && (
                          <>
                            <path
                              d={`${prodPath} L ${prodPoints[prodPoints.length - 1]?.x ?? 700} 210 L ${prodPoints[0]?.x ?? 40} 210 Z`}
                              fill="url(#prodArea)"
                            />
                            <path
                              d={prodPath}
                              fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                            />
                          </>
                        )}
                        
                        {/* Distraction Line & Area */}
                        {distPoints.length > 0 && (
                          <>
                            <path
                              d={`${distPath} L ${distPoints[distPoints.length - 1]?.x ?? 700} 210 L ${distPoints[0]?.x ?? 40} 210 Z`}
                              fill="url(#distArea)"
                            />
                            <path
                              d={distPath}
                              fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                            />
                          </>
                        )}

                        {/* Interactive Overlay Zones for tooltips */}
                        {processedTimeline.map((item: unknown, idx: number) => {
                          const x = 40 + idx * stepX;
                          const pMs = item.productiveMs || 0;
                          const dMs = item.distractingMs || 0;
                          return (
                            <g key={`overlay-${idx}`}>
                              <rect
                                x={x - stepX/2}
                                y={20}
                                width={stepX}
                                height={190}
                                fill="transparent"
                                style={{ cursor: 'crosshair' }}
                                onMouseEnter={() => setHoveredTooltip({
                                  x: 0, y: 0,
                                  title: item.date,
                                  content: (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                      <div style={{ color: '#10b981', fontWeight: 600 }}>Productive: {formatDuration(pMs)}</div>
                                      <div style={{ color: '#ef4444', fontWeight: 600 }}>Distracted: {formatDuration(dMs)}</div>
                                    </div>
                                  )
                                })}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              />
                              {hoveredTooltip?.title === item.date && (
                                <>
                                  <line x1={x} y1="20" x2={x} y2="210" stroke="var(--border-subtle)" strokeDasharray="4 4" pointerEvents="none" />
                                  <circle cx={x} cy={prodPoints[idx]?.y} r="4" fill="#10b981" style={{ pointerEvents: 'none', stroke: 'var(--bg-elevated)', strokeWidth: 2 }} />
                                  <circle cx={x} cy={distPoints[idx]?.y} r="4" fill="#ef4444" style={{ pointerEvents: 'none', stroke: 'var(--bg-elevated)', strokeWidth: 2 }} />
                                </>
                              )}
                              
                              {/* X-axis labels */}
                              {(idx % Math.ceil(ptCount / 8) === 0 || idx === ptCount - 1) && (
                                <text x={x} y="225" textAnchor="middle" className="chart-axis-text">
                                  {range === "today" ? item.date : item.date.substring(5)}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Top Domains Table Leaderboard */}
        <section className="vis-card" aria-label="Top active domain listings">
          <div className="vis-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              Top Domains
              <span style={{ margin: 0 }}>Sorted by {domainSort === "visits" ? "sessions" : "duration"}</span>
            </div>
            <div className="chart-tabs" style={{ display: 'flex', gap: '4px', fontSize: '12px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px' }}>
              <button 
                onClick={() => setDomainSort("duration")} 
                style={{ 
                  padding: '4px 8px', 
                  borderRadius: '6px', 
                  background: domainSort === "duration" ? 'var(--bg-elevated)' : 'transparent', 
                  border: 'none', 
                  boxShadow: domainSort === "duration" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  color: domainSort === "duration" ? 'var(--text-primary)' : 'var(--text-secondary)', 
                  cursor: 'pointer',
                  fontWeight: domainSort === "duration" ? 600 : 400
                }}
              >
                Duration
              </button>
              <button 
                onClick={() => setDomainSort("visits")} 
                style={{ 
                  padding: '4px 8px', 
                  borderRadius: '6px', 
                  background: domainSort === "visits" ? 'var(--bg-elevated)' : 'transparent', 
                  border: 'none', 
                  boxShadow: domainSort === "visits" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  color: domainSort === "visits" ? 'var(--text-primary)' : 'var(--text-secondary)', 
                  cursor: 'pointer',
                  fontWeight: domainSort === "visits" ? 600 : 400
                }}
              >
                Sessions
              </button>
            </div>
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
              {filteredDomains.map((item: unknown, idx: number) => {
                const fillWidth = domainSort === "visits"
                  ? (maxVisitCount > 0 ? (item.visitCount / maxVisitCount) * 100 : 0)
                  : (maxDomainMs > 0 ? (item.durationMs / maxDomainMs) * 100 : 0);
                
                return (
                  <div 
                    className="leaderboard-row hover-bg-elevated" 
                    key={item.domain} 
                    style={{ padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onClick={() => fetchDomainIntervals(item.domain)}
                    title="Click to view full session timeline"
                  >
                    <div className="leaderboard-meta" style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <img 
                          src={chrome.runtime?.id ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent("https://" + item.domain)}&size=64` : ""} 
                          alt="" 
                          style={{ width: '16px', height: '16px', borderRadius: '3px', marginRight: '8px', flexShrink: 0 }} 
                        />
                        <span className="leaderboard-name" title={item.domain} style={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text3)', marginRight: '6px', fontWeight: 500 }}>#{idx + 1}</span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.domain}</span>
                          <a href={`https://${item.domain}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', opacity: 0.5, transition: 'opacity 0.2s', marginLeft: '6px', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'} title={`Visit ${item.domain}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          </a>
                        </span>
                      </div>
                      <span className="leaderboard-time" style={{ color: 'var(--text2)', fontSize: '12px' }}>
                        {formatDuration(item.durationMs)} <span style={{ opacity: 0.7 }}>({item.visitCount} visits)</span>
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
    </div>
  );
}
