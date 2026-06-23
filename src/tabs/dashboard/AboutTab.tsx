import React, { useState } from "react";
import "./SettingsTab.css";
import { UserGuideModal } from "./modals/UserGuideModal";

export function AboutTab() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <section className="settings-panel-layout tab-panel" aria-label="About the Extension">
      {/* User Guide Banner */}
      <div className="settings-card" style={{ padding: '32px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)', border: '1px solid rgba(139, 92, 246, 0.3)', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }} onClick={() => setIsGuideOpen(true)}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(139, 92, 246, 0.2)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ flex: 1, paddingRight: '20px' }}>
            <h3 style={{ fontSize: '22px', marginBottom: '8px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
              Interactive User Manual
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>New here? Take a quick guided tour through the core features of Local Browse Insights.</p>
          </div>
          <button className="btn-primary" style={{ padding: '10px 20px', borderRadius: '8px', pointerEvents: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Open Guide
          </button>
        </div>
      </div>

      {/* Project Overview */}
      <div className="settings-card" style={{ padding: '32px' }}>
        <div className="settings-card-icon blue" aria-hidden="true" style={{ width: '64px', height: '64px', borderRadius: '16px', fontSize: '32px', marginBottom: '20px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <div className="settings-card-body" style={{ width: '100%' }}>
          <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>Local Browse Insights</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '16px', fontSize: '13px', fontWeight: 600 }}>v1.0.0</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Release: June 2026</span>
          </div>
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--text)', marginBottom: '16px' }}>A completely private, local-first browser extension designed to help you analyze your browsing habits, enforce productivity rules, and stay focused. Engineered from the ground up for privacy, speed, and beautiful aesthetics.</p>
          
          <h4 style={{ fontSize: '14px', color: 'var(--text)', marginTop: '24px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Zero Telemetry Guarantee</h4>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>Unlike cloud-based analytics, this extension never connects to an external database. All tracking data, browsing history, and classification rules are written directly to your browser&apos;s internal IndexedDB. You own your data. We have absolutely no way to access it.</p>
        </div>
      </div>



      {/* Author */}
      <div className="settings-card">
        <div className="settings-card-icon purple" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div className="settings-card-body">
          <h3>Author & Maintainer</h3>
          <p style={{ marginBottom: '16px' }}>This analytics engine was architected and developed entirely by <strong>Deekshith-goud</strong> as an open, private alternative to invasive cloud tracking platforms.</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <a href="https://github.com/Deekshith-goud" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              GitHub Profile
            </a>
          </div>
        </div>
      </div>

      {isGuideOpen && <UserGuideModal onClose={() => setIsGuideOpen(false)} />}
    </section>
  );
}
