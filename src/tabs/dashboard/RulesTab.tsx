import React, { useState, useMemo } from "react";
import "./RulesTab.css";
import { PomodoroTimer } from "../../components/ui/PomodoroTimer";
import { CustomDropdown } from "../../components/ui/CustomDropdown";
import type { ProductivityRule } from "../../analytics/productivity-rules";
import type { PomodoroState, PomodoroSettings, TimeLimitRule } from "../../types/tracking";

// Define DisplayRule based on what dashboard.tsx was using
export interface DisplayRule extends ProductivityRule {
  isCustom?: boolean;
}

interface RulesTabProps {
  pomodoroState: PomodoroState;
  pomodoroSettings: PomodoroSettings;
  handlePomodoroAction: (action: "START_POMODORO" | "PAUSE_POMODORO" | "RESUME_POMODORO" | "STOP_POMODORO", type?: "focus" | "break") => void;
  handlePomodoroSettingToggle: (key: keyof PomodoroSettings) => void;
  handlePomodoroDurationChange: (key: "focusDurationMs" | "breakDurationMs", val: number) => void;
  handlePomodoroMessageChange: (key: "customFocusMessage" | "customBreakMessage", val: string) => void;
  setPomodoroSettings: (settings: PomodoroSettings) => void;
  
  setInfoModal: (modal: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => void;
  setShowAddRuleModal: (show: boolean) => void;
  setShowAddLimitModal: (show: boolean) => void;
  
  allDisplayRules: DisplayRule[];
  handleEditRule: (rule: ProductivityRule) => void;
  handleDeleteRule: (domain: string) => void;
  handleResetRules: () => void;
  
  timeLimitRules: TimeLimitRule[];
  handleToggleTimeLimit: (domain: string) => void;
  handleDeleteTimeLimit: (domain: string) => void;
}

export function RulesTab({
  pomodoroState,
  pomodoroSettings,
  handlePomodoroAction,
  handlePomodoroSettingToggle,
  handlePomodoroDurationChange,
  handlePomodoroMessageChange,
  setPomodoroSettings,
  
  setInfoModal,
  setShowAddRuleModal,
  setShowAddLimitModal,
  
  allDisplayRules,
  handleEditRule,
  handleDeleteRule,
  handleResetRules,
  
  timeLimitRules,
  handleToggleTimeLimit,
  handleDeleteTimeLimit
}: RulesTabProps) {

  const [searchQuery, setSearchQuery] = useState("");
  const [ruleTypeFilter, setRuleTypeFilter] = useState<'all' | 'productive' | 'distracting' | 'neutral' | 'unknown'>('all');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const searchedRules = useMemo(() => {
    return allDisplayRules.filter(rule => {
      const matchesSearch = rule.domain.includes(searchQuery.toLowerCase());
      const matchesType = ruleTypeFilter === 'all' || rule.category === ruleTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [allDisplayRules, searchQuery, ruleTypeFilter]);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    return `${minutes}m`;
  };

  return (
    <section className="rules-manager-layout tab-panel" aria-label="Productivity classification preferences">
      <div className="rules-sidebar">
        <PomodoroTimer 
          pomodoroState={pomodoroState}
          pomodoroSettings={pomodoroSettings}
          handlePomodoroAction={handlePomodoroAction}
          handlePomodoroSettingToggle={handlePomodoroSettingToggle}
          handlePomodoroDurationChange={handlePomodoroDurationChange}
          handlePomodoroMessageChange={handlePomodoroMessageChange}
          setPomodoroSettings={setPomodoroSettings}
          setInfoModal={setInfoModal}
        />
      </div>

      <div className="rules-main" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
        <div className="rules-card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0 }}>Active Classifications</h3>
              <button type="button" className="btn-icon" onClick={() => setInfoModal("classification")} aria-label="About Classifications" style={{ padding: '4px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </button>
            </div>
            <div>
              <button type="button" className="btn-primary-elegant" style={{ boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }} onClick={() => setShowAddRuleModal(true)}>
                <span style={{ fontSize: '18px', fontWeight: 300, marginRight: '6px', lineHeight: 1 }}>+</span> Add Custom Rule
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                type="text"
                className="modal-input-elegant"
                placeholder="Search domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", paddingLeft: "36px" }}
                aria-label="Search rules by domain"
              />
            </div>
            <CustomDropdown
              value={ruleTypeFilter}
              options={[
                { id: "all", label: "All Categories" },
                { id: "productive", label: "Productive" },
                { id: "distracting", label: "Distracting" },
                { id: "neutral", label: "Neutral" },
                { id: "unknown", label: "Unknown" }
              ]}
              onChange={(val) => setRuleTypeFilter(val as 'all' | 'productive' | 'distracting' | 'neutral' | 'unknown')}
              width="150px"
            />
          </div>

          <div className="elegant-list-container" style={{ maxHeight: "280px", overflowY: "auto", paddingRight: searchedRules.length > 5 ? "8px" : "0" }}>
            {searchedRules.length === 0 ? (
              <div className="vis-empty" style={{ minHeight: "150px" }}>
                <p className="vis-empty-title">No Rules Found</p>
                <p className="vis-empty-desc">Adjust your search or filter settings.</p>
              </div>
            ) : (
              <>
                <div className="elegant-list-header" style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--surface)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase", margin: "-1px 0 0 0" }}>
                  <div className="elegant-row-col domain-col" style={{ flex: 2.5 }}>DOMAIN</div>
                  <div className="elegant-row-col category-col" style={{ flex: 1.5, paddingLeft: "8px" }}>CLASSIFICATION</div>
                  <div className="elegant-row-col actions-col" style={{ flex: 1 }}>ACTIONS</div>
                </div>
                {searchedRules.map((rule) => (
                  <div className="elegant-list-row" key={`${rule.domain}-${rule.isCustom ? 'custom' : 'default'}`}>
                    <div className="elegant-row-col domain-col" style={{ flex: 2.5, display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(99,102,241,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {imgErrors[rule.domain] ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text3)" }}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        ) : (
                          <img 
                            src={chrome.runtime?.id ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent("https://" + rule.domain)}&size=32` : ""} 
                            alt="" 
                            style={{ width: "16px", height: "16px", borderRadius: "2px" }} 
                            onError={() => setImgErrors(prev => ({ ...prev, [rule.domain]: true }))}
                          />
                        )}
                      </div>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1 }}>{rule.domain}</span>
                      <a href={`https://${rule.domain}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', opacity: 0.5, transition: 'opacity 0.2s', padding: '4px' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'} title={`Visit ${rule.domain}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    </div>
                    <div className="elegant-row-col category-col" style={{ flex: 1.5 }}>
                      <span className={`badge-category ${rule.category}`}>{rule.category.toUpperCase()}</span>
                    </div>
                    <div className="elegant-row-col actions-col" style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
                        <button type="button" className="btn-icon-elegant" onClick={() => handleEditRule(rule)} title={`Edit rule for ${rule.domain}`} aria-label={`Edit rule for ${rule.domain}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button type="button" className="btn-icon-elegant" onClick={() => handleDeleteRule(rule.domain)} title={`Delete rule for ${rule.domain}`} aria-label={`Delete rule for ${rule.domain}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="rules-summary-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", marginTop: "16px", background: "var(--surface)", borderRadius: "8px", border: "1px solid var(--border)", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingRight: "24px", borderRight: "1px solid var(--border)" }}>
                <div style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", padding: "6px", borderRadius: "6px", display: "flex" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.05em" }}>SUMMARY</span>
                  <span style={{ fontSize: "14px", fontWeight: 700 }}>Total: {allDisplayRules.length}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                   <svg width="14" height="14" stroke="#10b981" fill="none" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                   <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>Productive</span>
                   <span style={{ fontSize: "14px", fontWeight: 700 }}>{allDisplayRules.filter(r => r.category === 'productive').length}</span>
                 </div>
                 <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                   <svg width="14" height="14" stroke="#f59e0b" fill="none" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                   <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>Distracting</span>
                   <span style={{ fontSize: "14px", fontWeight: 700 }}>{allDisplayRules.filter(r => r.category === 'distracting').length}</span>
                 </div>
                 <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                   <svg width="14" height="14" stroke="#6b7280" fill="none" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                   <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>Neutral</span>
                   <span style={{ fontSize: "14px", fontWeight: 700 }}>{allDisplayRules.filter(r => r.category === 'neutral').length}</span>
                 </div>
              </div>
            </div>
            <button type="button" className="btn-danger-outline" style={{ margin: 0, padding: "8px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }} onClick={handleResetRules}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Reset All Rules
            </button>
          </div>
        </div>

        <div className="rules-card" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0 }}>Active Time Limits</h3>
              <button type="button" className="btn-icon" onClick={() => setInfoModal("blocker")} aria-label="About Time Limits" style={{ padding: '4px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </button>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button type="button" className="btn-primary-elegant" style={{ boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }} onClick={() => setShowAddLimitModal(true)}>
                <span style={{ fontSize: '18px', fontWeight: 300, marginRight: '6px', lineHeight: 1 }}>+</span> Add Soft-Block Limit
              </button>
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', minHeight: '150px' }}>
            <div className="elegant-list-container" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", paddingRight: timeLimitRules.length > 5 ? "8px" : "0" }}>
            {timeLimitRules.length === 0 ? (
              <div className="vis-empty" style={{ minHeight: "150px" }}>
                <p className="vis-empty-title">No Limits Set</p>
                <p className="vis-empty-desc">Add a time limit rule to restrict time spent on specific domains.</p>
              </div>
            ) : (
              timeLimitRules.map((rule) => (
                <div className="elegant-list-row" key={rule.domain} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div className="elegant-row-col domain-col" style={{ flex: 2, fontFamily: "monospace", fontSize: "13px", display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rule.domain}</span>
                    <a href={`https://${rule.domain}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', opacity: 0.5, transition: 'opacity 0.2s', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'} title={`Visit ${rule.domain}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  </div>
                  <div className="elegant-row-col limit-col" style={{ flex: 1, fontFamily: "monospace", fontSize: "13px", color: "var(--text-secondary)" }}>
                    {formatDuration(rule.maxDurationMs)}
                  </div>
                  <div className="elegant-row-col actions-col" style={{ width: "auto" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button 
                        type="button" 
                        className={`btn-icon-elegant ${rule.enabled !== false ? 'success' : ''}`} 
                        onClick={() => handleToggleTimeLimit(rule.domain)} 
                        title={rule.enabled !== false ? `Disable limit for ${rule.domain}` : `Enable limit for ${rule.domain}`}
                        style={{ opacity: rule.enabled !== false ? 1 : 0.4 }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      </button>
                      <button type="button" className="btn-icon-elegant danger" onClick={() => handleDeleteTimeLimit(rule.domain)} title={`Delete limit for ${rule.domain}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
