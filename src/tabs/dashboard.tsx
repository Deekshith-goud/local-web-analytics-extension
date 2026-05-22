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
import { downsampleTimeline, computeBarCoordinates } from "../analytics/selectors/transforms";
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

function getProductivityLabel(score: number, iconStyle: "minimal" | "playful"): string {
  if (iconStyle === "playful") {
    if (score >= 90) return "Highly Productive";
    if (score >= 70) return "Focus Mode Stable";
    if (score >= 50) return "Moderately Productive";
    if (score >= 30) return "Mildly Distracted";
    if (score >= 15) return "Highly Distracted";
    return "Critically Distracted";
  }
  if (score >= 90) return "Optimal Focus";
  if (score >= 70) return "Productive";
  if (score >= 50) return "Stable";
  if (score >= 30) return "Minor Distractions";
  if (score >= 15) return "Distracted";
  return "Critical Focus Loss";
}

function renderScoreIllustration(score: number, iconStyle: "minimal" | "playful") {
  let icon: React.ReactNode;
  let label: string;
  let bg: string;
  let color: string;
  let glow: string = "none";

  if (score >= 90) {
    icon = iconStyle === "minimal" 
      ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      : "🌳";
    label = iconStyle === "minimal" ? "Optimal" : "Thriving";
    bg = iconStyle === "minimal" ? "rgba(16, 185, 129, 0.1)" : "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)";
    color = "#10b981";
    glow = "0 8px 24px rgba(16,185,129,0.25)";
  } else if (score >= 70) {
    icon = iconStyle === "minimal"
      ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
      : "🌻";
    label = iconStyle === "minimal" ? "Productive" : "Flourishing";
    bg = iconStyle === "minimal" ? "rgba(59, 130, 246, 0.1)" : "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)";
    color = "#3b82f6";
    glow = "0 8px 24px rgba(34,197,94,0.2)";
  } else if (score >= 50) {
    icon = iconStyle === "minimal"
      ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      : "🪴";
    label = iconStyle === "minimal" ? "Stable" : "Growing";
    bg = iconStyle === "minimal" ? "rgba(100, 116, 139, 0.1)" : "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)";
    color = "#64748b";
    glow = "0 8px 24px rgba(59,130,246,0.2)";
  } else if (score >= 30) {
    icon = iconStyle === "minimal"
      ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      : "😨";
    label = iconStyle === "minimal" ? "Minor Issues" : "Distracted";
    bg = iconStyle === "minimal" ? "rgba(245, 158, 11, 0.1)" : "linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)";
    color = "#f59e0b";
    glow = "0 8px 24px rgba(245,158,11,0.2)";
  } else if (score >= 15) {
    icon = iconStyle === "minimal"
      ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      : "😵‍💫";
    label = "Distracted";
    bg = iconStyle === "minimal" ? "rgba(239, 68, 68, 0.1)" : "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)";
    color = "#ef4444";
    glow = "0 8px 24px rgba(239,68,68,0.2)";
  } else {
    icon = iconStyle === "minimal"
      ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      : "😱";
    label = iconStyle === "minimal" ? "Critical Loss" : "Critical";
    bg = iconStyle === "minimal" ? "rgba(225, 29, 72, 0.1)" : "linear-gradient(135deg, #fecdd3 0%, #fda4af 100%)";
    color = "#e11d48";
    glow = "0 8px 24px rgba(220,38,38,0.3)";
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    }}>
      <div style={{
        width: iconStyle === "minimal" ? "64px" : "72px",
        height: iconStyle === "minimal" ? "64px" : "72px",
        borderRadius: iconStyle === "minimal" ? "12px" : "50%",
        background: bg,
        color: color,
        border: iconStyle === "minimal" ? `1px solid ${color}40` : 'none',
        boxShadow: iconStyle === "playful" ? glow : 'none',
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: iconStyle === "playful" ? "32px" : undefined,
        lineHeight: iconStyle === "playful" ? 1 : undefined,
        transition: "all 0.3s ease",
      }}
        title={label}
      >
        {icon}
      </div>
      <span style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}>{label}</span>
    </div>
  );
}

