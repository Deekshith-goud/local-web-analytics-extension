import React, { useState } from "react";
import { CustomDropdown } from "./CustomDropdown";
import type { PomodoroState, PomodoroSettings } from "../../types/tracking";

interface PomodoroTimerProps {
  pomodoroState: PomodoroState;
  pomodoroSettings: PomodoroSettings;
  handlePomodoroAction: (action: string, type?: "focus" | "break") => void;
  handlePomodoroSettingToggle: (key: keyof PomodoroSettings) => void;
  handlePomodoroDurationChange: (key: "focusDurationMs" | "breakDurationMs", val: number) => void;
  handlePomodoroMessageChange: (key: "customFocusMessage" | "customBreakMessage", val: string) => void;
  setPomodoroSettings: (settings: PomodoroSettings) => void;
  setInfoModal: (modal: "timer" | "classification" | "score" | "categories" | "timeline" | null) => void;
}

export function PomodoroTimer({
  pomodoroState,
  pomodoroSettings,
  handlePomodoroAction,
  handlePomodoroSettingToggle,
  handlePomodoroDurationChange,
  handlePomodoroMessageChange,
  setPomodoroSettings,
  setInfoModal
}: PomodoroTimerProps) {
  const [focusInput, setFocusInput] = useState(() => String(Math.floor((pomodoroSettings?.focusDurationMs || 25 * 60000) / 60000)));
  const [breakInput, setBreakInput] = useState(() => String(Math.floor((pomodoroSettings?.breakDurationMs || 5 * 60000) / 60000)));
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [isBreakActive, setIsBreakActive] = useState(false);

  // Update local input state if settings change externally
  React.useEffect(() => {
    if (!isFocusActive) setFocusInput(String(Math.floor((pomodoroSettings?.focusDurationMs || 25 * 60000) / 60000)));
    if (!isBreakActive) setBreakInput(String(Math.floor((pomodoroSettings?.breakDurationMs || 5 * 60000) / 60000)));
  }, [pomodoroSettings?.focusDurationMs, pomodoroSettings?.breakDurationMs, isFocusActive, isBreakActive]);

  const isRunning = pomodoroState.status !== "idle";
  const isPaused = pomodoroState.pausedTimeRemaining !== undefined;
  
  let remainingMs = pomodoroState.durationMs || 0;
  if (isRunning) {
    if (isPaused) {
      remainingMs = pomodoroState.pausedTimeRemaining || 0;
    } else {
      const elapsed = Date.now() - pomodoroState.startTime;
      remainingMs = Math.max(0, (pomodoroState.durationMs || 0) - elapsed);
    }
  }
  
  const minutes = Math.floor((remainingMs || 0) / 60000);
  const seconds = Math.floor(((remainingMs || 0) % 60000) / 1000);
  const progressPct = (isRunning && pomodoroState.durationMs > 0) ? (((pomodoroState.durationMs - remainingMs) / pomodoroState.durationMs) * 100) : 0;
  
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPct / 100) * circumference;

  const renderTimer = () => {
    const style = pomodoroSettings.timerStyle || 'typographic';
    const color = pomodoroState.status === 'break' ? '#10b981' : 'var(--accent)';
    
    if (style === 'neumorphic') {
      return (
        <div style={{ position: 'relative', width: '220px', height: '220px', marginBottom: '32px', marginTop: '16px', borderRadius: '50%', background: 'var(--surface)', boxShadow: 'inset 8px 8px 16px rgba(0,0,0,0.2), inset -8px -8px 16px rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: '15px', borderRadius: '50%', background: 'var(--surface2)', boxShadow: '8px 8px 16px rgba(0,0,0,0.2), -8px -8px 16px rgba(255,255,255,0.05)' }}></div>
          <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
            <circle cx="110" cy="110" r={radius} fill="none" stroke="transparent" strokeWidth="12" />
            <circle cx="110" cy="110" r={radius} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={Number.isNaN(offset) ? 0 : offset} style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' }} />
          </svg>
          <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '48px', fontWeight: 400, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
              {String(minutes || 0).padStart(2, '0')}:{String(seconds || 0).padStart(2, '0')}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: color, textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '6px', opacity: 0.9 }}>
              {pomodoroState.status === "idle" ? "Ready" : pomodoroState.status === "focus" ? "Focusing" : "Break Time"}
            </div>
          </div>
        </div>
      );
    }

    if (style === 'horizontal') {
      return (
        <div style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px', marginTop: '24px' }}>
          <div style={{ fontSize: '72px', fontWeight: 300, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {String(minutes || 0).padStart(2, '0')}<span style={{ opacity: 0.3, fontWeight: 200 }}>:</span>{String(seconds || 0).padStart(2, '0')}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: color, textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: '12px', marginBottom: '24px', opacity: 0.9 }}>
            {pomodoroState.status === "idle" ? "Ready" : pomodoroState.status === "focus" ? "Focusing" : "Break Time"}
          </div>
          <div style={{ width: '100%', height: '6px', background: 'var(--track-bg)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${100 - progressPct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 1s linear', boxShadow: `0 0 10px ${color}60` }}></div>
          </div>
        </div>
      );
    }

    // typographic (default)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', marginBottom: '32px', marginTop: '16px' }}>
        <div style={{ fontSize: '84px', fontWeight: 300, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.05em', lineHeight: 1 }}>
          {String(minutes || 0).padStart(2, '0')}<span style={{ opacity: 0.2, fontWeight: 200 }}>:</span>{String(seconds || 0).padStart(2, '0')}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: color, textTransform: 'uppercase', letterSpacing: '0.25em', marginTop: '12px', opacity: 0.8 }}>
          {pomodoroState.status === "idle" ? "Ready" : pomodoroState.status === "focus" ? "Focusing" : "Break Time"}
        </div>
      </div>
    );
  };

  return (
    <div className="rules-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', margin: 0 }}>Pomodoro Timer</h3>
        <button type="button" className="btn-icon" onClick={() => setInfoModal("timer")} aria-label="About Timer" style={{ padding: '4px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {renderTimer()}

        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
          {pomodoroState.status === "idle" ? (
            <>
              <button className="btn-primary" onClick={() => handlePomodoroAction("START_POMODORO", "focus")} style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 500, borderRadius: '100px', background: 'linear-gradient(135deg, #a78bfa, #6366f1)', boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Focus
              </button>
              <button className="btn-secondary" onClick={() => handlePomodoroAction("START_POMODORO", "break")} style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 500, borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', background: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                Break
              </button>
            </>
          ) : (
            <>
              {isPaused ? (
                <button className="btn-primary" onClick={() => handlePomodoroAction("RESUME_POMODORO")} style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 500, borderRadius: '100px', background: 'linear-gradient(135deg, #a78bfa, #6366f1)', boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Resume
                </button>
              ) : (
                <button className="btn-secondary" onClick={() => handlePomodoroAction("PAUSE_POMODORO")} style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 500, borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', background: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                  Pause
                </button>
              )}
              <button className="btn-danger-outline" onClick={() => handlePomodoroAction("STOP_POMODORO")} style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 500, borderRadius: '100px', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#ef4444', background: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                Stop
              </button>
            </>
          )}
        </div>
        
        <div style={{ width: '100%', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div>
                    <div className="settings-row-title">Timer Style</div>
                    <div className="settings-row-desc">Customize timer appearance</div>
                  </div>
                </div>
                <CustomDropdown
                  value={pomodoroSettings.timerStyle === 'minimal' ? 'typographic' : (pomodoroSettings.timerStyle || 'typographic')}
                  options={[
                    { id: 'typographic', label: 'Typographic' },
                    { id: 'neumorphic', label: 'Neumorphic' },
                    { id: 'horizontal', label: 'Horizontal Dash' }
                  ]}
                  onChange={(val) => {
                    const newSettings = { ...pomodoroSettings, timerStyle: val as PomodoroSettings['timerStyle'] } as PomodoroSettings;
                    setPomodoroSettings(newSettings);
                    chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
                  }}
                  width="140px"
                />
              </div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <label className="toggle-switch">
                    <input type="checkbox" checked={pomodoroSettings.soundEnabled} onChange={() => handlePomodoroSettingToggle('soundEnabled')} />
                    <span className="toggle-slider"></span>
                  </label>
                  <div>
                    <div className="settings-row-title">Play Sound</div>
                    <div className="settings-row-desc">Audio alert on completion</div>
                  </div>
                </div>
                {pomodoroSettings.soundEnabled && (
                  <CustomDropdown
                    value={pomodoroSettings.soundId || 'beep'}
                    options={[
                      { id: 'beep', label: 'Beep' },
                      { id: 'chime', label: 'Chime' },
                      { id: 'digital', label: 'Digital' },
                    ]}
                    onChange={(val) => {
                      const newSettings = { ...pomodoroSettings, soundId: val };
                      setPomodoroSettings(newSettings);
                      chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
                    }}
                    width="120px"
                  />
                )}
              </div>

              <div className="settings-row">
                <div className="settings-row-left">
                  <label className="toggle-switch">
                    <input type="checkbox" checked={pomodoroSettings.notificationEnabled} onChange={() => handlePomodoroSettingToggle('notificationEnabled')} />
                    <span className="toggle-slider"></span>
                  </label>
                  <div>
                    <div className="settings-row-title">Show Notification</div>
                    <div className="settings-row-desc">Desktop alert on completion</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px' }}>
              <div className="premium-input-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Focus (M)</label>
                <div className="premium-input-wrapper">
                  <div className="premium-input-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <input 
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="premium-input"
                    value={focusInput}
                    onFocus={() => setIsFocusActive(true)}
                    onBlur={(e) => {
                      setIsFocusActive(false);
                      const val = e.target.value;
                      const parsed = parseInt(val, 10);
                      if (!val || isNaN(parsed) || parsed < 1) {
                        setFocusInput(String(Math.floor((pomodoroSettings?.focusDurationMs || 25 * 60000) / 60000)));
                      } else {
                        handlePomodoroDurationChange('focusDurationMs', parsed);
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setFocusInput(val);
                    }}
                    disabled={pomodoroState.status !== "idle"}
                    placeholder="25"
                  />
                </div>
              </div>
              <div className="premium-input-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Break (M)</label>
                <div className="premium-input-wrapper">
                  <div className="premium-input-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                  </div>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="premium-input"
                    value={breakInput}
                    onFocus={() => setIsBreakActive(true)}
                    onBlur={(e) => {
                      setIsBreakActive(false);
                      const val = e.target.value;
                      const parsed = parseInt(val, 10);
                      if (!val || isNaN(parsed) || parsed < 1) {
                        setBreakInput(String(Math.floor((pomodoroSettings?.breakDurationMs || 5 * 60000) / 60000)));
                      } else {
                        handlePomodoroDurationChange('breakDurationMs', parsed);
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setBreakInput(val);
                    }}
                    disabled={pomodoroState.status !== "idle"}
                    placeholder="5"
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div className="premium-input-group">
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Custom Focus Message (Optional)</label>
                <div className="premium-input-wrapper">
                  <div className="premium-input-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
                  </div>
                  <input 
                    type="text" 
                    className="premium-input" 
                    value={pomodoroSettings.customFocusMessage || ""}
                    onChange={(e) => handlePomodoroMessageChange('customFocusMessage', e.target.value)}
                    placeholder="Great job! Time for a short break."
                  />
                </div>
              </div>
              <div className="premium-input-group">
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Custom Break Message (Optional)</label>
                <div className="premium-input-wrapper">
                  <div className="premium-input-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
                  </div>
                  <input 
                    type="text" 
                    className="premium-input" 
                    value={pomodoroSettings.customBreakMessage || ""}
                    onChange={(e) => handlePomodoroMessageChange('customBreakMessage', e.target.value)}
                    placeholder="Time to get back to focus."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
