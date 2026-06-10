import React from "react";

export type IconStyleType = "minimal" | "playful" | "neon" | "corporate";

export function getProductivityLabel(score: number, iconStyle: IconStyleType): string {
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

export function getScoreCriteria(iconStyle: IconStyleType) {
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

export function ScoreIllustration({ score, iconStyle }: { score: number, iconStyle: IconStyleType }) {
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
