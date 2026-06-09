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
import timerDemoImg from "url:~assets/timer-demo.png";
import classifyDemoImg from "url:~assets/classify-demo.png";
import blockerDemoImg from "url:~assets/blocker-demo.png";
import { getLocalTodayDateString, getStartOfDayTimestamp } from "../utils/date-utils";
import { downsampleTimeline, computeBarCoordinates } from "../analytics/selectors/transforms";
import { validateProductivityRule, type ProductivityRule, type ProductivityCategory } from "../analytics/productivity-rules";
import type { HistoricalStatsResponse, RuntimeMessage, ActivityRecord, DomainIntervalsResponse, PomodoroState, PomodoroSettings, TimeLimitRule } from "../types/tracking";
import { generateExportBlob, downloadBlob, type ExportFormat, type ExportDateRange } from "../analytics/data-export";
import { db } from "../storage/db";

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
  if (ms <= 0) return "0s";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  
  if (hrs > 0) {
    const remainingMins = min % 60;
    return `${hrs}h ${remainingMins}m`;
  }
  if (min > 0) {
    const remainingSec = sec % 60;
    return remainingSec > 0 ? `${min}m ${remainingSec}s` : `${min}m`;
  }
  return `${sec}s`;
}

type IconStyleType = "minimal" | "playful" | "neon" | "corporate";

function getProductivityLabel(score: number, iconStyle: IconStyleType): string {
  if (iconStyle === "playful") {
    if (score >= 90) return "Highly Productive";
    if (score >= 70) return "Focus Mode Stable";
    if (score >= 50) return "Moderately Productive";
    if (score >= 30) return "Mildly Distracted";
    if (score >= 15) return "Highly Distracted";
    return "Critically Distracted";
  }
  if (iconStyle === "corporate") {
    if (score >= 90) return "Maximum Efficiency";
    if (score >= 70) return "Productive Output";
    if (score >= 50) return "Standard Operations";
    if (score >= 30) return "Minor Deficit";
    if (score >= 15) return "Attention Required";
    return "Critical Intervention";
  }
  if (iconStyle === "neon") {
    if (score >= 90) return "Hyper Focus";
    if (score >= 70) return "In The Zone";
    if (score >= 50) return "Flowing";
    if (score >= 30) return "Glitchy";
    if (score >= 15) return "Lagging";
    return "System Failure";
  }
  // minimal
  if (score >= 90) return "Optimal Focus";
  if (score >= 70) return "Productive";
  if (score >= 50) return "Stable";
  if (score >= 30) return "Minor Distractions";
  if (score >= 15) return "Distracted";
  return "Critical Focus Loss";
}

