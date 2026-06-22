import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./UserGuideModal.css";

import overviewImg from "url:~assets/dashboard/overview.png";
import blobImg from "url:~assets/floating-widget/Blob.png";
import rulesImg from "url:~assets/productivity/rules.png";

export type GuideCategory = "dashboard" | "productivity" | "settings" | null;

interface SlideData {
  title: string;
  description: string;
  imageUrl?: string;
  fallbackIcon?: React.ReactNode;
}

const GUIDE_CONTENT: Record<NonNullable<GuideCategory>, SlideData[]> = {
  dashboard: [
    {
      title: "Main Dashboard Overview",
      description: "Get a high-level view of your daily browsing habits. The dashboard tracks your total time spent and displays your most visited websites in an elegant UI.",
      imageUrl: overviewImg,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
    },
    {
      title: "Floating Widget",
      description: "A minimal, non-intrusive widget tracks your active session directly on the page, keeping you aware of your time without breaking your flow.",
      imageUrl: blobImg,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
    }
  ],
  productivity: [
    {
      title: "Productivity Rules",
      description: "Take control of your focus by categorizing websites into 'Productive', 'Neutral', or 'Distracting' based on your personal goals.",
      imageUrl: rulesImg,
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    },
    {
      title: "Focus Scoring",
      description: "The tracker automatically calculates your daily productivity score, generating beautiful heatmaps and donut charts to visualize your net positive days.",
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
    }
  ],
  settings: [
    {
      title: "100% Local Privacy",
      description: "Your data never leaves your device. Everything is stored directly in your browser's IndexedDB. We use zero telemetry and zero external tracking.",
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    },
    {
      title: "Data Retention & Control",
      description: "Configure how long your raw browsing history is kept before being automatically purged. You can also manually wipe all your data at any time with a single click.",
      fallbackIcon: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" y1="5" x2="22" y2="5"/><line x1="19" y1="2" x2="19" y2="8"/></svg>
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
