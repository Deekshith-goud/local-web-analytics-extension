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
const mockWindowsGet = vi.fn()
const mockWindowsGetLastFocused = vi.fn()
const mockTabsGet = vi.fn()
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
    onStateChanged: { addListener: vi.fn() }
  },
  tabs: {
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    get: mockTabsGet,
    query: mockTabsQuery
  },
  windows: {
    onFocusChanged: { addListener: vi.fn() },
    get: mockWindowsGet,
    getLastFocused: mockWindowsGetLastFocused,
    WINDOW_ID_NONE: -1
  }
} as any

describe("Active Tab Tracking in TrackingEngine", () => {
  let engine: TrackingEngine

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new TrackingEngine()
    mockStorageGet.mockResolvedValue({})
    mockStorageSet.mockResolvedValue(undefined)
    mockStorageRemove.mockResolvedValue(undefined)
  })

  it("should switch domain when a new tab is activated", async () => {
    await engine.initialize()

    // Start with tab A
    mockTabsQuery.mockResolvedValue([
      { id: 1, url: "https://site-a.com", active: true, windowId: 10 }
    ])
    mockWindowsGetLastFocused.mockResolvedValue({ id: 10, focused: true })
    // @ts-ignore
    await engine.evaluateCurrentState()
    expect(engine.getActiveSession()?.domain).toBe("site-a.com")

    // Simulate switching to tab B
    mockWindowsGet.mockResolvedValue({ id: 10, focused: true })
    mockTabsGet.mockResolvedValue({
      id: 2,
      url: "https://site-b.com",
      active: true,
      windowId: 10
    })

    // @ts-ignore
    await engine.onTabActivated({ tabId: 2, windowId: 10 })

    expect(engine.getActiveSession()?.domain).toBe("site-b.com")
  })

  it("should stop tracking if window loses focus", async () => {
    await engine.initialize()

    // Start with tab A
    mockTabsQuery.mockResolvedValue([
      { id: 1, url: "https://site-a.com", active: true, windowId: 10 }
    ])
    mockWindowsGetLastFocused.mockResolvedValue({ id: 10, focused: true })
    // @ts-ignore
    await engine.evaluateCurrentState()
    expect(engine.getActiveSession()?.domain).toBe("site-a.com")

    // Simulate losing focus
    // @ts-ignore
    await engine.onWindowFocusChanged(chrome.windows.WINDOW_ID_NONE)

    expect(engine.getActiveSession()).toBeNull()
  })
})
