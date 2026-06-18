/**
 * dashboard.tsx
 *
 * Full-tab Analytics Dashboard Options Page (`tabs/dashboard.html`).
 * Provides high-density local-first insights using raw SVG chart grids,
 * screen-reader tables, and zero network calls.
 *
 * Features integrated local-first Productivity Classification manager.
 */

import React, { useEffect, useMemo, useState } from "react"

import "../styles/variables.css"
import "../styles/global.css"
import "../styles/animations.css"
import "../styles/components.css"
import "./dashboard.css"

import brandLogo from "url:~assets/icon.png"

import { usePomodoro } from "../hooks/usePomodoro"
import { useProductivityRules } from "../hooks/useProductivityRules"
import { useTheme } from "../hooks/useTheme"
import type { HistoricalStatsResponse, RuntimeMessage } from "../types/tracking"
import {
  getLocalTodayDateString,
  getStartOfDayTimestamp
} from "../utils/date-utils"
import { AboutTab } from "./dashboard/AboutTab"
import { AnalyticsTab } from "./dashboard/AnalyticsTab"
import { AddLimitModal } from "./dashboard/modals/AddLimitModal"
import { AddRuleModal } from "./dashboard/modals/AddRuleModal"
import { AllDomainsModal } from "./dashboard/modals/AllDomainsModal"
import { CriteriaModal } from "./dashboard/modals/CriteriaModal"
import { DomainIntervalsModal } from "./dashboard/modals/DomainIntervalsModal"
import { InfoModal, type InfoModalType } from "./dashboard/modals/InfoModal"
import { PurgeDataModal } from "./dashboard/modals/PurgeDataModal"
import { RulesTab } from "./dashboard/RulesTab"
import { SettingsTab } from "./dashboard/SettingsTab"
// Formatting utility for durations
import "../utils/format"

class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Dashboard caught error:", error, errorInfo)
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 40,
            color: "white",
            backgroundColor: "#b91c1c",
            minHeight: "100vh"
          }}
        >
          <h2>Dashboard Crashed!</h2>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 20 }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 20 }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, padding: 10 }}
          >
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

