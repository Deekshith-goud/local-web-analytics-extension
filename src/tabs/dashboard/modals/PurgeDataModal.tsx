import React, { useState } from "react";

interface PurgeDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurgeComplete: () => void;
}

export function PurgeDataModal({ isOpen, onClose, onPurgeComplete }: PurgeDataModalProps) {
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [isPurging, setIsPurging] = useState(false);

  if (!isOpen) return null;

  const handleExecutePurge = () => {
    setIsPurging(true);
    chrome.runtime.sendMessage({ type: "PURGE_DATA" }, () => {
      setIsPurging(false);
      setPurgeConfirmText("");
      onPurgeComplete();
      onClose();
    });
  };

  const handleClose = () => {
    setPurgeConfirmText("");
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="purge-modal-title">
      <div className="modal-content">
        <h3 id="purge-modal-title" className="modal-title" style={{ color: 'var(--red)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Confirm Permanent Purge
        </h3>
        <p className="modal-desc">
          This action is destructive and <strong>absolutely irreversible</strong>. Your on-device data will be permanently wiped.
          To proceed, please type <strong>PURGE</strong> in the input field below to authorize this request:
        </p>
        <input
          type="text"
          className="modal-input"
          value={purgeConfirmText}
          onChange={(e) => setPurgeConfirmText(e.target.value.toUpperCase())}
          placeholder="Type PURGE to delete"
          disabled={isPurging}
          autoFocus
        />
        <div className="modal-actions">
          <button
            type="button"
            className="btn-modal-cancel"
            onClick={handleClose}
            disabled={isPurging}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-modal-confirm"
            onClick={handleExecutePurge}
            disabled={purgeConfirmText !== "PURGE" || isPurging}
          >
            {isPurging ? "Purging..." : "Confirm Purge"}
          </button>
        </div>
      </div>
    </div>
  );
}
