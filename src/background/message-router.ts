import { engine, classifier } from "./engine-instance";
import { getLivePopupSnapshot, handleGetHistoricalStats, getLiveTodayStats } from "./stats-service";
import { invalidateAllCaches, invalidateTodayCache, cacheMetrics, cacheEventsLog, maintenanceEventsLog, historicalSnapshotCache } from "./cache-service";

import { DEFAULT_RULES, getCustomRules, saveCustomRules } from "../analytics/productivity-rules";
import { getTimeLimitRules, saveTimeLimitRules, getTimeLimitBypasses, setTimeLimitBypass } from "../analytics/time-limits";
import { pomodoroEngine } from "../analytics/pomodoro-engine";
import { deriveSurface, isRuntimeMessage, logSecurityEvent, MESSAGE_CAPABILITIES, securityMetrics, securityEventsLog } from "../security/validators";
import { getStartOfDayTimestamp, getLocalTodayDateString } from "../utils/date-utils";
import { getActivityRecordsInRange } from "../storage/repository";
import { logger } from "../utils/logger";

import { clearAllData } from "../storage/repository";
import type { RuntimeMessage, ActiveSessionResponse, TodayStatsResponse, PopupSnapshotResponse, HistoricalStatsResponse, DomainIntervalsResponse } from "../types/tracking";

/**
 * Resets local storage configurations, custom productivity rules, active timers, and in-memory caches.
 */
async function resetExtensionState(): Promise<void> {
  logger.warn("[Background] Commencing full extension state reset...");

  // 1. Pause tracking engine
  await engine.setPaused(true);

  // 2. Clear IndexedDB repositories
  await clearAllData();

  // 3. Clear chrome.storage.local completely (WAL keys, options, maintenance timestamps, custom rules)
  await chrome.storage.local.clear();

  // 4. Reset engine in-memory state
  engine.clearState();

  // 5. Re-compile productivity classifier to empty state
  classifier.compileRules([]);

  // 6. Invalidate all cache memoizations
  invalidateAllCaches();

  logger.info("[Background] Full extension state reset completed successfully.");
}