type RangeType = "today" | "7days" | "30days"

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<
    "analytics" | "rules" | "settings" | "pomodoro" | "about"
  >("analytics")
  const [range, setRange] = useState<RangeType>("7days")
  const [stats, setStats] = useState<HistoricalStatsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const {
    theme,
    iconStyle,
    blobStyle,
    blobEnabled,
    dailyLimitHours,
    retentionDays,
    handleThemeChange,
    handleIconStyleChange,
    handleBlobStyleChange,
    handleBlobEnabledChange,
    handleDailyLimitChange,
    handleRetentionDaysChange
  } = useTheme()

  // Settings & Database Purge modal states
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [showCriteriaModal, setShowCriteriaModal] = useState(false)
  const [showAllDomainsModal, setShowAllDomainsModal] = useState(false)
  const [showAddRuleModal, setShowAddRuleModal] = useState(false)
  const [showAddLimitModal, setShowAddLimitModal] = useState(false)
  const [infoModal, setInfoModal] = useState<InfoModalType | null>(null)

  const [hoveredTooltip, setHoveredTooltip] = useState<{
    x: number
    y: number
    title: string
    content: React.ReactNode
  } | null>(null)
  const [activeChart, setActiveChart] = useState<"total" | "productivity">(
    "total"
  )
  const [domainSort, setDomainSort] = useState<"duration" | "visits">(
    "duration"
  )

  const [selectedDomainModal, setSelectedDomainModal] = useState<string | null>(
    null
  )
  const {
    pomodoroState,
    pomodoroSettings,
    handlePomodoroAction,
    handlePomodoroSettingToggle,
    handlePomodoroDurationChange,
    handlePomodoroMessageChange,
    updateSettings
  } = usePomodoro(activeTab)

  // 1. Core range calculation
  const rangeTimestamps = useMemo(() => {
    const now = Date.now()
    const todayStr = getLocalTodayDateString()
    const todayStart = getStartOfDayTimestamp(todayStr)

    switch (range) {
      case "today":
        return { startMs: todayStart, endMs: now }
      case "7days":
        return { startMs: todayStart - 6 * 24 * 60 * 60 * 1000, endMs: now }
      case "30days":
        return { startMs: todayStart - 29 * 24 * 60 * 60 * 1000, endMs: now }
    }
  }, [range])

  // 2. Fetch stats asynchronously via Chrome runtime message passing
  const fetchStats = React.useCallback(() => {
    setIsLoading(true)
    chrome.runtime.sendMessage(
      {
        type: "GET_HISTORICAL_STATS",
        version: 1,
        startMs: rangeTimestamps.startMs,
        endMs: rangeTimestamps.endMs
      } satisfies RuntimeMessage,
      (response: HistoricalStatsResponse) => {
        setIsLoading(false)
        if (response && response.metrics) {
          setStats(response)
        } else {
          setStats(null)
        }
      }
    )
  }, [rangeTimestamps])

  const {
    customRules,
    defaultRules,
    timeLimitRules,
    isQuickClassifyMode,
    setIsQuickClassifyMode,
    quickClassifications,
    setQuickClassifications,
    handleAddCustomRule,
    handleSaveQuickClassifications,
    handleDeleteRule,
    handleResetRules,
    handleExportRules,
    handleImportRulesFile,
    handleAddTimeLimit,
    handleDeleteTimeLimit,
    handleToggleTimeLimit
  } = useProductivityRules(activeTab, fetchStats)

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // 4. Memoized Transform coordinate projections
  const totalTrackedDuration = stats?.metrics?.totalDurationMs ?? 0
  const isDatabaseEmpty = totalTrackedDuration === 0

  // ─── Productivity Overview Math ───
  const productiveMs = stats?.metrics?.productiveDurationMs ?? 0
  const distractingMs = stats?.metrics?.distractingDurationMs ?? 0
  const neutralMs = stats?.metrics?.neutralDurationMs ?? 0
  const unknownMs = stats?.metrics?.unknownDurationMs ?? 0
  const productivityScore = stats?.metrics?.productivityScore ?? 0

  const totalClassifiedMs = productiveMs + distractingMs + neutralMs + unknownMs

  const productivePct =
    totalClassifiedMs > 0 ? (productiveMs / totalClassifiedMs) * 100 : 0
  const distractingPct =
    totalClassifiedMs > 0 ? (distractingMs / totalClassifiedMs) * 100 : 0
  const neutralPct =
    totalClassifiedMs > 0 ? (neutralMs / totalClassifiedMs) * 100 : 0
  const unknownPct =
    totalClassifiedMs > 0 ? (unknownMs / totalClassifiedMs) * 100 : 0

  // Conic gradient angle calculation for score circle
  const scoreAngle = `${(productivityScore / 100) * 360}deg`

  // ─── Productivity Rules Processing ───
  const allDisplayRules = useMemo(() => {
    const defaultMapped = (defaultRules || []).map((r) => ({
      ...r,
      isCustom: false
    }))
    const customMapped = (customRules || []).map((r) => ({
      ...r,
      isCustom: true
    }))

    // Custom overrides override defaults of the same domain in display listing
    const customDomainSet = new Set((customRules || []).map((r) => r.domain))
    const filteredDefaults = defaultMapped.filter(
      (r) => !customDomainSet.has(r.domain)
    )

    return [...customMapped, ...filteredDefaults].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority
      }
      return a.domain.localeCompare(b.domain)
    })
  }, [customRules, defaultRules])

  // ─── Form Submission Handlers ───
  const handleEditRule = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
    setShowAddRuleModal(true)
  }

  const handleImportRules = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const res = await handleImportRulesFile(file)
    if (res.success) {
      alert("Rules and Time Limits imported successfully!")
    } else {
      alert(res.error || "Failed to import rules.")
    }
    e.target.value = "" // Reset file input
  }

  return (
    <DashboardErrorBoundary>
      <div className="dashboard-wrapper">
        {/* Animated Fluid Glass Background Blobs */}
        <div className="glass-blob-container" aria-hidden="true">
          <div className="glass-blob blob-purple"></div>
          <div className="glass-blob blob-indigo"></div>
          <div className="glass-blob blob-cyan"></div>
        </div>

        {/* Header */}
        <header
          className="dashboard-header"
          role="banner"
          style={{ marginBottom: "28px", flexWrap: "nowrap", gap: "12px" }}
        >
          <div
            className="brand-section"
            style={{ flex: "0 1 auto", minWidth: "min-content" }}
          >
            <h1>
              <img
                src={brandLogo}
                alt="Logo"
                width="36"
                height="36"
                style={{ borderRadius: 8 }}
              />
              Local Browse Insights
            </h1>
            <p>Privacy-first. Secure local tracking dashboard.</p>
          </div>

          <nav
            className="dashboard-nav"
            aria-label="Main sections"
            style={{ flexShrink: 0 }}
          >
            <button
              className={`nav-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
              onClick={() => setActiveTab("analytics")}
            >
              Dashboard
            </button>
            <button
              className={`nav-tab-btn ${activeTab === "rules" ? "active" : ""}`}
              onClick={() => setActiveTab("rules")}
            >
              Productivity
            </button>
            <button
              className={`nav-tab-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              Settings
            </button>
            <button
              className={`nav-tab-btn ${activeTab === "about" ? "active" : ""}`}
              onClick={() => setActiveTab("about")}
            >
              About
            </button>
          </nav>

          <div
            style={{
              flex: "0 1 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              minWidth: "min-content",
              gap: "20px"
            }}
          >
            {/* Filter group hidden when not on analytics tab */}
            <nav
              aria-label="Dashboard range selection"
              style={{
                visibility: activeTab === "analytics" ? "visible" : "hidden",
                transition: "opacity 0.2s",
                opacity: activeTab === "analytics" ? 1 : 0
              }}
            >
              <div className="filter-group" style={{ whiteSpace: "nowrap" }}>
                <button
                  className={`filter-btn ${range === "today" ? "active" : ""}`}
                  onClick={() => setRange("today")}
                  aria-pressed={range === "today"}
                  tabIndex={activeTab === "analytics" ? 0 : -1}
                  style={{ whiteSpace: "nowrap" }}
                >
                  Today
                </button>
                <button
                  className={`filter-btn ${range === "7days" ? "active" : ""}`}
                  onClick={() => setRange("7days")}
                  aria-pressed={range === "7days"}
                  tabIndex={activeTab === "analytics" ? 0 : -1}
                  style={{ whiteSpace: "nowrap" }}
                >
                  Last 7 Days
                </button>
                <button
                  className={`filter-btn ${range === "30days" ? "active" : ""}`}
                  onClick={() => setRange("30days")}
                  aria-pressed={range === "30days"}
                  tabIndex={activeTab === "analytics" ? 0 : -1}
                  style={{ whiteSpace: "nowrap" }}
                >
                  Last 30 Days
                </button>
              </div>
            </nav>

            {/* Theme toggler pushed to absolute right edge */}
            <button
              onClick={() =>
                handleThemeChange(theme === "dark" ? "light" : "dark")
              }
              style={{
                marginLeft: "auto",
                background:
                  theme === "dark" ? "rgba(255,255,255,0.1)" : "var(--surface)",
                border:
                  theme === "dark"
                    ? "1px solid rgba(255,255,255,0.2)"
                    : "1px solid var(--border)",
                borderRadius: "24px",
                width: "64px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                position: "relative",
                cursor: "pointer",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                padding: "0 4px",
                overflow: "hidden",
                flexShrink: 0
              }}
              aria-label="Toggle Theme"
              title="Toggle Theme"
            >
              <div
                style={{
                  position: "absolute",
                  left: theme === "dark" ? "32px" : "4px",
                  width: "24px",
                  height: "24px",
                  background: theme === "dark" ? "#1e293b" : "#fff",
                  borderRadius: "50%",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2
                }}
              >
                {theme === "dark" ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="#60a5fa"
                    stroke="#60a5fa"
                    strokeWidth="2"
                  >
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="#f59e0b"
                    stroke="#f59e0b"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "0 4px",
                  zIndex: 1,
                  color: "var(--text-secondary)"
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              </div>
            </button>
          </div>
        </header>

        {/* Fresh install Onboarding preset displays */}
        {!isLoading && isDatabaseEmpty && activeTab === "analytics" && (
          <section
            className="welcome-preset"
            aria-label="First-time installation guide"
          >
            <div className="welcome-info">
              <h2>👋 Welcome to your Browse Analytics Dashboard!</h2>
              <p>
                Your tracking engine is fully initialized. Start browsing your
                favorite websites to capture premium statistics safely
                on-device.
              </p>
            </div>
            <div className="status-indicator">
              <span className="status-dot-indicator" aria-hidden="true"></span>
              <span>Real-time tracking active</span>
            </div>
          </section>
        )}

        {/* TABS CONTROLLER CONTAINER */}
        {activeTab === "analytics" && (
          <AnalyticsTab
            isLoading={isLoading}
            isDatabaseEmpty={isDatabaseEmpty}
            totalTrackedDuration={totalTrackedDuration}
            stats={stats}
            range={range}
            domainSort={domainSort}
            setDomainSort={setDomainSort}
            activeChart={activeChart}
            setActiveChart={setActiveChart}
            hoveredTooltip={hoveredTooltip}
            setHoveredTooltip={setHoveredTooltip}
            setShowAllDomainsModal={setShowAllDomainsModal}
            setShowCriteriaModal={setShowCriteriaModal}
            iconStyle={iconStyle}
            productivityScore={productivityScore}
            scoreAngle={scoreAngle}
            productivePct={productivePct}
            distractingPct={distractingPct}
            neutralPct={neutralPct}
            unknownPct={unknownPct}
            productiveMs={productiveMs}
            distractingMs={distractingMs}
            neutralMs={neutralMs}
            unknownMs={unknownMs}
            fetchDomainIntervals={(domain) => setSelectedDomainModal(domain)}
          />
        )}

        {activeTab === "rules" &&
          (!pomodoroState || !pomodoroSettings ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "200px",
                color: "var(--text-subtle)"
              }}
            >
              Loading productivity settings...
            </div>
          ) : (
            <RulesTab
              pomodoroState={pomodoroState}
              pomodoroSettings={pomodoroSettings}
              handlePomodoroAction={handlePomodoroAction}
              handlePomodoroSettingToggle={handlePomodoroSettingToggle}
              handlePomodoroDurationChange={handlePomodoroDurationChange}
              handlePomodoroMessageChange={handlePomodoroMessageChange}
              setPomodoroSettings={updateSettings}
              setInfoModal={setInfoModal}
              setShowAddRuleModal={setShowAddRuleModal}
              setShowAddLimitModal={setShowAddLimitModal}
              allDisplayRules={allDisplayRules}
              handleEditRule={handleEditRule}
              handleDeleteRule={handleDeleteRule}
              handleResetRules={handleResetRules}
              timeLimitRules={timeLimitRules}
              handleToggleTimeLimit={handleToggleTimeLimit}
              handleDeleteTimeLimit={handleDeleteTimeLimit}
            />
          ))}

        {activeTab === "settings" && (
          <SettingsTab
            iconStyle={iconStyle}
            handleIconStyleChange={handleIconStyleChange}
            dailyLimitHours={dailyLimitHours}
            handleDailyLimitChange={handleDailyLimitChange}
            blobEnabled={blobEnabled}
            handleBlobEnabledChange={handleBlobEnabledChange}
            blobStyle={blobStyle}
            handleBlobStyleChange={handleBlobStyleChange}
            retentionDays={retentionDays}
            handleRetentionDaysChange={handleRetentionDaysChange}
            handleExportRules={handleExportRules}
            handleImportRules={handleImportRules}
            setShowPurgeModal={setShowPurgeModal}
          />
        )}

        {activeTab === "about" && <AboutTab />}

        <PurgeDataModal
          isOpen={showPurgeModal}
          onClose={() => setShowPurgeModal(false)}
          onPurgeComplete={fetchStats}
        />
        <CriteriaModal
          isOpen={showCriteriaModal}
          onClose={() => setShowCriteriaModal(false)}
          iconStyle={iconStyle}
        />
        <AllDomainsModal
          isOpen={showAllDomainsModal}
          onClose={() => setShowAllDomainsModal(false)}
          stats={stats}
          isQuickClassifyMode={isQuickClassifyMode}
          setIsQuickClassifyMode={setIsQuickClassifyMode}
          handleSaveQuickClassifications={handleSaveQuickClassifications}
          fetchDomainIntervals={(domain) => setSelectedDomainModal(domain)}
          range={range}
          quickClassifications={quickClassifications}
          setQuickClassifications={setQuickClassifications}
        />
        <DomainIntervalsModal
          domain={selectedDomainModal}
          onClose={() => setSelectedDomainModal(null)}
          initialRange={range}
        />
        <AddRuleModal
          isOpen={showAddRuleModal}
          onClose={() => setShowAddRuleModal(false)}
          onAddRule={handleAddCustomRule}
        />
        <AddLimitModal
          isOpen={showAddLimitModal}
          onClose={() => setShowAddLimitModal(false)}
          onAddLimit={handleAddTimeLimit}
        />
        <InfoModal infoType={infoModal} onClose={() => setInfoModal(null)} />

        {/* Dashboard Footer */}
        <footer className="dashboard-footer" style={{ marginTop: "auto", borderTop: "1px solid var(--border-subtle)", padding: "16px 30px" }}>
          <div className="status-indicator">
            <span className={`status-dot-indicator ${stats?.trackingPaused ? "paused" : ""}`} aria-hidden="true"></span>
            <span>{stats?.trackingPaused ? "Tracking paused" : "Real-time tracking active"}</span>
          </div>
          <div>
            Data freshness: Last synced locally at {stats?.snapshotGeneratedAt ? new Date(stats.snapshotGeneratedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : "Unknown"}
            <span style={{ marginLeft: "16px", opacity: 0.7 }}>v{chrome.runtime.getManifest ? chrome.runtime.getManifest().version : "1.0.0"}</span>
          </div>
        </footer>
      </div>
    </DashboardErrorBoundary>
  )
}
