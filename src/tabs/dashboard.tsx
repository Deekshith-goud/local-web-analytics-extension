/**
 * dashboard.tsx
 *
 * Full-tab Analytics Dashboard Options Page (`tabs/dashboard.html`).
 * Provides high-density local-first insights using raw SVG chart grids,
 * screen-reader tables, and zero network calls.
 *
 * Features integrated local-first Productivity Classification manager.
 */

import React, { useEffect, useState, useMemo } from "react";
import "./dashboard.css";
import brandLogo from "url:~assets/icon.png";
import { getLocalTodayDateString, getStartOfDayTimestamp } from "../utils/date-utils";
import { downsampleTimeline, computeBarCoordinates, computeLineCoordinates } from "../analytics/selectors/transforms";
import { validateProductivityRule, type ProductivityRule, type ProductivityCategory } from "../analytics/productivity-rules";
import type { HistoricalStatsResponse, RuntimeMessage } from "../types/tracking";

class DashboardErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Dashboard caught error:", error, errorInfo);
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: "white", backgroundColor: "#b91c1c", minHeight: "100vh" }}>
          <h2>Dashboard Crashed!</h2>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 20 }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 20 }}>{this.state.error?.stack}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: 10 }}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Formatting utility for durations
function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  
  if (hrs > 0) {
    const remainingMins = min % 60;
    return `${hrs}h ${remainingMins}m`;
  }
  return `${min}m`;
}

function getProductivityLabel(score: number): string {
  if (score >= 90) return "Highly Productive";
  if (score >= 70) return "Focus Mode Stable";
  if (score >= 50) return "Moderately Productive";
  if (score >= 30) return "Mildly Distracted";
  if (score >= 15) return "Highly Distracted";
  return "Critically Distracted";
}

function renderScoreIllustration(score: number) {
  if (score >= 90) {
    // Clean Highly Productive
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <defs>
          <radialGradient id="prod-glow-90" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#prod-glow-90)"/>
        <circle cx="32" cy="32" r="16" fill="#10b981" fillOpacity="0.1" stroke="#10b981" strokeWidth="2.5" />
        <path d="M24 30 Q27 26 30 30" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M34 30 Q37 26 40 30" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M26 38 Q32 44 38 38" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M48 16 L50 20 L54 22 L50 24 L48 28 L46 24 L42 22 L46 20 Z" fill="#10b981" opacity="0.6" />
      </svg>
    );
  } else if (score >= 70) {
    // Clean Focus Mode Stable
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <defs>
          <radialGradient id="prod-glow-70" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#prod-glow-70)"/>
        <circle cx="32" cy="32" r="16" fill="#22c55e" fillOpacity="0.1" stroke="#22c55e" strokeWidth="2.5" />
        <circle cx="27" cy="29" r="2" fill="#22c55e" />
        <circle cx="37" cy="29" r="2" fill="#22c55e" />
        <path d="M27 38 Q32 42 37 38" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    );
  } else if (score >= 50) {
    // Clean Moderately Productive
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <defs>
          <radialGradient id="prod-glow-50" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#prod-glow-50)"/>
        <circle cx="32" cy="32" r="16" fill="#3b82f6" fillOpacity="0.1" stroke="#3b82f6" strokeWidth="2.5" />
        <circle cx="27" cy="29" r="2" fill="#3b82f6" />
        <circle cx="37" cy="29" r="2" fill="#3b82f6" />
        <path d="M28 38 L36 38" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    );
  } else if (score >= 30) {
    // Clean Mildly Distracted
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <defs>
          <radialGradient id="prod-glow-30" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#prod-glow-30)"/>
        <circle cx="32" cy="32" r="16" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="2.5" />
        <circle cx="26" cy="29" r="2" fill="#f59e0b" />
        <circle cx="36" cy="29" r="2" fill="#f59e0b" />
        <path d="M28 38 Q32 36 36 38" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    );
  } else if (score >= 15) {
    // Clean Highly Distracted
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <defs>
          <radialGradient id="prod-glow-15" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#prod-glow-15)"/>
        <circle cx="32" cy="32" r="16" fill="#ef4444" fillOpacity="0.1" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="4 4" />
        <path d="M25 27 L29 31 M29 27 L25 31" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M35 27 L39 31 M39 27 L35 31" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 39 Q32 35 36 39" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    );
  } else {
    // Clean Critically Distracted
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <defs>
          <radialGradient id="prod-glow-0" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#prod-glow-0)"/>
        <circle cx="32" cy="32" r="16" fill="#dc2626" fillOpacity="0.1" stroke="#dc2626" strokeWidth="3" />
        <path d="M25 27 L29 31 M29 27 L25 31" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
        <path d="M35 27 L39 31 M39 27 L35 31" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 40 Q32 34 36 40" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="48" cy="16" r="8" fill="#dc2626" />
        <path d="M48 11 L48 17 M48 20 L48 21" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
}

