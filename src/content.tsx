import cssText from "data-text:~style.css";
import type { PlasmoCSConfig } from "plasmo";
import React, { useEffect, useRef, useState } from "react";

import { isSensitiveSite } from "./security/sensitive-sites";
import { validateBlobUIState } from "./security/validators";
import type {
  AnchorCorner,
  BlobUIState,
  TodayStatsResponse,
  RuntimeMessage,
  TimeLimitState
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

  const [blobStyle, setBlobStyle] = useState<"glass" | "brutalist">("glass");

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

  // Pomodoro sliding notification state
  const [pomodoroAlert, setPomodoroAlert] = useState<{ title: string; message: string; phase: string } | null>(null);

  // Time Limit Block State
  const [timeLimitState, setTimeLimitState] = useState<TimeLimitState | null>(null);

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
    chrome.storage.local.get(["blob_ui_state", "blobStyle"], (result) => {
      if (result.blobStyle) {
        setBlobStyle(result.blobStyle as "glass" | "brutalist");
      }
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

    // Listen for Pomodoro notifications
    const handleMessage = (msg: Record<string, unknown>) => {
      if (msg.type === "SHOW_POMODORO_NOTIFICATION" && msg.version === 1) {
        setPomodoroAlert({ title: msg.title as string, message: msg.message as string, phase: msg.phase as string });
        // The CSS animation handles hiding after 6s. We just clean up state slightly after to allow animation to complete.
        setTimeout(() => setPomodoroAlert(null), 6500);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [clampPosition, fetchFreshStats]);

  // Listen for blob style changes dynamically
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local" && changes.blobStyle) {
        setBlobStyle(changes.blobStyle.newValue as "glass" | "brutalist");
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // 2. Poll aggregates VERY sparsely (every 30s only when expanded)
  useEffect(() => {
    if (uiState !== "expanded") return;

    const interval = setInterval(() => {
      fetchFreshStats();
    }, 30_000);

    return () => clearInterval(interval);
  }, [uiState, fetchFreshStats]);

  // 2b. Poll Time Limit State
  useEffect(() => {
    if (isSensitive) return;
    const domain = window.location.hostname.replace(/^www\./, "");
    
    const checkTimeLimit = () => {
      chrome.runtime.sendMessage(
        { type: "GET_TIME_LIMIT_STATE", version: 1, domain } as RuntimeMessage,
        (response: TimeLimitState) => {
          if (!chrome.runtime.lastError && response) {
            setTimeLimitState(response);
          }
        }
      );
    };

    checkTimeLimit();
    const limitInterval = setInterval(checkTimeLimit, 5000);
    return () => clearInterval(limitInterval);
  }, [isSensitive]);

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

  // Determine dynamic styles for sliding toast based on current anchor corner
  const getToastStyles = (): React.CSSProperties => {
    const isTop = position.anchorCorner.startsWith("top");
    const isLeft = position.anchorCorner.endsWith("left");

    return {
      [isTop ? "top" : "bottom"]: "calc(100% + 12px)",
      [isLeft ? "left" : "right"]: 0,
      transformOrigin: `${isTop ? "top" : "bottom"} ${isLeft ? "left" : "right"}`,
      "--toast-start-x": isLeft ? "-20px" : "20px",
      "--toast-start-y": isTop ? "-30px" : "30px"
    } as React.CSSProperties;
  };

  const inlinePos = getInlineCoordinates();

  const isCollapsed = uiState === "collapsed" || (uiState === "dragging" && position.isCollapsed);

  // Handle Bypass Action
  const handleBypass = (durationMs: number) => {
    const domain = window.location.hostname.replace(/^www\./, "");
    chrome.runtime.sendMessage(
      { type: "BYPASS_TIME_LIMIT", version: 1, domain, durationMs } as RuntimeMessage,
      () => {
        // Optimistically update local state to hide overlay immediately
        if (timeLimitState) {
          setTimeLimitState({ ...timeLimitState, isBlocked: false, bypassedUntil: Date.now() + durationMs });
        }
      }
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        width: "100vw",
        height: "100vh",
        top: 0,
        left: 0,
        pointerEvents: timeLimitState?.isBlocked ? "auto" : "none",
        zIndex: 2147483647
      }}
      className="select-none font-sans"
    >
      {/* Soft-Block Overlay */}
      {timeLimitState?.isBlocked && (
        <div style={{
          position: "absolute", inset: 0, 
          backdropFilter: "blur(12px) saturate(180%)",
          WebkitBackdropFilter: "blur(12px) saturate(180%)",
          backgroundColor: "rgba(10, 10, 10, 0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10
        }}>
          <div style={{
            background: "var(--w-card-bg)",
            border: "1px solid var(--w-border)",
            borderRadius: "20px",
            padding: "40px",
            maxWidth: "420px",
            textAlign: "center",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.15)",
            pointerEvents: "auto",
            animation: "fadeIn 0.3s ease-out forwards"
          }}>
            <div style={{ display: "inline-flex", padding: "12px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", marginBottom: "20px" }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--w-text-main)", marginBottom: "12px", letterSpacing: "-0.02em" }}>Time Limit Reached</h2>
            <p style={{ fontSize: "14px", color: "var(--w-text-subtle)", marginBottom: "30px", lineHeight: 1.6 }}>
              You have spent <strong style={{ color: "var(--w-text-main)" }}>{formatDuration(timeLimitState.currentDurationMs || 0)}</strong> on <strong style={{ color: "var(--w-text-main)" }}>{timeLimitState.domain}</strong> today. 
              This exceeds your limit of {formatDuration(timeLimitState.maxDurationMs || 0)}.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button 
                onClick={() => { window.location.href = "about:blank"; }}
                style={{
                  background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                  color: "#fff", border: "none", borderRadius: "10px", padding: "12px",
                  fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "opacity 0.2s"
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Leave Site
              </button>
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button 
                  onClick={() => handleBypass(15 * 60 * 1000)}
                  style={{
                    flex: 1, background: "transparent", color: "var(--w-text-subtle)",
                    border: "1px solid var(--w-border)", borderRadius: "10px", padding: "10px",
                    fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = "var(--w-text-main)"; e.currentTarget.style.borderColor = "var(--w-text-muted)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = "var(--w-text-subtle)"; e.currentTarget.style.borderColor = "var(--w-border)"; }}
                >
                  Bypass 15m
                </button>
                <button 
                  onClick={() => handleBypass(24 * 60 * 60 * 1000)}
                  style={{
                    flex: 1, background: "transparent", color: "var(--w-text-subtle)",
                    border: "1px solid var(--w-border)", borderRadius: "10px", padding: "10px",
                    fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = "var(--w-text-main)"; e.currentTarget.style.borderColor = "var(--w-text-muted)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = "var(--w-text-subtle)"; e.currentTarget.style.borderColor = "var(--w-border)"; }}
                >
                  Bypass Today
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        {pomodoroAlert && (
          <div 
            className="pomodoro-toast-slide-out" 
            style={getToastStyles()} 
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
        )}

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
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px" }}>
              {stats.activeSession ? (
                <>
                  <span style={{ fontSize: "8px", fontWeight: 700, color: "var(--w-text-accent-dim)", letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1 }}>live</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--w-text-accent)", fontFamily: "monospace", lineHeight: 1, letterSpacing: "-0.01em" }}>
                    {formatDuration(localLiveDurationMs)}
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

            {/* Micro Hover Tooltip */}
            <div className="absolute whitespace-nowrap text-[10px] rounded-lg px-2.5 py-1.5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none -top-9 left-1/2 transform -translate-x-1/2" style={{ background: "var(--w-footer-bg)", color: "var(--w-text-main)", border: "1px solid var(--w-border)", backdropFilter: "blur(12px)" }}>
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
                      {formatDuration(localLiveDurationMs)}
                    </span>
                    <span style={{ fontSize: "9px", color: "var(--w-text-subtle)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>this session</span>
                  </div>
                )}
              </div>

              {/* Grid stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", flexShrink: 0 }}>
                <div style={{ padding: "9px 12px", background: "var(--w-card-bg)", border: "1px solid var(--w-card-border)", borderRadius: "12px" }}>
                  <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--w-text-subtle)", display: "block", marginBottom: "2px", fontWeight: 700 }}>
                    Today&apos;s Total
                  </span>
                  <span style={{ fontSize: "17px", fontWeight: 800, color: "var(--w-text-main)", fontFamily: "monospace" }}>
                    {formatDuration(stats.totalDurationMs)}
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
                              {formatDuration(item.durationMs)}
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
      </div>
    </div>
  );
}
