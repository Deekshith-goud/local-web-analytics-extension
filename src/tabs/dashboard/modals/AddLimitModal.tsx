import React, { useState } from "react";

interface AddLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLimit: (domain: string, durationMins: number) => Promise<{ success: boolean; error?: string }>;
}

export function AddLimitModal({ isOpen, onClose, onAddLimit }: AddLimitModalProps) {
  const [newTimeLimitDomain, setNewTimeLimitDomain] = useState("");
  const [newTimeLimitDurationStr, setNewTimeLimitDurationStr] = useState("30");
  const [timeLimitError, setTimeLimitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTimeLimitError(null);
    const domain = newTimeLimitDomain.trim().toLowerCase();
    const durationMins = parseInt(newTimeLimitDurationStr, 10);
    
    if (!domain) {
      setTimeLimitError("Domain cannot be empty.");
      return;
    }
    if (isNaN(durationMins) || durationMins <= 0) {
      setTimeLimitError("Please enter a valid duration in minutes.");
      return;
    }
    
    const res = await onAddLimit(domain, durationMins);
    if (res.success) {
      handleClose();
    } else {
      setTimeLimitError(res.error || "Failed to add limit. It may already exist.");
    }
  };

  const handleClose = () => {
    setNewTimeLimitDomain("");
    setNewTimeLimitDurationStr("30");
    setTimeLimitError(null);
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-limit-modal-title" onClick={handleClose}>
      <div className="modal-content-elegant" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="add-limit-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.1))', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            Add Soft-Block Limit
          </h3>
          <button className="btn-icon-elegant" style={{ border: 'none' }} onClick={handleClose} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p className="modal-desc" style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '16px', marginBottom: '24px' }}>
          Set daily duration limits for distracting websites. Once reached, a soft-block overlay appears.
        </p>

        {timeLimitError && (
          <div className="rules-form-alert error" role="alert">
            {timeLimitError}
          </div>
        )}

        <form className="rules-form" style={{ gap: '16px' }} onSubmit={handleAddLimit}>
          <div className="premium-input-group">
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Domain (e.g. reddit.com)</label>
            <div className="premium-input-wrapper">
              <div className="premium-input-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <input
                type="text"
                className="premium-input"
                placeholder="Enter hostname..."
                value={newTimeLimitDomain}
                onChange={(e) => setNewTimeLimitDomain(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="premium-input-group">
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Daily Limit (minutes)</label>
            <div className="premium-input-wrapper">
              <div className="premium-input-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <input
                type="number"
                className="premium-input"
                min="1"
                value={newTimeLimitDurationStr}
                onChange={(e) => setNewTimeLimitDurationStr(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '14px 32px', fontSize: '14px', fontWeight: 600, borderRadius: '100px', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)', color: '#fff', border: 'none', cursor: 'pointer', transition: 'all 0.2s', width: '100%', marginTop: '8px' }}>
            Save Time Limit
          </button>
        </form>
      </div>
    </div>
  );
}