type RangeType = "today" | "7days" | "30days";

const computeSmoothPath = (points: {x: number, y: number}[]) => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i+1];
    const cp1x = curr.x + (next.x - curr.x) / 3;
    const cp1y = curr.y;
    const cp2x = next.x - (next.x - curr.x) / 3;
    const cp2y = next.y;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  return d;
}

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<"analytics" | "rules" | "settings">("analytics");
  const [range, setRange] = useState<RangeType>("7days");
  const [stats, setStats] = useState<HistoricalStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light" | "system">("system");
  const [iconStyle, setIconStyle] = useState<"minimal" | "playful">("minimal");
  const [blobStyle, setBlobStyle] = useState<"glass-dark" | "glass-light" | "brutalist-dark" | "brutalist-light">("glass-dark");

  // Load and apply theme on startup
  useEffect(() => {
    chrome.storage.local.get(["theme", "iconStyle", "blobStyle"], (res) => {
      const savedTheme = res.theme || "system";
      const savedIconStyle = res.iconStyle || "minimal";
      const savedBlobStyle = res.blobStyle || "glass-dark";
      setTheme(savedTheme);
      setIconStyle(savedIconStyle);
      setBlobStyle(savedBlobStyle);
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

  const handleIconStyleChange = (newStyle: "minimal" | "playful") => {
    setIconStyle(newStyle);
    chrome.storage.local.set({ iconStyle: newStyle });
  };

  const handleBlobStyleChange = (newStyle: "glass-dark" | "glass-light" | "brutalist-dark" | "brutalist-light") => {
    setBlobStyle(newStyle);
    chrome.storage.local.set({ blobStyle: newStyle });
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
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [showAllDomainsModal, setShowAllDomainsModal] = useState(false);
  const [allDomainsSort, setAllDomainsSort] = useState<"duration" | "visits">("duration");
  const [allDomainsSearch, setAllDomainsSearch] = useState("");

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

  const [hoveredTooltip, setHoveredTooltip] = useState<{x: number, y: number, title: string, content: React.ReactNode} | null>(null);
  const [activeChart, setActiveChart] = useState<"total" | "productivity">("total");
  const [domainSort, setDomainSort] = useState<"duration" | "visits">("duration");


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

  // Domain table limits (virtual limit to top 15 domains maximum to prevent DOM overhead)
  const filteredDomains = useMemo(() => {
    if (!stats || !stats.topDomains) return [];
    const domains = [...stats.topDomains];
    if (domainSort === "visits") {
      domains.sort((a, b) => b.visitCount - a.visitCount);
    } else {
      domains.sort((a, b) => b.durationMs - a.durationMs);
    }
    return domains.slice(0, 15);
  }, [stats, domainSort]);

  const maxDomainMs = useMemo(() => {
    if (filteredDomains.length === 0) return 0;
    return Math.max(...filteredDomains.map(d => d.durationMs), 1);
  }, [filteredDomains]);

  const maxVisitCount = useMemo(() => {
    if (filteredDomains.length === 0) return 0;
    return Math.max(...filteredDomains.map(d => d.visitCount), 1);
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
  const handleEditRule = (rule: ProductivityRule) => {
    setNewDomain(rule.domain);
    setNewCategory(rule.category);
    setNewPriority(rule.priority.toString());
    setFormError(null);
    setFormSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
            <div className="metric-card" style={{ position: 'relative' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '-15px', bottom: '-20px', width: '150px', height: '150px', opacity: 0.08, pointerEvents: 'none', color: 'var(--accent)', transform: 'rotate(-15deg)', WebkitMaskImage: 'linear-gradient(to top left, black 40%, transparent 90%)', maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div className="metric-icon purple" aria-hidden="true" style={{ position: 'relative', zIndex: 1 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <div className="metric-label" id="lbl-tracked" style={{ position: 'relative', zIndex: 1 }}>Total Tracked Time</div>
              <div className="metric-value" aria-labelledby="lbl-tracked" style={{ position: 'relative', zIndex: 1 }}>{isLoading ? "---" : formatDuration(totalTrackedDuration)}</div>
              <div className="metric-desc" style={{ position: 'relative', zIndex: 1 }}>Aggregated duration for active range</div>
            </div>

            <div className="metric-card" style={{ position: 'relative' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '-15px', bottom: '-20px', width: '150px', height: '150px', opacity: 0.08, pointerEvents: 'none', color: 'var(--green)', transform: 'rotate(10deg)', WebkitMaskImage: 'linear-gradient(to top left, black 40%, transparent 90%)', maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <div className="metric-icon green" aria-hidden="true" style={{ position: 'relative', zIndex: 1 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              </div>
              <div className="metric-label" id="lbl-focus" style={{ position: 'relative', zIndex: 1 }}>Focus Hours</div>
              <div className="metric-value" aria-labelledby="lbl-focus" style={{ position: 'relative', zIndex: 1 }}>{isLoading ? "---" : `${stats?.metrics?.focusHours ?? 0}h`}</div>
              <div className="metric-desc" style={{ position: 'relative', zIndex: 1 }}>Total productive browsing time</div>
            </div>

            <div className="metric-card" style={{ position: 'relative' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '-15px', bottom: '-20px', width: '150px', height: '150px', opacity: 0.08, pointerEvents: 'none', color: '#3b82f6', transform: 'rotate(-5deg)', WebkitMaskImage: 'linear-gradient(to top left, black 40%, transparent 90%)', maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
                <path d="m12 3-1.912 5.886H3.82l4.912 3.57L6.82 18.342 12 14.772l5.18 3.57-1.912-5.886 4.912-3.57h-6.268z" />
              </svg>
              <div className="metric-icon blue" aria-hidden="true" style={{ position: 'relative', zIndex: 1 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.886H3.82l4.912 3.57L6.82 18.342 12 14.772l5.18 3.57-1.912-5.886 4.912-3.57h-6.268z" /></svg>
              </div>
              <div className="metric-label" id="lbl-visits" style={{ position: 'relative', zIndex: 1 }}>Total Visits</div>
              <div className="metric-value" aria-labelledby="lbl-visits" style={{ position: 'relative', zIndex: 1 }}>{isLoading ? "---" : stats?.metrics?.totalVisits ?? 0}</div>
              <div className="metric-desc" style={{ position: 'relative', zIndex: 1 }}>Sum of all navigation transitions</div>
            </div>

            <div className="metric-card" style={{ position: 'relative' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '-15px', bottom: '-20px', width: '150px', height: '150px', opacity: 0.08, pointerEvents: 'none', color: 'var(--orange)', transform: 'rotate(15deg)', WebkitMaskImage: 'linear-gradient(to top left, black 40%, transparent 90%)', maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                <div className="metric-icon orange" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                {!isLoading && !isDatabaseEmpty && (
                  <button 
                    onClick={() => setShowAllDomainsModal(true)}
                    className="hover-text-black"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  >
                    View All &rarr;
                  </button>
                )}
              </div>
              <div className="metric-label" id="lbl-unique" style={{ position: 'relative', zIndex: 1 }}>Unique Hostnames</div>
              <div className="metric-value" aria-labelledby="lbl-unique" style={{ position: 'relative', zIndex: 1 }}>{isLoading ? "---" : stats?.metrics?.uniqueDomainsCount ?? 0}</div>
              <div className="metric-desc" style={{ position: 'relative', zIndex: 1 }}>Individual domains logged</div>
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
                    <h2 style={{ display: 'flex', alignItems: 'center' }}>
                      Productivity Score 
                      <button 
                        onClick={() => setShowCriteriaModal(true)}
                        className="btn-icon" 
                        style={{ marginLeft: 6, opacity: 0.6, width: 20, height: 20, padding: 0 }}
                        title="View Score Criteria"
                        aria-label="View Score Criteria"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      </button>
                      <span className={`badge-category ${productivityScore >= 50 ? 'productive' : 'distracting'}`} style={{ fontSize: "11px", marginLeft: 8 }}>
                        {getProductivityLabel(productivityScore, iconStyle)}
                      </span>
                    </h2>
                    <p>Ratio of productive vs distracting domain activities</p>
                  </div>
                </div>
                <div className={`prod-score-illus ${productivityScore >= 50 ? 'productive' : 'distracted'}`} aria-hidden="true">
                  {renderScoreIllustration(productivityScore, iconStyle)}
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
              <div className="vis-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {activeChart === "total" ? "Total Browsing Time" : "Productivity vs Distraction"}
                  <span style={{ margin: 0 }}>{range === "today" ? "Hourly intervals" : "Daily aggregates"}</span>
                </div>
                
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  {hoveredTooltip ? (
                    <div style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      minWidth: '140px'
                    }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {range === "today" ? `Time: ${hoveredTooltip.title}` : hoveredTooltip.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {hoveredTooltip.content}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', opacity: 0.5, fontStyle: 'italic' }}>
                      Hover over chart for details
                    </div>
                  )}
                </div>
                <div className="chart-tabs" style={{ display: 'flex', gap: '4px', fontSize: '12px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px' }}>
                   <button 
                     onClick={() => setActiveChart("total")} 
                     style={{ 
                       padding: '6px 12px', 
                       borderRadius: '6px', 
                       background: activeChart === "total" ? 'var(--bg-elevated)' : 'transparent', 
                       border: 'none', 
                       boxShadow: activeChart === "total" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                       color: activeChart === "total" ? 'var(--text-primary)' : 'var(--text-secondary)', 
                       cursor: 'pointer',
                       fontWeight: activeChart === "total" ? 600 : 400
                     }}
                   >
                     Total Time
                   </button>
                   <button 
                     onClick={() => setActiveChart("productivity")} 
                     style={{ 
                       padding: '6px 12px', 
                       borderRadius: '6px', 
                       background: activeChart === "productivity" ? 'var(--bg-elevated)' : 'transparent', 
                       border: 'none', 
                       boxShadow: activeChart === "productivity" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                       color: activeChart === "productivity" ? 'var(--text-primary)' : 'var(--text-secondary)', 
                       cursor: 'pointer',
                       fontWeight: activeChart === "productivity" ? 600 : 400
                     }}
                   >
                     Productivity
                   </button>
                </div>
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
                <div className="chart-container" style={{ position: 'relative' }}>
                  {activeChart === "total" && (
                    <svg className="chart-svg" viewBox="0 0 720 240" role="img" aria-label="Visual timeline chart showing browsing duration trend.">
                      <defs>
                        <linearGradient id="capsuleBrandGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fca5a5" />
                          <stop offset="100%" stopColor="#fef08a" />
                        </linearGradient>
                        <linearGradient id="capsuleHighlightGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" />
                          <stop offset="100%" stopColor="#fcd34d" />
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

                      {/* Capsule Bars for all ranges */}
                      {barChartCoordinates.map((bar, idx) => {
                         const maxBarHeight = Math.max(...barChartCoordinates.map(b => b.height));
                         const isMax = bar.height >= maxBarHeight * 0.99 && bar.height > 2; // Tolerance for floats
                         return (
                          <g key={idx}>
                            <rect
                              x={bar.x + bar.width * 0.1}
                              y={bar.y}
                              width={bar.width * 0.8}
                              height={bar.height}
                              rx={(bar.width * 0.8) / 2}
                              fill={isMax ? "url(#capsuleHighlightGradient)" : "url(#capsuleBrandGradient)"}
                              className="chart-capsule"
                              style={{ transition: 'all 0.2s ease', cursor: 'pointer', opacity: 1 }}
                              onMouseEnter={() => setHoveredTooltip({
                                x: 0, y: 0,
                                title: bar.rawDate,
                                content: <div style={{fontWeight: 600, color: 'var(--text-primary)'}}>{bar.valueLabel} total</div>
                              })}
                              onMouseLeave={() => setHoveredTooltip(null)}
                            />
                            {(idx % Math.ceil(barChartCoordinates.length / 8) === 0 || idx === barChartCoordinates.length - 1) && (
                              <text
                                x={bar.x + bar.width / 2}
                                y="225"
                                textAnchor="middle"
                                className="chart-axis-text"
                              >
                                {bar.label}
                              </text>
                            )}
                            {isMax && (
                              <text x={bar.x + bar.width / 2} y={bar.y - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="10px" fontWeight="600">
                                Max
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  )}

                  {activeChart === "productivity" && (
                    <svg className="chart-svg" viewBox="0 0 720 240">
                      <defs>
                        <linearGradient id="prodArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="distArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      <line x1="40" y1="20" x2="700" y2="20" className="chart-grid-line" />
                      <line x1="40" y1="95" x2="700" y2="95" className="chart-grid-line" />
                      <line x1="40" y1="170" x2="700" y2="170" className="chart-grid-line" />
                      <line x1="40" y1="210" x2="700" y2="210" stroke="var(--border-subtle)" strokeWidth="1.5" />

                      {(() => {
                        const maxCompMs = Math.max(...processedTimeline.map(t => Math.max(t.productiveMs || 0, t.distractingMs || 0)), 1000);
                        const ptCount = processedTimeline.length;
                        const stepX = ptCount > 1 ? 660 / (ptCount - 1) : 660;
                        
                        const prodPoints = processedTimeline.map((item, idx) => ({
                          x: 40 + idx * stepX,
                          y: 210 - ((item.productiveMs || 0) / maxCompMs) * 190,
                          val: item.productiveMs || 0,
                          date: item.date
                        }));
                        
                        const distPoints = processedTimeline.map((item, idx) => ({
                          x: 40 + idx * stepX,
                          y: 210 - ((item.distractingMs || 0) / maxCompMs) * 190,
                          val: item.distractingMs || 0,
                          date: item.date
                        }));

                        const prodPath = computeSmoothPath(prodPoints);
                        const distPath = computeSmoothPath(distPoints);

                        return (
                          <>
                            {/* Y-axis labels */}
                            <text x="12" y="24" className="chart-axis-text">{formatAxisLabel(maxCompMs)}</text>
                            <text x="12" y="100" className="chart-axis-text">{formatAxisLabel(maxCompMs / 2)}</text>
                            <text x="12" y="174" className="chart-axis-text">0m</text>
                            
                            {/* Productivity Line & Area */}
                            {prodPoints.length > 0 && (
                              <>
                                <path
                                  d={`${prodPath} L ${prodPoints[prodPoints.length - 1]?.x ?? 700} 210 L ${prodPoints[0]?.x ?? 40} 210 Z`}
                                  fill="url(#prodArea)"
                                />
                                <path
                                  d={prodPath}
                                  fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                                />
                              </>
                            )}
                            
                            {/* Distraction Line & Area */}
                            {distPoints.length > 0 && (
                              <>
                                <path
                                  d={`${distPath} L ${distPoints[distPoints.length - 1]?.x ?? 700} 210 L ${distPoints[0]?.x ?? 40} 210 Z`}
                                  fill="url(#distArea)"
                                />
                                <path
                                  d={distPath}
                                  fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                                />
                              </>
                            )}

                            {/* Interactive Overlay Zones for tooltips */}
                            {processedTimeline.map((item, idx) => {
                              const x = 40 + idx * stepX;
                              const pMs = item.productiveMs || 0;
                              const dMs = item.distractingMs || 0;
                              return (
                                <g key={`overlay-${idx}`}>
                                  <rect
                                    x={x - stepX/2}
                                    y={20}
                                    width={stepX}
                                    height={190}
                                    fill="transparent"
                                    style={{ cursor: 'crosshair' }}
                                    onMouseEnter={() => setHoveredTooltip({
                                      x: 0, y: 0,
                                      title: item.date,
                                      content: (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                          <div style={{ color: '#10b981', fontWeight: 600 }}>Productive: {formatDuration(pMs)}</div>
                                          <div style={{ color: '#ef4444', fontWeight: 600 }}>Distracted: {formatDuration(dMs)}</div>
                                        </div>
                                      )
                                    })}
                                    onMouseLeave={() => setHoveredTooltip(null)}
                                  />
                                  <circle cx={x} cy={prodPoints[idx]?.y} r="4" fill="#10b981" style={{ pointerEvents: 'none' }} />
                                  <circle cx={x} cy={distPoints[idx]?.y} r="4" fill="#ef4444" style={{ pointerEvents: 'none' }} />
                                  
                                  {/* X-axis labels */}
                                  {(idx % Math.ceil(ptCount / 8) === 0 || idx === ptCount - 1) && (
                                    <text x={x} y="225" textAnchor="middle" className="chart-axis-text">
                                      {range === "today" ? item.date : item.date.substring(5)}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  )}

                  {/* Tooltip Overlay removed, moved to header! */}
                </div>
              )}
            </section>

            {/* Right Column: Top Domains Table Leaderboard */}
            <section className="vis-card" aria-label="Top active domain listings">
              <div className="vis-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Top Domains
                  <span style={{ margin: 0 }}>Sorted by {domainSort === "visits" ? "sessions" : "duration"}</span>
                </div>
                <div className="chart-tabs" style={{ display: 'flex', gap: '4px', fontSize: '12px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px' }}>
                  <button 
                    onClick={() => setDomainSort("duration")} 
                    style={{ 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      background: domainSort === "duration" ? 'var(--bg-elevated)' : 'transparent', 
                      border: 'none', 
                      boxShadow: domainSort === "duration" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      color: domainSort === "duration" ? 'var(--text-primary)' : 'var(--text-secondary)', 
                      cursor: 'pointer',
                      fontWeight: domainSort === "duration" ? 600 : 400
                    }}
                  >
                    Duration
                  </button>
                  <button 
                    onClick={() => setDomainSort("visits")} 
                    style={{ 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      background: domainSort === "visits" ? 'var(--bg-elevated)' : 'transparent', 
                      border: 'none', 
                      boxShadow: domainSort === "visits" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      color: domainSort === "visits" ? 'var(--text-primary)' : 'var(--text-secondary)', 
                      cursor: 'pointer',
                      fontWeight: domainSort === "visits" ? 600 : 400
                    }}
                  >
                    Sessions
                  </button>
                </div>
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
                    const fillWidth = domainSort === "visits"
                      ? (maxVisitCount > 0 ? (item.visitCount / maxVisitCount) * 100 : 0)
                      : (maxDomainMs > 0 ? (item.durationMs / maxDomainMs) * 100 : 0);
                    
                    return (
                      <div className="leaderboard-row" key={item.domain} style={{ padding: '8px 0' }}>
                        <div className="leaderboard-meta" style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                            <img 
                              src={chrome.runtime?.id ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent("https://" + item.domain)}&size=64` : ""} 
                              alt="" 
                              style={{ width: '16px', height: '16px', borderRadius: '3px', marginRight: '8px', flexShrink: 0 }} 
                            />
                            <span className="leaderboard-name" title={item.domain} style={{ fontWeight: 600 }}>
                              <span style={{ color: 'var(--text3)', marginRight: '6px', fontWeight: 500 }}>#{idx + 1}</span>
                              {item.domain}
                            </span>
                          </div>
                          <span className="leaderboard-time" style={{ color: 'var(--text2)', fontSize: '12px' }}>
                            {formatDuration(item.durationMs)} <span style={{ opacity: 0.7 }}>({item.visitCount} visits)</span>
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
                                <button type="button" className="btn-icon" onClick={() => handleEditRule(rule)} title={`Edit rule for ${rule.domain}`} aria-label={`Edit rule for ${rule.domain}`}>
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
                <h3>Theme & Appearance</h3>
                <p style={{ marginBottom: 12 }}>Select your preferred user interface appearance and iconography style.</p>
                <div className="theme-selector-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                  <select
                    value={iconStyle}
                    onChange={(e) => handleIconStyleChange(e.target.value as "minimal" | "playful")}
                    className="theme-select-input"
                    aria-label="Select icon style"
                  >
                    <option value="minimal">🖋️ Minimal (Enterprise)</option>
                    <option value="playful">🌿 Playful (Emojis)</option>
                  </select>
                  <select
                    value={blobStyle}
                    onChange={(e) => handleBlobStyleChange(e.target.value as "glass-dark" | "glass-light" | "brutalist-dark" | "brutalist-light")}
                    className="theme-select-input"
                    aria-label="Select widget style"
                  >
                    <option value="glass-dark">🔮 Glass (Dark)</option>
                    <option value="glass-light">☁️ Glass (Light)</option>
                    <option value="brutalist-dark">⬛ Brutalist (Dark)</option>
                    <option value="brutalist-light">⬜ Brutalist (Light)</option>
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

        {/* Criteria Modal */}
        {showCriteriaModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="criteria-modal-title" onClick={() => setShowCriteriaModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '95vw', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 id="criteria-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '10px' }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  Productivity Score Criteria
                </h3>
                <button className="btn-icon" onClick={() => setShowCriteriaModal(false)} aria-label="Close modal">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <p className="modal-desc" style={{ marginBottom: '24px', fontSize: '15px' }}>
                Your score is determined by the ratio of time spent on productive vs distracting domains. Here is how your focus levels break down.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {(iconStyle === "minimal" ? [
                  { score: "90 - 100", label: "Optimal Focus", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, desc: "Highly focused on useful stuff. Almost zero time wasted.", quote: "Deep work is the superpower of the 21st century.", bg: "rgba(16, 185, 129, 0.1)", color: "#10b981" },
                  { score: "70 - 89", label: "Productive", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>, desc: "Solid work session with healthy context switching.", quote: "Productivity is being able to do things that you were never able to do before.", bg: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" },
                  { score: "50 - 69", label: "Stable", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, desc: "Balanced activity. Equal amounts of work and casual browsing.", quote: "Balance is not something you find, it's something you create.", bg: "rgba(100, 116, 139, 0.1)", color: "#64748b" },
                  { score: "30 - 49", label: "Minor Distractions", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, desc: "Slight rest is munching on productivity kinda. Easy to get back on track.", quote: "Starve your distractions, feed your focus.", bg: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" },
                  { score: "15 - 29", label: "Distracted", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, desc: "High distraction ratio. Most time spent on unproductive sites.", quote: "You can't do big things if you're distracted by small things.", bg: "rgba(239, 68, 68, 0.1)", color: "#ef4444" },
                  { score: "0 - 14", label: "Critical Focus Loss", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>, desc: "Non-productive state. Complete loss of focus on core tasks.", quote: "Action without focus is just busywork.", bg: "rgba(225, 29, 72, 0.1)", color: "#e11d48" }
                ] : [
                  { score: "90 - 100", label: "Highly Productive", icon: "🌳", desc: "Highly focused on useful stuff. Almost zero time wasted.", quote: "Deep work is the superpower of the 21st century.", bg: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)", color: "#065f46" },
                  { score: "70 - 89", label: "Focus Mode Stable", icon: "🌻", desc: "Solid work session with healthy context switching.", quote: "Productivity is being able to do things that you were never able to do before.", bg: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)", color: "#166534" },
                  { score: "50 - 69", label: "Moderately Productive", icon: "🪴", desc: "Balanced activity. Equal amounts of work and casual browsing.", quote: "Balance is not something you find, it's something you create.", bg: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)", color: "#1e40af" },
                  { score: "30 - 49", label: "Mildly Distracted", icon: "😨", desc: "Slight rest is munching on productivity kinda. Easy to get back on track.", quote: "Starve your distractions, feed your focus.", bg: "linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)", color: "#854d0e" },
                  { score: "15 - 29", label: "Highly Distracted", icon: "😵‍💫", desc: "High distraction ratio. Most time spent on unproductive sites.", quote: "You can't do big things if you're distracted by small things.", bg: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)", color: "#991b1b" },
                  { score: "0 - 14", label: "Critically Distracted", icon: "😱", desc: "Non-productive state. Complete loss of focus on core tasks.", quote: "Action without focus is just busywork.", bg: "linear-gradient(135deg, #fecdd3 0%, #fda4af 100%)", color: "#9f1239" }
                ]).map((item, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: iconStyle === "minimal" ? '12px' : '50%', background: item.bg, color: item.color, border: iconStyle === "minimal" ? `1px solid ${item.color}40` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: iconStyle === "playful" ? '24px' : undefined }}>
                        {item.icon}
                      </div>
                      <div style={{ fontWeight: 800, color: item.color, fontSize: '15px', background: item.bg, padding: '6px 12px', borderRadius: '8px', border: iconStyle === "minimal" ? `1px solid ${item.color}30` : `1px solid ${item.color}20` }}>
                        {item.score}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '16px', marginBottom: '6px' }}>{item.label}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5, flex: 1 }}>{item.desc}</div>
                    <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', borderLeft: `3px solid ${item.color}`, fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
                      &quot;{item.quote}&quot;
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All Domains Modal */}
        {showAllDomainsModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="all-domains-modal-title" onClick={() => setShowAllDomainsModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '95vw', padding: '24px', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
                <h3 id="all-domains-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  All Unique Domains
                </h3>
                <button className="btn-icon" onClick={() => setShowAllDomainsModal(false)} aria-label="Close modal">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexShrink: 0 }}>
                <input 
                  type="text" 
                  placeholder="Search domains..." 
                  value={allDomainsSearch}
                  onChange={(e) => setAllDomainsSearch(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}
                />
                <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px' }}>
                  <button onClick={() => setAllDomainsSort("duration")} style={{ padding: '4px 12px', borderRadius: '6px', background: allDomainsSort === "duration" ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: allDomainsSort === "duration" ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: allDomainsSort === "duration" ? 600 : 400 }}>Duration</button>
                  <button onClick={() => setAllDomainsSort("visits")} style={{ padding: '4px 12px', borderRadius: '6px', background: allDomainsSort === "visits" ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: allDomainsSort === "visits" ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: allDomainsSort === "visits" ? 600 : 400 }}>Sessions</button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                {(() => {
                  if (!stats || !stats.topDomains) return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No domains found</div>;
                  
                  const filtered = stats.topDomains.filter(d => d.domain.toLowerCase().includes(allDomainsSearch.toLowerCase()));
                  filtered.sort((a, b) => allDomainsSort === "visits" ? b.visitCount - a.visitCount : b.durationMs - a.durationMs);
                  
                  const maxD = Math.max(...filtered.map(d => d.durationMs), 1);
                  const maxV = Math.max(...filtered.map(d => d.visitCount), 1);

                  if (filtered.length === 0) return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No matching domains</div>;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {filtered.map((item, idx) => {
                        const fillWidth = allDomainsSort === "visits" ? (item.visitCount / maxV) * 100 : (item.durationMs / maxD) * 100;
                        return (
                          <div key={item.domain} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s', background: 'var(--bg-secondary)' }} className="hover-bg-elevated">
                            <div style={{ width: '24px', color: 'var(--text-subtle)', fontSize: '12px', fontWeight: 500, marginRight: '12px', textAlign: 'right', flexShrink: 0 }}>
                              {idx + 1}
                            </div>
                            
                            <img 
                              src={chrome.runtime?.id ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent("https://" + item.domain)}&size=64` : ""} 
                              alt="" 
                              style={{ width: '18px', height: '18px', borderRadius: '3px', marginRight: '14px', flexShrink: 0 }} 
                            />

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', letterSpacing: '-0.01em' }}>{item.domain}</span>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    {formatDuration(item.durationMs)}
                                  </span>
                                  <span style={{ color: 'var(--border-subtle)' }}>•</span>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {item.visitCount} visits
                                  </span>
                                </div>
                              </div>
                              <div style={{ height: '3px', background: 'var(--bg-elevated)', borderRadius: '1.5px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${fillWidth}%`, background: 'var(--brand-purple, #8b5cf6)', borderRadius: '1.5px', opacity: 0.85 }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
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