type RangeType = "today" | "7days" | "30days";

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<"analytics" | "rules" | "settings">("analytics");
  const [range, setRange] = useState<RangeType>("7days");
  const [stats, setStats] = useState<HistoricalStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light" | "system">("system");

  // Load and apply theme on startup
  useEffect(() => {
    chrome.storage.local.get(["theme"], (res) => {
      const savedTheme = res.theme || "system";
      setTheme(savedTheme);
      applyTheme(savedTheme);
    });
  }, []);

  const applyTheme = (targetTheme: "dark" | "light" | "system") => {
    let active: string;
    if (targetTheme === "system") {
      active = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      active = targetTheme;
    }
    document.documentElement.setAttribute("data-theme", active);
  };

  const handleThemeChange = (newTheme: "dark" | "light" | "system") => {
    setTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
    applyTheme(newTheme);
  };

  // Keep theme updated if system scheme changes and setting is system
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [theme]);

  // Settings & Database Purge modal states
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [isPurging, setIsPurging] = useState(false);

  // Productivity Rules Tab States
  const [customRules, setCustomRules] = useState<ProductivityRule[]>([]);
  const [defaultRules, setDefaultRules] = useState<ProductivityRule[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [ruleTypeFilter, setRuleTypeFilter] = useState<"all" | "default" | "custom">("all");

  // Form States for custom rules creation
  const [newDomain, setNewDomain] = useState("");
  const [newCategory, setNewCategory] = useState<ProductivityCategory>("productive");
  const [newPriority, setNewPriority] = useState("10");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // 1. Core range calculation
  const rangeTimestamps = useMemo(() => {
    const now = Date.now();
    const todayStr = getLocalTodayDateString();
    const todayStart = getStartOfDayTimestamp(todayStr);

    switch (range) {
      case "today":
        return { startMs: todayStart, endMs: now };
      case "7days":
        return { startMs: todayStart - 6 * 24 * 60 * 60 * 1000, endMs: now };
      case "30days":
        return { startMs: todayStart - 29 * 24 * 60 * 60 * 1000, endMs: now };
    }
  }, [range]);

  // 2. Fetch stats asynchronously via Chrome runtime message passing
  const fetchStats = React.useCallback(() => {
    setIsLoading(true);
    chrome.runtime.sendMessage(
      {
        type: "GET_HISTORICAL_STATS",
        version: 1,
        startMs: rangeTimestamps.startMs,
        endMs: rangeTimestamps.endMs
      } satisfies RuntimeMessage,
      (response: HistoricalStatsResponse) => {
        setIsLoading(false);
        if (response && response.metrics) {
          setStats(response);
        } else {
          setStats(null);
        }
      }
    );
  }, [rangeTimestamps]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 3. Fetch rules at mount or when active tab switches to "rules"
  const fetchRules = React.useCallback(() => {
    chrome.runtime.sendMessage(
      { type: "GET_PRODUCTIVITY_RULES", version: 1 } satisfies RuntimeMessage,
      (response: { success: boolean; customRules: ProductivityRule[]; defaultRules: ProductivityRule[]; error?: string }) => {
        if (response && response.success) {
          setCustomRules(response.customRules);
          setDefaultRules(response.defaultRules);
        }
      }
    );
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules, activeTab]);

  // 4. Memoized Transform coordinate projections
  const totalTrackedDuration = stats?.metrics?.totalDurationMs ?? 0;
  const isDatabaseEmpty = totalTrackedDuration === 0;

  // Downsampled timeline data for coordinates drawing
  // For "today": use 24 hourly buckets from background (skip downsample)
  // For multi-day: use daily timeline downsampled to max 14 columns
  const processedTimeline = useMemo(() => {
    if (!stats) return [];
    if (range === "today") {
      // Use the pre-built 24-hour buckets from background
      if (stats.hourlyTimeline && stats.hourlyTimeline.length > 0) {
        // Only show hours 6am–current hour for a cleaner chart (skip empty early morning)
        const now = new Date();
        const currentHour = now.getHours();
        return stats.hourlyTimeline.slice(0, currentHour + 1);
      }
      return [];
    }
    if (!stats.timeline) return [];
    return downsampleTimeline(stats.timeline, 14);
  }, [stats, range]);

  // Pure SVG coordinate points (memoized to prevent resize layout thrashing)
  const barChartCoordinates = useMemo(() => {
    return computeBarCoordinates(processedTimeline, 720, 240, {
      top: 20,
      bottom: 30,
      left: 40,
      right: 20
    });
  }, [processedTimeline]);

  const lineChartCoordinates = useMemo(() => {
    return computeLineCoordinates(processedTimeline, 720, 240, {
      top: 20,
      bottom: 30,
      left: 40,
      right: 20
    });
  }, [processedTimeline]);

  // Domain table limits (virtual limit to top 15 domains maximum to prevent DOM overhead)
  const filteredDomains = useMemo(() => {
    if (!stats || !stats.topDomains) return [];
    return stats.topDomains.slice(0, 15);
  }, [stats]);

  const maxDomainMs = useMemo(() => {
    if (filteredDomains.length === 0) return 0;
    return Math.max(...filteredDomains.map(d => d.durationMs), 1);
  }, [filteredDomains]);

  // Max duration for the chart Y-axis
  const maxTimelineMs = useMemo(() => {
    if (processedTimeline.length === 0) return 1000;
    return Math.max(...processedTimeline.map(t => t.durationMs), 1000);
  }, [processedTimeline]);

  const formatAxisLabel = (ms: number) => {
    if (ms <= 1000) return "0m"; // close to zero
    const minutes = Math.round(ms / 60000);
    if (minutes >= 60) return `${(ms / 3600000).toFixed(1)}h`;
    return `${minutes}m`;
  };

  // ─── Productivity Overview Math ───
  const productiveMs = stats?.metrics?.productiveDurationMs ?? 0;
  const distractingMs = stats?.metrics?.distractingDurationMs ?? 0;
  const neutralMs = stats?.metrics?.neutralDurationMs ?? 0;
  const unknownMs = stats?.metrics?.unknownDurationMs ?? 0;
  const productivityScore = stats?.metrics?.productivityScore ?? 0;

  const totalClassifiedMs = productiveMs + distractingMs + neutralMs + unknownMs;

  const productivePct = totalClassifiedMs > 0 ? (productiveMs / totalClassifiedMs) * 100 : 0;
  const distractingPct = totalClassifiedMs > 0 ? (distractingMs / totalClassifiedMs) * 100 : 0;
  const neutralPct = totalClassifiedMs > 0 ? (neutralMs / totalClassifiedMs) * 100 : 0;
  const unknownPct = totalClassifiedMs > 0 ? (unknownMs / totalClassifiedMs) * 100 : 0;

  // Conic gradient angle calculation for score circle
  const scoreAngle = `${(productivityScore / 100) * 360}deg`;

  // ─── Productivity Rules Processing ───
  const allDisplayRules = useMemo(() => {
    const defaultMapped = (defaultRules || []).map(r => ({ ...r, isCustom: false }));
    const customMapped = (customRules || []).map(r => ({ ...r, isCustom: true }));
    
    // Custom overrides override defaults of the same domain in display listing
    const customDomainSet = new Set((customRules || []).map(r => r.domain));
    const filteredDefaults = defaultMapped.filter(r => !customDomainSet.has(r.domain));

    return [...customMapped, ...filteredDefaults].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.domain.localeCompare(b.domain);
    });
  }, [customRules, defaultRules]);

  const searchedRules = useMemo(() => {
    return allDisplayRules.filter(rule => {
      const matchesSearch = rule.domain.includes(searchQuery.toLowerCase());
      const matchesFilter = 
        ruleTypeFilter === "all" ||
        (ruleTypeFilter === "custom" && rule.isCustom) ||
        (ruleTypeFilter === "default" && !rule.isCustom);
      return matchesSearch && matchesFilter;
    });
  }, [allDisplayRules, searchQuery, ruleTypeFilter]);

  // ─── Form Submission Handlers ───
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const priorityInt = parseInt(newPriority, 10);
    const candidateRule: ProductivityRule = {
      domain: newDomain.trim().toLowerCase(),
      category: newCategory,
      priority: isNaN(priorityInt) ? 1 : priorityInt,
      createdAt: Date.now()
    };

    // Strict validation
    const validationError = validateProductivityRule(candidateRule);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    // Check for duplicates in customRules list
    const updatedRules = customRules.filter(r => r.domain !== candidateRule.domain);
    updatedRules.push(candidateRule);

    chrome.runtime.sendMessage(
      {
        type: "SAVE_PRODUCTIVITY_RULES",
        version: 1,
        rules: updatedRules
      } satisfies RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        if (res && res.success) {
          setCustomRules(updatedRules);
          setFormSuccess(`Rule for '${candidateRule.domain}' added successfully.`);
          setNewDomain("");
          setNewPriority("10");
          fetchStats(); // Update live statistics metrics on rule change
        } else {
          setFormError(res?.error ?? "Failed to save rule in storage.");
        }
      }
    );
  };

  const handleDeleteRule = (domain: string) => {
    const updatedRules = customRules.filter(r => r.domain !== domain);

    chrome.runtime.sendMessage(
      {
        type: "SAVE_PRODUCTIVITY_RULES",
        version: 1,
        rules: updatedRules
      } satisfies RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        if (res && res.success) {
          setCustomRules(updatedRules);
          fetchStats();
        } else {
          alert(res?.error ?? "Failed to delete custom rule.");
        }
      }
    );
  };

  const handleResetRules = () => {
    if (!confirm("Are you sure you want to reset all custom rules? This restores the built-in catalog defaults.")) return;
    
    chrome.runtime.sendMessage(
      { type: "RESET_PRODUCTIVITY_RULES", version: 1 } satisfies RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        if (res && res.success) {
          setCustomRules([]);
          fetchStats();
        } else {
          alert(res?.error ?? "Failed to reset rules.");
        }
      }
    );
  };

  const handleExecutePurge = () => {
    if (purgeConfirmText !== "PURGE") return;
    setIsPurging(true);
    chrome.runtime.sendMessage(
      { type: "PURGE_ALL_DATA", version: 1 } satisfies RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        setIsPurging(false);
        setShowPurgeModal(false);
        setPurgeConfirmText("");
        if (res && res.success) {
          alert("All local database records, rules, and cache keys have been permanently purged.");
          // Refresh statistics
          fetchStats();
          // Reload custom/default rules lists
          fetchRules();
        } else {
          alert(`Failed to purge database: ${res?.error ?? "Unknown error"}`);
        }
      }
    );
  };

  const handleExportRules = () => {
    const payload = JSON.stringify({
      schema: "web-swap-productivity-rules",
      version: 1,
      exportedAt: Date.now(),
      rules: customRules
    }, null, 2);

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `web_swap_custom_rules_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportRules = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = event.target?.result as string;
        const parsed = JSON.parse(rawJson);

        if (parsed.schema !== "web-swap-productivity-rules" || parsed.version !== 1 || !Array.isArray(parsed.rules)) {
          alert("Invalid schema file. Must be a valid web-swap rules configuration.");
          return;
        }

        // Validate every rule in the array
        const importedRules: ProductivityRule[] = [];
        for (const rule of parsed.rules) {
          const check = validateProductivityRule(rule);
          if (check) {
            alert(`Validation failed for rule '${rule?.domain}': ${check}`);
            return;
          }
          importedRules.push({
            domain: rule.domain,
            category: rule.category,
            priority: rule.priority,
            createdAt: rule.createdAt ?? Date.now()
          });
        }

        if (confirm(`Importing ${importedRules.length} custom rules. Overwrite existing custom rules?`)) {
          chrome.runtime.sendMessage(
            {
              type: "SAVE_PRODUCTIVITY_RULES",
              version: 1,
              rules: importedRules
            },
            (res: { success: boolean; error?: string }) => {
              if (res && res.success) {
                setCustomRules(importedRules);
                fetchStats();
                alert("Rules imported successfully!");
              } else {
                alert(res?.error ?? "Failed to save imported rules.");
              }
            }
          );
        }
      } catch (err) {
        alert("Failed to parse JSON file structure. Verify the file contents.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset file input
  };

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
        <header className="dashboard-header" role="banner">
          <div className="brand-section">
            <h1>
              <img src={brandLogo} alt="Logo" width="28" height="28" style={{ borderRadius: 6 }} />
              Local Browse Insights
            </h1>
            <p>Privacy-first. Secure local tracking dashboard.</p>
          </div>

          <nav className="dashboard-nav" aria-label="Main sections">
            <button className={`nav-tab-btn ${activeTab === "analytics" ? "active" : ""}`} onClick={() => setActiveTab("analytics")}>Overview & Analytics</button>
            <button className={`nav-tab-btn ${activeTab === "rules" ? "active" : ""}`} onClick={() => setActiveTab("rules")}>Productivity Rules</button>
            <button className={`nav-tab-btn ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>Settings & Privacy</button>
          </nav>

          {/* Filter group always mounted to avoid layout shift; hidden via opacity when not on analytics tab */}
          <nav aria-label="Dashboard range selection" style={{ visibility: activeTab === "analytics" ? "visible" : "hidden", transition: "opacity 0.2s", opacity: activeTab === "analytics" ? 1 : 0 }}>
            <div className="filter-group">
              <button className={`filter-btn ${range === "today" ? "active" : ""}`} onClick={() => setRange("today")} aria-pressed={range === "today"} tabIndex={activeTab === "analytics" ? 0 : -1}>Today</button>
              <button className={`filter-btn ${range === "7days" ? "active" : ""}`} onClick={() => setRange("7days")} aria-pressed={range === "7days"} tabIndex={activeTab === "analytics" ? 0 : -1}>Last 7 Days</button>
              <button className={`filter-btn ${range === "30days" ? "active" : ""}`} onClick={() => setRange("30days")} aria-pressed={range === "30days"} tabIndex={activeTab === "analytics" ? 0 : -1}>Last 30 Days</button>
            </div>
          </nav>
        </header>

      {/* Fresh install Onboarding preset displays */}
      {!isLoading && isDatabaseEmpty && activeTab === "analytics" && (
        <section className="welcome-preset" aria-label="First-time installation guide">
          <div className="welcome-info">
            <h2>👋 Welcome to your Browse Analytics Dashboard!</h2>
            <p>Your tracking engine is fully initialized. Start browsing your favorite websites to capture premium statistics safely on-device.</p>
          </div>
          <div className="status-indicator">
            <span className="status-dot-indicator" aria-hidden="true"></span>
            <span>Real-time tracking active</span>
          </div>
        </section>
      )}

      {/* TABS CONTROLLER CONTAINER */}
      {activeTab === "analytics" && (
        <div className="tab-panel">
          {/* Derived Metric Cards Grid */}
          <section className="metrics-grid" aria-label="Browsing overview cards">
            <div className="metric-card">
              <div className="metric-icon purple" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <div className="metric-label" id="lbl-tracked">Total Tracked Time</div>
              <div className="metric-value" aria-labelledby="lbl-tracked">{isLoading ? "---" : formatDuration(totalTrackedDuration)}</div>
              <div className="metric-desc">Aggregated duration for active range</div>
            </div>

            <div className="metric-card">
              <div className="metric-icon green" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              </div>
              <div className="metric-label" id="lbl-focus">Focus Hours</div>
              <div className="metric-value" aria-labelledby="lbl-focus">{isLoading ? "---" : `${stats?.metrics?.focusHours ?? 0}h`}</div>
              <div className="metric-desc">Total productive browsing time</div>
            </div>

            <div className="metric-card">
              <div className="metric-icon blue" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.886H3.82l4.912 3.57L6.82 18.342 12 14.772l5.18 3.57-1.912-5.886 4.912-3.57h-6.268z" /></svg>
              </div>
              <div className="metric-label" id="lbl-visits">Total Visits</div>
              <div className="metric-value" aria-labelledby="lbl-visits">{isLoading ? "---" : stats?.metrics?.totalVisits ?? 0}</div>
              <div className="metric-desc">Sum of all navigation transitions</div>
            </div>

            <div className="metric-card">
              <div className="metric-icon orange" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <div className="metric-label" id="lbl-unique">Unique Hostnames</div>
              <div className="metric-value" aria-labelledby="lbl-unique">{isLoading ? "---" : stats?.metrics?.uniqueDomainsCount ?? 0}</div>
              <div className="metric-desc">Individual domains logged</div>
            </div>
          </section>

          {/* Productivity Distribution Banner */}
          {!isLoading && !isDatabaseEmpty && (
            <section
              className="productivity-overview-card"
              aria-label="Productivity breakdown diagnostics"
              style={{ "--score-angle": scoreAngle } as React.CSSProperties}
            >
              <div className="productivity-overview-header">
                <div className="productivity-score-display">
                  <div className="productivity-score-circle" role="img" aria-label={`Productivity score ${productivityScore}%`}>
                    <span className="productivity-score-text">{productivityScore}%</span>
                  </div>
                  <div className="productivity-score-info">
                    <h2>
                      Productivity Score 
                      <span className={`badge-category ${productivityScore >= 50 ? 'productive' : 'distracting'}`} style={{ fontSize: "11px", marginLeft: 8 }}>
                        {getProductivityLabel(productivityScore)}
                      </span>
                    </h2>
                    <p>Ratio of productive vs distracting domain activities</p>
                  </div>
                </div>
                <div className={`prod-score-illus ${productivityScore >= 50 ? 'productive' : 'distracted'}`} aria-hidden="true">
                  {renderScoreIllustration(productivityScore)}
                </div>
              </div>

              {/* Stacked Percentage bar */}
              <div className="productivity-overview-bar" aria-hidden="true">
                <div className="prod-bar-segment productive" style={{ width: `${productivePct}%` }} title={`Productive: ${productivePct.toFixed(1)}%`}></div>
                <div className="prod-bar-segment distracting" style={{ width: `${distractingPct}%` }} title={`Distracting: ${distractingPct.toFixed(1)}%`}></div>
                <div className="prod-bar-segment neutral" style={{ width: `${neutralPct}%` }} title={`Neutral: ${neutralPct.toFixed(1)}%`}></div>
                <div className="prod-bar-segment unknown" style={{ width: `${unknownPct}%` }} title={`Unknown: ${unknownPct.toFixed(1)}%`}></div>
              </div>

              {/* Interactive Legend */}
              <div className="productivity-legend">
                <div className="legend-item">
                  <span className="legend-color productive" aria-hidden="true"></span>
                  <div className="legend-meta">
                    <span className="legend-label">Productive</span>
                    <span className="legend-value">{formatDuration(productiveMs)} ({productivePct.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="legend-item">
                  <span className="legend-color distracting" aria-hidden="true"></span>
                  <div className="legend-meta">
                    <span className="legend-label">Distracting</span>
                    <span className="legend-value">{formatDuration(distractingMs)} ({distractingPct.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="legend-item">
                  <span className="legend-color neutral" aria-hidden="true"></span>
                  <div className="legend-meta">
                    <span className="legend-label">Neutral</span>
                    <span className="legend-value">{formatDuration(neutralMs)} ({neutralPct.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="legend-item">
                  <span className="legend-color unknown" aria-hidden="true"></span>
                  <div className="legend-meta">
                    <span className="legend-label">Unclassified</span>
                    <span className="legend-value">{formatDuration(unknownMs)} ({unknownPct.toFixed(0)}%)</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Main Visualizations section */}
          <div className="visualization-section">
            {/* Left Column: Visual SVG Chart */}
            <section className="vis-card" aria-label="Browsing history timeline chart">
              <div className="vis-card-title">
                Browsing Timeline
                <span>{range === "today" ? "Hourly intervals" : "Daily aggregates"}</span>
              </div>

              {isLoading ? (
                <div className="vis-empty" role="status">
                  <p className="vis-empty-title">Loading stats data...</p>
                </div>
              ) : isDatabaseEmpty ? (
                <div className="vis-empty">
                  <div className="vis-empty-icon" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="17" x2="9" y2="10" />
                      <line x1="15" y1="17" x2="15" y2="7" />
                    </svg>
                  </div>
                  <p className="vis-empty-title">No Timeline Data Found</p>
                  <p className="vis-empty-desc">Your history timeline is blank. Browse the web to generate historical metrics.</p>
                </div>
              ) : (
                <div className="chart-container">
                  {/* Screen reader table summary for accessibility */}
                  <table className="sr-only" aria-label="Browsing duration history table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedTimeline.map((item) => (
                        <tr key={item.date}>
                          <td>{item.date}</td>
                          <td>{formatDuration(item.durationMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Inline raw SVG coordinates chart */}
                  <svg className="chart-svg" viewBox="0 0 720 240" role="img" aria-label="Visual timeline chart showing browsing duration trend.">
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Y-axis gridlines */}
                    <line x1="40" y1="20" x2="700" y2="20" className="chart-grid-line" />
                    <line x1="40" y1="95" x2="700" y2="95" className="chart-grid-line" />
                    <line x1="40" y1="170" x2="700" y2="170" className="chart-grid-line" />
                    <line x1="40" y1="210" x2="700" y2="210" stroke="var(--border-subtle)" strokeWidth="1.5" />

                    {/* Y-axis labels */}
                    <text x="12" y="24" className="chart-axis-text">{formatAxisLabel(maxTimelineMs)}</text>
                    <text x="12" y="100" className="chart-axis-text">{formatAxisLabel(maxTimelineMs / 2)}</text>
                    <text x="12" y="174" className="chart-axis-text">0m</text>

                    {/* Bar components or line elements based on size */}
                    {range === "today" ? (
                      /* Today utilizes line charts */
                      <>
                        <path
                          className="chart-area"
                          d={`
                            M ${lineChartCoordinates[0]?.x ?? 40} 210
                            ${lineChartCoordinates.map(c => `L ${c.x} ${c.y}`).join(" ")}
                            L ${lineChartCoordinates[lineChartCoordinates.length - 1]?.x ?? 700} 210
                            Z
                          `}
                        />
                        <path
                          className="chart-line"
                          d={lineChartCoordinates.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")}
                        />
                        {lineChartCoordinates.map((c, idx) => (
                          <g key={idx}>
                            <circle
                              cx={c.x}
                              cy={c.y}
                              r="4"
                              className="chart-point"
                              role="img"
                              aria-label={`Time: ${c.rawDate}, Duration: ${c.valueLabel}`}
                            />
                            {/* Render label for every 3rd hour or the last hour to prevent crowding */}
                            {(idx % 3 === 0 || idx === lineChartCoordinates.length - 1) && (
                              <text
                                x={c.x}
                                y="225"
                                textAnchor="middle"
                                className="chart-axis-text"
                              >
                                {c.rawDate}
                              </text>
                            )}
                          </g>
                        ))}
                      </>
                    ) : (
                      /* Longer ranges utilize clean bar columns */
                      barChartCoordinates.map((bar, idx) => (
                        <g key={idx}>
                          <rect
                            x={bar.x}
                            y={bar.y}
                            width={bar.width}
                            height={bar.height}
                            className="chart-bar"
                            role="img"
                            aria-label={`Date: ${bar.rawDate}, Duration: ${bar.valueLabel}`}
                          />
                          <text
                            x={bar.x + bar.width / 2}
                            y="225"
                            textAnchor="middle"
                            className="chart-axis-text"
                          >
                            {bar.label}
                          </text>
                        </g>
                      ))
                    )}
                  </svg>
                </div>
              )}
            </section>

            {/* Right Column: Top Domains Table Leaderboard */}
            <section className="vis-card" aria-label="Top active domain listings">
              <div className="vis-card-title">
                Top Domains
                <span>Sorted by duration</span>
              </div>

              {isLoading ? (
                <div className="vis-empty" role="status">
                  <p className="vis-empty-title">Loading domains...</p>
                </div>
              ) : isDatabaseEmpty ? (
                <div className="vis-empty">
                  <div className="vis-empty-icon" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      <path d="M2 12h20" />
                    </svg>
                  </div>
                  <p className="vis-empty-title">No Activity Yet</p>
                  <p className="vis-empty-desc">Your visited domains listing will populate dynamically once tracking records are written.</p>
                </div>
              ) : (
                <div className="leaderboard-list">
                  {filteredDomains.map((item, idx) => {
                    const fillWidth = maxDomainMs > 0 ? (item.durationMs / maxDomainMs) * 100 : 0;
                    
                    return (
                      <div className="leaderboard-row" key={item.domain}>
                        <div className="leaderboard-meta">
                          <span className="leaderboard-name" title={item.domain}>
                            #{idx + 1} {item.domain}
                          </span>
                          <span className="leaderboard-time">
                            {formatDuration(item.durationMs)} ({item.visitCount} visits)
                          </span>
                        </div>
                        <div className="leaderboard-bar-track" aria-hidden="true">
                          <div
                            className="leaderboard-bar-fill"
                            style={{ width: `${fillWidth}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}


        {activeTab === "rules" && (
          /* PRODUCTIVITY RULES TAB PANEL */
          <section className="rules-manager-layout tab-panel" aria-label="Productivity classification preferences">
            <div className="rules-sidebar">
              <div className="rules-card">
                <h3>Add Custom Rule</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Override the semantic analysis engine with your own domain classification.
                </p>

                {formError && (
                  <div className="rules-form-alert error" role="alert">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="rules-form-alert success" role="status">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    {formSuccess}
                  </div>
                )}

                <form className="rules-form" onSubmit={handleAddRule}>
                  <div className="form-group">
                    <label htmlFor="domain-input">Domain (e.g. youtube.com)</label>
                    <input
                      id="domain-input"
                      type="text"
                      className="form-input"
                      placeholder="Enter hostname..."
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="category-select">Classification Category</label>
                    <select
                      id="category-select"
                      className="form-input"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as ProductivityCategory)}
                      required
                    >
                      <option value="productive">Productive (Deep Work)</option>
                      <option value="distracting">Distracting (Entertainment)</option>
                      <option value="neutral">Neutral (Utilities)</option>
                      <option value="unknown">Unknown (Unclassified)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="priority-input">Evaluation Priority</label>
                    <input
                      id="priority-input"
                      type="number"
                      className="form-input"
                      min="1"
                      max="100"
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      required
                    />
                    <small style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "var(--text-secondary)" }}>
                      Higher numbers override lower priority rules (Defaults run at Priority 1)
                    </small>
                  </div>

                  <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "6px" }}>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Save Custom Rule
                  </button>
                </form>
              </div>

              <div className="rules-card">
                <h3>Portability</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Export your meticulously crafted custom ruleset to a JSON file for backup or import to another device.
                </p>
                <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                  <button type="button" className="btn-secondary" onClick={handleExportRules} style={{ justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "6px" }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export Ruleset (.json)
                  </button>
                  <label className="btn-secondary" style={{ display: "flex", justifyContent: "center", cursor: "pointer", margin: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "6px" }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Import Ruleset
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImportRules} />
                  </label>
                </div>
              </div>
            </div>

            <div className="rules-main">
              <div className="rules-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <h3>Active Classifications</h3>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                      Showing both custom overrides and default baseline engine rules.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search domains..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: "200px" }}
                      aria-label="Search rules by domain"
                    />
                    <select
                      className="form-input"
                      value={ruleTypeFilter}
                      onChange={(e) => setRuleTypeFilter(e.target.value as "all" | "default" | "custom")}
                      aria-label="Filter rules by type"
                      style={{ width: "130px" }}
                    >
                      <option value="all">All Types</option>
                      <option value="custom">Custom Only</option>
                      <option value="default">Default Only</option>
                    </select>
                  </div>
                </div>

                <div className="rules-table-container">
                  <table className="rules-table">
                    <thead>
                      <tr>
                        <th>Domain Match</th>
                        <th>Classification</th>
                        <th>Priority</th>
                        <th>Source</th>
                        <th style={{ width: "80px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedRules.length === 0 ? (
                        <tr>
                          <td colSpan={5}>
                            <div className="vis-empty" style={{ minHeight: "150px" }}>
                              <p className="vis-empty-title">No Rules Found</p>
                              <p className="vis-empty-desc">Adjust your search or filter settings.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        searchedRules.map((rule) => (
                          <tr key={`${rule.domain}-${rule.isCustom ? 'custom' : 'default'}`}>
                            <td style={{ fontFamily: "ui-monospace, monospace", fontSize: "13px" }}>{rule.domain}</td>
                            <td><span className={`badge-category ${rule.category}`}>{rule.category.charAt(0).toUpperCase() + rule.category.slice(1)}</span></td>
                            <td>{rule.priority}</td>
                            <td>{rule.isCustom ? <span className="source-badge">Custom</span> : <span className="source-badge">System</span>}</td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                <button type="button" className="btn-icon" title={`Edit rule for ${rule.domain}`} aria-label={`Edit rule for ${rule.domain}`} disabled={!rule.isCustom} style={{ opacity: rule.isCustom ? 1 : 0.35 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button type="button" className="btn-icon danger" onClick={() => rule.isCustom && handleDeleteRule(rule.domain)} title={`Delete rule for ${rule.domain}`} aria-label={`Delete rule for ${rule.domain}`} style={{ opacity: rule.isCustom ? 1 : 0.35 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {customRules.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button type="button" className="btn-danger-outline" onClick={handleResetRules}>
                      Reset All Custom Rules
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "settings" && (
        <section className="settings-panel-layout tab-panel" aria-label="Settings and Data Control">
            {/* Privacy card */}
            <div className="settings-card">
              <div className="settings-card-icon purple" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5b57e6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div className="settings-card-body">
                <h3>Privacy &amp; Local-First Policy</h3>
                <p>Your browsing activity is processed and stored <strong>entirely on your local machine</strong>. No server connections are made, no telemetry is reported, and no analytical logs ever leave your device.</p>
              </div>
              <div className="settings-card-illus" aria-hidden="true">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" fill="rgba(91,87,230,0.08)" />
                  <rect x="22" y="34" width="36" height="26" rx="4" fill="rgba(91,87,230,0.15)" stroke="#5b57e6" strokeWidth="1.5"/>
                  <path d="M30 34V28a10 10 0 0 1 20 0v6" stroke="#5b57e6" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="40" cy="47" r="4" fill="#5b57e6"/>
                  <line x1="40" y1="51" x2="40" y2="55" stroke="#5b57e6" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="58" cy="24" r="3" fill="rgba(91,87,230,0.3)"/>
                  <circle cx="20" cy="56" r="2" fill="rgba(91,87,230,0.2)"/>
                </svg>
              </div>
            </div>

            {/* Storage card */}
            <div className="settings-card">
              <div className="settings-card-icon green" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              </div>
              <div className="settings-card-body">
                <h3>Local Storage Behavior</h3>
                <p>The extension uses highly-efficient IndexedDB and Chrome Extension local storage APIs. All tracking state runs asynchronously in service worker background threads with zero UI blocking. Please note that uninstalling this extension via the browser will automatically delete all stored on-device analytics databases.</p>
              </div>
              <div className="settings-card-illus" aria-hidden="true">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" fill="rgba(16,185,129,0.08)" />
                  <ellipse cx="40" cy="28" rx="18" ry="6" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1.5"/>
                  <path d="M22 28v10c0 3.31 8.06 6 18 6s18-2.69 18-6V28" stroke="#10b981" strokeWidth="1.5"/>
                  <path d="M22 38v10c0 3.31 8.06 6 18 6s18-2.69 18-6V38" stroke="#10b981" strokeWidth="1.5"/>
                  <circle cx="52" cy="53" r="8" fill="rgba(16,185,129,0.9)"/>
                  <path d="M49 53l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Theme card */}
            <div className="settings-card" style={{ flexWrap: "wrap" }}>
              <div className="settings-card-icon blue" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </div>
              <div className="settings-card-body">
                <h3>Theme Settings</h3>
                <p style={{ marginBottom: 12 }}>Select your preferred user interface appearance. All themes support our premium liquid glass look.</p>
                <div className="theme-selector-group">
                  <select
                    value={theme}
                    onChange={(e) => handleThemeChange(e.target.value as "dark" | "light" | "system")}
                    className="theme-select-input"
                    aria-label="Select color theme"
                  >
                    <option value="system">🖥️ System Default</option>
                    <option value="dark">🌙 Dark Glass</option>
                    <option value="light">☀️ Light Glass</option>
                  </select>
                </div>
              </div>
              <div className="settings-card-illus" aria-hidden="true">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" fill="rgba(59,130,246,0.08)" />
                  <rect x="18" y="22" width="44" height="32" rx="4" fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeWidth="1.5"/>
                  <rect x="22" y="26" width="36" height="20" rx="2" fill="rgba(59,130,246,0.08)"/>
                  <circle cx="32" cy="36" r="7" fill="rgba(59,130,246,0.25)" stroke="#3b82f6" strokeWidth="1"/>
                  <line x1="42" y1="30" x2="54" y2="30" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="42" y1="34" x2="52" y2="34" stroke="rgba(59,130,246,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="54" cy="54" r="4" fill="rgba(59,130,246,0.3)"/>
                  <circle cx="66" cy="30" r="3" fill="rgba(59,130,246,0.2)"/>
                </svg>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="settings-card danger-zone">
              <div className="settings-card-icon red" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="settings-card-body">
                <h3>Danger Zone: Permanent Purge</h3>
                <p style={{ marginBottom: 16 }}>Purging the on-device database is destructive and irreversible. This will instantly wipe all website session logs, daily domain indicators, customized classification rules, volatile ring-buffered caches, and active state keys.</p>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => { setShowPurgeModal(true); setPurgeConfirmText(""); }}
                  aria-haspopup="dialog"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Purge On-Device Database
                </button>
              </div>
              <div className="settings-card-illus" aria-hidden="true">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" fill="rgba(239,68,68,0.06)" />
                  <rect x="24" y="30" width="32" height="34" rx="3" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.5"/>
                  <rect x="20" y="26" width="40" height="6" rx="2" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1"/>
                  <rect x="34" y="22" width="12" height="6" rx="2" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1"/>
                  <line x1="33" y1="38" x2="33" y2="57" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="40" y1="38" x2="40" y2="57" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="47" y1="38" x2="47" y2="57" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="58" cy="58" r="8" fill="#ef4444"/>
                  <line x1="55" y1="55" x2="61" y2="61" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="61" y1="55" x2="55" y2="61" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="20" cy="36" r="3" fill="rgba(239,68,68,0.3)"/>
                  <circle cx="62" cy="28" r="2" fill="rgba(239,68,68,0.2)"/>
                </svg>
              </div>
            </div>
          </section>
        )}

        {/* MULTI-STEP CONFIRMATION MODAL OVERLAY */}
        {showPurgeModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="purge-modal-title">
            <div className="modal-content">
              <h3 id="purge-modal-title" className="modal-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Confirm Permanent Purge
              </h3>
              <p className="modal-desc">
                This action is destructive and <strong>absolutely irreversible</strong>. Your on-device data will be permanently wiped.
                To proceed, please type <strong>PURGE</strong> in the input field below to authorize this request:
              </p>
              <input
                type="text"
                className="modal-input"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value.toUpperCase())}
                placeholder="Type PURGE to delete"
                disabled={isPurging}
                autoFocus
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => {
                    setShowPurgeModal(false);
                    setPurgeConfirmText("");
                  }}
                  disabled={isPurging}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-modal-confirm"
                  onClick={handleExecutePurge}
                  disabled={purgeConfirmText !== "PURGE" || isPurging}
                >
                  {isPurging ? "Purging..." : "Confirm Purge"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <footer className="dashboard-footer" role="contentinfo">
          <div className="status-indicator">
            <span
              className={`status-dot-indicator ${stats?.trackingPaused ? "paused" : ""}`}
              aria-hidden="true"
            ></span>
            <span>
              {stats?.trackingPaused ? "Tracking paused" : "Real-time tracking active"}
            </span>
          </div>
          <div>
            <span>Data freshness: {stats ? `Last synced locally at ${new Date(stats.snapshotGeneratedAt).toLocaleTimeString()}` : "Not synced"}</span>
            <span style={{ marginLeft: "16px" }}>v1.0.0</span>
          </div>
        </footer>
      </div>
    </DashboardErrorBoundary>
  );
}
