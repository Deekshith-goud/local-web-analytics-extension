import { db } from "../storage/db";
import { getCustomRules } from "./productivity-rules";
import { getTimeLimitRules } from "./time-limits";

export type ExportFormat = "json" | "csv" | "pdf";
export type ExportDateRange = "all" | "today" | "this_month" | "custom";

function getRangeStartTimestamp(range: ExportDateRange): number {
  const now = new Date();
  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  if (range === "this_month") {
    now.setDate(now.getDate() - 30);
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  return 0;
}

export function getLocalYYYYMMDD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getRangeDateString(range: ExportDateRange): string {
  const now = new Date();
  if (range === "today") {
    return getLocalYYYYMMDD(now); // YYYY-MM-DD
  }
  if (range === "this_month") {
    return getLocalYYYYMMDD(now).substring(0, 7); // YYYY-MM
  }
  return "";
}

/**
 * Generates a Blob containing either a full JSON backup or a clean CSV report.
 */
export async function generateExportBlob(format: ExportFormat, range: ExportDateRange, customStart?: number, customEnd?: number): Promise<Blob> {
  if (format === "json") {
    return generateJsonBackup(range, customStart, customEnd);
  } else {
    return generateCsvReport(range, customStart, customEnd);
  }
}

async function generateJsonBackup(range: ExportDateRange, customStart?: number, customEnd?: number): Promise<Blob> {
  const minDateStr = getRangeDateString(range);
  const minTs = range === "custom" && customStart ? customStart : getRangeStartTimestamp(range);
  const maxTs = range === "custom" && customEnd ? customEnd : Date.now();

  let activities = await db.activities.toArray();
  let dailyDomainStats = await db.dailyDomainStats.toArray();
  let dailyTotals = await db.dailyTotals.toArray();

  if (range !== "all") {
    activities = activities.filter(a => a.startTime >= minTs && a.startTime <= maxTs);
    if (range === "custom" && customStart && customEnd) {
      const startStr = getLocalYYYYMMDD(new Date(customStart));
      const endStr = getLocalYYYYMMDD(new Date(customEnd));
      dailyDomainStats = dailyDomainStats.filter(d => d.date >= startStr && d.date <= endStr);
      dailyTotals = dailyTotals.filter(d => d.date >= startStr && d.date <= endStr);
    } else {
      dailyDomainStats = dailyDomainStats.filter(d => d.date.startsWith(minDateStr));
      dailyTotals = dailyTotals.filter(d => d.date.startsWith(minDateStr));
    }
  }

  const rules = await getCustomRules();
  const timeLimits = await getTimeLimitRules();

  const backupData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: 1,
      range,
      customStart,
      customEnd
    },
    database: {
      activities,
      dailyDomainStats,
      dailyTotals
    },
    storage: {
      rules,
      timeLimits
    }
  };

  return new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
}

async function generateCsvReport(range: ExportDateRange, customStart?: number, customEnd?: number): Promise<Blob> {
  const minTs = range === "custom" && customStart ? customStart : getRangeStartTimestamp(range);
  const maxTs = range === "custom" && customEnd ? customEnd : Date.now();
  
  let activities = await db.activities.toArray();
  if (range !== "all") {
    activities = activities.filter(a => a.startTime >= minTs && a.startTime <= maxTs);
  }

  const rules = await getCustomRules();
  const getCategory = (domain: string) => {
    const rule = rules.find(r => r.domain === domain);
    return rule ? rule.category : "unknown";
  };

  // Aggregate by Date + Domain on the fly since pre-aggregate tables are unpopulated
  const statsMap: Record<string, { date: string; domain: string; durationMs: number; visitCount: number }> = {};

  activities.forEach(a => {
    const dateStr = getLocalYYYYMMDD(new Date(a.startTime));
    const key = `${dateStr}:${a.domain}`;
    if (!statsMap[key]) {
      statsMap[key] = { date: dateStr, domain: a.domain, durationMs: 0, visitCount: 0 };
    }
    statsMap[key]!.durationMs += a.durationMs;
    statsMap[key]!.visitCount += 1;
  });

  const stats = Object.values(statsMap);

  // Sort chronologically then alphabetically
  stats.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.domain.localeCompare(b.domain);
  });

  const headers = ["Date", "Domain", "Category", "Duration (Minutes)", "Visits"];
  const rows = stats.map(s => {
    const durationMins = (s.durationMs / 60000).toFixed(2);
    const category = getCategory(s.domain);
    // Quote strings to avoid comma collision in domains
    return `"${s.date}","${s.domain}","${category}","${durationMins}","${s.visitCount}"`;
  });

  const csvContent = [headers.join(","), ...rows].join("\n");
  return new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
}

/**
 * Triggers a secure, local download of the Blob in the user's browser.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
