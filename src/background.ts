import { pomodoroEngine } from "./analytics/pomodoro-engine"
import { getCustomRules } from "./analytics/productivity-rules"
import {
  invalidateTodayCache,
  maintenanceEventsLog
} from "./background/cache-service"
import { classifier, engine } from "./background/engine-instance"
import { initializeMessageRouter } from "./background/message-router"
import { getLivePopupSnapshot } from "./background/stats-service"
import { drainStaging } from "./storage/drain-engine"
import { pruneOldActivities } from "./storage/repository"
import { logger } from "./utils/logger"

// Bootstrap asynchronous engines on service worker startup
;(async () => {
  try {
    await engine.initialize()

    // Broadcast a state sync to all tabs when a new tracking session begins.
    engine.events.on("session-started", () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs
              .sendMessage(tab.id, { type: "SYNC_REQUESTED", version: 1 })
              .catch(() => {})
          }
        })
      })
    })

    await pomodoroEngine.initialize()
    logger.info("[Background] All async engines initialized successfully.")
  } catch (err) {
    logger.error("[Background] Failed to initialize engines:", err)
  }
})()

// Initialize the message router for all communications
initializeMessageRouter()

// --- Debounced Drain ----------------------------------------------------------

const DRAIN_DEBOUNCE_MS = 5_000
let drainTimer: ReturnType<typeof setTimeout> | null = null

function scheduleDrain(): void {
  if (drainTimer !== null) {
    clearTimeout(drainTimer)
  }
  drainTimer = setTimeout(() => {
    drainTimer = null
    drainStaging().catch((e) => logger.error("Scheduled drain failed:", e))
  }, DRAIN_DEBOUNCE_MS)
}

// --- Reentrancy Locked Daily Incremental Maintenance Scheduler -------------------

let maintenanceInProgress = false

async function runMaintenance(): Promise<void> {
  if (maintenanceInProgress) {
    logger.debug(
      "[Background] Maintenance skipped: Compaction is already in progress."
    )
    return
  }

  try {
    const systemState = await new Promise<chrome.idle.IdleState>((resolve) => {
      chrome.idle.queryState(60, resolve)
    })

    if (systemState !== "idle" && systemState !== "locked") {
      logger.debug(
        "[Background] Deferring maintenance: System is currently active."
      )
      return
    }

    const storage = await chrome.storage.local.get([
      "maintenance:lastPrunedAt",
      "retentionDays"
    ])
    const lastPruned = storage["maintenance:lastPrunedAt"] as number | undefined
    const retentionDays =
      storage["retentionDays"] !== undefined
        ? (storage["retentionDays"] as number)
        : 90
    const now = Date.now()

    if (lastPruned && now - lastPruned < 24 * 60 * 60 * 1000) {
      logger.debug(
        "[Background] Compaction deferred: Database already pruned in last 24h."
      )
      return
    }

    if (retentionDays <= 0) {
      logger.info(
        "[Background] Data retention is set to Keep Forever. Skipping compaction."
      )
      return
    }

    logger.info(
      `[Background] System is idle. Executing daily database compaction (retention: ${retentionDays} days)...`
    )
    maintenanceInProgress = true
    const tStart = performance.now()

    const result = await pruneOldActivities(retentionDays, 500)

    const durationMs = performance.now() - tStart
    maintenanceInProgress = false

    await chrome.storage.local.set({ "maintenance:lastPrunedAt": now })
    maintenanceEventsLog.push({
      timestamp: now,
      durationMs,
      rowsDeleted: result.rowsDeleted,
      batchesExecuted: result.batchesExecuted,
      success: true
    })

    logger.info(
      `[Background] Compaction completed successfully: Pruned ${result.rowsDeleted} rows.`
    )
  } catch (err) {
    maintenanceInProgress = false
    logger.error("[Background] Maintenance compaction failed:", err)
    maintenanceEventsLog.push({
      timestamp: Date.now(),
      durationMs: 0,
      rowsDeleted: 0,
      batchesExecuted: 0,
      success: false
    })
  }
}

async function prewarmCache(): Promise<void> {
  logger.debug("[Background] Warming today stats cache...")
  try {
    const active = engine.getActiveSession()
    const paused = engine.getPaused()
    const activePayload = active
      ? { domain: active.domain, startTime: active.startTime }
      : null
    await getLivePopupSnapshot(activePayload, paused)
    logger.info("[Background] Today cache pre-warmed successfully.")
  } catch (err) {
    logger.error("[Background] Failed to pre-warm cache on worker wakeup:", err)
  }
}

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === "idle" || state === "locked") {
    await runMaintenance()
  }
})

// --- Engine + Drain Lifecycle -------------------------------------------------

async function initializeAndDrain(): Promise<void> {
  await engine.initialize()
  try {
    const customRules = await getCustomRules()
    classifier.compileRules(customRules)
    logger.info(
      `Productivity classifier compiled with ${customRules.length} custom rules.`
    )
  } catch (err) {
    logger.error("Failed to load custom rules on initialization:", err)
  }
  await pomodoroEngine.initialize()
  await drainStaging()
  await prewarmCache()
  await runMaintenance()
}

chrome.runtime.onInstalled.addListener(async () => {
  logger.info("Extension installed. Initializing tracking engine...")
  await initializeAndDrain()
})

chrome.runtime.onStartup.addListener(async () => {
  logger.info("Browser started. Initializing tracking engine...")
  await initializeAndDrain()
})

;(async () => {
  logger.info("Service worker awoke. Initializing tracking engine...")
  await initializeAndDrain()
})()

engine.events.on("session-started", () => {
  invalidateTodayCache()
})

engine.events.on("session-ended", () => {
  invalidateTodayCache()
  scheduleDrain()
})

chrome.runtime.onSuspend.addListener(() => {
  logger.info("Service worker suspending. Finalizing active session...")
  if (drainTimer !== null) {
    clearTimeout(drainTimer)
    drainTimer = null
  }
  engine.handleShutdown()
})
