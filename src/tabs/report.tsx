import React, { useEffect, useState } from "react";
import type { HistoricalStatsResponse } from "../types/tracking";
import "../style.css";

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
    
    if (rangeParam === "today") {
      now.setHours(0, 0, 0, 0);
      startMs = now.getTime();
    } else if (rangeParam === "this_month") {
      now.setDate(now.getDate() - 30);
      now.setHours(0, 0, 0, 0);
      startMs = now.getTime();
    }

    const endMs = Date.now();

    chrome.runtime.sendMessage(
      { type: "GET_HISTORICAL_STATS", version: 1, startMs, endMs },
      (res: any) => {
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

  const { metrics, topDomains } = stats;
  
  const formatDuration = (ms: number) => {
    if (ms < 60000) return "< 1m";
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getRangeLabel = () => {
    if (rangeStr === "today") return "TODAY";
    if (rangeStr === "this_month") return "LAST 30 DAYS";
    return "ALL TIME";
  };

  const total = metrics.productiveDurationMs + metrics.distractingDurationMs + metrics.neutralDurationMs + metrics.unknownDurationMs;
  let currentAngle = 0;
  
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const createPieSlice = (value: number, color: string, gap: number = 0.0) => {
    if (value === 0 || total === 0) return null;
    let percent = value / total;
    
    const adjustedPercent = percent;
    const startOffset = gap/2;
    
    const [startX, startY] = getCoordinatesForPercent(currentAngle + startOffset);
    currentAngle += percent;
    const [endX, endY] = getCoordinatesForPercent(currentAngle - startOffset);
    
    const largeArcFlag = adjustedPercent > 0.5 ? 1 : 0;
    
    const pathData = [
      `M ${startX} ${startY}`,
      `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`
    ].join(' ');

    return <path d={pathData} fill="none" stroke={color} strokeWidth="0.5" strokeLinecap="butt" className="donut-slice" />;
  };

  const hasData = total > 0;
  
  const getPercent = (val: number) => total > 0 ? Math.round((val / total) * 100) : 0;
  const prodPct = getPercent(metrics.productiveDurationMs);
  const distPct = getPercent(metrics.distractingDurationMs);
  const neutPct = getPercent(metrics.neutralDurationMs);
  const unkPct = getPercent(metrics.unknownDurationMs);

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
        
        .stat-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 6px;
        }
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
        
        .legend-row { display: grid; grid-template-columns: auto 150px auto auto; align-items: center; gap: 15px; padding: 12px 0; }
        .legend-dot { width: 16px; height: 16px; border-radius: 50%; display: inline-block; }
        .legend-label { font-weight: 600; font-size: 15px; color: #0f172a; }
        .legend-time { font-size: 14px; color: #64748b; font-variant-numeric: tabular-nums; text-align: right; }
        .legend-pct { background: #f1f5f9; color: #4f46e5; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 6px; min-width: 45px; text-align: center; }
        
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th { text-align: left; padding: 12px 10px; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .data-table td { padding: 16px 10px; font-size: 14px; border-top: 1px solid #f1f5f9; }
        .data-table tr:hover td { background: #f8fafc; }
        
        .share-bar-bg { width: 100px; height: 12px; background: #f1f5f9; border-radius: 2px; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 12px; }
        .share-bar-fill { height: 100%; }

        @media print {
          body, .report-viewport { background: white !important; }
          .header-bg { background: white !important; color: black !important; padding: 20px 0 !important; border-bottom: 2px solid #000; }
          .top-cards { margin-top: 20px !important; }
          .stat-card { border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
          .section-card { border: 1px solid #e2e8f0 !important; box-shadow: none !important; break-inside: avoid; }
          .no-print { display: none !important; }
          .header-bg h1 { color: black !important; }
          .header-bg p { color: #64748b !important; }
          .btn-primary { display: none !important; }
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
                SAVE REPORT
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
                <svg viewBox="-1.2 -1.2 2.4 2.4" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  {createPieSlice(metrics.productiveDurationMs, '#10b981')}
                  {createPieSlice(metrics.distractingDurationMs, '#ef4444')}
                  {createPieSlice(metrics.neutralDurationMs, '#3b82f6')}
                  {createPieSlice(metrics.unknownDurationMs, '#94a3b8')}
                </svg>
              ) : (
                <div style={{ width: '100%', height: '100%', border: '8px solid #f1f5f9', borderRadius: '50%' }} />
              )}
              {hasData && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{Math.round(metrics.productivityScore || 0)}%</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>SCORE</div>
                </div>
              )}
            </div>
            
            <div style={{ flex: 1 }}>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: '#10b981' }}></span>
                <span className="legend-label">Productive</span>
                <span className="legend-time">{formatDuration(metrics.productiveDurationMs)}</span>
                <span className="legend-pct" style={{ color: '#10b981', background: '#ecfdf5' }}>{prodPct}%</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: '#ef4444' }}></span>
                <span className="legend-label">Distracting</span>
                <span className="legend-time">{formatDuration(metrics.distractingDurationMs)}</span>
                <span className="legend-pct" style={{ color: '#ef4444', background: '#fef2f2' }}>{distPct}%</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: '#3b82f6' }}></span>
                <span className="legend-label">Neutral</span>
                <span className="legend-time">{formatDuration(metrics.neutralDurationMs)}</span>
                <span className="legend-pct" style={{ color: '#3b82f6', background: '#eff6ff' }}>{neutPct}%</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: '#94a3b8' }}></span>
                <span className="legend-label">Uncategorized</span>
                <span className="legend-time">{formatDuration(metrics.unknownDurationMs)}</span>
                <span className="legend-pct" style={{ color: '#64748b', background: '#f8fafc' }}>{unkPct}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="section-card">
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
                topDomains.slice(0, 15).map((td, i) => {
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
        
      </div>
      <footer style={{ background: '#1a1e2e', color: '#94a3b8', padding: '20px 40px', marginTop: '40px', fontSize: '12px', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
        <span>WEBSWAP ANALYTICS &middot; SECURE LOCAL-FIRST ARCHITECTURE</span>
        <span>GENERATED {new Date().toLocaleDateString().toUpperCase()}</span>
      </footer>
    </div>
  );
}
