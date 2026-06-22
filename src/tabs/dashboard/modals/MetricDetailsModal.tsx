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

      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Total Tracked Duration</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(stats.metrics.totalDurationMs)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Average Session Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(stats.metrics.averageSessionMs)}</span>
          </div>
          {maxDay && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
              <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Most Active Day ({maxDay.date})</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(maxDay.durationMs)}</span>
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

      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '12px' }} />
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Productive Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(stats.metrics.productiveDurationMs)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '12px' }} />
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Distracting Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(stats.metrics.distractingDurationMs)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6b7280', marginRight: '12px' }} />
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Neutral Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(stats.metrics.neutralDurationMs)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text3)', marginRight: '12px' }} />
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Unknown Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{formatDuration(stats.metrics.unknownDurationMs)}</span>
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
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-elevated">
            <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>Total Visits</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{stats.metrics.totalVisits.toLocaleString()}</span>
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
