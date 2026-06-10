import React, { useState, useEffect } from "react";
import { CustomDropdown } from "../../components/ui/CustomDropdown";
import { type IconStyleType } from "../../components/ui/ScoreIllustration";
import { generateExportBlob, downloadBlob, type ExportFormat, type ExportDateRange } from "../../analytics/data-export";
import { db } from "../../storage/db";

interface SettingsTabProps {
  iconStyle: IconStyleType;
  handleIconStyleChange: (style: string) => void;
  dailyLimitHours: number;
  handleDailyLimitChange: (hours: number) => void;
  blobEnabled: boolean;
  handleBlobEnabledChange: (enabled: boolean) => void;
  blobStyle: string;
  handleBlobStyleChange: (style: string) => void;
  handleExportRules: () => void;
  handleImportRules: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setShowPurgeModal: (show: boolean) => void;
  setPurgeConfirmText: (text: string) => void;
}

export function SettingsTab({
  iconStyle,
  handleIconStyleChange,
  dailyLimitHours,
  handleDailyLimitChange,
  blobEnabled,
  handleBlobEnabledChange,
  blobStyle,
  handleBlobStyleChange,
  handleExportRules,
  handleImportRules,
  setShowPurgeModal,
  setPurgeConfirmText
}: SettingsTabProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportRange, setExportRange] = useState<ExportDateRange>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [minAvailableDate, setMinAvailableDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const getMinDate = async () => {
      const oldestRecord = await db.timeline.orderBy("timestamp").first();
      if (oldestRecord) {
        const minDateStr = new Date(oldestRecord.timestamp).toISOString().split('T')[0];
        setMinAvailableDate(minDateStr);
        setCustomStartDate(minDateStr);
      }
    };
    getMinDate();
  }, []);

  const handleDataExport = async () => {
    try {
      if (exportFormat === "pdf") {
        let url = `./tabs/report.html?range=${exportRange}`;
        if (exportRange === "custom" && customStartDate && customEndDate) {
          url += `&start=${new Date(customStartDate).getTime()}&end=${new Date(customEndDate).getTime() + 86399999}`;
        }
        window.open(url, '_blank');
        return;
      }

      setIsExporting(true);
      
      let customStartMs, customEndMs;
      if (exportRange === "custom") {
        if (!customStartDate || !customEndDate) {
          alert("Please select both start and end dates.");
          setIsExporting(false);
          return;
        }
        customStartMs = new Date(customStartDate).getTime();
        customEndMs = new Date(customEndDate).getTime() + 86399999;
      }

      const blob = await generateExportBlob(exportFormat, exportRange, customStartMs, customEndMs);
      const ext = exportFormat === "json" ? "json" : "csv";
      downloadBlob(blob, `web-swap-analytics-${exportRange}.${ext}`);
      
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="settings-panel-layout tab-panel" aria-label="Settings and Data Control">
        {/* Appearance Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          
          {/* Dashboard Appearance */}
          <div className="settings-card" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', padding: '16px 20px', gap: 0 }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
              <div className="settings-card-icon orange" aria-hidden="true" style={{ margin: 0, width: '40px', height: '40px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Dashboard Preferences</h3>
            </div>
            <div className="settings-card-body" style={{ width: '100%' }}>
              <p style={{ marginBottom: 16, fontSize: '13px' }}>Configure your dashboard UI and daily tracking goals.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Iconography Style</span>
                  <div style={{ width: '170px' }}>
                    <CustomDropdown
                      width="100%"
                      value={iconStyle}
                      onChange={handleIconStyleChange}
                      options={[
                        { id: 'minimal', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Minimal</div> },
                        { id: 'playful', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> Playful</div> },
                        { id: 'neon', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Neon</div> },
                        { id: 'corporate', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> Corporate</div> }
                      ]}
                    />
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Daily Goal Limit</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.8 }}>Target hours per day</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="range" 
                        min="1" 
                        max="8" 
                        step="1"
                        value={dailyLimitHours} 
                        onChange={(e) => handleDailyLimitChange(parseInt(e.target.value))}
                        className="elegant-slider"
                      />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', width: '28px', textAlign: 'right' }}>{dailyLimitHours}h</span>
                    </div>
                  </div>
                  
                  {dailyLimitHours >= 5 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12px', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 10px', borderRadius: '6px', marginTop: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      <span>High target! Consider aiming for more offline breaks.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Floating Widget card */}
          <div className="settings-card" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', padding: '16px 20px', gap: 0 }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
              <div className="settings-card-icon blue" aria-hidden="true" style={{ margin: 0, width: '40px', height: '40px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Floating Widget</h3>
            </div>
            <div className="settings-card-body" style={{ width: '100%' }}>
              <p style={{ marginBottom: 16, fontSize: '13px' }}>Manage the on-page active tracking indicator.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Enable Widget</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Show floating blob</span>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={blobEnabled} onChange={(e) => handleBlobEnabledChange(e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: blobEnabled ? 1 : 0.5, pointerEvents: blobEnabled ? 'auto' : 'none', transition: 'opacity 0.2s', padding: '0 4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Widget Style</span>
                  <div style={{ width: '170px' }}>
                    <CustomDropdown
                      width="100%"
                      value={blobStyle}
                      onChange={handleBlobStyleChange}
                      options={[
                        { id: 'glass-dark', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/></svg> Glass Dark</div> },
                        { id: 'glass-light', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg> Glass Light</div> },
                        { id: 'brutalist-dark', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Brutalist Dark</div> },
                        { id: 'brutalist-light', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Brutalist Light</div> }
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy card */}
        <div className="settings-card">
          <div className="settings-card-icon green" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div className="settings-card-body">
            <h3>Privacy &amp; Local-First Policy</h3>
            <p>Your browsing activity is processed and stored <strong>entirely on your local machine</strong>. No server connections are made, no telemetry is reported, and no analytical logs ever leave your device.</p>
          </div>
          <div className="settings-card-illus" aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="36" fill="rgba(16,185,129,0.08)" />
              <rect x="22" y="34" width="36" height="26" rx="4" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="1.5"/>
              <path d="M30 34V28a10 10 0 0 1 20 0v6" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="40" cy="47" r="4" fill="#10b981"/>
              <line x1="40" y1="51" x2="40" y2="55" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="58" cy="24" r="3" fill="rgba(16,185,129,0.3)"/>
              <circle cx="20" cy="56" r="2" fill="rgba(16,185,129,0.2)"/>
            </svg>
          </div>
        </div>

        {/* Portability */}
        <div className="settings-card" style={{ padding: '24px' }}>
          <div className="settings-card-body" style={{ width: '100%', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div className="settings-card-icon blue" aria-hidden="true" style={{ position: 'static', margin: 0, padding: '10px', width: 'auto', height: 'auto' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Data Portability & Export</h3>
            </div>
            <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>Manage your local analytics data and classification rulesets safely. All exports are generated entirely on-device.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {/* Analytics Data Export Box */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '10px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Analytics Data</h4>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div className="premium-input-group" style={{ flex: 1, minWidth: '140px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Format</label>
                    <div className="premium-input-wrapper" style={{ background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', position: 'relative' }}>
                      <select className="premium-input" value={exportFormat} onChange={e => setExportFormat(e.target.value as ExportFormat)} style={{ appearance: 'none', backgroundColor: 'transparent', padding: '12px 14px', fontSize: '13px', width: '100%', color: 'var(--text)', border: 'none', outline: 'none', cursor: 'pointer' }}>
                        <option value="csv" style={{ background: 'var(--bg)', color: 'var(--text)' }}>CSV (Spreadsheet Report)</option>
                        <option value="json" style={{ background: 'var(--bg)', color: 'var(--text)' }}>JSON (Full Backup)</option>
                        <option value="pdf" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Visual Report (PDF/Print)</option>
                      </select>
                      <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  </div>

                  <div className="premium-input-group" style={{ flex: 1, minWidth: '120px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Time Range</label>
                    <div className="premium-input-wrapper" style={{ background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', position: 'relative' }}>
                      <select className="premium-input" value={exportRange} onChange={e => setExportRange(e.target.value as ExportDateRange)} style={{ appearance: 'none', backgroundColor: 'transparent', padding: '12px 14px', fontSize: '13px', width: '100%', color: 'var(--text)', border: 'none', outline: 'none', cursor: 'pointer' }}>
                        <option value="all" style={{ background: 'var(--bg)', color: 'var(--text)' }}>All Time</option>
                        <option value="this_month" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Last 30 Days</option>
                        <option value="today" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Today</option>
                        <option value="custom" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Custom Range...</option>
                      </select>
                      <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  </div>
                </div>

                {exportRange === "custom" && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '-4px' }}>
                    <div className="premium-input-group" style={{ flex: 1, minWidth: '130px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Start Date</label>
                      <input type="date" value={customStartDate} min={minAvailableDate} max={customEndDate} onChange={e => setCustomStartDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none' }} />
                    </div>
                    <div className="premium-input-group" style={{ flex: 1, minWidth: '130px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>End Date</label>
                      <input type="date" value={customEndDate} min={customStartDate || minAvailableDate} max={new Date().toISOString().split('T')[0]} onChange={e => setCustomEndDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none' }} />
                    </div>
                  </div>
                )}

                <button type="button" className="btn-primary" onClick={handleDataExport} disabled={isExporting} style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 600, borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)', color: '#fff', border: 'none', cursor: isExporting ? 'wait' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 'auto' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "8px" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {isExporting ? "Exporting Data..." : `Export Analytics Data`}
                </button>
              </div>

              {/* Ruleset Management Box */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <div style={{ padding: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '10px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Ruleset Configuration</h4>
                </div>
                
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Backup your custom domain classifications and time limits, or import a pre-configured ruleset to quickly set up your workspace.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
                  <button type="button" className="btn-secondary" onClick={handleExportRules} style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 600, borderRadius: '10px', color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export Ruleset Backup
                  </button>
                  <label className="btn-secondary" style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 600, borderRadius: '10px', color: 'var(--text-secondary)', background: 'var(--bg)', border: '1px dashed var(--border)', cursor: "pointer", transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Import Existing Ruleset
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImportRules} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Storage card */}
        <div className="settings-card">
          <div className="settings-card-icon purple" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          </div>
          <div className="settings-card-body">
            <h3>Local Storage Behavior</h3>
            <p>The extension uses highly-efficient IndexedDB and Chrome Extension local storage APIs. All tracking state runs asynchronously in service worker background threads with zero UI blocking. Please note that uninstalling this extension via the browser will automatically delete all stored on-device analytics databases.</p>
          </div>
          <div className="settings-card-illus" aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="36" fill="rgba(139,92,246,0.08)" />
              <ellipse cx="40" cy="28" rx="18" ry="6" fill="rgba(139,92,246,0.2)" stroke="#8b5cf6" strokeWidth="1.5"/>
              <path d="M22 28v10c0 3.31 8.06 6 18 6s18-2.69 18-6V28" stroke="#8b5cf6" strokeWidth="1.5"/>
              <path d="M22 38v10c0 3.31 8.06 6 18 6s18-2.69 18-6V38" stroke="#8b5cf6" strokeWidth="1.5"/>
              <circle cx="52" cy="53" r="8" fill="rgba(139,92,246,0.9)"/>
              <path d="M49 53l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="settings-card danger-zone">
          <div className="settings-card-icon red" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="settings-card-body">
            <h3>Danger Zone: Permanent Purge</h3>
            <p style={{ marginBottom: 16 }}>Purging the on-device database is destructive and irreversible. This will instantly wipe all website session logs, daily domain indicators, customized classification rules, volatile ring-buffered caches, and active state keys.</p>
            <button
              type="button"
              className="btn-danger"
              onClick={() => { setShowPurgeModal(true); setPurgeConfirmText(""); }}
              aria-haspopup="dialog"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Purge On-Device Database
            </button>
          </div>
          <div className="settings-card-illus" aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="36" fill="rgba(239,68,68,0.06)" />
              <rect x="24" y="30" width="32" height="34" rx="3" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.5"/>
              <rect x="20" y="26" width="40" height="6" rx="2" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1"/>
              <rect x="34" y="22" width="12" height="6" rx="2" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1"/>
              <line x1="33" y1="38" x2="33" y2="57" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="40" y1="38" x2="40" y2="57" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="47" y1="38" x2="47" y2="57" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="58" cy="58" r="8" fill="#ef4444"/>
              <line x1="55" y1="55" x2="61" y2="61" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="61" y1="55" x2="55" y2="61" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="20" cy="36" r="3" fill="rgba(239,68,68,0.3)"/>
              <circle cx="62" cy="28" r="2" fill="rgba(239,68,68,0.2)"/>
            </svg>
          </div>
        </div>
      </section>
  );
}
