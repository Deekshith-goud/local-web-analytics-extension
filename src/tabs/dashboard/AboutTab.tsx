import React from "react";

export function AboutTab() {
  return (
    <section className="settings-panel-layout tab-panel" aria-label="About the Extension">
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Architecture stack */}
        <div className="settings-card">
            <div className="settings-card-icon green" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <div className="settings-card-body">
              <h3>Architecture & Technology</h3>
              <p style={{ marginBottom: '16px' }}>Built using modern, secure web technologies running directly in your browser:</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>React 18</span>
                <span style={{ padding: '4px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>TypeScript</span>
                <span style={{ padding: '4px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>Plasmo Framework</span>
                <span style={{ padding: '4px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>Dexie.js (IndexedDB)</span>
                <span style={{ padding: '4px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>Recharts</span>
              </div>
            </div>
        </div>

        {/* Acknowledgements */}
        <div className="settings-card">
            <div className="settings-card-icon orange" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            </div>
            <div className="settings-card-body">
              <h3>Open Source Credits</h3>
              <p style={{ marginBottom: '16px' }}>This project stands on the shoulders of giants. We utilize several incredible open-source libraries to deliver a seamless experience:</p>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                <li><strong>Lucide Icons</strong> for beautiful, crisp vector iconography.</li>
                <li><strong>Recharts</strong> for robust, declarative data visualization.</li>
                <li><strong>Dexie.js</strong> for reliable, high-performance local database wrappers.</li>
              </ul>
            </div>
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
    </section>
  );
}
