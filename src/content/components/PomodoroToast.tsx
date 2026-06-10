import React from "react";

interface PomodoroToastProps {
  pomodoroAlert: { title: string; message: string; phase: string } | null;
  setPomodoroAlert: (alert: { title: string; message: string; phase: string } | null) => void;
  blobStyle: "glass" | "brutalist";
  anchorCorner: string;
}

export function PomodoroToast({ pomodoroAlert, setPomodoroAlert, blobStyle, anchorCorner }: PomodoroToastProps) {
  if (!pomodoroAlert) return null;

  const getToastStyles = (): React.CSSProperties => {
    const isTop = anchorCorner.startsWith("top");
    const isLeft = anchorCorner.endsWith("left");

    return {
      [isTop ? "top" : "bottom"]: "calc(100% + 12px)",
      [isLeft ? "left" : "right"]: 0,
      transformOrigin: `${isTop ? "top" : "bottom"} ${isLeft ? "left" : "right"}`,
      "--toast-start-x": isLeft ? "-20px" : "20px",
      "--toast-start-y": isTop ? "-30px" : "30px",
      position: "absolute"
    } as React.CSSProperties;
  };

  return (
    <div 
      className={`pomodoro-toast-slide-out widget-frame widget-${blobStyle}`} 
      style={{ ...getToastStyles(), zIndex: 10 }} 
      onClick={() => setPomodoroAlert(null)}
    >
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "50%", background: pomodoroAlert.phase === "break" ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)", color: pomodoroAlert.phase === "break" ? "#10b981" : "#3b82f6" }}>
        {pomodoroAlert.phase === "break" ? (
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
        ) : (
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span style={{ fontSize: "13px", fontWeight: 700 }}>{pomodoroAlert.title}</span>
        <span style={{ fontSize: "11px", color: "var(--w-text-subtle)", whiteSpace: "normal", lineHeight: 1.2 }}>{pomodoroAlert.message}</span>
      </div>
    </div>
  );
}
