import React, { useMemo, useState } from "react";
import type { HistoricalStatsResponse } from "../../../types/tracking";
import { formatDuration } from "../../../utils/format";

interface MetricDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricType: "tracked" | "focus" | "visits" | null;
  stats: HistoricalStatsResponse | null;
}

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

export function MetricDetailsModal({ isOpen, onClose, metricType, stats }: MetricDetailsModalProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const content = useMemo(() => {
    if (!metricType || !stats) return null;

    const timeline = stats.hourlyTimeline || stats.timeline || [];
    const sortedTimeline = [...timeline].sort((a, b) => a.date.localeCompare(b.date));

    if (metricType === "tracked") {
      const maxDay = [...(stats.timeline || [])].sort((a, b) => b.durationMs - a.durationMs)[0];
      const maxVal = Math.max(...sortedTimeline.map(t => t.durationMs), 1);
      
      const width = 450;
      const height = 100;
      const stepX = sortedTimeline.length > 1 ? width / (sortedTimeline.length - 1) : width;
      const points = sortedTimeline.map((t, i) => ({
        x: i * stepX,
        y: height - (t.durationMs / maxVal) * (height - 10)
      }));
      const path = computeSmoothPath(points);

      const avgDailyMs = sortedTimeline.length > 0 ? stats.metrics.totalDurationMs / sortedTimeline.length : 0;
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Total Tracked Duration</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(stats.metrics.totalDurationMs)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Daily Average Tracked</span>
            <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '14px' }}>{formatDuration(avgDailyMs)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Average Session Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(stats.metrics.averageSessionMs)}</span>
          </div>
          {maxDay && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
              <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Highest Activity Day ({maxDay.date})</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(maxDay.durationMs)}</span>
            </div>
          )}

          {/* Keen Observations Bar (from Unique Domains) */}
          {stats && stats.topDomains && stats.topDomains.length > 0 && stats.metrics && stats.metrics.totalDurationMs > 0 && (
            <div style={{ padding: '24px 16px 8px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', gap: '16px', padding: '16px', background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Traversed Host</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--orange)' }}>{stats.topDomains[0].domain}</div>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Concentration</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{((stats.topDomains[0].durationMs / stats.metrics.totalDurationMs) * 100).toFixed(1)}% of all time</div>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Time per Host</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatDuration(stats.metrics.totalDurationMs / Math.max(1, stats.metrics.uniqueDomainsCount))}</div>
                </div>
              </div>

              {/* Concentration Stacked Bar Chart */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Domains Spread</span>
                </div>
                <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }}>
                  {(() => {
                    const total = stats.metrics.totalDurationMs;
                    const top5 = stats.topDomains.slice(0, 5);
                    const elegantColors = [
                      { gradient: 'linear-gradient(90deg, #8b5cf6, #6366f1)', dot: 'linear-gradient(135deg, #8b5cf6, #6366f1)' },
                      { gradient: 'linear-gradient(90deg, #0ea5e9, #3b82f6)', dot: 'linear-gradient(135deg, #0ea5e9, #3b82f6)' },
                      { gradient: 'linear-gradient(90deg, #14b8a6, #10b981)', dot: 'linear-gradient(135deg, #14b8a6, #10b981)' },
                      { gradient: 'linear-gradient(90deg, #fbbf24, #f59e0b)', dot: 'linear-gradient(135deg, #fbbf24, #f59e0b)' },
                      { gradient: 'linear-gradient(90deg, #f472b6, #ec4899)', dot: 'linear-gradient(135deg, #f472b6, #ec4899)' },
                    ];
                    
                    let accumulated = 0;
                    const segments = top5.map((td, i) => {
                      const pct = (td.durationMs / total) * 100;
                      accumulated += pct;
                      const isLast = i === top5.length - 1 && Math.abs(accumulated - 100) < 0.1;
                      return (
                        <div key={td.domain} title={`${td.domain}: ${pct.toFixed(1)}%`} 
                          style={{ 
                            width: `${pct}%`, 
                            background: elegantColors[i % elegantColors.length].gradient, 
                            height: '100%', 
                            cursor: 'help',
                            borderRight: isLast ? 'none' : '2px solid var(--bg-card)',
                            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3)'
                          }} 
                        />
                      );
                    });
                    
                    const remaining = 100 - accumulated;
                    if (remaining > 0.1) {
                      segments.push(
                        <div key="other" title={`Other Domains: ${remaining.toFixed(1)}%`} 
                          style={{ 
                            width: `${remaining}%`, 
                            background: 'linear-gradient(90deg, #475569, #334155)', 
                            height: '100%', 
                            cursor: 'help',
                            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)'
                          }} 
                        />
                      );
                    }
                    
                    return segments;
                  })()}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px' }}>
                  {stats.topDomains.slice(0, 5).map((td, i) => {
                    const elegantColors = [
                      { gradient: 'linear-gradient(90deg, #8b5cf6, #6366f1)', dot: 'linear-gradient(135deg, #8b5cf6, #6366f1)', shadow: 'rgba(99, 102, 241, 0.4)' },
                      { gradient: 'linear-gradient(90deg, #0ea5e9, #3b82f6)', dot: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', shadow: 'rgba(59, 130, 246, 0.4)' },
                      { gradient: 'linear-gradient(90deg, #14b8a6, #10b981)', dot: 'linear-gradient(135deg, #14b8a6, #10b981)', shadow: 'rgba(16, 185, 129, 0.4)' },
                      { gradient: 'linear-gradient(90deg, #fbbf24, #f59e0b)', dot: 'linear-gradient(135deg, #fbbf24, #f59e0b)', shadow: 'rgba(245, 158, 11, 0.4)' },
                      { gradient: 'linear-gradient(90deg, #f472b6, #ec4899)', dot: 'linear-gradient(135deg, #f472b6, #ec4899)', shadow: 'rgba(236, 72, 153, 0.4)' },
                    ];
                    const colorScheme = elegantColors[i % elegantColors.length];
                    return (
                      <div key={`legend-${td.domain}`} style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colorScheme.dot, marginRight: '8px', boxShadow: `0 2px 6px ${colorScheme.shadow}` }} />
                        <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{td.domain}</span>
                        <span style={{ marginLeft: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>{((td.durationMs / stats.metrics.totalDurationMs) * 100).toFixed(1)}%</span>
                      </div>
                    );
                  })}
                  {stats.topDomains.length > 5 && (
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'linear-gradient(135deg, #475569, #334155)', marginRight: '8px' }} />
                      <span>Other</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (metricType === "focus") {
      const width = 450;
      const height = 100;
      const stepX = sortedTimeline.length > 1 ? width / (sortedTimeline.length - 1) : width;
      const maxVal = Math.max(...sortedTimeline.map(t => Math.max(t.productiveMs || 0, t.distractingMs || 0)), 1);

      const prodPoints = sortedTimeline.map((t, i) => ({
        x: i * stepX, y: height - ((t.productiveMs || 0) / maxVal) * (height - 10)
      }));
      const distPoints = sortedTimeline.map((t, i) => ({
        x: i * stepX, y: height - ((t.distractingMs || 0) / maxVal) * (height - 10)
      }));

      const prodPath = computeSmoothPath(prodPoints);
      const distPath = computeSmoothPath(distPoints);

      const focusPct = stats.metrics.totalDurationMs > 0 ? (stats.metrics.productiveDurationMs / stats.metrics.totalDurationMs) * 100 : 0;
      const bestFocusDay = [...sortedTimeline].sort((a, b) => (b.productiveMs || 0) - (a.productiveMs || 0))[0];

      const totalPD = stats.metrics.productiveDurationMs + stats.metrics.distractingDurationMs;
      const prodRatio = totalPD > 0 ? stats.metrics.productiveDurationMs / totalPD : 0;
      const distRatio = totalPD > 0 ? stats.metrics.distractingDurationMs / totalPD : 0;

      const radius = 75;
      const circumference = 2 * Math.PI * radius;
      const prodDash = prodRatio * circumference;
      const distDash = distRatio * circumference;
      
      const hasBoth = prodRatio > 0 && distRatio > 0;
      const strokeW = 18;
      const gap = hasBoth ? strokeW + 12 : 0; 
      
      const pDash = Math.max(0, prodDash - gap);
      const dDash = Math.max(0, distDash - gap);
      
      const pOffset = hasBoth ? -(gap / 2) : 0;
      const dOffset = hasBoth ? -(gap / 2 + pDash + gap) : 0;
      
      const avgDailyProd = sortedTimeline.length > 0 ? stats.metrics.productiveDurationMs / sortedTimeline.length : 0;
      const consistentDays = sortedTimeline.filter(t => (t.productiveMs || 0) > (t.distractingMs || 0)).length;
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(16, 185, 129, 0.05)' }}>
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--green)', fontSize: '13px' }}>Focus Ratio vs Total Browsing</span>
            <span style={{ fontWeight: 600, color: 'var(--green)', fontSize: '14px' }}>{focusPct.toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Average Daily Focus</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(avgDailyProd)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Net Positive Days (Focus > Distraction)</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{consistentDays} of {sortedTimeline.length} days</span>
          </div>
          {bestFocusDay && bestFocusDay.productiveMs && bestFocusDay.productiveMs > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)' }} className="hover-bg-elevated">
              <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Peak Focus Day ({bestFocusDay.date})</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(bestFocusDay.productiveMs)}</span>
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ position: 'relative', width: '200px', height: '200px' }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                  <linearGradient id="prodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="distGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fb7185" />
                    <stop offset="100%" stopColor="#e11d48" />
                  </linearGradient>
                  <filter id="glowProd" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#059669" floodOpacity="0.4"/>
                  </filter>
                  <filter id="glowDist" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#e11d48" floodOpacity="0.2"/>
                  </filter>
                </defs>

                {/* Background Track */}
                <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="16" />
                
                {/* Inner Decorative Rings */}
                <circle cx="100" cy="100" r={radius - 22} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 6" />
                <circle cx="100" cy="100" r={radius - 18} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="2" />
                
                {/* Productive Segment */}
                {prodRatio > 0 && (
                  <circle 
                    cx="100" cy="100" r={radius} fill="none" stroke="url(#prodGrad)" strokeWidth="18"
                    strokeLinecap="round"
                    strokeDasharray={`${pDash} ${circumference}`}
                    strokeDashoffset={pOffset}
                    filter="url(#glowProd)"
                    style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  />
                )}
                
                {/* Distracting Segment */}
                {distRatio > 0 && (
                  <circle 
                    cx="100" cy="100" r={radius} fill="none" stroke="url(#distGrad)" strokeWidth="18"
                    strokeLinecap="round"
                    strokeDasharray={`${dDash} ${circumference}`}
                    strokeDashoffset={dOffset}
                    filter="url(#glowDist)"
                    style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  />
                )}
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{Math.round(prodRatio * 100)}%</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>Focus</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '48px', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'linear-gradient(135deg, #34d399, #059669)', marginRight: '10px', boxShadow: '0 2px 8px rgba(5, 150, 105, 0.4)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>Productive</span>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginLeft: '22px' }}>{formatDuration(stats.metrics.productiveDurationMs)}</div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'linear-gradient(135deg, #fb7185, #e11d48)', marginRight: '10px', boxShadow: '0 2px 8px rgba(225, 29, 72, 0.3)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>Distracting</span>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginLeft: '22px' }}>{formatDuration(stats.metrics.distractingDurationMs)}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (metricType === "visits") {
      const maxDay = [...(stats.timeline || [])].sort((a, b) => b.visitCount - a.visitCount)[0];
      const avgPerDomain = stats.metrics.uniqueDomainsCount > 0 
        ? (stats.metrics.totalVisits / stats.metrics.uniqueDomainsCount).toFixed(1) 
        : 0;
        
      const width = 450;
      const height = 100;
      const stepX = sortedTimeline.length > 1 ? width / (sortedTimeline.length - 1) : width;
      const maxVal = Math.max(...sortedTimeline.map(t => t.visitCount), 1);
      const points = sortedTimeline.map((t, i) => ({
        x: i * stepX,
        y: height - (t.visitCount / maxVal) * (height - 10)
      }));
      const path = computeSmoothPath(points);
      
      const avgDailyVisits = sortedTimeline.length > 0 ? Math.round(stats.metrics.totalVisits / sortedTimeline.length) : 0;
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Total Visits</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{stats.metrics.totalVisits.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Daily Average Visits</span>
            <span style={{ fontWeight: 600, color: 'var(--blue)', fontSize: '14px' }}>{avgDailyVisits.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Avg Visits per Domain</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{avgPerDomain}</span>
          </div>
          {maxDay && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
              <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Most Visits in a Day ({maxDay.date})</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{maxDay.visitCount.toLocaleString()}</span>
            </div>
          )}

          {/* Graph Section */}
          {sortedTimeline.length > 0 && (
            <div style={{ padding: '24px 16px 16px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Visits Trend
                </h4>
                {hoveredIdx !== null && (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {sortedTimeline[hoveredIdx]?.date}: {sortedTimeline[hoveredIdx]?.visitCount.toLocaleString()} visits
                  </span>
                )}
              </div>
              
              <div style={{ height: '100px', width: '100%', position: 'relative' }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="visitsAreaModal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  <line x1="0" y1={height} x2={width} y2={height} stroke="var(--border-subtle)" strokeWidth="1.5" />
                  
                  <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#visitsAreaModal)" />
                  <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  
                  {points.map((p, idx) => (
                    <g key={idx}>
                      <rect 
                        x={p.x - stepX/2} y="0" width={stepX} height={height} fill="transparent" 
                        onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}
                        style={{ cursor: 'crosshair' }}
                      />
                      {hoveredIdx === idx && (
                        <>
                          <line x1={p.x} y1="0" x2={p.x} y2={height} stroke="var(--border-subtle)" strokeDasharray="4 4" pointerEvents="none" />
                          <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" pointerEvents="none" />
                        </>
                      )}
                    </g>
                  ))}
                </svg>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px', color: 'var(--text-subtle)' }}>
                <span>{sortedTimeline[0]?.date}</span>
                <span>{sortedTimeline[sortedTimeline.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  }, [metricType, stats, hoveredIdx]);

  if (!isOpen || !metricType || !stats) return null;

  const titles = {
    tracked: "Tracked Time Details",
    focus: "Focus Hours Breakdown",
    visits: "Visits Statistics"
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '95vw', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
          <h3 className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            {metricType === 'tracked' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #8b5cf6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
            {metricType === 'focus' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green, #10b981)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            )}
            {metricType === 'visits' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}>
                <path d="m12 3-1.912 5.886H3.82l4.912 3.57L6.82 18.342 12 14.772l5.18 3.57-1.912-5.886 4.912-3.57h-6.268z" />
              </svg>
            )}
            {metricType && titles[metricType]}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
          {content}
        </div>
      </div>
    </div>
  );
}
