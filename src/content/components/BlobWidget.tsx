import React from "react";
import type { TodayStatsResponse } from "../../types/tracking";
import { formatTimer } from "../../utils/format";

interface BlobWidgetProps {
  isCollapsed: boolean;
  blobStyle: "glass" | "brutalist";
  stats: TodayStatsResponse & { _fetchedAt?: number };
  activeDomainTodayLiveMs: number;
  transitionToState: (target: "collapsed" | "expanded") => void;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  blobRef: React.RefObject<HTMLDivElement>;
}

export function BlobWidget({
  isCollapsed,
  blobStyle,
  stats,
  activeDomainTodayLiveMs,
  transitionToState,
  onMouseDown,
  blobRef
}: BlobWidgetProps) {
  return (
    <div
      ref={blobRef}
      className={`widget-frame widget-${blobStyle}`}
      style={{
        width: isCollapsed ? "52px" : "284px",
        height: isCollapsed ? "52px" : "380px",
        borderRadius: isCollapsed ? "var(--w-radius-collapsed)" : "var(--w-radius-expanded)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
        flexGrow: 0,
        zIndex: 20
      }}
    >
      {/* 1. Collapsed View */}
      <div
        onMouseDown={onMouseDown}
        tabIndex={isCollapsed ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            transitionToState("expanded");
          }
        }}
        title="Drag to move. Click to expand local browsing analytics stats."
        className={`widget-collapsed-view group ${isCollapsed ? "fade-in-content" : "fade-out-content"}`}
        role="button"
        aria-label="Expand local browse analytics dashboard"
        aria-expanded={!isCollapsed}
      >
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
        </span>

        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px" }}>
          {stats.activeSession ? (
            <>
              <span style={{ fontSize: "8px", fontWeight: 700, color: "var(--w-text-accent-dim)", letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1 }}>live</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--w-text-accent)", fontFamily: "monospace", lineHeight: 1, letterSpacing: "-0.01em" }}>
                {formatTimer(activeDomainTodayLiveMs)}
              </span>
            </>
          ) : (
            <svg
              style={{ width: "20px", height: "20px", color: "var(--w-text-accent-dim)" }}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>

        <div className="absolute whitespace-nowrap text-[10px] rounded-lg px-2.5 py-1.5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none -top-9 left-1/2 transform -translate-x-1/2" style={{ background: "var(--w-footer-bg)", color: "var(--w-text-main)", border: "1px solid var(--w-border)", backdropFilter: "blur(12px)" }}>
          Today: {formatTimer(stats.totalDurationMs)}
        </div>
      </div>

      {/* 2. Expanded Glassmorphic Panel */}
      <div
        className={`widget-expanded-view ${!isCollapsed ? "fade-in-content" : "fade-out-content"}`}
        role="dialog"
        aria-label="Local Browse Analytics Panel"
        tabIndex={!isCollapsed ? 0 : -1}
        style={{ display: "flex", flexDirection: "column", width: "288px", height: "380px", overflow: "hidden" }}
      >
        {/* Header / Drag Bar */}
        <div
          onMouseDown={onMouseDown}
          title="Drag to reposition widget"
          style={{
            flexShrink: 0,
            padding: "12px 14px 10px",
            background: "var(--w-header-bg)",
            borderBottom: "1px solid var(--w-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "grab"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
            <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", color: "var(--w-text-accent)", textTransform: "uppercase" }}>
              Local Analytics
            </span>
          </div>
          <button
            onClick={() => transitionToState("collapsed")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                transitionToState("collapsed");
              }
            }}
            style={{
              background: "var(--w-card-bg)",
              border: "1px solid var(--w-border)",
              color: "var(--w-text-accent)",
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "11px",
              lineHeight: 1,
              transition: "all 0.15s ease"
            }}
            aria-label="Minimize statistics dashboard"
          >
            ✕
          </button>
        </div>

        {/* Contents */}
        <div
          style={{
            flex: "1 1 0",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "12px 14px",
            overflow: "hidden"
          }}
        >
          {/* Active Site card */}
          <div
            style={{
              flexShrink: 0,
              padding: "10px 13px",
              background: "var(--w-active-bg)",
              border: "1px solid var(--w-border)",
              borderRadius: "14px"
            }}
          >
            <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--w-text-accent-dim)", display: "block", marginBottom: "3px", fontWeight: 700 }}>
              Active Domain
            </span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--w-text-main)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {stats.activeSession?.domain || "Idle / Inactive"}
            </span>
            {stats.activeSession && (
              <div style={{ display: "flex", alignItems: "baseline", gap: "5px", marginTop: "4px" }}>
                <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--w-text-accent)", textShadow: "0 0 12px var(--w-glow-color)", fontFamily: "monospace" }}>
                  {formatTimer(activeDomainTodayLiveMs)}
                </span>
                <span style={{ fontSize: "9px", color: "var(--w-text-subtle)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>today on site</span>
              </div>
            )}
          </div>

          {/* Grid stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", flexShrink: 0 }}>
            <div style={{ padding: "9px 12px", background: "var(--w-card-bg)", border: "1px solid var(--w-card-border)", borderRadius: "12px" }}>
              <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--w-text-subtle)", display: "block", marginBottom: "2px", fontWeight: 700 }}>
                Today's Total
              </span>
              <span style={{ fontSize: "17px", fontWeight: 800, color: "var(--w-text-main)", fontFamily: "monospace" }}>
                {formatTimer(stats.totalDurationMs)}
              </span>
            </div>
            <div style={{ padding: "9px 12px", background: "var(--w-card-bg)", border: "1px solid var(--w-card-border)", borderRadius: "12px" }}>
              <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--w-text-subtle)", display: "block", marginBottom: "2px", fontWeight: 700 }}>
                Unique Sites
              </span>
              <span style={{ fontSize: "17px", fontWeight: 800, color: "var(--w-text-main)" }}>
                {stats.uniqueDomainsCount}
              </span>
            </div>
          </div>

          {/* Top 5 Domains */}
          <div
            style={{
              flex: "1 1 0",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }}
          >
            <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--w-text-muted)", display: "block", flexShrink: 0, marginBottom: "2px" }}>
              Top Domains Visited Today
            </span>
            {stats.topDomains.length === 0 ? (
              <span style={{ fontSize: "11px", color: "var(--w-text-muted)", textAlign: "center", paddingTop: "8px" }}>
                No data recorded today
              </span>
            ) : (
              <div
                style={{
                  flex: "1 1 0",
                  minHeight: 0,
                  overflowY: "auto",
                  overflowX: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  paddingRight: "2px"
                }}
              >
                {stats.topDomains.slice(0, 5).map((item) => {
                  const percent = stats.totalDurationMs > 0
                    ? Math.min(100, Math.round((item.durationMs / stats.totalDurationMs) * 100))
                    : 0;

                  return (
                    <div key={item.domain} style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "155px", color: "var(--w-text-main)", fontWeight: 500 }}>
                          {item.domain}
                        </span>
                        <span style={{ color: "var(--w-text-muted)", fontFamily: "monospace", flexShrink: 0, marginLeft: "4px", fontSize: "11px" }}>
                          {formatTimer(item.durationMs)}
                        </span>
                      </div>
                      <div style={{ height: "4px", width: "100%", background: "var(--w-card-bg)", border: "1px solid var(--w-card-border)", borderRadius: "2px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: "100%",
                            background: "var(--w-text-accent)",
                            borderRadius: "2px",
                            transition: "width 500ms ease"
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            padding: "8px 14px",
            borderTop: "1px solid var(--w-border)",
            background: "var(--w-footer-bg)",
            fontSize: "9px",
            color: "var(--w-text-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            letterSpacing: "0.04em"
          }}
        >
          <span>🔒 Local-only · zero telemetry</span>
          <span style={{ color: "var(--w-text-accent-dim)", fontWeight: 700 }}>v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
