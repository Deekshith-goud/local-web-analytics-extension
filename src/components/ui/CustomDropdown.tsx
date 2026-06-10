import React, { useState } from "react";

export const CustomDropdown = ({ 
  value, 
  options, 
  onChange, 
  width 
}: { 
  value: string, 
  options: {id: string, label: React.ReactNode}[], 
  onChange: (val: string) => void, 
  width?: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.id === value) || options[0];

  return (
    <div style={{ position: 'relative', width: width || '100%', minWidth: width ? 'auto' : '220px' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: '10px', color: 'var(--text)', fontSize: '13px', fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.2s',
          boxShadow: isOpen ? '0 0 0 2px var(--accent-bg)' : 'none',
          borderColor: isOpen ? 'var(--accent)' : 'var(--border)'
        }}
      >
        <span>{selectedOption?.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      
      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px',
          padding: '6px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', flexDirection: 'column', gap: '2px', animation: 'tab-fade-in 0.2s ease forwards',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
        }}>
          {options.map(opt => (
            <button
              key={opt.id}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevents blur event on the parent button
                onChange(opt.id);
                setIsOpen(false);
              }}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px',
                background: value === opt.id ? 'var(--accent-bg)' : 'transparent',
                color: value === opt.id ? 'var(--accent)' : 'var(--text)',
                border: 'none', borderRadius: '6px', fontSize: '13px',
                fontWeight: value === opt.id ? 600 : 500, cursor: 'pointer', transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => { if (value !== opt.id) e.currentTarget.style.background = 'var(--surface2)'; }}
              onMouseLeave={(e) => { if (value !== opt.id) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
