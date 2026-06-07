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
      now.setDate(1);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: '"Outfit", system-ui, sans-serif', background: '#0f172a', color: 'white' }}>
        <h2 style={{ animation: 'pulse 1.5s infinite ease-in-out' }}>Synthesizing Analytics...</h2>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </div>
    );
  }

  if (errorDetails || !stats || !stats.metrics) {
    return (
      <div style={{ padding: '40px', fontFamily: '"Outfit", system-ui, sans-serif', background: '#0f172a', color: 'white', minHeight: '100vh' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '30px', borderRadius: '16px', maxWidth: '600px', margin: '40px auto' }}>
          <h2 style={{ color: '#f87171', marginTop: 0 }}>Error generating report</h2>
          <p style={{ color: '#fca5a5', fontFamily: 'monospace', fontSize: '13px', wordBreak: 'break-all' }}>{errorDetails || "Unknown error."}</p>
        </div>
      </div>
    );
  }

  const { metrics, topDomains } = stats;
  
  const formatDuration = (ms: number) => {
    if (ms < 60000) return "< 1 min";
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getRangeLabel = () => {
    if (rangeStr === "today") return "Today";
    if (rangeStr === "this_month") return "This Month";
    return "All Time";
  };

  const total = metrics.productiveDurationMs + metrics.distractingDurationMs + metrics.neutralDurationMs + metrics.unknownDurationMs;
  let currentAngle = 0;
  
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const createPieSlice = (value: number, color: string, gap: number = 0.01) => {
    if (value === 0 || total === 0) return null;
    let percent = value / total;
    
    const adjustedPercent = percent > gap * 2 ? percent - gap : percent;
    const startOffset = percent > gap * 2 ? gap/2 : 0;
    
    const [startX, startY] = getCoordinatesForPercent(currentAngle + startOffset);
    currentAngle += percent;
    const [endX, endY] = getCoordinatesForPercent(currentAngle - startOffset);
    
    const largeArcFlag = adjustedPercent > 0.5 ? 1 : 0;
    
    const pathData = [
      `M ${startX} ${startY}`,
      `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`
    ].join(' ');

    return <path d={pathData} fill="none" stroke={color} strokeWidth="0.4" strokeLinecap="round" style={{ transition: 'all 0.3s ease', transformOrigin: 'center' }} className="donut-slice" />;
  };

  const hasData = total > 0;

  return (
    <div className="report-viewport" style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      padding: '40px',
      fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
      color: '#f8fafc'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        
        /* Animations */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }

        /* Donut Hover */
        .donut-slice:hover { filter: brightness(1.2); cursor: pointer; }
        
        /* Container */
        .report-paper {
          max-width: 850px;
          margin: 0 auto;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 50px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          position: relative;
          overflow: hidden;
        }
        
        /* Subtle glowing orb in background */
        .report-paper::before {
          content: ''; position: absolute; top: -150px; right: -150px; width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%);
          border-radius: 50%; pointer-events: none; z-index: 0;
        }

        /* Print Overrides */
        @media print {
          body, .report-viewport { background: white !important; padding: 0 !important; color: #0f172a !important; }
          .report-paper { background: white !important; border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; filter: none !important; }
          .report-paper::before { display: none !important; }
          .no-print { display: none !important; }
          .metric-card { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
          .chart-section { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
          .metric-value { background: none !important; -webkit-text-fill-color: #3b82f6 !important; color: #3b82f6 !important; }
          .data-table th { color: #64748b !important; border-bottom: 2px solid #e2e8f0 !important; }
          .data-table td { color: #0f172a !important; border-bottom: 1px solid #f1f5f9 !important; }
          .data-table tr:nth-child(even) td { background: #f8fafc !important; }
          .domain-text { color: #0f172a !important; }
          .duration-text { color: #3b82f6 !important; background: none !important; border: 1px solid #3b82f6 !important; }
          .report-title { background: none !important; -webkit-text-fill-color: #0f172a !important; color: #0f172a !important; }
          .range-pill { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; color: #0f172a !important; }
          .chart-legend .legend-item { color: #0f172a !important; border: 1px solid #e2e8f0 !important; background: #fff !important; }
          .chart-legend span { color: #0f172a !important; }
        }
        @page { size: A4; margin: 20mm; }

        .report-header { position: relative; z-index: 1; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 24px; margin-bottom: 36px; display: flex; justify-content: space-between; align-items: flex-end; }
        .report-title { font-size: 36px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.02em; background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .report-subtitle { font-size: 14px; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
        
        .metrics-grid { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 48px; }
        .metric-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; position: relative; overflow: hidden; transition: transform 0.3s ease, background 0.3s ease; }
        .metric-card:hover { transform: translateY(-4px); background: rgba(255, 255, 255, 0.05); }
        .metric-value { font-size: 32px; font-weight: 800; margin-bottom: 8px; font-variant-numeric: tabular-nums; background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .metric-label { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px; }

        .chart-section { position: relative; z-index: 1; display: flex; gap: 48px; align-items: center; margin-bottom: 48px; padding: 36px; background: rgba(255, 255, 255, 0.02); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.05); }
        .chart-legend { flex: 1; display: flex; flex-direction: column; gap: 16px; justify-content: center; }
        .legend-item { display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 500; background: rgba(255,255,255,0.02); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03); transition: background 0.2s; }
        .legend-item:hover { background: rgba(255,255,255,0.05); }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 12px; display: inline-block; box-shadow: 0 0 10px currentColor; }

        .data-table { position: relative; z-index: 1; width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 24px; }
        .data-table th { text-align: left; padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .data-table td { padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); font-size: 15px; font-weight: 500; transition: background 0.2s; }
        .data-table tr:hover td { background: rgba(255, 255, 255, 0.02); }
        .data-table tr:last-child td { border-bottom: none; }
        .domain-text { color: #f8fafc; font-weight: 600; }
        .duration-text { font-variant-numeric: tabular-nums; background: rgba(59, 130, 246, 0.1); color: #60a5fa; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700; display: inline-block; }
      `}</style>

      <div className="report-paper animate-up">
        
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px', position: 'relative', zIndex: 10 }}>
          <button 
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)', transition: 'transform 0.2s, box-shadow 0.2s' }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'none'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Export to PDF
          </button>
        </div>

        <header className="report-header">
          <div>
            <h1 className="report-title">WebSwap Analytics</h1>
            <p className="report-subtitle">Intelligent Browsing Report</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500, marginBottom: '4px' }}>Range</div>
            <div className="range-pill" style={{ fontSize: '16px', color: '#f8fafc', fontWeight: 700, background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {getRangeLabel()}
            </div>
          </div>
        </header>

        <div className="metrics-grid animate-up delay-1">
          <div className="metric-card">
            <div className="metric-value">{formatDuration(metrics.totalDurationMs)}</div>
            <div className="metric-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Total Duration
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{metrics.totalVisits.toLocaleString()}</div>
            <div className="metric-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Total Visits
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{metrics.uniqueDomainsCount.toLocaleString()}</div>
            <div className="metric-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Unique Domains
            </div>
          </div>
        </div>

        <div className="animate-up delay-2">
          <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 24px 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
            Productivity Breakdown
          </h3>
          <div className="chart-section">
            <div style={{ width: '220px', height: '220px', position: 'relative' }}>
              {hasData ? (
                <svg viewBox="-1.2 -1.2 2.4 2.4" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }}>
                  {createPieSlice(metrics.productiveDurationMs, '#10b981')}
                  {createPieSlice(metrics.neutralDurationMs, '#94a3b8')}
                  {createPieSlice(metrics.unknownDurationMs, '#475569')}
                  {createPieSlice(metrics.distractingDurationMs, '#ef4444')}
                </svg>
              ) : (
                <div style={{ width: '100%', height: '100%', border: '4px dashed rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>No Data</span>
                </div>
              )}
              {/* Inner hole overlay for Donut effect */}
              {hasData && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>{Math.round(metrics.productivityScore || 0)}</div>
                </div>
              )}
            </div>
            <div className="chart-legend">
              <div className="legend-item" style={{ color: '#10b981' }}>
                <div><span className="legend-dot" style={{ background: '#10b981' }}></span>Productive</div>
                <span style={{ color: '#f8fafc' }}>{formatDuration(metrics.productiveDurationMs)}</span>
              </div>
              <div className="legend-item" style={{ color: '#ef4444' }}>
                <div><span className="legend-dot" style={{ background: '#ef4444' }}></span>Distracting</div>
                <span style={{ color: '#f8fafc' }}>{formatDuration(metrics.distractingDurationMs)}</span>
              </div>
              <div className="legend-item" style={{ color: '#94a3b8' }}>
                <div><span className="legend-dot" style={{ background: '#94a3b8' }}></span>Neutral</div>
                <span style={{ color: '#f8fafc' }}>{formatDuration(metrics.neutralDurationMs)}</span>
              </div>
              <div className="legend-item" style={{ color: '#475569' }}>
                <div><span className="legend-dot" style={{ background: '#475569' }}></span>Uncategorized</div>
                <span style={{ color: '#f8fafc' }}>{formatDuration(metrics.unknownDurationMs)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="animate-up delay-3">
          <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Top Visited Domains
          </h3>
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60%' }}>Domain</th>
                  <th style={{ textAlign: 'right' }}>Total Duration</th>
                </tr>
              </thead>
              <tbody>
                {topDomains.length > 0 ? (
                  topDomains.slice(0, 15).map((td, i) => (
                    <tr key={i}>
                      <td className="domain-text">{td.domain}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="duration-text">{formatDuration(td.durationMs)}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', color: '#64748b', padding: '40px', fontWeight: 500 }}>No domain activity recorded for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <footer style={{ marginTop: '60px', textAlign: 'center', fontSize: '12px', color: '#64748b', fontWeight: 500, letterSpacing: '0.05em', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
          WEBSWAP ANALYTICS • SECURE LOCAL-FIRST ARCHITECTURE • GENERATED {new Date().toLocaleDateString().toUpperCase()}
        </footer>
      </div>
    </div>
  );
}
