import React, { useMemo } from "react";
import type { HistoricalStatsResponse } from "../../../types/tracking";
import { formatDuration } from "../../../utils/format";

interface MetricDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricType: "tracked" | "focus" | "visits" | null;
  stats: HistoricalStatsResponse | null;
}

export function MetricDetailsModal({ isOpen, onClose, metricType, stats }: MetricDetailsModalProps) {
  if (!isOpen || !metricType || !stats) return null;

  const content = useMemo(() => {
    if (metricType === "tracked") {
      const maxDay = [...(stats.timeline || [])].sort((a, b) => b.durationMs - a.durationMs)[0];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface2)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text2)' }}>Total Tracked Duration</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatDuration(stats.metrics.totalDurationMs)}</span>
          </div>
          <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface2)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text2)' }}>Average Session Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatDuration(stats.metrics.averageSessionMs)}</span>
          </div>
          {maxDay && (
            <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface2)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text2)' }}>Most Active Day ({maxDay.date})</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatDuration(maxDay.durationMs)}</span>
            </div>
          )}
        </div>
      );
    }

    if (metricType === "focus") {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface2)', borderRadius: '8px', borderLeft: '4px solid var(--productive)' }}>
            <span style={{ color: 'var(--text2)' }}>Productive Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatDuration(stats.metrics.productiveDurationMs)}</span>
          </div>
          <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface2)', borderRadius: '8px', borderLeft: '4px solid var(--distracting)' }}>
            <span style={{ color: 'var(--text2)' }}>Distracting Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatDuration(stats.metrics.distractingDurationMs)}</span>
          </div>
          <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface2)', borderRadius: '8px', borderLeft: '4px solid var(--neutral)' }}>
            <span style={{ color: 'var(--text2)' }}>Neutral Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatDuration(stats.metrics.neutralDurationMs)}</span>
          </div>
          <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface2)', borderRadius: '8px', borderLeft: '4px solid var(--text3)' }}>
            <span style={{ color: 'var(--text2)' }}>Unknown Time</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{formatDuration(stats.metrics.unknownDurationMs)}</span>
          </div>
        </div>
      );
    }

    if (metricType === "visits") {
      const maxDay = [...(stats.timeline || [])].sort((a, b) => b.visitCount - a.visitCount)[0];
      const avgPerDomain = stats.metrics.uniqueDomainsCount > 0 
        ? (stats.metrics.totalVisits / stats.metrics.uniqueDomainsCount).toFixed(1) 
        : 0;
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface2)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text2)' }}>Total Visits</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{stats.metrics.totalVisits.toLocaleString()}</span>
          </div>
          <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface2)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text2)' }}>Avg Visits per Domain</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{avgPerDomain}</span>
          </div>
          {maxDay && (
            <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface2)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text2)' }}>Most Visits in a Day ({maxDay.date})</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{maxDay.visitCount.toLocaleString()}</span>
            </div>
          )}
        </div>
      );
    }

    return null;
  }, [metricType, stats]);

  const titles = {
    tracked: "Tracked Time Details",
    focus: "Focus Hours Breakdown",
    visits: "Visits Statistics"
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%', padding: '24px', display: 'flex', flexDirection: 'column' }}>
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
        
        {content}
      </div>
    </div>
  );
}
