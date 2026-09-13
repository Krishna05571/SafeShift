import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, ShieldCheck, Clock, Bot, Zap, X, ShieldAlert, CheckCircle2, ArrowLeft, Radio, Layers, Users, Navigation } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8005';

export default function AIBriefingModal({
  isOpen,
  onClose,
  riskMode = 'baseline',
  onToggleRiskMode = null,
  relocationPlan = [],
  onLocateZone = null,
  theme = 'light',
}) {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeMode, setActiveMode] = useState(riskMode);

  const isLive = activeMode === 'live';

  // Synchronize internal mode with parent riskMode prop
  useEffect(() => {
    setActiveMode(riskMode);
  }, [riskMode]);

  const fetchBriefing = useCallback(async (targetMode = activeMode) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/ai-explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: targetMode,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI Engine Error (${res.status})`);
      }

      const data = await res.json();
      setBriefing(data);
    } catch (err) {
      console.error('Error fetching AI briefing:', err);
      setError(err.message || 'Unable to generate AI situational report');
    } finally {
      setLoading(false);
    }
  }, [activeMode]);

  // Handle mode switch inside full-screen view
  const handleSwitchMode = (newMode) => {
    setActiveMode(newMode);
    if (onToggleRiskMode) {
      onToggleRiskMode(newMode);
    }
    fetchBriefing(newMode);
  };

  // Automatically fetch when modal opens or when activeMode changes
  useEffect(() => {
    if (isOpen) {
      fetchBriefing(activeMode);
    }
  }, [isOpen, activeMode, fetchBriefing]);

  // Handle ESC key for quick exit
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalEvacuees = relocationPlan?.reduce((sum, item) => sum + (Number(item.people) || 0), 0) || 0;
  const highRiskRoutes = relocationPlan?.filter((item) => (item.risk || '').toLowerCase() === 'high').length || 0;

  return (
    <div className="ai-fullscreen-container" role="dialog" aria-modal="true">
      {/* Top Fixed Command Header */}
      <header className="ai-fullscreen-header">
        <div className="ai-header-left">
          <button
            type="button"
            className="ai-back-btn"
            onClick={onClose}
            title="Return to Interactive GIS Operations Map (Esc)"
          >
            <ArrowLeft size={16} />
            <span>Back to Map</span>
          </button>

          <div className="ai-header-brand-wrap">
            <div className="ai-header-sparkle-box">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="ai-header-title-row">
                <h2 className="ai-header-title">Gemini Situational Intelligence</h2>
                <span className={`ai-mode-pill ${isLive ? 'mode-live' : 'mode-baseline'}`}>
                  <span className="pulse-dot-indicator" />
                  {isLive ? 'Live Weather Influx' : 'Baseline Vulnerability'}
                </span>
              </div>
              <p className="ai-header-desc">
                NDMA Autonomous Disaster Evacuation Briefing • Powered by {briefing?.ai_engine || 'Google Gemini AI'}
              </p>
            </div>
          </div>
        </div>

        {/* Center Mode Switcher Tabs */}
        <div className="ai-mode-switcher">
          <button
            type="button"
            className={`ai-mode-tab ${!isLive ? 'active' : ''}`}
            onClick={() => handleSwitchMode('baseline')}
            title="Evaluate evacuation plan based on historical terrain exposure"
          >
            <Layers size={13} />
            <span>Baseline Mode</span>
          </button>

          <button
            type="button"
            className={`ai-mode-tab ${isLive ? 'active' : ''}`}
            onClick={() => handleSwitchMode('live')}
            title="Evaluate evacuation plan based on live Open-Meteo precipitation surges"
          >
            <Radio size={13} />
            <span>Live Weather Mode</span>
          </button>
        </div>

        {/* Right Header Actions */}
        <div className="ai-header-right">
          <button
            type="button"
            className="ai-action-refresh-btn"
            onClick={() => fetchBriefing(activeMode)}
            disabled={loading}
            title="Re-synthesize situational briefing with latest telemetry"
          >
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            <span>{loading ? 'Synthesizing...' : 'Regenerate Briefing'}</span>
          </button>

          <button
            type="button"
            className="ai-close-icon-btn"
            onClick={onClose}
            title="Close Full-Screen View"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Full-Screen Content Area */}
      <main className="ai-fullscreen-content">
        {loading && !briefing && (
          <div className="ai-fullscreen-loading">
            <div className="ai-loading-spinner-box">
              <Bot size={36} className="ai-bot-icon-anim" />
              <div className="ai-spinner-ring" />
            </div>
            <h3>Synthesizing Multi-Hazard Disaster Report...</h3>
            <p>Analyzing {relocationPlan?.length || 0} active evacuation routes across {isLive ? 'live weather feeds' : 'historical vulnerability models'}.</p>
          </div>
        )}

        {error && !briefing && (
          <div className="ai-fullscreen-error">
            <AlertTriangle size={36} className="error-icon" />
            <h3>Briefing Generation Notice</h3>
            <p>{error}</p>
            <button
              type="button"
              className="ai-retry-action-btn"
              onClick={() => fetchBriefing(activeMode)}
            >
              Retry Synthesizing
            </button>
          </div>
        )}

        {briefing && (
          <div className={`ai-briefing-layout ${loading ? 'content-refreshing' : ''}`}>
            {/* 1. Top Executive KPI & Summary Row */}
            <div className="ai-top-section">
              {/* Executive Summary Card */}
              <div className={`ai-exec-summary-card ${isLive ? 'exec-live' : 'exec-baseline'}`}>
                <div className="ai-exec-badge">
                  <span>Executive Tactical Directive</span>
                  <span className="ai-eval-tag">{isLive ? 'Dynamic IMD Weather Assessment' : 'Topographical Baseline Assessment'}</span>
                </div>
                <p className="ai-exec-text">{briefing.summary}</p>
              </div>

              {/* Quick Summary Metrics */}
              <div className="ai-metrics-row">
                <div className="ai-metric-box">
                  <span className="metric-lbl">Total Evacuees</span>
                  <div className="metric-val-wrap">
                    <strong>{(briefing.total_people ?? totalEvacuees).toLocaleString()}</strong>
                  </div>
                  <span className="metric-sub">Dispatched citizens</span>
                </div>

                <div className="ai-metric-box">
                  <span className="metric-lbl">High-Risk Corridors</span>
                  <div className="metric-val-wrap">
                    <strong className={briefing.high_risk_count > 0 ? "text-red" : "text-emerald"}>
                      {briefing.high_risk_count ?? highRiskRoutes}
                    </strong>
                  </div>
                  <span className="metric-sub">
                    {briefing.high_risk_count > 0 ? "Immediate priority" : "0 Active Emergencies"}
                  </span>
                </div>

                <div className="ai-metric-box">
                  <span className="metric-lbl">Active Routes</span>
                  <div className="metric-val-wrap">
                    <strong>{briefing.total_routes ?? relocationPlan?.length ?? 0}</strong>
                  </div>
                  <span className="metric-sub">Shelter pairings</span>
                </div>

                <div className="ai-metric-box">
                  <span className="metric-lbl">Evaluation Engine</span>
                  <div className="metric-val-wrap">
                    <strong className="text-purple-name">{briefing.ai_engine?.split(' ')[0] || 'Gemini AI'}</strong>
                  </div>
                  <span className="metric-sub">{briefing.ai_engine || 'Autonomous Engine'}</span>
                </div>
              </div>
            </div>

            {/* 2. Main Two-Column Content Grid */}
            <div className="ai-main-grid">
              {/* Left Column: Top Prioritized Corridors */}
              <div className="ai-grid-column">
                <div className="ai-column-header">
                  <div className="ai-col-title-wrap">
                    <ShieldAlert size={18} className="text-red" />
                    <h3>Prioritized Evacuation Corridors</h3>
                  </div>
                  <span className="ai-badge-count">{briefing.critical_zones?.length || 0} Key Sectors</span>
                </div>

                <div className="ai-cards-stack">
                  {briefing.critical_zones && briefing.critical_zones.length > 0 ? (
                    briefing.critical_zones.map((zone, idx) => {
                      const isHigh = (zone.risk_level || '').toUpperCase() === 'HIGH';
                      const isMed = (zone.risk_level || '').toUpperCase() === 'MEDIUM';

                      return (
                        <div
                          key={idx}
                          className={`ai-zone-tactical-card ${isHigh ? 'zone-high-card' : isMed ? 'zone-med-card' : 'zone-low-card'}`}
                        >
                          <div className="ai-card-head">
                            <div className="ai-card-title-group">
                              <span className="ai-rank-num">#{idx + 1}</span>
                              <h4 className="ai-card-zone-name">{zone.zone_name}</h4>
                            </div>
                            <span className={`ai-card-risk-pill ${isHigh ? 'pill-high' : isMed ? 'pill-med' : 'pill-low'}`}>
                              {zone.risk_level} RISK
                            </span>
                          </div>

                          <p className="ai-card-reason">{zone.priority_reason}</p>

                          <div className="ai-card-stats-strip">
                            <div className="ai-strip-item">
                              <span className="strip-lbl">Assigned Safe Haven:</span>
                              <strong className="strip-val shelter-color">{zone.assigned_shelter}</strong>
                            </div>
                            <div className="ai-strip-item">
                              <span className="strip-lbl">Evacuees:</span>
                              <strong className="strip-val">{Number(zone.evacuees || 0).toLocaleString()}</strong>
                            </div>
                            <div className="ai-strip-item">
                              <span className="strip-lbl">Transit Duration:</span>
                              <strong className="strip-val eta-color">
                                <Clock size={12} />
                                {zone.estimated_travel_time}
                              </strong>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="ai-empty-state-box">
                      <ShieldCheck size={28} />
                      <p>All active sectors are operating within standard tolerance margins.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: NDMA Tactical Directives & Operational Checklist */}
              <div className="ai-grid-column">
                <div className="ai-column-header">
                  <div className="ai-col-title-wrap">
                    <CheckCircle2 size={18} className="text-emerald" />
                    <h3>Field Operational Directives</h3>
                  </div>
                  <span className="ai-badge-protocol">NDMA Protocol SOP</span>
                </div>

                <div className="ai-directives-list">
                  {briefing.recommendations && briefing.recommendations.map((rec, i) => (
                    <div key={i} className="ai-directive-card">
                      <div className="ai-directive-number">{i + 1}</div>
                      <div className="ai-directive-body">
                        <p className="ai-directive-text">{rec}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Additional Tactical Guidance Card */}
                <div className="ai-sop-note-card">
                  <h4>Live Deployment Protocol</h4>
                  <p>
                    Coordinate arterial road clearances with state traffic police. Ensure emergency convoy communications
                    remain on designated satellite/VHF channels (Channel 16 - NDRF Disaster Relay).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
