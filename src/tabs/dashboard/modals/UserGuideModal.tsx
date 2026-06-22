import React, { useState } from "react";
import { createPortal } from "react-dom";
import "./UserGuideModal.css";

import dash1 from "url:~assets/dashboard/dash-1.png";
import dash1 from "url:~assets/dashboard/dash-1.png";
import dash2 from "url:~assets/dashboard/dash-2.png";
import dash3 from "url:~assets/dashboard/dash-3.png";
import dash4 from "url:~assets/dashboard/dash-4.png";
import dash5 from "url:~assets/dashboard/dash-5.png";
import dash6 from "url:~assets/dashboard/dash-6.png";
import dash7 from "url:~assets/dashboard/dash-7.png";
import prod1 from "url:~assets/productivity/prod-1.png";
import pomoMain from "url:~assets/productivity/pomo-main.png";
import pomoAlerts from "url:~assets/productivity/pomo-alerts.png";
import prod3 from "url:~assets/productivity/prod-3.png";
import set1 from "url:~assets/settings/set-1.png";
import set2 from "url:~assets/settings/set-2.png";
import set3 from "url:~assets/settings/set-3.png";
import set4 from "url:~assets/settings/set-4.png";
import set5 from "url:~assets/settings/set-5.png";
import popupNewDark from "url:~assets/popup/popup-new-dark.png";
import popupNewLight from "url:~assets/popup/popup-new-light.png";
import blobLive from "url:~assets/floating-widget/blob-live.png";
import blobImg from "url:~assets/floating-widget/Blob.png";

export type GuideCategory = "dashboard" | "productivity" | "settings" | "popup" | "blob" | null;

interface SlideData {
  title: string;
  description: string;
  imageUrl?: string;
  fallbackIcon?: React.ReactNode;
}

const GUIDE_CONTENT: Record<NonNullable<GuideCategory>, SlideData[]> = {
  dashboard: [
    {
      title: "Total Tracking Time",
      description: "Overview of total time spent online.\nTop of the dashboard.\nAggregates all active browsing time for the day.",
      imageUrl: dash1,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    },
    {
      title: "Focus Hours Breakdown",
      description: "Detailed view of focus periods.\nNext to total tracking time.\nBreaks down your focused and productive blocks.",
      imageUrl: dash2,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    },
    {
      title: "Total Visits",
      description: "Count of all website visits.\nMetric card section.\nTracks the raw number of times domains were accessed.",
      imageUrl: dash3,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
    },
    {
      title: "Unique Hostnames",
      description: "Number of unique sites visited.\nMetric card section.\nCounts distinct domains to show browsing variety.",
      imageUrl: dash4,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="21" x2="15" y2="15"/><circle cx="10" cy="10" r="7"/></svg>
    },
    {
      title: "Productivity Score",
      description: "Your daily focus rating.\nMetric card section.\nCalculates a score based on your productive vs distracting time.",
      imageUrl: dash5,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    },
    {
      title: "Total Browsing Time Graph",
      description: "Visual timeline of your day.\nFirst row of charts.\nShows your browsing activity peaks hour by hour.",
      imageUrl: dash6,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    },
    {
      title: "Productivity vs Distraction Graph",
      description: "Comparison of website categories.\nSecond row of charts.\nContrasts time spent on productive vs distracting sites.",
      imageUrl: dash7,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
    }
  ],
  productivity: [
    {
      title: "Active Classifications",
      description: "Custom rules for domain categories.\n'Productivity' tab.\nMaps domains to 'Productive' or 'Distracting' to calculate your focus score.",
      imageUrl: prod3,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    },
    {
      title: "Soft-Block Limits",
      description: "Daily time budgets for distracting websites.\n'Productivity' tab, below classifications.\nShows a soft-block warning screen when you exceed your set time limit.",
      imageUrl: prod1,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    },
    {
      title: "Pomodoro Timer",
      description: "An integrated Pomodoro focus timer.\nExtension Popup and 'Productivity' tab.\nCustomizes focus intervals, breaks, styles, and audio notifications.",
      imageUrl: pomoMain,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 15"/></svg>
    },
    {
      title: "Smart Notifications",
      description: "Alerts for Pomodoro focus sessions.\nSystem notifications and Floating Widget.\nSends a gentle reminder when a session completes, and displays live remaining time.",
      imageUrl: pomoAlerts,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>
    }
  ],
  settings: [
    {
      title: "Dashboard Customization",
      description: "Preferences for the UI.\n'Settings' tab, Preferences section.\nSets daily focus hour goals and changes the visual iconography style.",
      imageUrl: set4,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    },
    {
      title: "Local Data Retention",
      description: "Auto-purge controls for old data.\n'Settings' tab, under Data Control.\nConfigures how long raw activity is kept before being permanently deleted.",
      imageUrl: set3,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    },
    {
      title: "Widget Preferences",
      description: "Settings for the Floating Blob.\n'Settings' tab, Widget section.\nToggles blob visibility and changes its visual theme.",
      imageUrl: set5,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
    }, 
    {
      title: "Data Portability & Export",
      description: "Export and backup tools.\n'Settings' tab.\nExports tracking history to CSV and backs up custom rulesets.",
      imageUrl: set2,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    },
    {
      title: "Danger Zone & Data Wiping",
      description: "Absolute data deletion.\nBottom of the 'Settings' tab.\nPermanently wipes all local databases, session logs, and caches.",
      imageUrl: set1,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
    }
  ],
  popup: [
    {
      title: "Mini-Dashboard (Dark Mode)",
      description: "A quick-access overview.\nBrowser extension popup.\nShows current active session, live Pomodoro timer, and top sites.",
      imageUrl: popupNewDark,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/></svg>
    },
    {
      title: "Mini-Dashboard (Light Mode)",
      description: "Light theme support and Detox Mode.\nBrowser extension popup.\nAdapts to system theme and allows one-click blocking of distractions.",
      imageUrl: popupNewLight,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    }
  ],
  blob: [
    {
      title: "Live Active Tracker",
      description: "A live timer widget.\nInjected directly onto active webpages.\nTracks and displays time spent on the current site in real-time.",
      imageUrl: blobLive,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
    },
    {
      title: "Customizable & Draggable",
      description: "Draggable, customizable UI blob.\nFloating atop active webpages.\nCan be moved anywhere on screen; visual style can be changed in settings.",
      imageUrl: blobImg,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
    }
  ]
};

