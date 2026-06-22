import React, { useEffect, useState } from "react";
import type { HistoricalStatsResponse } from "../types/tracking";
import "../style.css";

const createSmoothPath = (points: [number, number][]) => {
  if (points.length === 0) return "";
  let d = `M ${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const x_mid = (p1[0] + p2[0]) / 2;
    d += ` C ${x_mid},${p1[1]} ${x_mid},${p2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
};

const createAreaPath = (points: [number, number][], bottomY: number) => {
  if (points.length === 0) return "";
  const linePath = createSmoothPath(points);
  return `${linePath} L ${points[points.length - 1]![0]},${bottomY} L ${points[0]![0]},${bottomY} Z`;
};

export default function ReportPage() {
  const [stats, setStats] = useState<HistoricalStatsResponse | null>(null);
  const [rangeStr, setRangeStr] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const rangeParam = searchParams.get("range") || "all";
    setRangeStr(rangeParam);

    const now = new Date();
    let startMs = 0;
    let endMs = Date.now();
    
    if (rangeParam === "today") {
      now.setHours(0, 0, 0, 0);
      startMs = now.getTime();
    } else if (rangeParam === "last_7_days") {
      now.setDate(now.getDate() - 7);
      now.setHours(0, 0, 0, 0);
      startMs = now.getTime();
    } else if (rangeParam === "this_month") {
      now.setDate(now.getDate() - 30);
      now.setHours(0, 0, 0, 0);
      startMs = now.getTime();
    } else if (rangeParam === "custom") {
      const customStart = searchParams.get("start");
      const customEnd = searchParams.get("end");
      if (customStart) startMs = parseInt(customStart, 10);
      if (customEnd) endMs = parseInt(customEnd, 10);
    }

    chrome.runtime.sendMessage(
      { type: "GET_HISTORICAL_STATS", version: 1, startMs, endMs },
      (res: HistoricalStatsResponse & { error?: string } | null) => {
        if (chrome.runtime.lastError) {
          setErrorDetails("Runtime Error: " + chrome.runtime.lastError.message);
        } else if (!res) {
          setErrorDetails("Empty response from background script.");
        } else if (res.error) {
          setErrorDetails("Background rejected: " + res.error);
        } else if (!res.metrics) {
          setErrorDetails("Missing metrics in response: " + JSON.stringify(res));
        } else {
          setStats(res);
        }
        setIsLoading(false);
      }
    );
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: '"Inter", system-ui, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        <h2 style={{ animation: 'pulse 1.5s infinite ease-in-out' }}>Loading Report...</h2>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </div>
    );
  }

  if (errorDetails || !stats || !stats.metrics) {
    return (
      <div style={{ padding: '40px', fontFamily: '"Inter", system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '30px', borderRadius: '8px', maxWidth: '600px', margin: '40px auto' }}>
          <h2 style={{ color: '#b91c1c', marginTop: 0 }}>Error generating report</h2>
          <p style={{ color: '#7f1d1d', fontFamily: 'monospace', fontSize: '13px', wordBreak: 'break-all' }}>{errorDetails || "Unknown error."}</p>
        </div>
      </div>
    );
  }

  const { metrics, topDomains, timeline } = stats;
  
  const formatDuration = (ms: number) => {
    if (ms < 60000) return "< 1m";
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getRangeLabel = () => {
    if (rangeStr === "today") return "TODAY";
    if (rangeStr === "last_7_days") return "LAST 7 DAYS";
    if (rangeStr === "this_month") return "LAST 30 DAYS";
    if (rangeStr === "custom") return "CUSTOM RANGE";
    return "ALL TIME";
  };

  const total = metrics.productiveDurationMs + metrics.distractingDurationMs + metrics.neutralDurationMs + metrics.unknownDurationMs;
  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  
  const getDashValues = (val: number, offsetAccumulator: number) => {
    if (val === 0 || total === 0) return { dash: 0, offset: 0 };
    const ratio = val / total;
    // Gap = 16px (to clear rounded caps) + 8px visual spacing
    const gap = (ratio > 0 && ratio < 1) ? 24 : 0; 
    
    let dash = (ratio * circumference) - gap;
    dash = Math.max(0.1, dash); // 0.1 prevents SVG rendering glitches on absolute 0
    
    // Shift offset by half the gap so the spacing is distributed evenly on both sides
    const offset = offsetAccumulator - (gap / 2);
    
    return { dash, offset };
  };

  const hasData = total > 0;
  const getPercent = (val: number) => total > 0 ? Math.round((val / total) * 100) : 0;
  const prodPct = getPercent(metrics.productiveDurationMs);
  const distPct = getPercent(metrics.distractingDurationMs);
  const neutPct = getPercent(metrics.neutralDurationMs);
  const unkPct = getPercent(metrics.unknownDurationMs);

  // Line Chart Computations
  const chartWidth = 800;
  const chartHeight = 200;
  const paddingX = 60;
  const paddingTop = 30;
  const paddingBottom = 40;

  const validTimeline = (rangeStr === "today" && stats.hourlyTimeline && stats.hourlyTimeline.length > 0)
    ? stats.hourlyTimeline
    : (timeline || []);
  const maxVal = Math.max(
    1000, 
    ...validTimeline.map(t => Math.max(t.productiveMs, t.distractingMs))
  );

  const pointsProd: [number, number][] = [];
  const pointsDist: [number, number][] = [];
  
  if (validTimeline.length > 0) {
    const stepX = (chartWidth - paddingX * 2) / Math.max(1, validTimeline.length - 1);
    validTimeline.forEach((t, i) => {
      const x = paddingX + i * stepX;
      const yProd = paddingTop + (chartHeight - paddingTop - paddingBottom) * (1 - (t.productiveMs / maxVal));
      const yDist = paddingTop + (chartHeight - paddingTop - paddingBottom) * (1 - (t.distractingMs / maxVal));
      pointsProd.push([x, yProd]);
      pointsDist.push([x, yDist]);
    });
  }

  // Insight calculations
  let mostActiveDay = null;
  let topProductiveSite = null;
  let topDistractingSite = null;
  
  if (validTimeline.length > 0) {
    mostActiveDay = [...validTimeline].sort((a, b) => b.durationMs - a.durationMs)[0];
  }
  if (topDomains.length > 0) {
    topProductiveSite = topDomains[0]; // Heuristic since we don't have per-domain classification mapped deeply here easily, but top domain is a good insight
    topDistractingSite = topDomains.find(d => d.domain.includes('instagram') || d.domain.includes('youtube') || d.domain.includes('facebook') || d.domain.includes('twitter') || d.domain.includes('reddit')) || (topDomains.length > 1 ? topDomains[1] : null);
  }

  return (
    <div className="report-viewport" style={{ 
      minHeight: '100vh',
      background: '#f3f4f6',
      fontFamily: '"Inter", system-ui, sans-serif',
      color: '#1e293b',
      paddingBottom: '0'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        .header-bg {
          background: #1a1e2e;
          padding: 60px 0 80px 0;
          color: white;
        }
        
        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 0 40px;
        }

        .top-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-top: -40px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 30px 20px;
          text-align: center;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
          position: relative;
          overflow: hidden;
        }
        
        .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 6px; }
        .stat-card.blue::before { background: #6366f1; }
        .stat-card.green::before { background: #10b981; }
        .stat-card.orange::before { background: #f59e0b; }
        .stat-card.pink::before { background: #ec4899; }

        .stat-val { font-size: 32px; font-weight: 700; color: #0f172a; margin-bottom: 8px; font-variant-numeric: tabular-nums; }
        .stat-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-sub { font-size: 12px; margin-top: 8px; }
        
        .section-card {
          background: white;
          border-radius: 12px;
          padding: 35px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          margin-bottom: 30px;
        }
        
        .section-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
        .section-desc { font-size: 14px; color: #64748b; margin: 0 0 30px 0; }

        .breakdown-row { display: flex; align-items: center; gap: 60px; }
        
        .legend-row { display: grid; grid-template-columns: auto 150px auto auto; align-items: center; gap: 15px; padding: 16px 0; border-bottom: 1px dashed #e2e8f0; }
        .legend-row:last-child { border-bottom: none; }
        .legend-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .legend-label { font-weight: 600; font-size: 15px; color: #1e293b; }
        .legend-time { font-size: 14px; font-weight: 500; color: #64748b; font-variant-numeric: tabular-nums; text-align: right; }
        .legend-pct { font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 20px; min-width: 55px; text-align: center; font-variant-numeric: tabular-nums; }
        
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th { text-align: left; padding: 12px 10px; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .data-table td { padding: 16px 10px; font-size: 14px; border-top: 1px solid #f1f5f9; }
        .data-table tr:hover td { background: #f8fafc; }
        
        .share-bar-bg { width: 100px; height: 12px; background: #f1f5f9; border-radius: 2px; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 12px; }
        .share-bar-fill { height: 100%; }
        
        .insight-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .insight-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); position: relative; overflow: hidden; }
        .insight-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }
        .insight-card.blue::before { background: #6366f1; }
        .insight-card.green::before { background: #10b981; }
        .insight-card.red::before { background: #ef4444; }
        .insight-card.orange::before { background: #f59e0b; }
        .insight-title { font-weight: 700; font-size: 16px; color: #0f172a; margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px; }
        .insight-desc { font-size: 14px; color: #64748b; margin: 0; line-height: 1.5; }

        @media print {
          /* Force EXACT colors and styling when printing/saving to PDF */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          body, .report-viewport { 
            background: #f3f4f6 !important; 
          }
          
          /* Prevent page breaks inside cards */
          .section-card, .stat-card, .insight-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          /* Allow page break before insights section if needed */
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }
          
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="header-bg">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 10px 0', letterSpacing: '-0.02em' }}>Browsing Analytics</h1>
              <p style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', margin: '0 0 24px 0' }}>INTELLIGENT BROWSING REPORT &middot; {new Date().toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()} &middot; {getRangeLabel()}</p>
              <p style={{ color: '#cbd5e1', fontSize: '15px', margin: 0 }}>
                You browsed for {formatDuration(metrics.totalDurationMs)} across {metrics.uniqueDomainsCount} domains. 
                Productivity score is {Math.round(metrics.productivityScore || 0)}%.
              </p>
            </div>
            <div className="no-print">
              <button 
                onClick={() => window.print()}
                className="btn-primary"
                style={{ background: '#6366f1', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)' }}
              >
                SAVE AS PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="top-cards">
          <div className="stat-card blue">
            <div className="stat-val">{formatDuration(metrics.totalDurationMs)}</div>
            <div className="stat-label">TOTAL DURATION</div>
            <div className="stat-sub" style={{ color: '#6366f1' }}>↑ Active period</div>
          </div>
          <div className="stat-card green">
            <div className="stat-val">{metrics.totalVisits.toLocaleString()}</div>
            <div className="stat-label">TOTAL VISITS</div>
            <div className="stat-sub" style={{ color: '#10b981' }}>Across all sites</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-val">{metrics.uniqueDomainsCount.toLocaleString()}</div>
            <div className="stat-label">UNIQUE DOMAINS</div>
            <div className="stat-sub" style={{ color: '#f59e0b' }}>Sites explored</div>
          </div>
          <div className="stat-card pink">
            <div className="stat-val">{Math.round(metrics.productivityScore || 0)}%</div>
            <div className="stat-label">PROD. SCORE</div>
            <div className="stat-sub" style={{ color: '#ec4899' }}>Analyzed focus</div>
          </div>
        </div>

        <div className="section-card">
          <h3 className="section-title">Productivity Breakdown</h3>
          <p className="section-desc">Distribution of browsing time by category</p>
          
          <div className="breakdown-row">
            <div style={{ width: '220px', height: '220px', position: 'relative', flexShrink: 0 }}>
              {hasData ? (
                <svg viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%', overflow: 'visible', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.06))' }}>
                  <defs>
                    <linearGradient id="prodGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#059669"/></linearGradient>
                    <linearGradient id="distGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fb7185"/><stop offset="100%" stopColor="#e11d48"/></linearGradient>
                    <linearGradient id="neutGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#2563eb"/></linearGradient>
                    <linearGradient id="unkGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#cbd5e1"/><stop offset="100%" stopColor="#64748b"/></linearGradient>
                  </defs>
                  
                  {(() => {
                    let offsetAccum = 0;
                    
                    const prod = getDashValues(metrics.productiveDurationMs, offsetAccum);
                    offsetAccum -= (metrics.productiveDurationMs / total) * circumference;
                    
                    const dist = getDashValues(metrics.distractingDurationMs, offsetAccum);
                    offsetAccum -= (metrics.distractingDurationMs / total) * circumference;
                    
                    const neut = getDashValues(metrics.neutralDurationMs, offsetAccum);
                    offsetAccum -= (metrics.neutralDurationMs / total) * circumference;
                    
                    const unk = getDashValues(metrics.unknownDurationMs, offsetAccum);
                    
                    return (
                      <>
                        {metrics.productiveDurationMs > 0 && <circle cx="100" cy="100" r={radius} fill="none" stroke="url(#prodGrad)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${prod.dash} ${circumference}`} strokeDashoffset={prod.offset} />}
                        {metrics.distractingDurationMs > 0 && <circle cx="100" cy="100" r={radius} fill="none" stroke="url(#distGrad)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${dist.dash} ${circumference}`} strokeDashoffset={dist.offset} />}
                        {metrics.neutralDurationMs > 0 && <circle cx="100" cy="100" r={radius} fill="none" stroke="url(#neutGrad)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${neut.dash} ${circumference}`} strokeDashoffset={neut.offset} />}
                        {metrics.unknownDurationMs > 0 && <circle cx="100" cy="100" r={radius} fill="none" stroke="url(#unkGrad)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${unk.dash} ${circumference}`} strokeDashoffset={unk.offset} />}
                      </>
                    );
                  })()}
                </svg>
              ) : (
                <div style={{ width: '100%', height: '100%', border: '16px solid #f1f5f9', borderRadius: '50%' }} />
              )}
              {hasData && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '38px', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>{Math.round(metrics.productivityScore || 0)}%</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginTop: '6px', letterSpacing: '0.1em' }}>SCORE</div>
                </div>
              )}
            </div>
            
            <div style={{ flex: 1 }}>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: 'linear-gradient(135deg, #34d399, #059669)' }}></span>
                <span className="legend-label">Productive</span>
                <span className="legend-time">{formatDuration(metrics.productiveDurationMs)}</span>
                <span className="legend-pct" style={{ color: '#059669', background: 'rgba(16, 185, 129, 0.1)' }}>{prodPct}%</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: 'linear-gradient(135deg, #fb7185, #e11d48)' }}></span>
                <span className="legend-label">Distracting</span>
                <span className="legend-time">{formatDuration(metrics.distractingDurationMs)}</span>
                <span className="legend-pct" style={{ color: '#e11d48', background: 'rgba(239, 68, 68, 0.1)' }}>{distPct}%</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: 'linear-gradient(135deg, #60a5fa, #2563eb)' }}></span>
                <span className="legend-label">Neutral</span>
                <span className="legend-time">{formatDuration(metrics.neutralDurationMs)}</span>
                <span className="legend-pct" style={{ color: '#2563eb', background: 'rgba(59, 130, 246, 0.1)' }}>{neutPct}%</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: 'linear-gradient(135deg, #cbd5e1, #64748b)' }}></span>
                <span className="legend-label">Uncategorized</span>
                <span className="legend-time">{formatDuration(metrics.unknownDurationMs)}</span>
                <span className="legend-pct" style={{ color: '#475569', background: 'rgba(100, 116, 138, 0.1)' }}>{unkPct}%</span>
              </div>
            </div>
          </div>
        </div>

        {validTimeline.length > 0 && (
          <div className="section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 className="section-title">Productivity vs Distraction</h3>
                <p className="section-desc">{rangeStr === "today" ? "Hourly intervals" : "Daily aggregates"} — trend analysis</p>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-dot" style={{ background: '#10b981', width: '12px', height: '12px' }}></span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>Productive</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="legend-dot" style={{ background: '#ef4444', width: '12px', height: '12px' }}></span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>Distracting</span>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '240px' }}>
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                {/* Y Axis Grid Lines */}
                {[0, 0.5, 1].map((pct, i) => {
                  const y = paddingTop + (chartHeight - paddingTop - paddingBottom) * pct;
                  const val = maxVal * (1 - pct);
                  return (
                    <g key={i}>
                      <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                      <text x={paddingX - 10} y={y + 4} fontSize="11" fill="#94a3b8" textAnchor="end">{formatDuration(val)}</text>
                    </g>
                  );
                })}

                {/* Area Fills */}
                <path d={createAreaPath(pointsProd, chartHeight - paddingBottom)} fill="rgba(16, 185, 129, 0.1)" stroke="none" />
                <path d={createAreaPath(pointsDist, chartHeight - paddingBottom)} fill="rgba(239, 68, 68, 0.05)" stroke="none" />

                {/* Line Paths */}
                <path d={createSmoothPath(pointsProd)} fill="none" stroke="#10b981" strokeWidth="3" />
                <path d={createSmoothPath(pointsDist)} fill="none" stroke="#ef4444" strokeWidth="3" />

                {/* Data Points */}
                {pointsProd.map((p, i) => (
                  <circle key={`p-${i}`} cx={p[0]} cy={p[1]} r="4" fill="white" stroke="#10b981" strokeWidth="2" />
                ))}
                {pointsDist.map((p, i) => (
                  <circle key={`d-${i}`} cx={p[0]} cy={p[1]} r="4" fill="white" stroke="#ef4444" strokeWidth="2" />
                ))}

                {/* X Axis Labels */}
                {validTimeline.map((t, i) => {
                  // If too many points, only show a subset
                  if (validTimeline.length > 10 && i % Math.ceil(validTimeline.length / 8) !== 0 && i !== validTimeline.length - 1) return null;
                  const x = paddingX + i * ((chartWidth - paddingX * 2) / Math.max(1, validTimeline.length - 1));
                  const shortDate = t.date.length > 5 ? t.date.substring(5) : t.date; // Convert 2026-06-01 to 06-01
                  return (
                    <text key={i} x={x} y={chartHeight - 5} fontSize="11" fill="#94a3b8" textAnchor="middle">
                      {shortDate}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        <div className="section-card page-break-before">
          <h3 className="section-title">Top Visited Domains</h3>
          <p className="section-desc">Sorted by total duration &middot; Top domains of {metrics.uniqueDomainsCount} total</p>
          
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>DOMAIN</th>
                <th style={{ textAlign: 'right' }}>DURATION</th>
                <th style={{ textAlign: 'right' }}>SHARE</th>
              </tr>
            </thead>
            <tbody>
              {topDomains.length > 0 ? (
                topDomains.slice(0, 10).map((td, i) => {
                  const sharePct = total > 0 ? Math.round((td.durationMs / total) * 100) : 0;
                  const barColors = ['#6366f1', '#ec4899', '#f59e0b', '#ef4444', '#0ea5e9', '#10b981'];
                  const barColor = barColors[i % barColors.length];
                  
                  return (
                    <tr key={i}>
                      <td style={{ color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{td.domain}</td>
                      <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{formatDuration(td.durationMs)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="share-bar-bg">
                          <div className="share-bar-fill" style={{ width: `${sharePct}%`, background: barColor }}></div>
                        </div>
                        <span style={{ fontSize: '13px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{sharePct}%</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '40px', fontWeight: 500 }}>No domain activity recorded for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="section-card">
          <h3 className="section-title">Daily Breakdown & Insights</h3>
          <p className="section-desc">PER-DAY STATS &middot; BEHAVIOR ANALYSIS</p>

          <div className="insight-grid">
            <div className="insight-card blue">
              <h4 className="insight-title"><span style={{ color: '#6366f1' }}>■</span> Most Active Day</h4>
              <p className="insight-desc">
                {mostActiveDay 
                  ? `${mostActiveDay.date} was your busiest day with ~${formatDuration(mostActiveDay.durationMs)} of browsing time.`
                  : "Not enough data for this insight yet."}
              </p>
            </div>
            
            <div className="insight-card green">
              <h4 className="insight-title"><span style={{ color: '#10b981' }}>■</span> Top Productive Site</h4>
              <p className="insight-desc">
                {topProductiveSite
                  ? `${topProductiveSite.domain} leads with ${formatDuration(topProductiveSite.durationMs)} — strong focus.`
                  : "No productive sites detected yet."}
              </p>
            </div>

            <div className="insight-card red">
              <h4 className="insight-title"><span style={{ color: '#ef4444' }}>■■</span> Distraction Alert</h4>
              <p className="insight-desc">
                {topDistractingSite
                  ? `${topDistractingSite.domain} consumed ${formatDuration(topDistractingSite.durationMs)} (${topDistractingSite.visitCount} visits). Consider time limits.`
                  : "Excellent! No major distraction sinks detected."}
              </p>
            </div>

            <div className="insight-card orange">
              <h4 className="insight-title"><span style={{ color: '#f59e0b' }}>■</span> Focus Opportunity</h4>
              <p className="insight-desc">
                {unkPct > 0 
                  ? `${unkPct}% unclassified time — categorise these domains in the Dashboard for a more accurate productivity score.`
                  : "All top domains are categorized. Great job maintaining your rules!"}
              </p>
            </div>
          </div>
        </div>
        
      </div>
      <footer style={{ background: '#1a1e2e', color: '#94a3b8', padding: '20px 40px', marginTop: '40px', fontSize: '12px', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
        <span>WEBSWAP ANALYTICS &middot; SECURE LOCAL-FIRST ARCHITECTURE</span>
        <span>GENERATED {new Date().toLocaleDateString().toUpperCase()}</span>
      </footer>
    </div>
  );
}
