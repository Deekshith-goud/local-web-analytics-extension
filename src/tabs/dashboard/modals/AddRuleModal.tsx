import React, { useState } from "react";
import type { ProductivityRule, ProductivityCategory } from "../../../analytics/productivity-rules";

interface AddRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRule: (rule: ProductivityRule) => Promise<{ success: boolean; error?: string }>;
}

export function AddRuleModal({ isOpen, onClose, onAddRule }: AddRuleModalProps) {
  const [newDomain, setNewDomain] = useState("");
  const [newCategory, setNewCategory] = useState<ProductivityCategory>("productive");
  const [newPriority] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    
    if (!newDomain.trim()) {
      setFormError("Domain cannot be empty.");
      return;
    }
    
    const priorityInt = parseInt(newPriority, 10);
    const candidateRule: ProductivityRule = {
      domain: newDomain.trim().toLowerCase(),
      category: newCategory,
      priority: isNaN(priorityInt) ? 1 : priorityInt,
      createdAt: Date.now(),
      isCustom: true
    };
    
    const res = await onAddRule(candidateRule);
    if (res.success) {
      handleClose();
    } else {
      setFormError(res.error || "Failed to save rule. It may already exist.");
    }
  };

  const handleClose = () => {
    setNewDomain("");
    setNewCategory("productive");
    setFormError(null);
    setFormSuccess(null);
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-rule-modal-title" onClick={handleClose}>
      <div className="modal-content-elegant" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="add-rule-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>
            </div>
            Add Custom Rule
          </h3>
          <button className="btn-icon-elegant" style={{ border: 'none' }} onClick={handleClose} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p className="modal-desc" style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '16px', marginBottom: '24px' }}>
          Override the semantic analysis engine with your own domain classification.
        </p>

        {formError && (
          <div className="rules-form-alert error" role="alert">
            {formError}
          </div>
        )}
        {formSuccess && (
          <div className="rules-form-alert success" role="status">
            {formSuccess}
          </div>
        )}

        <form className="rules-form" style={{ gap: '16px' }} onSubmit={handleAddRule}>
          <div className="premium-input-group">
            <label htmlFor="domain-input" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Domain (e.g. youtube.com)</label>
            <div className="premium-input-wrapper">
              <div className="premium-input-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <input
                id="domain-input"
                type="text"
                className="premium-input"
                placeholder="Enter hostname..."
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="premium-input-group">
            <label htmlFor="category-select" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Classification Category</label>
            <div className="premium-input-wrapper">
              <div className="premium-input-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              </div>
              <select
                id="category-select"
                className="premium-input"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ProductivityCategory)}
                required
                style={{ appearance: 'none', backgroundColor: 'transparent' }}
              >
                <option value="productive" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Productive (Deep Work)</option>
                <option value="distracting" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Distracting (Entertainment)</option>
                <option value="neutral" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Neutral (Utilities)</option>
                <option value="unknown" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Unknown (Unclassified)</option>
              </select>
              <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '14px 32px', fontSize: '14px', fontWeight: 600, borderRadius: '100px', background: 'linear-gradient(135deg, #a78bfa, #6366f1)', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)', color: '#fff', border: 'none', cursor: 'pointer', transition: 'all 0.2s', width: '100%', marginTop: '8px' }}>
            Save Custom Rule
          </button>
        </form>
      </div>
    </div>
  );
}