export function initializeMessageRouter() {

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Derive execution origin context surface and validate sender identity
  const surface = deriveSurface(sender);
  if (surface === "unknown") {
    securityMetrics.rejectedMessages++;
    logSecurityEvent(
      "REJECTED_UNKNOWN_SURFACE",
      "unknown",
      `Connection blocked. Sender ID: ${sender.id ?? "none"}, URL: ${sender.url ?? "none"}`
    );
    logger.warn(`[Background Security] Rejected message from untrusted surface. Sender URL: ${sender.url}`);
    return false;
  }

  // 2. Structurally validate message schema shape and protocol version
  if (!isRuntimeMessage(message)) {
    logSecurityEvent(
      "REJECTED_MALFORMED_SCHEMA",
      surface,
      `Payload failed schema validation type-guards.`
    );
    logger.warn(`[Background Security] Malformed payload rejected from surface: ${surface}`);
    sendResponse({ success: false, error: "Access denied. Malformed message payload." });
    return false;
  }

  const msg = message as RuntimeMessage;

  // 3. Enforce capabilities access policies (Deny-by-Default)
  const allowedSurfaces = (MESSAGE_CAPABILITIES as Record<string, readonly string[]>)[msg.type];
  if (!allowedSurfaces || !allowedSurfaces.includes(surface)) {
    securityMetrics.privilegeViolations++;
    logSecurityEvent(
      "REJECTED_PRIVILEGE_VIOLATION",
      surface,
      `Action '${msg.type}' requires privileged access. Allowed: [${allowedSurfaces ? allowedSurfaces.join(", ") : "none"}]`,
      msg.type
    );
    logger.error(
      `[Background Security] Privilege violation: surface '${surface}' attempted action '${msg.type}'`
    );
    sendResponse({ success: false, error: `Access denied. Unauthorized context surface '${surface}'.` });
    return false;
  }

  // 4. Privileged command route execution
  if (msg.type === "GET_ACTIVE_SESSION") {
    const active = engine.getActiveSession();
    const response: ActiveSessionResponse = {
      activeSession: active ? { domain: active.domain, startTime: active.startTime } : null
    };
    sendResponse(response);
    return false; // Synchronous response
  }

  if (msg.type === "GET_TODAY_STATS") {
    // Aggregation uses async DB call — return true to signal asynchronous response
    getLiveTodayStats()
      .then((stats) => {
        sendResponse(stats);
      })
      .catch((err) => {
        logger.error("[Background] Failed to aggregate live today stats", err);
        // Fail-safe empty stats payload
        sendResponse({
          activeSession: null,
          totalDurationMs: 0,
          uniqueDomainsCount: 0,
          topDomains: []
        } as TodayStatsResponse);
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "GET_POPUP_SNAPSHOT") {
    const active = engine.getActiveSession();
    const paused = engine.getPaused();
    const activePayload = active ? { domain: active.domain, startTime: active.startTime } : null;

    getLivePopupSnapshot(activePayload, paused)
      .then((snapshot) => {
        sendResponse(snapshot);
      })
      .catch((err) => {
        logger.error("[Background] Failed to generate popup snapshot", err);
        sendResponse({
          trackingPaused: paused,
          activeSession: null,
          todayTotals: { totalDurationMs: 0, totalVisits: 0, uniqueDomainsCount: 0 },
          topDomains: [],
          snapshotGeneratedAt: Date.now()
        } as PopupSnapshotResponse);
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "GET_HISTORICAL_STATS") {
    const active = engine.getActiveSession();
    const paused = engine.getPaused();
    const activePayload = active ? { domain: active.domain, startTime: active.startTime } : null;

    if (typeof msg.startMs !== "number" || typeof msg.endMs !== "number") {
      sendResponse({
        trackingPaused: paused,
        metrics: {
          totalDurationMs: 0,
          totalVisits: 0,
          uniqueDomainsCount: 0,
          averageSessionMs: 0,
          focusHours: 0,
          productiveDurationMs: 0,
          distractingDurationMs: 0,
          neutralDurationMs: 0,
          unknownDurationMs: 0,
          productivityScore: 0,
          metricsVersion: 1
        },
        timeline: [],
        topDomains: [],
        snapshotGeneratedAt: Date.now()
      } as HistoricalStatsResponse);
      return false;
    }

    handleGetHistoricalStats(msg.startMs, msg.endMs, activePayload, paused)
      .then((res) => {
        sendResponse(res);
      })
      .catch((err) => {
        logger.error("[Background] Failed to aggregate historical range", err);
        sendResponse({
          trackingPaused: paused,
          metrics: {
            totalDurationMs: 0,
            totalVisits: 0,
            uniqueDomainsCount: 0,
            averageSessionMs: 0,
            focusHours: 0,
            productiveDurationMs: 0,
            distractingDurationMs: 0,
            neutralDurationMs: 0,
            unknownDurationMs: 0,
            productivityScore: 0,
            metricsVersion: 1
          },
          timeline: [],
          topDomains: [],
          snapshotGeneratedAt: Date.now()
        } as HistoricalStatsResponse);
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "GET_DOMAIN_INTERVALS") {
    if (typeof msg.startMs !== "number" || typeof msg.endMs !== "number" || typeof msg.domain !== "string") {
      sendResponse({ domain: msg.domain || "", intervals: [] } as DomainIntervalsResponse);
      return false;
    }

    getActivityRecordsInRange(msg.startMs, msg.endMs)
      .then((records) => {
        const domainRecords = records.filter(r => r.domain === msg.domain);
        
        // Check if there's an active session for this domain that should be included
        const active = engine.getActiveSession();
        if (active && active.domain === msg.domain && active.startTime <= msg.endMs && active.startTime >= msg.startMs) {
           domainRecords.push({
             sessionId: active.sessionId,
             domain: active.domain,
             startTime: active.startTime,
             endTime: Date.now(),
             durationMs: Date.now() - active.startTime,
             terminationReason: "idle", // Placeholder for ongoing session
             createdAt: Date.now(),
             updatedAt: Date.now(),
             schemaVersion: 1
           });
        }
        
        sendResponse({
          domain: msg.domain,
          intervals: domainRecords
        } as DomainIntervalsResponse);
      })
      .catch((err) => {
        logger.error("[Background] Failed to get domain intervals", err);
        sendResponse({ domain: msg.domain, intervals: [] } as DomainIntervalsResponse);
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "GET_CACHE_METRICS") {
    sendResponse({
      metrics: cacheMetrics,
      eventsLog: cacheEventsLog.get(),
      maintenanceLog: maintenanceEventsLog.get(),
      historicalCacheSize: historicalSnapshotCache.size,
      historicalCacheKeys: Array.from(historicalSnapshotCache.keys())
    });
    return false; // Synchronous response
  }

  if (msg.type === "GET_SECURITY_METRICS") {
    sendResponse({
      metrics: securityMetrics,
      eventsLog: securityEventsLog.get()
    });
    return false; // Synchronous response
  }

  if (msg.type === "GET_TRACKING_STATUS") {
    sendResponse({
      trackingPaused: engine.getPaused()
    });
    return false; // Synchronous response
  }

  if (msg.type === "BROADCAST_RULES_UPDATED") {
    getCustomRules()
      .then((rules) => {
        classifier.compileRules(rules);
        invalidateAllCaches();
      })
      .catch(() => {});
    return false; // Synchronous acknowledgment
  }

  if (msg.type === "GET_PRODUCTIVITY_RULES") {
    getCustomRules()
      .then((customRules) => {
        sendResponse({
          success: true,
          customRules,
          defaultRules: DEFAULT_RULES
        });
      })
      .catch((err) => {
        logger.error("[Background] Failed to get productivity rules", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "SAVE_PRODUCTIVITY_RULES") {
    if (!Array.isArray(msg.rules)) {
      sendResponse({ success: false, error: "Rules payload must be a valid array." });
      return false;
    }
    const rulesToSave = msg.rules;
    saveCustomRules(rulesToSave)
      .then((res) => {
        if (res.success) {
          classifier.compileRules(rulesToSave);
          invalidateAllCaches();
        }
        sendResponse(res);
      })
      .catch((err) => {
        logger.error("[Background] Failed to save productivity rules", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "RESET_PRODUCTIVITY_RULES") {
    saveCustomRules([])
      .then((res) => {
        if (res.success) {
          classifier.compileRules([]);
          invalidateAllCaches();
        }
        sendResponse(res);
      })
      .catch((err) => {
        logger.error("[Background] Failed to reset productivity rules", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "TOGGLE_TRACKING") {
    const desiredState = !!msg.paused;
    engine.setPaused(desiredState)
      .then(() => {
        invalidateTodayCache();
        sendResponse({ success: true, trackingPaused: desiredState });
      })
      .catch((err) => {
        logger.error("[Background] Failed to toggle tracking engine paused state", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "PURGE_ALL_DATA") {
    resetExtensionState()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((err) => {
        logger.error("[Background] Failed to execute extension state purge:", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }

  // Pomodoro Handlers
  if (msg.type === "GET_POMODORO_STATE") {
    pomodoroEngine.getState().then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === "START_POMODORO") {
    pomodoroEngine.startTimer(msg.phase).then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === "PAUSE_POMODORO") {
    pomodoroEngine.pauseTimer().then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === "RESUME_POMODORO") {
    pomodoroEngine.resumeTimer().then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === "STOP_POMODORO") {
    pomodoroEngine.stopTimer().then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === "GET_POMODORO_SETTINGS") {
    pomodoroEngine.getSettings().then((settings) => {
      sendResponse(settings);
    });
    return true;
  }

  if (msg.type === "SAVE_POMODORO_SETTINGS") {
    pomodoroEngine.saveSettings(msg.settings).then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  if (msg.type === "GET_TIME_LIMIT_RULES") {
    getTimeLimitRules().then((rules) => {
      sendResponse({ success: true, rules });
    }).catch(err => {
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  if (msg.type === "SAVE_TIME_LIMIT_RULES") {
    saveTimeLimitRules(msg.rules).then((res) => {
      sendResponse(res);
    }).catch(err => {
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  if (msg.type === "BYPASS_TIME_LIMIT") {
    setTimeLimitBypass(msg.domain, msg.durationMs).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  if (msg.type === "GET_TIME_LIMIT_STATE") {
    (async () => {
      try {
        const rules = await getTimeLimitRules();
        const normalizedMsgDomain = msg.domain.replace(/^www\./, "");
        const rule = rules.find(r => r.domain.replace(/^www\./, "") === normalizedMsgDomain && r.enabled !== false);
        
        if (!rule) {
          sendResponse({ domain: msg.domain, isBlocked: false });
          return;
        }

        const bypasses = await getTimeLimitBypasses();
        const bypass = bypasses.find(b => b.domain.replace(/^www\./, "") === normalizedMsgDomain);
        const bypassedUntil = bypass ? bypass.bypassedUntil : undefined;

        // Calculate time spent today on this domain
        const active = engine.getActiveSession();
        const now = Date.now();
        const startOfDayMs = getStartOfDayTimestamp(getLocalTodayDateString(new Date(now)));
        const records = await getActivityRecordsInRange(startOfDayMs, now);
        
        let currentDurationMs = 0;
        for (const r of records) {
          if (r.domain.replace(/^www\./, "") === normalizedMsgDomain) {
            currentDurationMs += r.durationMs;
          }
        }
        
        if (active && !engine.getPaused()) {
          if (active.domain.replace(/^www\./, "") === normalizedMsgDomain) {
            currentDurationMs += Math.max(0, now - active.startTime);
          }
        }

        const isBlocked = currentDurationMs >= rule.maxDurationMs && (!bypassedUntil || now > bypassedUntil);

        sendResponse({
          domain: msg.domain,
          isBlocked,
          bypassedUntil,
          maxDurationMs: rule.maxDurationMs,
          currentDurationMs
        });
      } catch (err) {
        logger.error("[Background] Failed to get time limit state", err);
        sendResponse({ domain: msg.domain, isBlocked: false });
      }
    })();
    return true;
  }

  return false;
});
}
