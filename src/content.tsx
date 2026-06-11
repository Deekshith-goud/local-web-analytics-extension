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

import { TimeLimitBlocker } from "./content/components/TimeLimitBlocker";
import { PomodoroToast } from "./content/components/PomodoroToast";
import { BlobWidget } from "./content/components/BlobWidget";

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
  const [uiState, setUiState] = useState<"expanded" | "collapsed" | "dragging" | "hidden">("collapsed");

  const [blobStyle, setBlobStyle] = useState<"glass" | "brutalist">("glass");
  const [blobEnabled, setBlobEnabled] = useState<boolean>(true);

  // Live aggregated stats from background
  const [stats, setStats] = useState<TodayStatsResponse & { _fetchedAt?: number }>({
    activeSession: null,
    totalDurationMs: 0,
    uniqueDomainsCount: 0,
    topDomains: []
  });

  // Ticking time derived locally in-memory (0 messages sent)
  const [activeDomainTodayLiveMs, setActiveDomainTodayLiveMs] = useState<number>(0);

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
  const [bypassRemainingStr, setBypassRemainingStr] = useState<string | null>(null);

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
          setStats({ ...response, _fetchedAt: Date.now() });
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
    chrome.storage.local.get(["blob_ui_state", "blobStyle", "blobEnabled"], (result) => {
      if (result.blobStyle) {
        setBlobStyle(result.blobStyle as "glass" | "brutalist");
      }
      if (result.blobEnabled !== undefined) {
        setBlobEnabled(result.blobEnabled);
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

    // Listen for Pomodoro notifications and Background State Syncs
    const handleMessage = (msg: Record<string, unknown>) => {
      if (msg.type === "SHOW_POMODORO_NOTIFICATION" && msg.version === 1) {
        setPomodoroAlert({ title: msg.title as string, message: msg.message as string, phase: msg.phase as string });
        // The CSS animation handles hiding after 6s. We just clean up state slightly after to allow animation to complete.
        setTimeout(() => setPomodoroAlert(null), 6500);
      }
      
      if (msg.type === "SYNC_REQUESTED" && msg.version === 1) {
        fetchFreshStats();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [clampPosition, fetchFreshStats]);

  // Listen for blob style changes dynamically
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local") {
        if (changes.blobStyle) {
          setBlobStyle(changes.blobStyle.newValue as "glass" | "brutalist");
        }
        if (changes.blobEnabled) {
          setBlobEnabled(changes.blobEnabled.newValue);
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Dopamine Detox (Grayscale) CSS Injection
  useEffect(() => {
    const updateDetoxStyle = (enabled: boolean) => {
      if (enabled) {
        document.documentElement.style.setProperty('filter', 'grayscale(100%)', 'important');
        document.documentElement.style.setProperty('transition', 'filter 0.8s ease-in-out', 'important');
      } else {
        document.documentElement.style.removeProperty('filter');
        document.documentElement.style.removeProperty('transition');
      }
    };

    chrome.storage.local.get(["isDetoxModeEnabled"], (res) => {
      updateDetoxStyle(!!res.isDetoxModeEnabled);
    });

    const handleStorage = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && changes.isDetoxModeEnabled) {
        updateDetoxStyle(changes.isDetoxModeEnabled.newValue);
      }
    };
    chrome.storage.onChanged.addListener(handleStorage);
    return () => chrome.storage.onChanged.removeListener(handleStorage);
  }, []);

  // 2. Poll aggregates VERY sparsely (every 30s only when expanded)
  useEffect(() => {
    if (uiState !== "expanded") return;

    const interval = setInterval(() => {
      fetchFreshStats();
    }, 30_000);

    return () => clearInterval(interval);
  }, [uiState, fetchFreshStats]);

  // 2a. Immediately fetch fresh stats when the tab comes back into focus
  // This ensures the local tracker doesn't falsely tick when inactive, and syncs immediately on return.
  useEffect(() => {
    const handleActiveChange = () => {
      if (document.visibilityState === "visible" || document.hasFocus()) {
        fetchFreshStats();
      }
    };
    
    document.addEventListener("visibilitychange", handleActiveChange);
    window.addEventListener("focus", handleActiveChange);
    return () => {
      document.removeEventListener("visibilitychange", handleActiveChange);
      window.removeEventListener("focus", handleActiveChange);
    };
  }, [fetchFreshStats]);

  // 2b. Poll Time Limit State
  useEffect(() => {
    if (isSensitive) return;
    const domain = window.location.hostname.replace(/^www\./, "");
    
    const checkTimeLimit = () => {
      chrome.runtime.sendMessage(
        { type: "GET_TIME_LIMIT_STATE", version: 1, domain } as RuntimeMessage,
        (response: TimeLimitState) => {
          if (!chrome.runtime.lastError && response) {
            setTimeLimitState((prev) => {
              if (prev?.isBlocked && response.isBlocked) {
                return {
                  ...response,
                  currentDurationMs: prev.currentDurationMs || 0
                };
              }
              return response;
            });
          }
        }
      );
    };

    checkTimeLimit();
    const limitInterval = setInterval(checkTimeLimit, 5000);
    return () => clearInterval(limitInterval);
  }, [isSensitive]);

  // 2c. Bypass Timer Badge Ticker
  useEffect(() => {
    if (!timeLimitState?.bypassedUntil) {
      setBypassRemainingStr(null);
      return;
    }
    
    const tickBypass = () => {
      const now = Date.now();
      const until = timeLimitState.bypassedUntil;
      if (until && until > now) {
        const diffMs = until - now;
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        if (diffMins > 60) {
          setBypassRemainingStr("Bypassed for today");
        } else {
          setBypassRemainingStr(`Bypassed: ${diffMins}:${diffSecs.toString().padStart(2, '0')}`);
        }
      } else {
        setBypassRemainingStr(null);
      }
    };

    tickBypass();
    const interval = setInterval(tickBypass, 1000);
    return () => clearInterval(interval);
  }, [timeLimitState?.bypassedUntil]);

  // 3. Local Timer Ticker - derived entirely in-memory at 1s resolution
  useEffect(() => {
    const active = stats.activeSession;
    const currentDomain = window.location.hostname.replace(/^www\./, "");
    
    // If we are NOT the globally active tracking session (e.g., user is on another tab/window),
    // we freeze the ticker and display the last known database total for this domain.
    if (!active || active.domain !== currentDomain) {
      const staticDomainStat = stats.topDomains.find(d => d.domain === currentDomain);
      setActiveDomainTodayLiveMs(staticDomainStat ? staticDomainStat.durationMs : 0);
      return;
    }

    // Set initial duration
    const computeDuration = () => {
      const elapsed = Math.max(0, Date.now() - active.startTime);
      
      const fetchedAt = stats._fetchedAt || Date.now();
      const baseDbTotalApprox = active.todayTotalMs - Math.max(0, fetchedAt - active.startTime);
      setActiveDomainTodayLiveMs(Math.max(0, baseDbTotalApprox) + elapsed);
    };

    computeDuration();
    const interval = setInterval(computeDuration, 1000);

    return () => clearInterval(interval);
  }, [stats]);

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

  // 5. Early Returns for hidden states
  if (isSensitive) return null;
  if (!blobEnabled) return null;
  if (uiState as any === "hidden") return null;

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
    if (uiState as any === "hidden" || !containerRef.current) return;

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

  const handleBypass = () => {
    chrome.runtime.sendMessage({ type: "BYPASS_LIMIT", domain: window.location.hostname });
  };

  const inlinePos = {
    top: position.anchorCorner.startsWith("top") ? position.offsetY : "auto",
    bottom: position.anchorCorner.startsWith("bottom") ? position.offsetY : "auto",
    left: position.anchorCorner.endsWith("left") ? position.offsetX : "auto",
    right: position.anchorCorner.endsWith("right") ? position.offsetX : "auto"
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
    >
      <TimeLimitBlocker timeLimitState={timeLimitState} handleBypass={handleBypass} />
      
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          top: inlinePos.top,
          bottom: inlinePos.bottom,
          left: inlinePos.left,
          right: inlinePos.right,
          pointerEvents: "auto",
          transition: uiState === "dragging" ? "none" : "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          isolation: "isolate"
        }}
        className="flex items-center justify-center"
      >
        {bypassRemainingStr && !timeLimitState?.isBlocked && (
          <div style={{
            position: "absolute",
            bottom: "calc(100% + 12px)",
            right: 0,
            background: "rgba(14, 14, 15, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "6px 12px",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
            zIndex: 10,
            whiteSpace: "nowrap"
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px rgba(16, 185, 129, 0.5)" }} />
            {bypassRemainingStr}
          </div>
        )}

        <PomodoroToast 
          pomodoroAlert={pomodoroAlert} 
          setPomodoroAlert={setPomodoroAlert} 
          blobStyle={blobStyle} 
          anchorCorner={position.anchorCorner} 
        />

        <BlobWidget 
          isCollapsed={position.isCollapsed} 
          blobStyle={blobStyle} 
          stats={stats} 
          activeDomainTodayLiveMs={activeDomainTodayLiveMs} 
          transitionToState={transitionToState} 
          onMouseDown={onMouseDown} 
          blobRef={blobRef} 
        />
      </div>
    </div>
  );
}
