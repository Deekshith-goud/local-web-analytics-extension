import React from "react";
import type { TimeLimitState } from "../../types/tracking";
import { formatTimer } from "../../utils/format";

interface TimeLimitBlockerProps {
  timeLimitState: TimeLimitState | null;
  handleBypass: (durationMs: number) => void;
}

export function TimeLimitBlocker({ timeLimitState, handleBypass }: TimeLimitBlockerProps) {
  if (!timeLimitState?.isBlocked) return null;

  return (
    <div
      style={{
        position: "fixed",
        width: "100vw",
        height: "100vh",
        top: 0,
        left: 0,
        backgroundColor: "rgba(14, 14, 15, 0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}
    >
      <div style={{
        maxWidth: "400px", width: "90%", padding: "40px",
        background: "rgba(25, 25, 28, 0.8)", border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "24px", textAlign: "center",
        boxShadow: "0 24px 80px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.05)"
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "64px", height: "64px", borderRadius: "20px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", marginBottom: "24px" }}>
          <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "12px", lineHeight: 1.2 }}>
          Time Limit Reached
        </h1>
        <p style={{ fontSize: "14px", color: "#8b8b93", marginBottom: "32px", lineHeight: 1.5, fontWeight: 400 }}>
          You have spent <strong style={{ color: "#ffffff", fontWeight: 500 }}>{formatTimer(timeLimitState.currentDurationMs || 0)}</strong> on <strong style={{ color: "#ffffff", fontWeight: 500 }}>{timeLimitState.domain}</strong> today. 
          This exceeds your limit of {formatTimer(timeLimitState.maxDurationMs || 0)}.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button 
            onClick={() => { window.location.href = "about:blank"; }}
            style={{
              background: "#ffffff",
              color: "#000000", border: "none", borderRadius: "12px", padding: "12px",
              fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease",
              boxShadow: "0 4px 12px rgba(255, 255, 255, 0.15)"
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "scale(0.98)"; e.currentTarget.style.opacity = "0.9"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.opacity = "1"; }}
          >
            Leave Site
          </button>
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button 
              onClick={() => handleBypass(15 * 60 * 1000)}
              style={{
                flex: 1, background: "rgba(255, 255, 255, 0.04)", color: "#a1a1aa",
                border: "none", borderRadius: "10px", padding: "10px",
                fontSize: "13px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s ease"
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"; e.currentTarget.style.color = "#ffffff"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)"; e.currentTarget.style.color = "#a1a1aa"; }}
            >
              Bypass 15m
            </button>
            <button 
              onClick={() => {
                const now = new Date();
                const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                handleBypass(endOfDay.getTime() - now.getTime());
              }}
              style={{
                flex: 1, background: "rgba(255, 255, 255, 0.04)", color: "#a1a1aa",
                border: "none", borderRadius: "10px", padding: "10px",
                fontSize: "13px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s ease"
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"; e.currentTarget.style.color = "#ffffff"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)"; e.currentTarget.style.color = "#a1a1aa"; }}
            >
              Bypass Today
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
