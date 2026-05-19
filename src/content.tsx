import cssText from "data-text:~style.css";
import type { PlasmoCSConfig } from "plasmo";
import React, { useEffect, useRef, useState } from "react";

import { isSensitiveSite } from "./security/sensitive-sites";
import { validateBlobUIState } from "./security/validators";
import type {
  AnchorCorner,
  BlobUIState,
  TodayStatsResponse,
  RuntimeMessage
} from "./types/tracking";

// Encapsulate and export Shadow DOM CSS injector
export const getStyle = () => {
  const style = document.createElement("style");
  style.textContent = cssText;
  return style;
};

// Exclude sensitive domains from injecting content script UI
export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  exclude_matches: [
    "https://accounts.google.com/*",
    "https://*.microsoftonline.com/*",
    "https://appleid.apple.com/*"
  ]
};

type UIState = "collapsed" | "expanded" | "dragging" | "hidden";

export default function BlobContent() {
  // Check sensitive site on mount (double security layer)
  const [isSensitive, setIsSensitive] = useState<boolean>(true);

  // Core Explicit UI State Machine
  const [uiState, setUiState] = useState<UIState>("collapsed");

  // Live aggregated stats from background
  const [stats, setStats] = useState<TodayStatsResponse>({
    activeSession: null,
    totalDurationMs: 0,
    uniqueDomainsCount: 0,
    topDomains: []
  });

  // Ticking time derived locally in-memory (0 messages sent)
  const [localLiveDurationMs, setLocalLiveDurationMs] = useState<number>(0);

  // Position attributes
  const [position, setPosition] = useState<BlobUIState>({
    anchorCorner: "bottom-right",
    offsetX: 24,
    offsetY: 24,
    isCollapsed: true
  });

  // DOM node references for requestAnimationFrame direct mutation
  const containerRef = useRef<HTMLDivElement>(null);
  const blobRef = useRef<HTMLDivElement>(null);

  // Ref tracking parameters to bypass React render cycle during drags
  const dragStartRef = useRef<{ mX: number; mY: number; oX: number; oY: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const targetAnchorRef = useRef<AnchorCorner>("bottom-right");
  const targetOffsetXRef = useRef<number>(24);
  const targetOffsetYRef = useRef<number>(24);
  const animationFrameIdRef = useRef<number | null>(null);

  // ─── Component Helpers (Declared first to avoid Block TDZ checks) ─────────────────

  // Collision clamping logic to prevent offscreen coordinates
  const clampPosition = React.useCallback((anchor: AnchorCorner, ox: number, oy: number) => {
    const minPadding = 16;
    const widgetWidth = position.isCollapsed ? 56 : 288;
    const widgetHeight = position.isCollapsed ? 56 : 380;

    const maxW = window.innerWidth - widgetWidth - minPadding;
    const maxH = window.innerHeight - widgetHeight - minPadding;

    return {
      anchor,
      ox: Math.max(minPadding, Math.min(ox, maxW)),
      oy: Math.max(minPadding, Math.min(oy, maxH))
    };
  }, [position.isCollapsed]);

  // Helper to query stats safely from background
  const fetchFreshStats = React.useCallback(() => {
    chrome.runtime.sendMessage(
      { type: "GET_TODAY_STATS", version: 1 } satisfies RuntimeMessage,
      (response: TodayStatsResponse) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (response) {
          setStats(response);
        }
      }
    );
  }, []);

  // Helper to transition state machines and persist state
  const transitionToState = React.useCallback((target: "collapsed" | "expanded") => {
    setUiState(target);
    setPosition((prev) => {
      const updated = { ...prev, isCollapsed: target === "collapsed" };
      chrome.storage.local.set({ blob_ui_state: updated });
      return updated;
    });
    // Immediately refresh stats on expansion to ensure fresh top list
    if (target === "expanded") {
      fetchFreshStats();
    }
  }, [fetchFreshStats]);

  // ─── Component Effects & Lifecycles ──────────────────────────────────────────────

  // 1. Initial mounting checks & persistent state loading
  useEffect(() => {
    const currentUrl = window.location.href;
    if (isSensitiveSite(currentUrl)) {
      setIsSensitive(true);
      return;
    }
    setIsSensitive(false);

    // Load persisted coordinates from chrome.storage.local
    chrome.storage.local.get(["blob_ui_state"], (result) => {
      const saved = validateBlobUIState(result.blob_ui_state);
      // Verify against window size to avoid offscreen positioning on lower res
      const clamped = clampPosition(saved.anchorCorner, saved.offsetX, saved.offsetY);
      setPosition({
        anchorCorner: clamped.anchor,
        offsetX: clamped.ox,
        offsetY: clamped.oy,
        isCollapsed: saved.isCollapsed
      });
      setUiState(saved.isCollapsed ? "collapsed" : "expanded");
    });

    // Load base today stats from background
    fetchFreshStats();
  }, [clampPosition, fetchFreshStats]);

  // 2. Poll aggregates VERY sparsely (every 30s only when expanded)
  useEffect(() => {
    if (uiState !== "expanded") return;

    const interval = setInterval(() => {
      fetchFreshStats();
    }, 30_000);

    return () => clearInterval(interval);
  }, [uiState, fetchFreshStats]);

  // 3. Local Timer Ticker - derived entirely in-memory at 1s resolution
  useEffect(() => {
    const active = stats.activeSession;
    if (!active) {
      setLocalLiveDurationMs(0);
      return;
    }

    // Set initial duration
    const computeDuration = () => {
      const elapsed = Math.max(0, Date.now() - active.startTime);
      setLocalLiveDurationMs(elapsed);
    };

    computeDuration();
    const interval = setInterval(computeDuration, 1000);

    return () => clearInterval(interval);
  }, [stats.activeSession]);

  // 4. Global Accessibility & Keyboard Handlers (ESC key close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && uiState === "expanded") {
        e.preventDefault();
        transitionToState("collapsed");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [uiState, transitionToState]);

  // Handle window resizing collisions
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const clamped = clampPosition(prev.anchorCorner, prev.offsetX, prev.offsetY);
        return {
          ...prev,
          anchorCorner: clamped.anchor,
          offsetX: clamped.ox,
          offsetY: clamped.oy
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  // Return empty immediately if site is marked as high-sensitivity
  if (isSensitive) {
    return null;
  }

  // 5. Drag & Drop mouse sequence utilizing requestAnimationFrame
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only capture left-clicks
    if (e.button !== 0) return;

    e.preventDefault();
    const currentElement = containerRef.current;
    if (!currentElement) return;

    isDraggingRef.current = false;
    setUiState("dragging");

    // Grab current viewport geometry to deduce initial offset distances
    const rect = currentElement.getBoundingClientRect();
    const curX = rect.left;
    const curY = rect.top;

    dragStartRef.current = {
      mX: e.clientX,
      mY: e.clientY,
      oX: curX,
      oY: curY
    };

    // Attach global window event handlers
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Launch RAF loop
    if (animationFrameIdRef.current === null) {
      animationFrameIdRef.current = requestAnimationFrame(updateDOMPosition);
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    const start = dragStartRef.current;
    if (!start) return;

    const deltaX = e.clientX - start.mX;
    const deltaY = e.clientY - start.mY;

    // Detect click-vs-drag threshold filter (5px)
    if (!isDraggingRef.current && Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 5) {
      isDraggingRef.current = true;
    }

    if (!isDraggingRef.current) return;

    // Resolve target pixel offset relative to screen corners
    const targetX = start.oX + deltaX;
    const targetY = start.oY + deltaY;

    // Resolve closest horizontal and vertical edges to snap anchor
    const isLeft = targetX < window.innerWidth / 2;
    const isTop = targetY < window.innerHeight / 2;

    const hAnchor = isLeft ? "left" : "right";
    const vAnchor = isTop ? "top" : "bottom";

    const resolvedAnchor = `${vAnchor}-${hAnchor}` as AnchorCorner;

    // Calculate actual coordinate spacing relative to matching anchor corner
    const offsetH = isLeft ? targetX : window.innerWidth - targetX - (position.isCollapsed ? 56 : 288);
    const offsetV = isTop ? targetY : window.innerHeight - targetY - (position.isCollapsed ? 56 : 340);

    // Save variables into mutable refs for the RAF loop to read instantly
    targetAnchorRef.current = resolvedAnchor;
    targetOffsetXRef.current = offsetH;
    targetOffsetYRef.current = offsetV;
  };

  const updateDOMPosition = () => {
    if (uiState === "hidden" || !containerRef.current) return;

    const element = containerRef.current;
    const anchor = targetAnchorRef.current;

    // Clamp coordinates safely within screen bounds to ensure no parts drop offscreen
    const clamped = clampPosition(anchor, targetOffsetXRef.current, targetOffsetYRef.current);

    // Direct DOM write bypasses React rendering for 60fps performance
    element.style.top = clamped.anchor.startsWith("top") ? `${clamped.oy}px` : "auto";
    element.style.bottom = clamped.anchor.startsWith("bottom") ? `${clamped.oy}px` : "auto";
    element.style.left = clamped.anchor.endsWith("left") ? `${clamped.ox}px` : "auto";
    element.style.right = clamped.anchor.endsWith("right") ? `${clamped.ox}px` : "auto";

    animationFrameIdRef.current = requestAnimationFrame(updateDOMPosition);
  };

  const onMouseUp = () => {
    // Teardown event listeners
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);

    // Stop and clear RAF loop
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    const wasDragging = isDraggingRef.current;
    isDraggingRef.current = false;

    if (wasDragging) {
      // Complete dragging state transition, clamp final results, commit state and persist
      const clamped = clampPosition(targetAnchorRef.current, targetOffsetXRef.current, targetOffsetYRef.current);
      const nextPos: BlobUIState = {
        anchorCorner: clamped.anchor,
        offsetX: clamped.ox,
        offsetY: clamped.oy,
        isCollapsed: position.isCollapsed
      };

      setPosition(nextPos);
      setUiState(position.isCollapsed ? "collapsed" : "expanded");
      chrome.storage.local.set({ blob_ui_state: nextPos });
    } else {
      // Treat as click trigger: toggle expansion state
      const targetCollapse = !position.isCollapsed;
      transitionToState(targetCollapse ? "collapsed" : "expanded");
    }

    dragStartRef.current = null;
  };

  // Human friendly milliseconds to MM:SS or HH:MM:SS formatter
  const formatDuration = (ms: number): string => {
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (num: number) => String(num).padStart(2, "0");

    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${mins}:${pad(secs)}`;
  };

  // Determine inline coordinates for regular render positioning
  const getInlineCoordinates = () => {
    const isTop = position.anchorCorner.startsWith("top");
    const isLeft = position.anchorCorner.endsWith("left");

    return {
      top: isTop ? `${position.offsetY}px` : "auto",
      bottom: isTop ? "auto" : `${position.offsetY}px`,
      left: isLeft ? `${position.offsetX}px` : "auto",
      right: isLeft ? "auto" : `${position.offsetX}px`
    };
  };

  const inlinePos = getInlineCoordinates();

  const isCollapsed = uiState === "collapsed" || (uiState === "dragging" && position.isCollapsed);

  return (
    <div
      style={{
        position: "fixed",
        width: "100vw",
        height: "100vh",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 2147483647
      }}
      className="select-none font-sans"
    >
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          top: inlinePos.top,
          bottom: inlinePos.bottom,
          left: inlinePos.left,
          right: inlinePos.right,
          pointerEvents: "auto",
          transition: uiState === "dragging" ? "none" : "all 300ms cubic-bezier(0.4, 0, 0.2, 1)"
        }}
        className="flex items-center justify-center"
      >
        <div
          ref={blobRef}
          className="widget-frame"
          style={{
            width: isCollapsed ? "56px" : "288px",
            height: isCollapsed ? "56px" : "380px",
            borderRadius: isCollapsed ? "28px" : "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
            flexGrow: 0
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
            {/* Ping Indicator Glow */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
            </span>

            {/* Display ticking duration or icon */}
            <div className="flex flex-col items-center justify-center text-center">
              {stats.activeSession ? (
                <span className="text-[10px] font-bold text-violet-400 tracking-tight font-mono">
                  {formatDuration(localLiveDurationMs)}
                </span>
              ) : (
                <svg
                  className="w-5 h-5 text-violet-400 group-hover:text-white transition-colors"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
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

            {/* Micro Hover Tooltip */}
            <div className="absolute whitespace-nowrap bg-slate-900 border border-slate-800 text-[10px] text-slate-300 rounded px-2 py-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none -top-8 left-1/2 transform -translate-x-1/2">
              Today: {formatDuration(stats.totalDurationMs)}
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
            {/* Header / Drag Bar — fixed height ~44px */}
            <div
              onMouseDown={onMouseDown}
              className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between cursor-grab active:cursor-grabbing"
              title="Drag to reposition widget"
              style={{ flexShrink: 0 }}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                </span>
                <span className="text-xs font-semibold tracking-wider text-violet-400 uppercase">
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
                className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-850 rounded-lg text-xs"
                aria-label="Minimize statistics dashboard"
              >
                ✕
              </button>
            </div>

            {/* Contents — rigid flex column, takes all remaining space */}
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
              {/* Active Site card — compact, fixed height */}
              <div
                className="bg-slate-900/40 border border-slate-800/50 rounded-xl"
                style={{ flexShrink: 0, padding: "8px 12px" }}
              >
                <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", display: "block", marginBottom: "2px" }}>
                  Active Domain
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {stats.activeSession?.domain || "Idle / Inactive"}
                </span>
                {stats.activeSession && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "2px" }}>
                    <span style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em", color: "#a78bfa" }}>
                      {formatDuration(localLiveDurationMs)}
                    </span>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>this session</span>
                  </div>
                )}
              </div>

              {/* Grid stats — compact fixed height */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", flexShrink: 0 }}>
                <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl" style={{ padding: "8px 12px" }}>
                  <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", display: "block", marginBottom: "1px" }}>
                    Today&apos;s Total
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>
                    {formatDuration(stats.totalDurationMs)}
                  </span>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl" style={{ padding: "8px 12px" }}>
                  <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", display: "block", marginBottom: "1px" }}>
                    Unique Sites
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>
                    {stats.uniqueDomainsCount}
                  </span>
                </div>
              </div>

              {/* Top 5 Domains — fixed 5 rows, no scroll needed */}
              <div
                style={{
                  flex: "1 1 0",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }}
              >
                <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", display: "block", flexShrink: 0, marginBottom: "2px" }}>
                  Top Domains Visited Today
                </span>
                {stats.topDomains.length === 0 ? (
                  <span style={{ fontSize: "11px", color: "#64748b", textAlign: "center", paddingTop: "8px" }}>
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
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "155px", color: "#cbd5e1", fontWeight: 500 }}>
                              {item.domain}
                            </span>
                            <span style={{ color: "#94a3b8", fontFamily: "monospace", flexShrink: 0, marginLeft: "4px", fontSize: "11px" }}>
                              {formatDuration(item.durationMs)}
                            </span>
                          </div>
                          <div style={{ height: "4px", width: "100%", background: "rgba(15,23,42,0.8)", borderRadius: "2px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${percent}%`,
                                height: "100%",
                                background: "linear-gradient(to right, #7c3aed, #6366f1)",
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

            {/* Footer — fixed height, always pinned to bottom */}
            <div
              className="px-4 py-2 border-t border-slate-900 bg-slate-950 text-[10px] text-slate-500 flex items-center justify-between"
              style={{ flexShrink: 0 }}
            >
              <span>🔒 Encrypted local-only analytics</span>
              <span>v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
