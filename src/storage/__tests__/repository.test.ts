import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "../db"
import { pruneOldActivities } from "../repository"

// Mock dependencies
vi.mock("../db", () => ({
  db: {
    isOpen: vi.fn().mockReturnValue(true),
    activities: {
      where: vi.fn().mockReturnThis(),
      below: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      primaryKeys: vi.fn(),
      bulkDelete: vi.fn()
    }
  }
}))

vi.mock("../../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock("../../utils/scheduler", () => ({
  cooperativeYield: vi.fn().mockResolvedValue(undefined)
}))

describe("Repository - pruneOldActivities", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should not delete anything if no old activities exist", async () => {
    ;((db.activities as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).primaryKeys as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

    const result = await pruneOldActivities(90, 500)

    expect(result.rowsDeleted).toBe(0)
    expect(result.batchesExecuted).toBe(0)
    expect(db.activities.bulkDelete).not.toHaveBeenCalled()
  })

  it("should delete old activities in chunks", async () => {
    // Mock the first batch returning 500 keys, the second returning 10 keys, then 0.
    const batch1 = Array(500).fill("session-id")
    const batch2 = Array(10).fill("session-id")

    ;((db.activities as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).primaryKeys as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce([])

    const result = await pruneOldActivities(30, 500)

    expect(result.rowsDeleted).toBe(510)
    expect(result.batchesExecuted).toBe(2)
    expect(db.activities.bulkDelete).toHaveBeenCalledTimes(2)
    expect(db.activities.bulkDelete).toHaveBeenNthCalledWith(1, batch1)
    expect(db.activities.bulkDelete).toHaveBeenNthCalledWith(2, batch2)
  })

  it("should handle database errors gracefully", async () => {
    ;((db.activities as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).primaryKeys as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("DB Error")
    )

    const result = await pruneOldActivities(90, 500)

    expect(result.rowsDeleted).toBe(0)
    expect(result.batchesExecuted).toBe(0)
  })
})
