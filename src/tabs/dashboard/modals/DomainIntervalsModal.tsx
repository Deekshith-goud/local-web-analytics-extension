import React, { useState, useEffect, useMemo, useCallback } from "react";
import { formatDuration } from "../../../utils/format";
import { getStartOfDayTimestamp, getLocalTodayDateString } from "../../../utils/date-utils";
import type { ActivityRecord, DomainIntervalsResponse, RuntimeMessage } from "../../../types/tracking";

interface DomainIntervalsModalProps {
  domain: string | null;
  onClose: () => void;
  initialRange?: "today" | "7days" | "30days";
}

export function DomainIntervalsModal({ domain, onClose, initialRange = "7days" }: DomainIntervalsModalProps) {
  const [modalRange, setModalRange] = useState<"7days" | "30days">(initialRange === "today" ? "7days" : initialRange);
  const [domainIntervals, setDomainIntervals] = useState<ActivityRecord[]>([]);
  const [isLoadingIntervals, setIsLoadingIntervals] = useState(false);

  const fetchDomainIntervals = useCallback((targetDomain: string, range: "7days" | "30days") => {
    setIsLoadingIntervals(true);
    setModalRange(range);

    const now = Date.now();
    const todayStr = getLocalTodayDateString();
    const todayStart = getStartOfDayTimestamp(todayStr);
    let sMs = todayStart;
    
    if (range === "7days") sMs = todayStart - 6 * 24 * 60 * 60 * 1000;
    else if (range === "30days") sMs = todayStart - 29 * 24 * 60 * 60 * 1000;

    chrome.runtime.sendMessage(
      {
        type: "GET_DOMAIN_INTERVALS",
        version: 1,
        domain: targetDomain,
        startMs: sMs,
        endMs: now
      } satisfies RuntimeMessage,
      (response: DomainIntervalsResponse) => {
        setIsLoadingIntervals(false);
        if (response && response.intervals) {
          const sorted = [...response.intervals].sort((a, b) => b.startTime - a.startTime);
          setDomainIntervals(sorted);
        } else {
          setDomainIntervals([]);
        }
      }
    );
  }, []);

  useEffect(() => {
    if (domain) {
      fetchDomainIntervals(domain, modalRange);
    }
  }, [domain, fetchDomainIntervals, modalRange]);

  const groupedIntervals = useMemo(() => {
    const groups: Record<string, { date: Date, sessions: ActivityRecord[], totalMs: number }> = {};
    for (const interval of domainIntervals) {
      const d = new Date(interval.startTime);
      const dateStr = d.toLocaleDateString();
      if (!groups[dateStr]) {
        const startOfDay = new Date(d);
        startOfDay.setHours(0, 0, 0, 0);
        groups[dateStr] = { date: startOfDay, sessions: [], totalMs: 0 };
      }
      groups[dateStr]!.sessions.push(interval);
      groups[dateStr]!.totalMs += interval.durationMs;
    }
    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [domainIntervals]);

  if (!domain) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="domain-intervals-modal-title" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95vw', padding: '24px', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
          <h3 id="domain-intervals-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', color: 'inherit' }}>
            <img 
              src={chrome.runtime?.id ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent("https://" + domain)}&size=64` : ""} 
              alt="" 
              style={{ width: '24px', height: '24px', borderRadius: '4px', marginRight: '10px' }} 
            />
            <span style={{ color: 'inherit', fontWeight: 600 }}>{domain}</span>
            <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '14px', fontWeight: 500 }}>Sessions</span>
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '6px', borderRadius: '12px', gap: '6px' }}>
              <button 
                onClick={() => fetchDomainIntervals(domain, "7days")} 
                style={{ padding: '8px 16px', borderRadius: '8px', background: modalRange === "7days" ? '#3b82f6' : 'transparent', border: 'none', color: modalRange === "7days" ? '#ffffff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: modalRange === "7days" ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none', transform: modalRange === "7days" ? 'scale(1)' : 'scale(0.95)' }}
              >7 Days</button>
              <button 
                onClick={() => fetchDomainIntervals(domain, "30days")} 
                style={{ padding: '8px 16px', borderRadius: '8px', background: modalRange === "30days" ? '#3b82f6' : 'transparent', border: 'none', color: modalRange === "30days" ? '#ffffff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: modalRange === "30days" ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none', transform: modalRange === "30days" ? 'scale(1)' : 'scale(0.95)' }}
              >30 Days</button>
            </div>
            <button className="btn-icon" onClick={onClose} aria-label="Close modal" style={{ marginLeft: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          {isLoadingIntervals ? (
             <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading sessions...</div>
          ) : domainIntervals.length === 0 ? (
             <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No sessions found for this timeframe.</div>
          ) : (
            <div style={{ display: 'flex', height: '500px', padding: '30px 24px 16px 24px', position: 'relative' }}>
               {/* Y-Axis: Hours */}
               <div style={{ width: '50px', position: 'relative', borderRight: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, marginRight: '16px', paddingBottom: '50px' }}>
                  <div style={{ position: 'absolute', top: '0%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-subtle)' }}>12 AM</div>
                  <div style={{ position: 'absolute', top: '25%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-subtle)' }}>6 AM</div>
                  <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-subtle)' }}>12 PM</div>
                  <div style={{ position: 'absolute', top: '75%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-subtle)' }}>6 PM</div>
                  <div style={{ position: 'absolute', top: '100%', marginTop: '-50px', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-subtle)' }}>11:59</div>
               </div>

               {/* X-Axis Dates & Timeline Columns */}
               <div style={{ flex: 1, display: 'flex', overflowX: 'auto', paddingBottom: '8px', gap: '6px' }}>
                  {[...groupedIntervals].reverse().map(group => (
                     <div key={group.date.getTime()} style={{ flex: 1, minWidth: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        
                        {/* Timeline Column */}
                        <div style={{ width: '100%', height: 'calc(100% - 50px)', position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                           {group.sessions.map((session, i) => {
                              const startOfDay = group.date.getTime();
                              const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
                              const clampedStart = Math.max(startOfDay, session.startTime);
                              const clampedEnd = Math.min(endOfDay, session.endTime);
                              
                              const topPct = ((clampedStart - startOfDay) / (24 * 60 * 60 * 1000)) * 100;
                              const heightPct = ((clampedEnd - clampedStart) / (24 * 60 * 60 * 1000)) * 100;
                              const isLive = session.terminationReason === "idle" && Date.now() - session.endTime < 5000 && i === 0;

                              return (
                                 <div 
                                    key={session.sessionId}
                                    style={{
                                       position: 'absolute',
                                       top: `${topPct}%`,
                                       height: `${Math.max(0.4, heightPct)}%`,
                                       left: '20%',
                                       right: '20%',
                                       background: isLive ? '#10b981' : '#3b82f6',
                                       borderRadius: '2px',
                                       opacity: 0.9,
                                       cursor: 'pointer',
                                       transition: 'opacity 0.2s, background 0.2s, transform 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                       (e.target as HTMLDivElement).style.opacity = '1';
                                       (e.target as HTMLDivElement).style.background = isLive ? '#34d399' : '#60a5fa';
                                       (e.target as HTMLDivElement).style.transform = 'scaleX(1.4)';
                                       (e.target as HTMLDivElement).style.zIndex = '10';
                                    }}
                                    onMouseLeave={(e) => {
                                       (e.target as HTMLDivElement).style.opacity = '0.9';
                                       (e.target as HTMLDivElement).style.background = isLive ? '#10b981' : '#3b82f6';
                                       (e.target as HTMLDivElement).style.transform = 'scaleX(1)';
                                       (e.target as HTMLDivElement).style.zIndex = '1';
                                    }}
                                    title={`${new Date(clampedStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} - ${new Date(clampedEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\nDuration: ${formatDuration(session.durationMs)}\nReason: ${session.terminationReason.replace("-", " ")}${isLive ? ' (LIVE)' : ''}`}
                                 />
                              );
                           })}
                        </div>
                        
                        {/* X-Axis Date Label */}
                        <div style={{ height: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '8px' }}>
                           <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 500 }}>
                              {group.date.toLocaleDateString(undefined, { weekday: 'short' })}
                           </span>
                           <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              {group.date.getDate()}
                           </span>
                           <span style={{ fontSize: '9px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                              {formatDuration(group.totalMs)}
                           </span>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
