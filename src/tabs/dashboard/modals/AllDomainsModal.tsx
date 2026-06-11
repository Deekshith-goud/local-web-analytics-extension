import React, { useState } from "react";
import { formatDuration } from "../../../utils/format";
import type { HistoricalStatsResponse } from "../../../types/tracking";
import type { ProductivityCategory } from "../../../analytics/productivity-rules";

interface AllDomainsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: HistoricalStatsResponse | null;
  isQuickClassifyMode: boolean;
  setIsQuickClassifyMode: (value: boolean) => void;
  handleSaveQuickClassifications: () => void;
  fetchDomainIntervals: (domain: string, range?: "today" | "7days" | "30days") => void;
  range: "today" | "7days" | "30days";
  quickClassifications: Record<string, ProductivityCategory>;
  setQuickClassifications: React.Dispatch<React.SetStateAction<Record<string, ProductivityCategory>>>;
}

export function AllDomainsModal({
  isOpen,
  onClose,
  stats,
  isQuickClassifyMode,
  setIsQuickClassifyMode,
  handleSaveQuickClassifications,
  fetchDomainIntervals,
  range,
  quickClassifications,
  setQuickClassifications
}: AllDomainsModalProps) {
  const [allDomainsSort, setAllDomainsSort] = useState<"duration" | "visits">("duration");
  const [allDomainsSearch, setAllDomainsSearch] = useState("");

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="all-domains-modal-title" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '95vw', padding: '24px', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
          <h3 id="all-domains-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            All Unique Domains
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexShrink: 0 }}>
          <input 
            type="text" 
            placeholder="Search domains..." 
            value={allDomainsSearch}
            onChange={(e) => setAllDomainsSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}
          />
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px' }}>
            <button onClick={() => setAllDomainsSort("duration")} style={{ padding: '4px 12px', borderRadius: '6px', background: allDomainsSort === "duration" ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: allDomainsSort === "duration" ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: allDomainsSort === "duration" ? 600 : 400 }}>Duration</button>
            <button onClick={() => setAllDomainsSort("visits")} style={{ padding: '4px 12px', borderRadius: '6px', background: allDomainsSort === "visits" ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: allDomainsSort === "visits" ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: allDomainsSort === "visits" ? 600 : 400 }}>Sessions</button>
          </div>
          {isQuickClassifyMode ? (
            <button 
              onClick={handleSaveQuickClassifications}
              className="btn-primary-elegant" 
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', margin: 0, height: 'auto', display: 'flex', alignItems: 'center' }}
            >
              Save Changes
            </button>
          ) : (
            <button 
              onClick={() => setIsQuickClassifyMode(true)}
              style={{ padding: '6px 14px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center' }}
            >
              Quick Classify
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          {(() => {
            if (!stats || !stats.topDomains) return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No domains found</div>;
            
            const filtered = stats.topDomains.filter(d => d.domain.toLowerCase().includes(allDomainsSearch.toLowerCase()));
            filtered.sort((a, b) => allDomainsSort === "visits" ? b.visitCount - a.visitCount : b.durationMs - a.durationMs);
            
            const maxD = Math.max(...filtered.map(d => d.durationMs), 1);
            const maxV = Math.max(...filtered.map(d => d.visitCount), 1);

            if (filtered.length === 0) return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No matching domains</div>;

            return (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filtered.map((item, idx) => {
                  const fillWidth = allDomainsSort === "visits" ? (item.visitCount / maxV) * 100 : (item.durationMs / maxD) * 100;
                  return (
                    <div 
                      key={item.domain} 
                      style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s', background: 'var(--bg-secondary)', cursor: isQuickClassifyMode ? 'default' : 'pointer' }} 
                      className="hover-bg-elevated"
                      onClick={() => { if (!isQuickClassifyMode) fetchDomainIntervals(item.domain, range); }}
                      title={isQuickClassifyMode ? "Quick classify" : "Click to view full session timeline"}
                    >
                      <div style={{ width: '24px', color: 'var(--text-subtle)', fontSize: '12px', fontWeight: 500, marginRight: '12px', textAlign: 'right', flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      
                      <img 
                        src={chrome.runtime?.id ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent("https://" + item.domain)}&size=64` : ""} 
                        alt="" 
                        style={{ width: '18px', height: '18px', borderRadius: '3px', marginRight: '14px', flexShrink: 0 }} 
                      />

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', letterSpacing: '-0.01em' }}>{item.domain}</span>
                          {isQuickClassifyMode ? (
                            <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: '6px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={() => setQuickClassifications(prev => ({ ...prev, [item.domain]: 'productive' }))}
                                style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRight: '1px solid var(--border-subtle)', background: quickClassifications[item.domain] === 'productive' ? '#10b981' : 'transparent', color: quickClassifications[item.domain] === 'productive' ? '#fff' : '#10b981', cursor: 'pointer', transition: 'all 0.15s' }}
                              >PROD</button>
                              <button 
                                onClick={() => setQuickClassifications(prev => ({ ...prev, [item.domain]: 'distracting' }))}
                                style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRight: '1px solid var(--border-subtle)', background: quickClassifications[item.domain] === 'distracting' ? '#ef4444' : 'transparent', color: quickClassifications[item.domain] === 'distracting' ? '#fff' : '#ef4444', cursor: 'pointer', transition: 'all 0.15s' }}
                              >DIST</button>
                              <button 
                                onClick={() => setQuickClassifications(prev => ({ ...prev, [item.domain]: 'neutral' }))}
                                style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, border: 'none', background: quickClassifications[item.domain] === 'neutral' ? '#6b7280' : 'transparent', color: quickClassifications[item.domain] === 'neutral' ? '#fff' : '#6b7280', cursor: 'pointer', transition: 'all 0.15s' }}
                              >NEUT</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                {formatDuration(item.durationMs)}
                              </span>
                              <span style={{ color: 'var(--border-subtle)' }}>•</span>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {item.visitCount} visits
                              </span>
                            </div>
                          )}
                        </div>
                        {!isQuickClassifyMode && (
                          <div style={{ height: '3px', background: 'var(--bg-elevated)', borderRadius: '1.5px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${fillWidth}%`, background: 'var(--brand-purple, #8b5cf6)', borderRadius: '1.5px', opacity: 0.85 }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
