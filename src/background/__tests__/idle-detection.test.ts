import { beforeEach, describe, expect, it, vi } from "vitest"

import { TrackingEngine } from "../../analytics/tracking-engine"

// Mock Dependencies
vi.mock("../../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock("../../storage/drain-engine", () => ({
  stageRecord: vi.fn().mockResolvedValue(undefined)
}))

// Mock Chrome APIs
const mockStorageGet = vi.fn()
const mockStorageSet = vi.fn()
const mockStorageRemove = vi.fn()
const mockWindowsGetLastFocused = vi.fn()
const mockTabsQuery = vi.fn()

global.chrome = {
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
      remove: mockStorageRemove
    }
  },
  idle: {
    setDetectionInterval: vi.fn(),
    onStateChanged: {
      addListener: vi.fn()
    }
  },
  tabs: {
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    query: mockTabsQuery
  },
  windows: {
    onFocusChanged: { addListener: vi.fn() },
    getLastFocused: mockWindowsGetLastFocused
  }
} as any

describe("Idle Detection in TrackingEngine", () => {
  let engine: TrackingEngine

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new TrackingEngine()
    mockStorageGet.mockResolvedValue({})
    mockStorageSet.mockResolvedValue(undefined)
    mockStorageRemove.mockResolvedValue(undefined)
  })

  it('should finalize session with reason "idle" when idle state triggers', async () => {
    await engine.initialize()

    // Force an active session
    mockTabsQuery.mockResolvedValue([
      { id: 1, url: "https://example.com", active: true, windowId: 10 }
    ])
    mockWindowsGetLastFocused.mockResolvedValue({ id: 10, focused: true })

    // @ts-ignore - internal method access for test
    await engine.evaluateCurrentState()
    expect(engine.getActiveSession()?.domain).toBe("example.com")

    // Trigger Idle
    // @ts-ignore
    await engine.onIdleStateChanged("idle")

    // Session should be cleared
    expect(engine.getActiveSession()).toBeNull()
  })

  it("should resume tracking when state becomes active again", async () => {
    await engine.initialize()

    // Trigger Active (simulate wake up)
    mockTabsQuery.mockResolvedValue([
      { id: 2, url: "https://github.com", active: true, windowId: 11 }
    ])
    mockWindowsGetLastFocused.mockResolvedValue({ id: 11, focused: true })

    // @ts-ignore
    await engine.onIdleStateChanged("active")

    // Should have evaluated state and started tracking github
    expect(engine.getActiveSession()?.domain).toBe("github.com")
  })
})