interface Props {
  onClose: () => void;
}

export function UserGuideModal({ onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState<GuideCategory>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleSelectCategory = (cat: NonNullable<GuideCategory>) => {
    setActiveCategory(cat);
    setCurrentSlide(0);
  };

  const slides = activeCategory ? GUIDE_CONTENT[activeCategory] : [];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const modalContent = (
    <div className="user-guide-overlay" onClick={onClose}>
      <div className="user-guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="user-guide-header">
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            {activeCategory ? `Guide: ${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}` : "Interactive User Manual"}
          </h2>
          <button className="user-guide-close" onClick={onClose} aria-label="Close guide">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* CATEGORY SELECTION VIEW */}
          {!activeCategory && (
            <div className="guide-categories-grid">
              <p style={{ color: 'var(--text2)', marginBottom: '24px', fontSize: '15px' }}>
                Welcome to Local Browse Insights! Select a module below to learn how it works.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <button className="guide-category-card" onClick={() => handleSelectCategory("dashboard")}>
                  <div className="guide-icon blue">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  </div>
                  <h3>Dashboard</h3>
                  <p>Analytics & tracking features</p>
                </button>
                <button className="guide-category-card" onClick={() => handleSelectCategory("productivity")}>
                  <div className="guide-icon green">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <h3>Productivity</h3>
                  <p>Focus scoring & custom rules</p>
                </button>
                <button className="guide-category-card" onClick={() => handleSelectCategory("settings")}>
                  <div className="guide-icon orange">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </div>
                  <h3>Privacy & Settings</h3>
                  <p>Data retention & local storage</p>
                </button>
                <button className="guide-category-card" onClick={() => handleSelectCategory("popup")}>
                  <div className="guide-icon blue">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/></svg>
                  </div>
                  <h3>Extension Popup</h3>
                  <p>Quick access to metrics</p>
                </button>
                <button className="guide-category-card" onClick={() => handleSelectCategory("blob")}>
                  <div className="guide-icon green">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  </div>
                  <h3>Floating Blob</h3>
                  <p>Live active session tracker</p>
                </button>
              </div>
            </div>
          )}

          {/* CAROUSEL VIEW */}
          {activeCategory && (
            <div className="carousel-view">
              <button className="btn-back-menu" onClick={() => setActiveCategory(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Back to Menu
              </button>

              <div className="carousel-slide-container">
                {slides.map((slide, idx) => (
                  <div key={idx} className={`carousel-slide ${idx === currentSlide ? 'active' : ''}`} style={{ display: idx === currentSlide ? 'flex' : 'none' }}>
                    <div className="carousel-image-wrapper">
                      {slide.imageUrl ? (
                        <img src={slide.imageUrl} alt={slide.title} className="carousel-image" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <div className="carousel-fallback-icon">
                          {slide.fallbackIcon}
                        </div>
                      )}
                    </div>
                    <div className="carousel-text-content">
                      <h3 style={{ fontSize: '22px', marginBottom: '12px', color: 'var(--text)' }}>{slide.title}</h3>
                      <p style={{ fontSize: '15px', color: 'var(--text2)', lineHeight: 1.6 }}>{slide.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CAROUSEL CONTROLS */}
              <div className="carousel-controls">
                <button className="carousel-arrow" onClick={handlePrev} disabled={currentSlide === 0} aria-label="Previous slide">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div className="carousel-dots">
                  {slides.map((_, idx) => (
                    <button 
                      key={idx} 
                      className={`carousel-dot ${idx === currentSlide ? 'active' : ''}`}
                      onClick={() => setCurrentSlide(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
                <button className="carousel-arrow" onClick={handleNext} disabled={currentSlide === slides.length - 1} aria-label="Next slide">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Safely mount to document.body only if it exists (handles SSR/testing gracefully)
  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return null;
}
