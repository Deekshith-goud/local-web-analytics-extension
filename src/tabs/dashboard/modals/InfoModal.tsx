import React from "react";
import timerDemoImg from "url:~assets/timer-demo.png";
import classifyDemoImg from "url:~assets/classify-demo.png";
import blockerDemoImg from "url:~assets/blocker-demo.png";

export type InfoModalType = "score" | "timer" | "classification" | "categories" | "timeline" | "blocker";

interface InfoModalProps {
  infoType: InfoModalType | null;
  onClose: () => void;
}

export function InfoModal({ infoType, onClose }: InfoModalProps) {
  if (!infoType) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="info-modal-title" onClick={onClose}>
      <div className="modal-content-elegant" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 id="info-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {infoType === "timer" && <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-purple, #8b5cf6)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> About Timer</>}
            {infoType === "classification" && <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-blue, #3b82f6)" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> About Productivity Engine</>}
            {infoType === "blocker" && <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange, #f59e0b)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> About Soft-Blocker</>}
          </h3>
          <button className="btn-icon-elegant" style={{ border: 'none' }} onClick={onClose} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <div className="modal-desc" style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', flex: 1 }}>
            {infoType === "timer" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                <p style={{ margin: 0 }}>The Pomodoro Timer helps you maintain focus using timeboxed work sessions.</p>
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li><strong>Cycles:</strong> The timer naturally reciprocates. When a Focus session ends, it automatically prompts you to start a Break, and vice versa.</li>
                  <li><strong>Customization:</strong> You can adjust the exact minutes for Focus and Break periods below.</li>
                  <li><strong>Notifications:</strong> Toggle desktop notifications or choose from several notification sounds (Beep, Chime, Digital) to alert you when a cycle ends.</li>
                  <li><strong>Custom Messages:</strong> Set custom motivational messages that will appear in your notifications when it&apos;s time to focus or take a break.</li>
                </ul>
              </div>
            )}
            {infoType === "classification" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                <p style={{ margin: 0 }}>Categorize domains to let the analytics engine calculate your exact productivity score.</p>
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li><strong><span style={{ color: '#10b981' }}>Productive:</span></strong> Sites essential for work (e.g. github.com, docs.google.com).</li>
                  <li><strong><span style={{ color: '#ef4444' }}>Distracting:</span></strong> Sites that break your workflow (e.g. reddit.com, youtube.com).</li>
                  <li><strong>How to Add:</strong> Click <em>&quot;+ Add Custom Rule&quot;</em> to manually assign a category to a domain.</li>
                  <li><strong>Quick Classify:</strong> Go to the Dashboard tab, click <em>&quot;View All Domains&quot;</em>, and use the inline PROD/DIST/NEUT buttons to rapidly categorize your most visited sites in bulk.</li>
                </ul>
              </div>
            )}
            {infoType === "blocker" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                <p style={{ margin: 0 }}>The Soft-Blocker prevents you from doomscrolling by enforcing daily allowances.</p>
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li><strong>Setting Limits:</strong> Assign a maximum daily allowance (in minutes) for specific distracting domains.</li>
                  <li><strong>Gentle Interventions:</strong> Once the limit is reached, a full-page overlay is injected over the site to block access and remind you to refocus.</li>
                  <li><strong>Daily Resets:</strong> All accumulated time resets automatically at midnight, giving you a fresh allowance the next day.</li>
                  <li><strong>Toggles:</strong> You can temporarily disable a limit using the toggle button without deleting the rule entirely.</li>
                </ul>
              </div>
            )}
          </div>
          <div style={{ flex: '0 0 45%', display: 'flex', justifyContent: 'center' }}>
            {infoType === "timer" && <img src={timerDemoImg} alt="Timer Example" style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }} />}
            {infoType === "classification" && <img src={classifyDemoImg} alt="Classification Example" style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }} />}
            {infoType === "blocker" && <img src={blockerDemoImg} alt="Blocker Example" style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
