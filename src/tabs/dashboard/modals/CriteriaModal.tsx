import React from "react";
import { getScoreCriteria, type IconStyleType } from "../../../components/ui/ScoreIllustration";

interface CriteriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  iconStyle: IconStyleType;
}

export function CriteriaModal({ isOpen, onClose, iconStyle }: CriteriaModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="criteria-modal-title" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '95vw', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 id="criteria-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '10px' }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Productivity Score Criteria
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p className="modal-desc" style={{ marginBottom: '24px', fontSize: '15px' }}>
          Your score is determined by the ratio of time spent on productive vs distracting domains. Here is how your focus levels break down.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          {getScoreCriteria(iconStyle).map((item, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: (iconStyle === "minimal" || iconStyle === "corporate" || iconStyle === "neon") ? '12px' : '50%', 
                  background: item.bg, 
                  color: item.color, 
                  border: (iconStyle === "minimal" || iconStyle === "corporate") ? `1px solid ${item.color}40` : 'none', 
                  boxShadow: iconStyle === "neon" ? `inset 0 0 10px ${item.color}40, 0 0 15px ${item.color}60` : 'none',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: iconStyle === "playful" ? '24px' : undefined 
                }}>
                  {item.icon}
                </div>
                <div style={{ fontWeight: 800, color: item.color, fontSize: '15px', background: item.bg, padding: '6px 12px', borderRadius: '8px', border: `1px solid ${item.color}30` }}>
                  {item.score}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '16px', marginBottom: '6px' }}>{item.label}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5, flex: 1 }}>{item.desc}</div>
              <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', borderLeft: `3px solid ${item.color}`, fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
                &quot;{item.quote}&quot;
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