function getScoreCriteria(iconStyle: IconStyleType) {
  if (iconStyle === "playful") {
    return [
      { score: "90 - 100", label: "Highly Productive", icon: "🌳", desc: "Highly focused on useful stuff. Almost zero time wasted.", quote: "Deep work is the superpower of the 21st century.", bg: "var(--playful-bg-90)", color: "var(--playful-color-90)" },
      { score: "70 - 89", label: "Focus Mode Stable", icon: "🌻", desc: "Solid work session with healthy context switching.", quote: "Productivity is being able to do things that you were never able to do before.", bg: "var(--playful-bg-70)", color: "var(--playful-color-70)" },
      { score: "50 - 69", label: "Moderately Productive", icon: "🪴", desc: "Balanced activity. Equal amounts of work and casual browsing.", quote: "Balance is not something you find, it's something you create.", bg: "var(--playful-bg-50)", color: "var(--playful-color-50)" },
      { score: "30 - 49", label: "Mildly Distracted", icon: "😨", desc: "Slight rest is munching on productivity kinda. Easy to get back on track.", quote: "Starve your distractions, feed your focus.", bg: "var(--playful-bg-30)", color: "var(--playful-color-30)" },
      { score: "15 - 29", label: "Highly Distracted", icon: "😵‍💫", desc: "High distraction ratio. Most time spent on unproductive sites.", quote: "You can't do big things if you're distracted by small things.", bg: "var(--playful-bg-15)", color: "var(--playful-color-15)" },
      { score: "0 - 14", label: "Critically Distracted", icon: "😱", desc: "Non-productive state. Complete loss of focus on core tasks.", quote: "Action without focus is just busywork.", bg: "var(--playful-bg-0)", color: "var(--playful-color-0)" }
    ];
  }
  if (iconStyle === "neon") {
    return [
      { score: "90 - 100", label: "Hyper Focus", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, desc: "Ultimate focus mode engaged.", quote: "The future is built by deep work.", bg: "rgba(0, 255, 204, 0.1)", color: "#00ffcc" },
      { score: "70 - 89", label: "In The Zone", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, desc: "High velocity and stable output.", quote: "Momentum is a product of consistency.", bg: "rgba(0, 170, 255, 0.1)", color: "#00aaff" },
      { score: "50 - 69", label: "Flowing", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>, desc: "Standard performance matrix.", quote: "Keep the systems running.", bg: "rgba(168, 85, 247, 0.1)", color: "#a855f7" },
      { score: "30 - 49", label: "Glitchy", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, desc: "Minor interruptions detected.", quote: "Realign your bandwidth.", bg: "rgba(255, 204, 0, 0.1)", color: "#ffcc00" },
      { score: "15 - 29", label: "Lagging", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>, desc: "High latency. Reconnect to tasks.", quote: "Disconnect the noise.", bg: "rgba(255, 51, 102, 0.1)", color: "#ff3366" },
      { score: "0 - 14", label: "System Failure", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>, desc: "Complete breakdown of focus parameters.", quote: "Hard reset required.", bg: "rgba(255, 0, 0, 0.1)", color: "#ff0000" }
    ];
  }
  if (iconStyle === "corporate") {
    return [
      { score: "90 - 100", label: "Maximum Efficiency", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, desc: "KPIs exceeded.", quote: "Productivity drives profitability.", bg: "rgba(16, 185, 129, 0.1)", color: "#10b981" },
      { score: "70 - 89", label: "Productive Output", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>, desc: "Strong quarterly performance equivalent.", quote: "Execution is everything.", bg: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" },
      { score: "50 - 69", label: "Standard Operations", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>, desc: "Operating within acceptable parameters.", quote: "Maintain the baseline.", bg: "rgba(100, 116, 139, 0.1)", color: "#64748b" },
      { score: "30 - 49", label: "Minor Deficit", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, desc: "Operational inefficiencies detected.", quote: "Audit your time allocation.", bg: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" },
      { score: "15 - 29", label: "Attention Required", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>, desc: "Significant deviation from goals.", quote: "Refocus on deliverables.", bg: "rgba(239, 68, 68, 0.1)", color: "#ef4444" },
      { score: "0 - 14", label: "Critical Intervention", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>, desc: "Unacceptable performance metrics.", quote: "Immediate remediation necessary.", bg: "rgba(225, 29, 72, 0.1)", color: "#e11d48" }
    ];
  }
  return [
    { score: "90 - 100", label: "Optimal Focus", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, desc: "Highly focused on useful stuff. Almost zero time wasted.", quote: "Deep work is the superpower of the 21st century.", bg: "rgba(16, 185, 129, 0.1)", color: "#10b981" },
    { score: "70 - 89", label: "Productive", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>, desc: "Solid work session with healthy context switching.", quote: "Productivity is being able to do things that you were never able to do before.", bg: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" },
    { score: "50 - 69", label: "Stable", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, desc: "Balanced activity. Equal amounts of work and casual browsing.", quote: "Balance is not something you find, it's something you create.", bg: "rgba(100, 116, 139, 0.1)", color: "#64748b" },
    { score: "30 - 49", label: "Minor Distractions", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, desc: "Slight rest is munching on productivity kinda. Easy to get back on track.", quote: "Starve your distractions, feed your focus.", bg: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" },
    { score: "15 - 29", label: "Distracted", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, desc: "High distraction ratio. Most time spent on unproductive sites.", quote: "You can't do big things if you're distracted by small things.", bg: "rgba(239, 68, 68, 0.1)", color: "#ef4444" },
    { score: "0 - 14", label: "Critical Focus Loss", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>, desc: "Non-productive state. Complete loss of focus on core tasks.", quote: "Action without focus is just busywork.", bg: "rgba(225, 29, 72, 0.1)", color: "#e11d48" }
  ];
}

function renderScoreIllustration(score: number, iconStyle: IconStyleType) {
  let icon: React.ReactNode;
  let label: string;
  let bg: string;
  let color: string;
  let glow: string = "none";

  const neonGlow = (clr: string) => `inset 0 0 10px ${clr}40, 0 0 15px ${clr}60`;

  if (score >= 90) {
    if (iconStyle === "playful") icon = "🌳";
    else if (iconStyle === "neon") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    else if (iconStyle === "corporate") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    else icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
    
    label = "Optimal";
    color = iconStyle === "neon" ? "#00ffcc" : "#10b981";
    bg = iconStyle === "playful" ? "var(--playful-bg-90)" : (iconStyle === "neon" ? "rgba(0, 255, 204, 0.1)" : "rgba(16, 185, 129, 0.1)");
    glow = iconStyle === "playful" ? "0 8px 24px rgba(16,185,129,0.25)" : (iconStyle === "neon" ? neonGlow(color) : "none");
  } else if (score >= 70) {
    if (iconStyle === "playful") icon = "🌻";
    else if (iconStyle === "neon") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    else if (iconStyle === "corporate") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
    else icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    
    label = "Productive";
    color = iconStyle === "neon" ? "#00aaff" : "#3b82f6";
    bg = iconStyle === "playful" ? "var(--playful-bg-70)" : (iconStyle === "neon" ? "rgba(0, 170, 255, 0.1)" : "rgba(59, 130, 246, 0.1)");
    glow = iconStyle === "playful" ? "0 8px 24px rgba(34,197,94,0.2)" : (iconStyle === "neon" ? neonGlow(color) : "none");
  } else if (score >= 50) {
    if (iconStyle === "playful") icon = "🪴";
    else if (iconStyle === "neon") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
    else if (iconStyle === "corporate") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
    else icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    
    label = "Stable";
    color = iconStyle === "neon" ? "#a855f7" : "#64748b";
    bg = iconStyle === "playful" ? "var(--playful-bg-50)" : (iconStyle === "neon" ? "rgba(168, 85, 247, 0.1)" : "rgba(100, 116, 139, 0.1)");
    glow = iconStyle === "playful" ? "0 8px 24px rgba(59,130,246,0.2)" : (iconStyle === "neon" ? neonGlow(color) : "none");
  } else if (score >= 30) {
    if (iconStyle === "playful") icon = "😨";
    else if (iconStyle === "neon") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    else if (iconStyle === "corporate") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    else icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
    
    label = "Minor Issues";
    color = iconStyle === "neon" ? "#ffcc00" : "#f59e0b";
    bg = iconStyle === "playful" ? "var(--playful-bg-30)" : (iconStyle === "neon" ? "rgba(255, 204, 0, 0.1)" : "rgba(245, 158, 11, 0.1)");
    glow = iconStyle === "playful" ? "0 8px 24px rgba(245,158,11,0.2)" : (iconStyle === "neon" ? neonGlow(color) : "none");
  } else if (score >= 15) {
    if (iconStyle === "playful") icon = "😵‍💫";
    else if (iconStyle === "neon") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
    else if (iconStyle === "corporate") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
    else icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    
    label = "Distracted";
    color = iconStyle === "neon" ? "#ff3366" : "#ef4444";
    bg = iconStyle === "playful" ? "var(--playful-bg-15)" : (iconStyle === "neon" ? "rgba(255, 51, 102, 0.1)" : "rgba(239, 68, 68, 0.1)");
    glow = iconStyle === "playful" ? "0 8px 24px rgba(239,68,68,0.2)" : (iconStyle === "neon" ? neonGlow(color) : "none");
  } else {
    if (iconStyle === "playful") icon = "😱";
    else if (iconStyle === "neon") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
    else if (iconStyle === "corporate") icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
    else icon = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
    
    label = "Critical";
    color = iconStyle === "neon" ? "#ff0000" : "#e11d48";
    bg = iconStyle === "playful" ? "var(--playful-bg-0)" : (iconStyle === "neon" ? "rgba(255, 0, 0, 0.1)" : "rgba(225, 29, 72, 0.1)");
    glow = iconStyle === "playful" ? "0 8px 24px rgba(220,38,38,0.3)" : (iconStyle === "neon" ? neonGlow(color) : "none");
  }

  const isSquare = iconStyle === "minimal" || iconStyle === "corporate" || iconStyle === "neon";
  
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    }}>
      <div style={{
        width: isSquare ? "64px" : "72px",
        height: isSquare ? "64px" : "72px",
        borderRadius: isSquare ? "12px" : "50%",
        background: bg,
        color: color,
        border: (isSquare && iconStyle !== "neon") ? `1px solid ${color}40` : 'none',
        boxShadow: glow !== "none" ? glow : 'none',
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
  const firstPoint = points[0];
  if (!firstPoint) return "";
  if (points.length === 1) return `M ${firstPoint.x} ${firstPoint.y}`;
  let d = `M ${firstPoint.x} ${firstPoint.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i+1];
    if (!curr || !next) continue;
    const cp1x = curr.x + (next.x - curr.x) / 3;
    const cp1y = curr.y;
    const cp2x = next.x - (next.x - curr.x) / 3;
    const cp2y = next.y;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  return d;
}

const CustomDropdown = ({ value, options, onChange, width }: { value: string, options: {id: string, label: React.ReactNode}[], onChange: (val: string) => void, width?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.id === value) || options[0];

  return (
    <div style={{ position: 'relative', width: width || '100%', minWidth: width ? 'auto' : '220px' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: '10px', color: 'var(--text)', fontSize: '13px', fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.2s',
          boxShadow: isOpen ? '0 0 0 2px var(--accent-bg)' : 'none',
          borderColor: isOpen ? 'var(--accent)' : 'var(--border)'
        }}
      >
        <span>{selectedOption?.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      
      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px',
          padding: '6px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', flexDirection: 'column', gap: '2px', animation: 'tab-fade-in 0.2s ease forwards',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
        }}>
          {options.map(opt => (
            <button
              key={opt.id}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevents blur event on the parent button
                onChange(opt.id);
                setIsOpen(false);
              }}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px',
                background: value === opt.id ? 'var(--accent-bg)' : 'transparent',
                color: value === opt.id ? 'var(--accent)' : 'var(--text)',
                border: 'none', borderRadius: '6px', fontSize: '13px',
                fontWeight: value === opt.id ? 600 : 500, cursor: 'pointer', transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => { if (value !== opt.id) e.currentTarget.style.background = 'var(--surface2)'; }}
              onMouseLeave={(e) => { if (value !== opt.id) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<"analytics" | "rules" | "settings" | "pomodoro">("analytics");
  const [range, setRange] = useState<RangeType>("7days");
  const [stats, setStats] = useState<HistoricalStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light" | "system">("system");
  const [iconStyle, setIconStyle] = useState<IconStyleType>("minimal");
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

  const handleIconStyleChange = (newStyle: string) => {
    setIconStyle(newStyle as IconStyleType);
    chrome.storage.local.set({ iconStyle: newStyle });
  };

  const handleBlobStyleChange = (newStyle: string) => {
    setBlobStyle(newStyle as "glass-dark" | "glass-light" | "brutalist-dark" | "brutalist-light");
    chrome.storage.local.set({ blobStyle: newStyle });
  };

  // Apply Detox Mode to the Dashboard
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
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [showAddLimitModal, setShowAddLimitModal] = useState(false);
  const [allDomainsSort, setAllDomainsSort] = useState<"duration" | "visits">("duration");
  const [allDomainsSearch, setAllDomainsSearch] = useState("");
  const [isQuickClassifyMode, setIsQuickClassifyMode] = useState(false);
  const [quickClassifications, setQuickClassifications] = useState<Record<string, ProductivityCategory>>({});
  const [infoModal, setInfoModal] = useState<"timer" | "classification" | "blocker" | null>(null);

  // Productivity Rules Tab States
  const [customRules, setCustomRules] = useState<ProductivityRule[]>([]);
  const [defaultRules, setDefaultRules] = useState<ProductivityRule[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [ruleTypeFilter, setRuleTypeFilter] = useState<"all" | "productive" | "distracting" | "neutral" | "unknown">("all");

  // Form States for custom rules creation
  const [newDomain, setNewDomain] = useState("");
  const [newCategory, setNewCategory] = useState<ProductivityCategory>("productive");
  const [newPriority, setNewPriority] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [hoveredTooltip, setHoveredTooltip] = useState<{x: number, y: number, title: string, content: React.ReactNode} | null>(null);
  const [activeChart, setActiveChart] = useState<"total" | "productivity">("total");
  const [domainSort, setDomainSort] = useState<"duration" | "visits">("duration");

  const [selectedDomainModal, setSelectedDomainModal] = useState<string | null>(null);
  const [domainIntervals, setDomainIntervals] = useState<ActivityRecord[]>([]);
  const [isLoadingIntervals, setIsLoadingIntervals] = useState(false);



  const [modalRange, setModalRange] = useState<"7days" | "30days">("7days");

  const [pomodoroState, setPomodoroState] = useState<PomodoroState | null>(null);
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettings | null>(null);
  const [focusInput, setFocusInput] = useState<string>("");
  const [breakInput, setBreakInput] = useState<string>("");
  const [isFocusActive, setIsFocusActive] = useState<boolean>(false);
  const [isBreakActive, setIsBreakActive] = useState<boolean>(false);
  const [, setPomodoroTick] = useState(0);

  const [timeLimitRules, setTimeLimitRules] = useState<TimeLimitRule[]>([]);
  const [newTimeLimitDomain, setNewTimeLimitDomain] = useState("");
  const [newTimeLimitDurationStr, setNewTimeLimitDurationStr] = useState("30");
  const [timeLimitError, setTimeLimitError] = useState<string | null>(null);

  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportRange, setExportRange] = useState<ExportDateRange>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [minAvailableDate, setMinAvailableDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Determine the earliest available date for custom range picker
    db.activities.orderBy("startTime").first().then(firstAct => {
      if (firstAct) {
        const d = new Date(firstAct.startTime);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const minDateStr = `${yyyy}-${mm}-${dd}`;
        setMinAvailableDate(minDateStr);
        setCustomStartDate(minDateStr);
      }
    }).catch(console.error);
  }, []);

  const handleDataExport = async () => {
    try {
      if (exportFormat === "pdf") {
        let url = `./tabs/report.html?range=${exportRange}`;
        if (exportRange === "custom" && customStartDate && customEndDate) {
          url += `&start=${new Date(customStartDate).getTime()}&end=${new Date(customEndDate).getTime() + 86399999}`;
        }
        chrome.tabs.create({ url });
        return;
      }
      setIsExporting(true);
      let customStartMs: number | undefined = undefined;
      let customEndMs: number | undefined = undefined;
      if (exportRange === "custom") {
        if (!customStartDate || !customEndDate) {
          alert("Please select both start and end dates.");
          setIsExporting(false);
          return;
        }
        customStartMs = new Date(customStartDate).getTime();
        customEndMs = new Date(customEndDate).getTime() + 86399999;
      }
      
      const blob = await generateExportBlob(exportFormat, exportRange, customStartMs, customEndMs);
      const ext = exportFormat === "json" ? "json" : "csv";
      downloadBlob(blob, `web-swap-analytics-${exportRange}.${ext}`);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export data. Please check the console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (pomodoroSettings) {
      if (!isFocusActive) {
        setFocusInput(String(Math.floor(pomodoroSettings.focusDurationMs / 60000)));
      }
      if (!isBreakActive) {
        setBreakInput(String(Math.floor(pomodoroSettings.breakDurationMs / 60000)));
      }
    }
  }, [pomodoroSettings, isFocusActive, isBreakActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === "rules") {
      const fetchPomodoro = () => {
        chrome.runtime.sendMessage({ type: "GET_POMODORO_STATE", version: 1 }, (res) => {
          setPomodoroState(res);
        });
        chrome.runtime.sendMessage({ type: "GET_POMODORO_SETTINGS", version: 1 }, (res) => {
          setPomodoroSettings(res);
        });
      };
      fetchPomodoro();
      interval = setInterval(() => {
        fetchPomodoro();
        setPomodoroTick(t => t + 1);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [activeTab]);

  const handlePomodoroAction = (action: "START_POMODORO" | "PAUSE_POMODORO" | "RESUME_POMODORO" | "STOP_POMODORO", phase?: "focus" | "break") => {
    chrome.runtime.sendMessage({ type: action, version: 1, phase }, (res) => {
      setPomodoroState(res);
    });
  };

  const handlePomodoroSettingToggle = (key: keyof PomodoroSettings) => {
    if (!pomodoroSettings) return;
    const newSettings = { ...pomodoroSettings, [key]: !pomodoroSettings[key] };
    setPomodoroSettings(newSettings);
    chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
  };

  const handlePomodoroDurationChange = (key: 'focusDurationMs' | 'breakDurationMs', minutes: number) => {
    if (!pomodoroSettings || isNaN(minutes) || minutes < 1) return;
    const newSettings = { ...pomodoroSettings, [key]: minutes * 60 * 1000 };
    setPomodoroSettings(newSettings);
    chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
  };

  const handlePomodoroMessageChange = (key: 'customFocusMessage' | 'customBreakMessage', message: string) => {
    if (!pomodoroSettings) return;
    const newSettings = { ...pomodoroSettings, [key]: message };
    setPomodoroSettings(newSettings);
    chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
  };

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

  const fetchDomainIntervals = React.useCallback((domain: string, specificRange?: "today" | "7days" | "30days") => {
    setSelectedDomainModal(domain);
    setIsLoadingIntervals(true);
    
    // Map "today" to "7days" to provide better visual context in the timeline
    const mappedRange = specificRange === "today" ? "7days" : specificRange;
    const activeRange = mappedRange || modalRange;
    
    if (mappedRange && mappedRange !== modalRange) {
      setModalRange(mappedRange as "7days" | "30days");
    }

    const now = Date.now();
    const todayStr = getLocalTodayDateString();
    const todayStart = getStartOfDayTimestamp(todayStr);
    let sMs = todayStart;
    
    if (activeRange === "7days") sMs = todayStart - 6 * 24 * 60 * 60 * 1000;
    else if (activeRange === "30days") sMs = todayStart - 29 * 24 * 60 * 60 * 1000;

    chrome.runtime.sendMessage(
      {
        type: "GET_DOMAIN_INTERVALS",
        version: 1,
        domain,
        startMs: sMs,
        endMs: now
      } satisfies RuntimeMessage,
      (response: DomainIntervalsResponse) => {
        setIsLoadingIntervals(false);
        if (response && response.intervals) {
          const sorted = [...response.intervals].sort((a, b) => b.startTime - a.startTime);
          setDomainIntervals(sorted);
        } else {
          setDomainIntervals([]);
        }
      }
    );
  }, [modalRange]);

  const groupedIntervals = React.useMemo(() => {
    const groups: Record<string, { date: Date, sessions: ActivityRecord[], totalMs: number }> = {};
    domainIntervals.forEach(interval => {
      const d = new Date(interval.startTime);
      const dateStr = d.toLocaleDateString();
      if (!groups[dateStr]) {
         groups[dateStr] = { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), sessions: [], totalMs: 0 };
      }
      groups[dateStr]!.sessions.push(interval);
      groups[dateStr]!.totalMs += interval.durationMs;
    });
    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [domainIntervals]);

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
      (response: { success: boolean; customRules?: ProductivityRule[]; defaultRules?: ProductivityRule[]; error?: string }) => {
        if (response && response.success) {
          setCustomRules(response.customRules ?? []);
          setDefaultRules(response.defaultRules ?? []);
        }
      }
    );
    chrome.runtime.sendMessage(
      { type: "GET_TIME_LIMIT_RULES", version: 1 },
      (res: { success: boolean; rules?: TimeLimitRule[] }) => {
        if (res && res.success) {
          setTimeLimitRules(res.rules ?? []);
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
      // Returning all 24 hours prevents the chart from stretching early-day data into a giant blob.
      if (stats.hourlyTimeline && stats.hourlyTimeline.length > 0) {
        return stats.hourlyTimeline;
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
        rule.category === ruleTypeFilter;
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
    setShowAddRuleModal(true);
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
          setShowAddRuleModal(false);
          fetchStats(); // Update live statistics metrics on rule change
        } else {
          setFormError(res?.error ?? "Failed to save rule in storage.");
        }
      }
    );
  };

  const handleSaveQuickClassifications = () => {
    const domains = Object.keys(quickClassifications);
    if (domains.length === 0) {
      setIsQuickClassifyMode(false);
      return;
    }

    let updatedRules = [...customRules];
    domains.forEach(domain => {
      const category = quickClassifications[domain];
      updatedRules = updatedRules.filter(r => r.domain !== domain);
      updatedRules.push({
        domain,
        category: category!,
        priority: 1,
        createdAt: Date.now()
      });
    });

    chrome.runtime.sendMessage(
      {
        type: "SAVE_PRODUCTIVITY_RULES",
        version: 1,
        rules: updatedRules
      } satisfies RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        if (res && res.success) {
          setCustomRules(updatedRules);
          setQuickClassifications({});
          setIsQuickClassifyMode(false);
          fetchStats(); // Update live stats
        } else {
          alert(res?.error ?? "Failed to save quick classifications.");
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
      rules: customRules,
      timeLimits: timeLimitRules
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

        if (parsed.schema !== "web-swap-productivity-rules" || parsed.version !== 1) {
          alert("Invalid schema file. Must be a valid web-swap rules configuration.");
          return;
        }

        const importedRules: ProductivityRule[] = [];
        if (Array.isArray(parsed.rules)) {
          for (const rule of parsed.rules) {
            const check = validateProductivityRule(rule);
            if (check) {
              alert(`Validation failed for category rule '${rule?.domain}': ${check}`);
              return;
            }
            importedRules.push({
              domain: rule.domain,
              category: rule.category,
              priority: rule.priority,
              createdAt: rule.createdAt ?? Date.now()
            });
          }
        }

        const importedTimeLimits: TimeLimitRule[] = [];
        if (Array.isArray(parsed.timeLimits)) {
          for (const limit of parsed.timeLimits) {
            if (!limit.domain || typeof limit.domain !== "string") {
              alert("Validation failed for time limit: missing/invalid domain");
              return;
            }
            if (typeof limit.maxDurationMs !== "number" || limit.maxDurationMs <= 0) {
              alert(`Validation failed for time limit on '${limit.domain}': invalid duration`);
              return;
            }
            importedTimeLimits.push({
              domain: limit.domain,
              maxDurationMs: limit.maxDurationMs,
              createdAt: limit.createdAt ?? Date.now(),
              enabled: limit.enabled ?? true
            });
          }
        }

        if (confirm(`Importing ${importedRules.length} category rules and ${importedTimeLimits.length} time limits. Overwrite existing rules?`)) {
          chrome.runtime.sendMessage(
            { type: "SAVE_PRODUCTIVITY_RULES", version: 1, rules: importedRules },
            (res: { success: boolean; error?: string }) => {
              if (res && res.success) {
                setCustomRules(importedRules);
                
                chrome.runtime.sendMessage(
                  { type: "SAVE_TIME_LIMIT_RULES", version: 1, rules: importedTimeLimits },
                  (resTL: { success: boolean; error?: string }) => {
                    if (resTL && resTL.success) {
                      setTimeLimitRules(importedTimeLimits);
                      fetchStats();
                      alert("Rules and Time Limits imported successfully!");
                    } else {
                      alert(resTL?.error ?? "Failed to save imported time limits.");
                    }
                  }
                );
              } else {
                alert(res?.error ?? "Failed to save imported category rules.");
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

  const handleAddTimeLimit = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeLimitError(null);
    const domain = newTimeLimitDomain.trim().toLowerCase();
    const durationMins = parseInt(newTimeLimitDurationStr, 10);
    if (!domain || isNaN(durationMins) || durationMins < 1) {
      setTimeLimitError("Valid domain and duration > 0 required.");
      return;
    }
    const maxDurationMs = durationMins * 60 * 1000;
    const newRule: TimeLimitRule = { domain, maxDurationMs, createdAt: Date.now() };
    const updated = [...timeLimitRules.filter(r => r.domain !== domain), newRule];
    chrome.runtime.sendMessage({ type: "SAVE_TIME_LIMIT_RULES", version: 1, rules: updated }, (res) => {
      if (chrome.runtime.lastError) {
        setTimeLimitError("Connection error: " + chrome.runtime.lastError.message);
        return;
      }
      if (res && res.success) {
        setTimeLimitRules(updated);
        setNewTimeLimitDomain("");
        setNewTimeLimitDurationStr("30");
        setShowAddLimitModal(false);
      } else {
        setTimeLimitError(res?.error || "Failed to save time limit rule.");
      }
    });
  };

  const handleDeleteTimeLimit = (domain: string) => {
    const updated = timeLimitRules.filter(r => r.domain !== domain);
    chrome.runtime.sendMessage({ type: "SAVE_TIME_LIMIT_RULES", version: 1, rules: updated }, (res) => {
      if (res && res.success) {
        setTimeLimitRules(updated);
      }
    });
  };

  const handleToggleTimeLimit = (domain: string) => {
    const updated = timeLimitRules.map(r => 
      r.domain === domain ? { ...r, enabled: r.enabled === false ? true : false } : r
    );
    chrome.runtime.sendMessage({ type: "SAVE_TIME_LIMIT_RULES", version: 1, rules: updated }, (res) => {
      if (res && res.success) {
        setTimeLimitRules(updated);
      }
    });
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
        <header className="dashboard-header" role="banner" style={{ marginBottom: '28px' }}>
          <div className="brand-section" style={{ flex: 1 }}>
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

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {/* Filter group hidden when not on analytics tab */}
            <nav aria-label="Dashboard range selection" style={{ visibility: activeTab === "analytics" ? "visible" : "hidden", transition: "opacity 0.2s", opacity: activeTab === "analytics" ? 1 : 0 }}>
              <div className="filter-group" style={{ whiteSpace: 'nowrap' }}>
                <button className={`filter-btn ${range === "today" ? "active" : ""}`} onClick={() => setRange("today")} aria-pressed={range === "today"} tabIndex={activeTab === "analytics" ? 0 : -1} style={{ whiteSpace: 'nowrap' }}>Today</button>
                <button className={`filter-btn ${range === "7days" ? "active" : ""}`} onClick={() => setRange("7days")} aria-pressed={range === "7days"} tabIndex={activeTab === "analytics" ? 0 : -1} style={{ whiteSpace: 'nowrap' }}>Last 7 Days</button>
                <button className={`filter-btn ${range === "30days" ? "active" : ""}`} onClick={() => setRange("30days")} aria-pressed={range === "30days"} tabIndex={activeTab === "analytics" ? 0 : -1} style={{ whiteSpace: 'nowrap' }}>Last 30 Days</button>
              </div>
            </nav>
            
            {/* Theme toggler pushed to absolute right edge */}
            <button
              onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
              style={{
                marginLeft: 'auto',
                background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'var(--surface)',
                border: theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)',
                borderRadius: '24px',
                width: '64px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                cursor: 'pointer',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: '0 4px',
                overflow: 'hidden',
                flexShrink: 0
              }}
              aria-label="Toggle Theme"
              title="Toggle Theme"
            >
              <div style={{
                position: 'absolute',
                left: theme === 'dark' ? '32px' : '4px',
                width: '24px',
                height: '24px',
                background: theme === 'dark' ? '#1e293b' : '#fff',
                borderRadius: '50%',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2
              }}>
                {theme === 'dark' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#60a5fa" stroke="#60a5fa" strokeWidth="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px', zIndex: 1, color: 'var(--text-secondary)' }}>
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              </div>
            </button>
          </div>
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
              <div className="vis-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '74px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  {activeChart === "total" ? "Total Browsing Time" : "Productivity vs Distraction"}
                  <span style={{ margin: 0 }}>{range === "today" ? "Hourly intervals" : "Daily aggregates"}</span>
                </div>
                
                <div style={{ flex: 1.5, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '64px' }}>
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
                <div className="chart-tabs" style={{ display: 'flex', gap: '4px', fontSize: '12px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', flex: 1, justifyContent: 'flex-end', flexWrap: 'nowrap', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                   <button 
                     onClick={() => setActiveChart("total")} 
                     style={{ 
                       padding: '6px 10px', 
                       borderRadius: '6px', 
                       background: activeChart === "total" ? 'var(--bg-elevated)' : 'transparent', 
                       border: 'none', 
                       boxShadow: activeChart === "total" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                       color: activeChart === "total" ? 'var(--text-primary)' : 'var(--text-secondary)', 
                       cursor: 'pointer',
                       fontWeight: activeChart === "total" ? 600 : 400,
                       whiteSpace: 'nowrap'
                     }}
                   >
                     Total Time
                   </button>
                   <button 
                     onClick={() => setActiveChart("productivity")} 
                     style={{ 
                       padding: '6px 10px', 
                       borderRadius: '6px', 
                       background: activeChart === "productivity" ? 'var(--bg-elevated)' : 'transparent', 
                       border: 'none', 
                       boxShadow: activeChart === "productivity" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                       color: activeChart === "productivity" ? 'var(--text-primary)' : 'var(--text-secondary)', 
                       cursor: 'pointer',
                       fontWeight: activeChart === "productivity" ? 600 : 400,
                       whiteSpace: 'nowrap'
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
                              fill={isMax ? "url(#capsuleHighlightGradient)" : bar.height <= 2 ? "rgba(255, 255, 255, 0.05)" : "url(#capsuleBrandGradient)"}
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
                      <div 
                        className="leaderboard-row hover-bg-elevated" 
                        key={item.domain} 
                        style={{ padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' }}
                        onClick={() => fetchDomainIntervals(item.domain)}
                        title="Click to view full session timeline"
                      >
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
              <div className="rules-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '18px', margin: 0 }}>Pomodoro Timer</h3>
                  <button type="button" className="btn-icon" onClick={() => setInfoModal("timer")} aria-label="About Timer" style={{ padding: '4px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  </button>
                </div>
                
                {pomodoroState && pomodoroSettings ? (() => {
                  const isRunning = pomodoroState.status !== "idle";
                  const isPaused = pomodoroState.pausedTimeRemaining !== undefined;
                  
                  let remainingMs = pomodoroState.durationMs || 0;
                  if (isRunning) {
                    if (isPaused) {
                      remainingMs = pomodoroState.pausedTimeRemaining || 0;
                    } else {
                      const elapsed = Date.now() - pomodoroState.startTime;
                      remainingMs = Math.max(0, (pomodoroState.durationMs || 0) - elapsed);
                    }
                  }
                  
                  const minutes = Math.floor((remainingMs || 0) / 60000);
                  const seconds = Math.floor(((remainingMs || 0) % 60000) / 1000);
                  const progressPct = (isRunning && pomodoroState.durationMs > 0) ? (((pomodoroState.durationMs - remainingMs) / pomodoroState.durationMs) * 100) : 0;
                  
                  const radius = 80;
                  const circumference = 2 * Math.PI * radius;
                  const offset = circumference - (progressPct / 100) * circumference;

                  const renderTimer = () => {
                    const style = pomodoroSettings.timerStyle || 'typographic';
                    const color = pomodoroState.status === 'break' ? '#10b981' : 'var(--accent)';
                    
                    if (style === 'neumorphic') {
                      return (
                        <div style={{ position: 'relative', width: '220px', height: '220px', marginBottom: '32px', marginTop: '16px', borderRadius: '50%', background: 'var(--surface)', boxShadow: 'inset 8px 8px 16px rgba(0,0,0,0.2), inset -8px -8px 16px rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ position: 'absolute', inset: '15px', borderRadius: '50%', background: 'var(--surface2)', boxShadow: '8px 8px 16px rgba(0,0,0,0.2), -8px -8px 16px rgba(255,255,255,0.05)' }}></div>
                          <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                            <circle cx="110" cy="110" r={radius} fill="none" stroke="transparent" strokeWidth="12" />
                            <circle cx="110" cy="110" r={radius} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={Number.isNaN(offset) ? 0 : offset} style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' }} />
                          </svg>
                          <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '48px', fontWeight: 400, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
                              {String(minutes || 0).padStart(2, '0')}:{String(seconds || 0).padStart(2, '0')}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: color, textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '6px', opacity: 0.9 }}>
                              {pomodoroState.status === "idle" ? "Ready" : pomodoroState.status === "focus" ? "Focusing" : "Break Time"}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (style === 'horizontal') {
                      return (
                        <div style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px', marginTop: '24px' }}>
                          <div style={{ fontSize: '72px', fontWeight: 300, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em', lineHeight: 1 }}>
                            {String(minutes || 0).padStart(2, '0')}<span style={{ opacity: 0.3, fontWeight: 200 }}>:</span>{String(seconds || 0).padStart(2, '0')}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: color, textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: '12px', marginBottom: '24px', opacity: 0.9 }}>
                            {pomodoroState.status === "idle" ? "Ready" : pomodoroState.status === "focus" ? "Focusing" : "Break Time"}
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'var(--track-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${100 - progressPct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 1s linear', boxShadow: `0 0 10px ${color}60` }}></div>
                          </div>
                        </div>
                      );
                    }
                    
                    if (style === 'glass' || style === 'breathing') {
                      // Removed styles
                    }

                    // typographic (default)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', marginBottom: '32px', marginTop: '16px' }}>
                        <div style={{ fontSize: '84px', fontWeight: 300, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.05em', lineHeight: 1 }}>
                          {String(minutes || 0).padStart(2, '0')}<span style={{ opacity: 0.2, fontWeight: 200 }}>:</span>{String(seconds || 0).padStart(2, '0')}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: color, textTransform: 'uppercase', letterSpacing: '0.25em', marginTop: '12px', opacity: 0.8 }}>
                          {pomodoroState.status === "idle" ? "Ready" : pomodoroState.status === "focus" ? "Focusing" : "Break Time"}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {renderTimer()}

                      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                        {pomodoroState.status === "idle" ? (
                          <>
                            <button className="btn-primary" onClick={() => handlePomodoroAction("START_POMODORO", "focus")} style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 500, borderRadius: '100px', background: 'linear-gradient(135deg, #a78bfa, #6366f1)', boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                              Focus
                            </button>
                            <button className="btn-secondary" onClick={() => handlePomodoroAction("START_POMODORO", "break")} style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 500, borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', background: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                              Break
                            </button>
                          </>
                        ) : (
                          <>
                            {isPaused ? (
                              <button className="btn-primary" onClick={() => handlePomodoroAction("RESUME_POMODORO")} style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 500, borderRadius: '100px', background: 'linear-gradient(135deg, #a78bfa, #6366f1)', boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                Resume
                              </button>
                            ) : (
                              <button className="btn-secondary" onClick={() => handlePomodoroAction("PAUSE_POMODORO")} style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 500, borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', background: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                Pause
                              </button>
                            )}
                            <button className="btn-danger-outline" onClick={() => handlePomodoroAction("STOP_POMODORO")} style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 500, borderRadius: '100px', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#ef4444', background: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                              Stop
                            </button>
                          </>
                        )}
                      </div>
                      
                      <div style={{ width: '100%', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="settings-row">
                              <div className="settings-row-left">
                                <div>
                                  <div className="settings-row-title">Timer Style</div>
                                  <div className="settings-row-desc">Customize timer appearance</div>
                                </div>
                              </div>
                              <CustomDropdown
                                value={pomodoroSettings.timerStyle === 'minimal' ? 'typographic' : (pomodoroSettings.timerStyle || 'typographic')}
                                options={[
                                  { id: 'typographic', label: 'Typographic' },
                                  { id: 'neumorphic', label: 'Neumorphic' },
                                  { id: 'horizontal', label: 'Horizontal Dash' }
                                ]}
                                onChange={(val) => {
                                  const newSettings = { ...pomodoroSettings, timerStyle: val as PomodoroSettings['timerStyle'] } as PomodoroSettings;
                                  setPomodoroSettings(newSettings);
                                  chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
                                }}
                                width="140px"
                              />
                            </div>
                            <div className="settings-row">
                              <div className="settings-row-left">
                                <label className="toggle-switch">
                                  <input type="checkbox" checked={pomodoroSettings.soundEnabled} onChange={() => handlePomodoroSettingToggle('soundEnabled')} />
                                  <span className="toggle-slider"></span>
                                </label>
                                <div>
                                  <div className="settings-row-title">Play Sound</div>
                                  <div className="settings-row-desc">Audio alert on completion</div>
                                </div>
                              </div>
                              {pomodoroSettings.soundEnabled && (
                                <CustomDropdown
                                  value={pomodoroSettings.soundId || 'beep'}
                                  options={[
                                    { id: 'beep', label: 'Beep' },
                                    { id: 'chime', label: 'Chime' },
                                    { id: 'digital', label: 'Digital' },
                                  ]}
                                  onChange={(val) => {
                                    const newSettings = { ...pomodoroSettings, soundId: val };
                                    setPomodoroSettings(newSettings);
                                    chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
                                  }}
                                  width="120px"
                                />
                              )}
                            </div>

                            <div className="settings-row">
                              <div className="settings-row-left">
                                <label className="toggle-switch">
                                  <input type="checkbox" checked={pomodoroSettings.notificationEnabled} onChange={() => handlePomodoroSettingToggle('notificationEnabled')} />
                                  <span className="toggle-slider"></span>
                                </label>
                                <div>
                                  <div className="settings-row-title">Show Notification</div>
                                  <div className="settings-row-desc">Desktop alert on completion</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px' }}>
                            <div className="premium-input-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Focus (M)</label>
                              <div className="premium-input-wrapper">
                                <div className="premium-input-icon">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </div>
                                <input 
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  className="premium-input"
                                  value={focusInput}
                                  onFocus={() => setIsFocusActive(true)}
                                  onBlur={(e) => {
                                    setIsFocusActive(false);
                                    const val = e.target.value;
                                    const parsed = parseInt(val, 10);
                                    if (!val || isNaN(parsed) || parsed < 1) {
                                      setFocusInput(String(Math.floor((pomodoroSettings?.focusDurationMs || 25 * 60000) / 60000)));
                                    } else {
                                      handlePomodoroDurationChange('focusDurationMs', parsed);
                                    }
                                  }}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setFocusInput(val);
                                  }}
                                  disabled={pomodoroState.status !== "idle"}
                                  placeholder="25"
                                />
                              </div>
                            </div>
                            <div className="premium-input-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Break (M)</label>
                              <div className="premium-input-wrapper">
                                <div className="premium-input-icon">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                                </div>
                                <input 
                                  type="text" 
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  className="premium-input"
                                  value={breakInput}
                                  onFocus={() => setIsBreakActive(true)}
                                  onBlur={(e) => {
                                    setIsBreakActive(false);
                                    const val = e.target.value;
                                    const parsed = parseInt(val, 10);
                                    if (!val || isNaN(parsed) || parsed < 1) {
                                      setBreakInput(String(Math.floor((pomodoroSettings?.breakDurationMs || 5 * 60000) / 60000)));
                                    } else {
                                      handlePomodoroDurationChange('breakDurationMs', parsed);
                                    }
                                  }}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setBreakInput(val);
                                  }}
                                  disabled={pomodoroState.status !== "idle"}
                                  placeholder="5"
                                />
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                            <div className="premium-input-group">
                              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Custom Focus Message (Optional)</label>
                              <div className="premium-input-wrapper">
                                <div className="premium-input-icon">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
                                </div>
                                <input 
                                  type="text" 
                                  className="premium-input" 
                                  value={pomodoroSettings.customFocusMessage || ""}
                                  onChange={(e) => handlePomodoroMessageChange('customFocusMessage', e.target.value)}
                                  placeholder="Great job! Time for a short break."
                                />
                              </div>
                            </div>
                            <div className="premium-input-group">
                              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Custom Break Message (Optional)</label>
                              <div className="premium-input-wrapper">
                                <div className="premium-input-icon">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
                                </div>
                                <input 
                                  type="text" 
                                  className="premium-input" 
                                  value={pomodoroSettings.customBreakMessage || ""}
                                  onChange={(e) => handlePomodoroMessageChange('customBreakMessage', e.target.value)}
                                  placeholder="Time to get back to focus."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>Loading...</div>
                )}
              </div>
            </div>

            <div className="rules-main" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <div className="rules-card" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ margin: 0 }}>Active Classifications</h3>
                    <button type="button" className="btn-icon" onClick={() => setInfoModal("classification")} aria-label="About Classifications" style={{ padding: '4px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </button>
                  </div>
                  <div>
                    <button type="button" className="btn-primary-elegant" style={{ boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }} onClick={() => setShowAddRuleModal(true)}>
                      <span style={{ fontSize: '18px', fontWeight: 300, marginRight: '6px', lineHeight: 1 }}>+</span> Add Custom Rule
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input
                      type="text"
                      className="modal-input-elegant"
                      placeholder="Search domains..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: "100%", paddingLeft: "36px" }}
                      aria-label="Search rules by domain"
                    />
                  </div>
                  <select
                    className="modal-input-elegant"
                    value={ruleTypeFilter}
                    onChange={(e) => setRuleTypeFilter(e.target.value as 'all' | 'productive' | 'distracting' | 'neutral' | 'unknown')}
                    aria-label="Filter rules by type"
                    style={{ width: "150px" }}
                  >
                    <option value="all">All Categories</option>
                    <option value="productive">Productive</option>
                    <option value="distracting">Distracting</option>
                    <option value="neutral">Neutral</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div className="elegant-list-container" style={{ maxHeight: "280px", overflowY: "auto", paddingRight: searchedRules.length > 5 ? "8px" : "0" }}>
                  {searchedRules.length === 0 ? (
                    <div className="vis-empty" style={{ minHeight: "150px" }}>
                      <p className="vis-empty-title">No Rules Found</p>
                      <p className="vis-empty-desc">Adjust your search or filter settings.</p>
                    </div>
                  ) : (
                    <>
                      <div className="elegant-list-header" style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--surface)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase", margin: "-1px 0 0 0" }}>
                        <div className="elegant-row-col domain-col" style={{ flex: 2.5 }}>DOMAIN</div>
                        <div className="elegant-row-col category-col" style={{ flex: 1.5, paddingLeft: "8px" }}>CLASSIFICATION</div>
                        <div className="elegant-row-col actions-col" style={{ flex: 1 }}>ACTIONS</div>
                      </div>
                      {searchedRules.map((rule) => (
                        <div className="elegant-list-row" key={`${rule.domain}-${rule.isCustom ? 'custom' : 'default'}`}>
                          <div className="elegant-row-col domain-col" style={{ flex: 2.5, display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(99,102,241,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <img 
                                src={chrome.runtime?.id ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent("https://" + rule.domain)}&size=32` : ""} 
                                alt="" 
                                style={{ width: "16px", height: "16px", borderRadius: "2px" }} 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text3)"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
                                }}
                              />
                            </div>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1 }}>{rule.domain}</span>
                          </div>
                          <div className="elegant-row-col category-col" style={{ flex: 1.5 }}>
                            <span className={`badge-category ${rule.category}`}>{rule.category.toUpperCase()}</span>
                          </div>
                          <div className="elegant-row-col actions-col" style={{ flex: 1 }}>
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
                              <button type="button" className="btn-icon-elegant" onClick={() => handleEditRule(rule)} title={`Edit rule for ${rule.domain}`} aria-label={`Edit rule for ${rule.domain}`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button type="button" className="btn-icon-elegant" onClick={() => handleDeleteRule(rule.domain)} title={`Delete rule for ${rule.domain}`} aria-label={`Delete rule for ${rule.domain}`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="rules-summary-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", marginTop: "16px", background: "var(--surface)", borderRadius: "8px", border: "1px solid var(--border)", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingRight: "24px", borderRight: "1px solid var(--border)" }}>
                      <div style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", padding: "6px", borderRadius: "6px", display: "flex" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.05em" }}>SUMMARY</span>
                        <span style={{ fontSize: "14px", fontWeight: 700 }}>Total: {allDisplayRules.length}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                       <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                         <svg width="14" height="14" stroke="#10b981" fill="none" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                         <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>Productive</span>
                         <span style={{ fontSize: "14px", fontWeight: 700 }}>{allDisplayRules.filter(r => r.category === 'productive').length}</span>
                       </div>
                       <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                         <svg width="14" height="14" stroke="#f59e0b" fill="none" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                         <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>Distracting</span>
                         <span style={{ fontSize: "14px", fontWeight: 700 }}>{allDisplayRules.filter(r => r.category === 'distracting').length}</span>
                       </div>
                       <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                         <svg width="14" height="14" stroke="#6b7280" fill="none" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                         <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>Neutral</span>
                         <span style={{ fontSize: "14px", fontWeight: 700 }}>{allDisplayRules.filter(r => r.category === 'neutral').length}</span>
                       </div>
                    </div>
                  </div>
                  <button type="button" className="btn-danger-outline" style={{ margin: 0, padding: "8px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }} onClick={handleResetRules}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    Reset All Rules
                  </button>
                </div>
              </div>

              <div className="rules-card" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ margin: 0 }}>Active Time Limits</h3>
                    <button type="button" className="btn-icon" onClick={() => setInfoModal("blocker")} aria-label="About Time Limits" style={{ padding: '4px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button type="button" className="btn-primary-elegant" style={{ boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }} onClick={() => setShowAddLimitModal(true)}>
                      <span style={{ fontSize: '18px', fontWeight: 300, marginRight: '6px', lineHeight: 1 }}>+</span> Add Soft-Block Limit
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, position: 'relative', minHeight: '150px' }}>
                  <div className="elegant-list-container" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", paddingRight: timeLimitRules.length > 5 ? "8px" : "0" }}>
                  {timeLimitRules.length === 0 ? (
                    <div className="vis-empty" style={{ minHeight: "150px" }}>
                      <p className="vis-empty-title">No Limits Set</p>
                      <p className="vis-empty-desc">Add a time limit rule to restrict time spent on specific domains.</p>
                    </div>
                  ) : (
                    timeLimitRules.map((rule) => (
                      <div className="elegant-list-row" key={rule.domain} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <div className="elegant-row-col domain-col" style={{ flex: 2, fontFamily: "monospace", fontSize: "13px" }}>
                          {rule.domain}
                        </div>
                        <div className="elegant-row-col limit-col" style={{ flex: 1, fontFamily: "monospace", fontSize: "13px", color: "var(--text-secondary)" }}>
                          {formatDuration(rule.maxDurationMs).replace(" minutes", "m").replace(" minute", "m")}
                        </div>
                        <div className="elegant-row-col actions-col" style={{ width: "auto" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button 
                              type="button" 
                              className={`btn-icon-elegant ${rule.enabled !== false ? 'success' : ''}`} 
                              onClick={() => handleToggleTimeLimit(rule.domain)} 
                              title={rule.enabled !== false ? `Disable limit for ${rule.domain}` : `Enable limit for ${rule.domain}`}
                              style={{ opacity: rule.enabled !== false ? 1 : 0.4 }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                            </button>
                            <button type="button" className="btn-icon-elegant danger" onClick={() => handleDeleteTimeLimit(rule.domain)} title={`Delete limit for ${rule.domain}`}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}


        {activeTab === "settings" && (
        <section className="settings-panel-layout tab-panel" aria-label="Settings and Data Control">
            {/* Theme card */}
            <div className="settings-card" style={{ flexWrap: "wrap" }}>
              <div className="settings-card-icon blue" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </div>
              <div className="settings-card-body">
                <h3>Theme & Appearance</h3>
                <p style={{ marginBottom: 12 }}>Select your preferred user interface appearance and iconography style.</p>
                <div className="theme-selector-group" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '16px' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Iconography Style</span>
                    <CustomDropdown
                      value={iconStyle}
                      onChange={handleIconStyleChange}
                      options={[
                        { id: 'minimal', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Minimal</div> },
                        { id: 'playful', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> Playful</div> },
                        { id: 'neon', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Neon</div> },
                        { id: 'corporate', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> Corporate</div> }
                      ]}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Widget Appearance</span>
                    <CustomDropdown
                      value={blobStyle}
                      onChange={handleBlobStyleChange}
                      options={[
                        { id: 'glass-dark', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/></svg> Glass Dark</div> },
                        { id: 'glass-light', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg> Glass Light</div> },
                        { id: 'brutalist-dark', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Brutalist Dark</div> },
                        { id: 'brutalist-light', label: <div style={{display:'flex',alignItems:'center',gap:'8px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Brutalist Light</div> }
                      ]}
                    />
                  </div>
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

            {/* Portability */}
            {/* Portability */}
            <div className="settings-card" style={{ padding: '24px' }}>
              <div className="settings-card-body" style={{ width: '100%', display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div className="settings-card-icon blue" aria-hidden="true" style={{ position: 'static', margin: 0, padding: '10px', width: 'auto', height: 'auto' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Data Portability & Export</h3>
                </div>
                <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>Manage your local analytics data and classification rulesets safely. All exports are generated entirely on-device.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                  {/* Analytics Data Export Box */}
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '10px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      </div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Analytics Data</h4>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div className="premium-input-group" style={{ flex: 1, minWidth: '140px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Format</label>
                        <div className="premium-input-wrapper" style={{ background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', position: 'relative' }}>
                          <select className="premium-input" value={exportFormat} onChange={e => setExportFormat(e.target.value as ExportFormat)} style={{ appearance: 'none', backgroundColor: 'transparent', padding: '12px 14px', fontSize: '13px', width: '100%', color: 'var(--text)', border: 'none', outline: 'none', cursor: 'pointer' }}>
                            <option value="csv" style={{ background: 'var(--bg)', color: 'var(--text)' }}>CSV (Spreadsheet Report)</option>
                            <option value="json" style={{ background: 'var(--bg)', color: 'var(--text)' }}>JSON (Full Backup)</option>
                            <option value="pdf" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Visual Report (PDF/Print)</option>
                          </select>
                          <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </div>
                      </div>

                      <div className="premium-input-group" style={{ flex: 1, minWidth: '120px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Time Range</label>
                        <div className="premium-input-wrapper" style={{ background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', position: 'relative' }}>
                          <select className="premium-input" value={exportRange} onChange={e => setExportRange(e.target.value as ExportDateRange)} style={{ appearance: 'none', backgroundColor: 'transparent', padding: '12px 14px', fontSize: '13px', width: '100%', color: 'var(--text)', border: 'none', outline: 'none', cursor: 'pointer' }}>
                            <option value="all" style={{ background: 'var(--bg)', color: 'var(--text)' }}>All Time</option>
                            <option value="this_month" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Last 30 Days</option>
                            <option value="today" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Today</option>
                            <option value="custom" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Custom Range...</option>
                          </select>
                          <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {exportRange === "custom" && (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '-4px' }}>
                        <div className="premium-input-group" style={{ flex: 1, minWidth: '130px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Start Date</label>
                          <input type="date" value={customStartDate} min={minAvailableDate} max={customEndDate} onChange={e => setCustomStartDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none' }} />
                        </div>
                        <div className="premium-input-group" style={{ flex: 1, minWidth: '130px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>End Date</label>
                          <input type="date" value={customEndDate} min={customStartDate || minAvailableDate} max={new Date().toISOString().split('T')[0]} onChange={e => setCustomEndDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none' }} />
                        </div>
                      </div>
                    )}

                    <button type="button" className="btn-primary" onClick={handleDataExport} disabled={isExporting} style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 600, borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)', color: '#fff', border: 'none', cursor: isExporting ? 'wait' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 'auto' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "8px" }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      {isExporting ? "Exporting Data..." : `Export Analytics Data`}
                    </button>
                  </div>

                  {/* Ruleset Management Box */}
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <div style={{ padding: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '10px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      </div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Ruleset Configuration</h4>
                    </div>
                    
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                      Backup your custom domain classifications and time limits, or import a pre-configured ruleset to quickly set up your workspace.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
                      <button type="button" className="btn-secondary" onClick={handleExportRules} style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 600, borderRadius: '10px', color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export Ruleset Backup
                      </button>
                      <label className="btn-secondary" style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 600, borderRadius: '10px', color: 'var(--text-secondary)', background: 'var(--bg)', border: '1px dashed var(--border)', cursor: "pointer", transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: 0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Import Existing Ruleset
                        <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImportRules} />
                      </label>
                    </div>
                  </div>
                </div>
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
              <h3 id="purge-modal-title" className="modal-title" style={{ color: 'var(--red)' }}>
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
                {getScoreCriteria(iconStyle).map((item, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ 
                        width: '48px', 
                        height: '48px', 
                        borderRadius: (iconStyle === "minimal" || iconStyle === "corporate" || iconStyle === "neon") ? '12px' : '50%', 
                        background: item.bg, 
                        color: item.color, 
                        border: (iconStyle === "minimal" || iconStyle === "corporate") ? `1px solid ${item.color}40` : 'none', 
                        boxShadow: iconStyle === "neon" ? `inset 0 0 10px ${item.color}40, 0 0 15px ${item.color}60` : 'none',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: iconStyle === "playful" ? '24px' : undefined 
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ fontWeight: 800, color: item.color, fontSize: '15px', background: item.bg, padding: '6px 12px', borderRadius: '8px', border: `1px solid ${item.color}30` }}>
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
                {isQuickClassifyMode ? (
                  <button 
                    onClick={handleSaveQuickClassifications}
                    className="btn-primary-elegant" 
                    style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', margin: 0, height: 'auto', display: 'flex', alignItems: 'center' }}
                  >
                    Save Changes
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsQuickClassifyMode(true)}
                    style={{ padding: '6px 14px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center' }}
                  >
                    Quick Classify
                  </button>
                )}
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
                          <div 
                            key={item.domain} 
                            style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s', background: 'var(--bg-secondary)', cursor: isQuickClassifyMode ? 'default' : 'pointer' }} 
                            className="hover-bg-elevated"
                            onClick={() => { if (!isQuickClassifyMode) fetchDomainIntervals(item.domain, range); }}
                            title={isQuickClassifyMode ? "Quick classify" : "Click to view full session timeline"}
                          >
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
                                {isQuickClassifyMode ? (
                                  <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: '6px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                                    <button 
                                      onClick={() => setQuickClassifications(prev => ({ ...prev, [item.domain]: 'productive' }))}
                                      style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRight: '1px solid var(--border-subtle)', background: quickClassifications[item.domain] === 'productive' ? '#10b981' : 'transparent', color: quickClassifications[item.domain] === 'productive' ? '#fff' : '#10b981', cursor: 'pointer', transition: 'all 0.15s' }}
                                    >PROD</button>
                                    <button 
                                      onClick={() => setQuickClassifications(prev => ({ ...prev, [item.domain]: 'distracting' }))}
                                      style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRight: '1px solid var(--border-subtle)', background: quickClassifications[item.domain] === 'distracting' ? '#ef4444' : 'transparent', color: quickClassifications[item.domain] === 'distracting' ? '#fff' : '#ef4444', cursor: 'pointer', transition: 'all 0.15s' }}
                                    >DIST</button>
                                    <button 
                                      onClick={() => setQuickClassifications(prev => ({ ...prev, [item.domain]: 'neutral' }))}
                                      style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, border: 'none', background: quickClassifications[item.domain] === 'neutral' ? '#6b7280' : 'transparent', color: quickClassifications[item.domain] === 'neutral' ? '#fff' : '#6b7280', cursor: 'pointer', transition: 'all 0.15s' }}
                                    >NEUT</button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                      {formatDuration(item.durationMs)}
                                    </span>
                                    <span style={{ color: 'var(--border-subtle)' }}>•</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                      {item.visitCount} visits
                                    </span>
                                  </div>
                                )}
                              </div>
                              {!isQuickClassifyMode && (
                                <div style={{ height: '3px', background: 'var(--bg-elevated)', borderRadius: '1.5px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${fillWidth}%`, background: 'var(--brand-purple, #8b5cf6)', borderRadius: '1.5px', opacity: 0.85 }} />
                                </div>
                              )}
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

        {/* Domain Intervals Modal */}
        {selectedDomainModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="domain-intervals-modal-title" onClick={() => setSelectedDomainModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95vw', padding: '24px', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
                <h3 id="domain-intervals-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', color: 'inherit' }}>
                  <img 
                    src={chrome.runtime?.id ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent("https://" + selectedDomainModal)}&size=64` : ""} 
                    alt="" 
                    style={{ width: '24px', height: '24px', borderRadius: '4px', marginRight: '10px' }} 
                  />
                  <span style={{ color: 'inherit', fontWeight: 600 }}>{selectedDomainModal}</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '14px', fontWeight: 500 }}>Sessions</span>
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '6px', borderRadius: '12px', gap: '6px' }}>
                    <button 
                      onClick={() => fetchDomainIntervals(selectedDomainModal!, "7days")} 
                      style={{ padding: '8px 16px', borderRadius: '8px', background: modalRange === "7days" ? '#3b82f6' : 'transparent', border: 'none', color: modalRange === "7days" ? '#ffffff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: modalRange === "7days" ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none', transform: modalRange === "7days" ? 'scale(1)' : 'scale(0.95)' }}
                      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                      onMouseUp={e => e.currentTarget.style.transform = modalRange === "7days" ? 'scale(1)' : 'scale(0.95)'}
                    >7 Days</button>
                    <button 
                      onClick={() => fetchDomainIntervals(selectedDomainModal!, "30days")} 
                      style={{ padding: '8px 16px', borderRadius: '8px', background: modalRange === "30days" ? '#3b82f6' : 'transparent', border: 'none', color: modalRange === "30days" ? '#ffffff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: modalRange === "30days" ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none', transform: modalRange === "30days" ? 'scale(1)' : 'scale(0.95)' }}
                      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                      onMouseUp={e => e.currentTarget.style.transform = modalRange === "30days" ? 'scale(1)' : 'scale(0.95)'}
                    >30 Days</button>
                  </div>
                  <button className="btn-icon" onClick={() => setSelectedDomainModal(null)} aria-label="Close modal" style={{ marginLeft: '12px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                {isLoadingIntervals ? (
                   <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading sessions...</div>
                ) : domainIntervals.length === 0 ? (
                   <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No sessions found for this timeframe.</div>
                ) : (
                  <div style={{ display: 'flex', height: '500px', padding: '30px 24px 16px 24px', position: 'relative' }}>
                     {/* Y-Axis: Hours */}
                     <div style={{ width: '50px', position: 'relative', borderRight: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, marginRight: '16px', paddingBottom: '50px' }}>
                        <div style={{ position: 'absolute', top: '0%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-subtle)' }}>12 AM</div>
                        <div style={{ position: 'absolute', top: '25%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-subtle)' }}>6 AM</div>
                        <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-subtle)' }}>12 PM</div>
                        <div style={{ position: 'absolute', top: '75%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-subtle)' }}>6 PM</div>
                        <div style={{ position: 'absolute', top: '100%', marginTop: '-50px', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-subtle)' }}>11:59</div>
                     </div>

                     {/* X-Axis Dates & Timeline Columns */}
                     <div style={{ flex: 1, display: 'flex', overflowX: 'auto', paddingBottom: '8px', gap: '6px' }}>
                        {[...groupedIntervals].reverse().map(group => (
                           <div key={group.date.getTime()} style={{ flex: 1, minWidth: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              
                              {/* Timeline Column */}
                              <div style={{ width: '100%', height: 'calc(100% - 50px)', position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                                 {group.sessions.map((session, i) => {
                                    const startOfDay = group.date.getTime();
                                    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
                                    const clampedStart = Math.max(startOfDay, session.startTime);
                                    const clampedEnd = Math.min(endOfDay, session.endTime);
                                    
                                    const topPct = ((clampedStart - startOfDay) / (24 * 60 * 60 * 1000)) * 100;
                                    const heightPct = ((clampedEnd - clampedStart) / (24 * 60 * 60 * 1000)) * 100;
                                    const isLive = session.terminationReason === "idle" && Date.now() - session.endTime < 5000 && i === 0;

                                    return (
                                       <div 
                                          key={session.sessionId}
                                          style={{
                                             position: 'absolute',
                                             top: `${topPct}%`,
                                             height: `${Math.max(0.4, heightPct)}%`,
                                             left: '20%',
                                             right: '20%',
                                             background: isLive ? '#10b981' : '#3b82f6',
                                             borderRadius: '2px',
                                             opacity: 0.9,
                                             cursor: 'pointer',
                                             transition: 'opacity 0.2s, background 0.2s, transform 0.15s',
                                          }}
                                          onMouseEnter={(e) => {
                                             (e.target as HTMLDivElement).style.opacity = '1';
                                             (e.target as HTMLDivElement).style.background = isLive ? '#34d399' : '#60a5fa';
                                             (e.target as HTMLDivElement).style.transform = 'scaleX(1.4)';
                                             (e.target as HTMLDivElement).style.zIndex = '10';
                                          }}
                                          onMouseLeave={(e) => {
                                             (e.target as HTMLDivElement).style.opacity = '0.9';
                                             (e.target as HTMLDivElement).style.background = isLive ? '#10b981' : '#3b82f6';
                                             (e.target as HTMLDivElement).style.transform = 'scaleX(1)';
                                             (e.target as HTMLDivElement).style.zIndex = '1';
                                          }}
                                          title={`${new Date(clampedStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} - ${new Date(clampedEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\nDuration: ${formatDuration(session.durationMs)}\nReason: ${session.terminationReason.replace("-", " ")}${isLive ? ' (LIVE)' : ''}`}
                                       />
                                    );
                                 })}
                              </div>
                              
                              {/* X-Axis Date Label */}
                              <div style={{ height: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '8px' }}>
                                 <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    {group.date.toLocaleDateString(undefined, { weekday: 'short' })}
                                 </span>
                                 <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                    {group.date.getDate()}
                                 </span>
                                 <span style={{ fontSize: '9px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                                    {formatDuration(group.totalMs)}
                                 </span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Custom Rule Modal */}
        {showAddRuleModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-rule-modal-title" onClick={() => setShowAddRuleModal(false)}>
            <div className="modal-content-elegant" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 id="add-rule-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>
                  </div>
                  Add Custom Rule
                </h3>
                <button className="btn-icon-elegant" style={{ border: 'none' }} onClick={() => setShowAddRuleModal(false)} aria-label="Close modal">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <p className="modal-desc" style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '16px', marginBottom: '24px' }}>
                Override the semantic analysis engine with your own domain classification.
              </p>

              {formError && (
                <div className="rules-form-alert error" role="alert">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="rules-form-alert success" role="status">
                  {formSuccess}
                </div>
              )}

              <form className="rules-form" style={{ gap: '16px' }} onSubmit={handleAddRule}>
                <div className="premium-input-group">
                  <label htmlFor="domain-input" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Domain (e.g. youtube.com)</label>
                  <div className="premium-input-wrapper">
                    <div className="premium-input-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    </div>
                    <input
                      id="domain-input"
                      type="text"
                      className="premium-input"
                      placeholder="Enter hostname..."
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="premium-input-group">
                  <label htmlFor="category-select" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Classification Category</label>
                  <div className="premium-input-wrapper">
                    <div className="premium-input-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    </div>
                    <select
                      id="category-select"
                      className="premium-input"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as ProductivityCategory)}
                      required
                      style={{ appearance: 'none', backgroundColor: 'transparent' }}
                    >
                      <option value="productive" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Productive (Deep Work)</option>
                      <option value="distracting" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Distracting (Entertainment)</option>
                      <option value="neutral" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Neutral (Utilities)</option>
                      <option value="unknown" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Unknown (Unclassified)</option>
                    </select>
                    <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '14px 32px', fontSize: '14px', fontWeight: 600, borderRadius: '100px', background: 'linear-gradient(135deg, #a78bfa, #6366f1)', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)', color: '#fff', border: 'none', cursor: 'pointer', transition: 'all 0.2s', width: '100%', marginTop: '8px' }}>
                  Save Custom Rule
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Add Soft-Block Limit Modal */}
        {showAddLimitModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-limit-modal-title" onClick={() => setShowAddLimitModal(false)}>
            <div className="modal-content-elegant" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 id="add-limit-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.1))', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  Add Soft-Block Limit
                </h3>
                <button className="btn-icon-elegant" style={{ border: 'none' }} onClick={() => setShowAddLimitModal(false)} aria-label="Close modal">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <p className="modal-desc" style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '16px', marginBottom: '24px' }}>
                Set daily duration limits for distracting websites. Once reached, a soft-block overlay appears.
              </p>

              {timeLimitError && (
                <div className="rules-form-alert error" role="alert">
                  {timeLimitError}
                </div>
              )}

              <form className="rules-form" style={{ gap: '16px' }} onSubmit={handleAddTimeLimit}>
                <div className="premium-input-group">
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Domain (e.g. reddit.com)</label>
                  <div className="premium-input-wrapper">
                    <div className="premium-input-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    </div>
                    <input
                      type="text"
                      className="premium-input"
                      placeholder="Enter hostname..."
                      value={newTimeLimitDomain}
                      onChange={(e) => setNewTimeLimitDomain(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="premium-input-group">
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>Daily Limit (minutes)</label>
                  <div className="premium-input-wrapper">
                    <div className="premium-input-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <input
                      type="number"
                      className="premium-input"
                      min="1"
                      value={newTimeLimitDurationStr}
                      onChange={(e) => setNewTimeLimitDurationStr(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '14px 32px', fontSize: '14px', fontWeight: 600, borderRadius: '100px', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)', color: '#fff', border: 'none', cursor: 'pointer', transition: 'all 0.2s', width: '100%', marginTop: '8px' }}>
                  Save Time Limit
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Info Modal */}
        {infoModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="info-modal-title" onClick={() => setInfoModal(null)}>
            <div className="modal-content-elegant" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '90%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 id="info-modal-title" className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {infoModal === "timer" && <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-purple, #8b5cf6)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> About Timer</>}
                  {infoModal === "classification" && <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-blue, #3b82f6)" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> About Productivity Engine</>}
                  {infoModal === "blocker" && <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange, #f59e0b)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> About Soft-Blocker</>}
                </h3>
                <button className="btn-icon-elegant" style={{ border: 'none' }} onClick={() => setInfoModal(null)} aria-label="Close modal">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                <div className="modal-desc" style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', flex: 1 }}>
                  {infoModal === "timer" && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                      <p style={{ margin: 0 }}>The Pomodoro Timer helps you maintain focus using timeboxed work sessions.</p>
                      <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li><strong>Cycles:</strong> The timer naturally reciprocates. When a Focus session ends, it automatically prompts you to start a Break, and vice versa.</li>
                        <li><strong>Customization:</strong> You can adjust the exact minutes for Focus and Break periods below.</li>
                        <li><strong>Notifications:</strong> Toggle desktop notifications or choose from several notification sounds (Beep, Chime, Digital) to alert you when a cycle ends.</li>
                        <li><strong>Custom Messages:</strong> Set custom motivational messages that will appear in your notifications when it&apos;s time to focus or take a break.</li>
                      </ul>
                    </div>
                  )}
                  {infoModal === "classification" && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                      <p style={{ margin: 0 }}>Categorize domains to let the analytics engine calculate your exact productivity score.</p>
                      <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li><strong><span style={{ color: '#10b981' }}>Productive:</span></strong> Sites essential for work (e.g. github.com, docs.google.com).</li>
                        <li><strong><span style={{ color: '#ef4444' }}>Distracting:</span></strong> Sites that break your workflow (e.g. reddit.com, youtube.com).</li>
                        <li><strong>How to Add:</strong> Click <em>&quot;+ Add Custom Rule&quot;</em> to manually assign a category to a domain.</li>
                        <li><strong>Quick Classify:</strong> Go to the Dashboard tab, click <em>&quot;View All Domains&quot;</em>, and use the inline PROD/DIST/NEUT buttons to rapidly categorize your most visited sites in bulk.</li>
                      </ul>
                    </div>
                  )}
                  {infoModal === "blocker" && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                      <p style={{ margin: 0 }}>The Soft-Blocker prevents you from doomscrolling by enforcing daily allowances.</p>
                      <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li><strong>Setting Limits:</strong> Assign a maximum daily allowance (in minutes) for specific distracting domains.</li>
                        <li><strong>Gentle Interventions:</strong> Once the limit is reached, a full-page overlay is injected over the site to block access and remind you to refocus.</li>
                        <li><strong>Daily Resets:</strong> All accumulated time resets automatically at midnight, giving you a fresh allowance the next day.</li>
                        <li><strong>Toggles:</strong> You can temporarily disable a limit using the toggle button without deleting the rule entirely.</li>
                      </ul>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {infoModal === "timer" && <img src={timerDemoImg} alt="Timer Example" style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }} />}
                  {infoModal === "classification" && <img src={classifyDemoImg} alt="Classification Example" style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }} />}
                  {infoModal === "blocker" && <img src={blockerDemoImg} alt="Blocker Example" style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }} />}
                </div>
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
