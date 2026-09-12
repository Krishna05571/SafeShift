import React, { useState, useEffect } from 'react';
import SafeShiftLogo from './SafeShiftLogo';
import {
  Shield,
  MapPin,
  Users,
  ShieldCheck,
  BarChart3,
  Waves,
  Mountain,
  CloudRain,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  Activity,
  Compass,
  Building2,
  Landmark,
  Radio,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Zap,
  Navigation,
  Globe,
  Route,
  Server,
  Terminal,
} from 'lucide-react';
import './LandingPage.css';

const SECTIONS = [
  { id: 'hero', label: 'Overview' },
  { id: 'problem', label: 'Crisis' },
  { id: 'solution', label: 'Solution' },
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'Workflow' },
  { id: 'preview', label: 'System Preview' },
  { id: 'use-cases', label: 'Use Cases' },
];

export default function LandingPage({
  onLaunchCommandCenter,
  onOpenSetup,
  isApiOnline = true,
}) {
  const [activePreviewTab, setActivePreviewTab] = useState('map'); // 'map' | 'routes' | 'shelters'
  const [activeSection, setActiveSection] = useState('hero');

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 140;
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const sec = document.getElementById(SECTIONS[i].id);
        if (sec) {
          const top = sec.offsetTop;
          if (scrollPos >= top) {
            setActiveSection(SECTIONS[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll handler with exact offset for permanently fixed navbar
  const scrollToSection = (id) => {
    if (id === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -76;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-container">
      {/* 1. Permanently Fixed Navigation Bar */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand" onClick={() => scrollToSection('hero')}>
            <div className="brand-icon-wrap">
              <SafeShiftLogo iconOnly size={24} />
            </div>
            <div>
              <div className="brand-name">
                Safe<span>Shift</span>
              </div>
              <span className="brand-tag">Spatial Relocation Intelligence</span>
            </div>
          </div>

          <nav className="landing-nav-links">
            {SECTIONS.filter((s) => s.id !== 'hero').map((sec) => (
              <span
                key={sec.id}
                className={`nav-link ${activeSection === sec.id ? 'active' : ''}`}
                onClick={() => scrollToSection(sec.id)}
              >
                {sec.label}
              </span>
            ))}
          </nav>

          <div className="landing-nav-actions">
            <button
              type="button"
              className="btn-nav-launch"
              onClick={() => onLaunchCommandCenter()}
            >
              <span>Launch Command Center</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section id="hero" className="hero-section">
        <div className="hero-grid-bg" />
        <div className="hero-content">
          <div className="hero-text-block">
            <div className="hero-badge-wrap">
              <Zap size={14} />
              <span>MISSION-CRITICAL EMERGENCY DISPATCH SYSTEM</span>
            </div>

            <h1 className="hero-headline">
              From <span className="text-danger">Danger</span> to <span className="text-safety">Safety</span> — Optimized in Real Time
            </h1>

            <p className="hero-subheading">
              AI-powered evacuation planning using live weather feeds, multi-hazard spatial vulnerability grids, and mathematical optimization for zero-delay citizen relocation.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="btn-hero-primary"
                onClick={() => onLaunchCommandCenter()}
              >
                <Radio size={18} />
                <span>Launch Command Center</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn-hero-secondary"
                onClick={() => scrollToSection('preview')}
              >
                <Activity size={18} />
                <span>View System Simulation</span>
              </button>
            </div>

            {/* Quick Live Telemetry Strip */}
            <div className="hero-metrics-strip">
              <div className="hero-metric-item">
                <h4>49</h4>
                <p>Pan-India Hazard Zones</p>
              </div>
              <div className="hero-metric-item">
                <h4>0.4s</h4>
                <p>LP Dispatch Calculation</p>
              </div>
              <div className="hero-metric-item">
                <h4>100%</h4>
                <p>Shelter Bed Constraint</p>
              </div>
              <div className="hero-metric-item">
                <h4>10 min</h4>
                <p>Open-Meteo Weather Sync</p>
              </div>
            </div>
          </div>

          {/* Hero Visual: High-Tech Animated Radar Map with Pulsing Epicenters and Corridors */}
          <div className="hero-visual-card">
            <div className="hero-map-viewport">
              <div className="radar-grid" />
              <div className="radar-sweep" />

              <div className="hud-pill">
                <Radio size={13} className="text-sky-400" />
                <span>RADAR LIVE • 49 SPATIAL NODES • OSRM HIGHWAY ACTIVE</span>
              </div>

              {/* Animated Map Canvas Graphic */}
              <svg width="100%" height="100%" viewBox="0 0 500 400" style={{ position: 'absolute', inset: 0 }}>
                <defs>
                  <linearGradient id="routeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <linearGradient id="routeGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="glow" />
                    <feComposite in="SourceGraphic" in2="glow" operator="over" />
                  </filter>
                </defs>

                {/* Evacuation Highway Routes (Curved Polyline corridors) */}
                <path
                  d="M 90 120 Q 180 80, 290 130 T 400 90"
                  fill="none"
                  stroke="url(#routeGrad1)"
                  strokeWidth="3.5"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  filter="url(#glow)"
                >
                  <animate attributeName="stroke-dashoffset" values="40;0" dur="2s" repeatCount="indefinite" />
                </path>

                <path
                  d="M 120 280 Q 220 230, 310 260 T 420 220"
                  fill="none"
                  stroke="url(#routeGrad2)"
                  strokeWidth="3"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                >
                  <animate attributeName="stroke-dashoffset" values="30;0" dur="2.5s" repeatCount="indefinite" />
                </path>

                <path
                  d="M 90 120 Q 200 200, 310 260"
                  fill="none"
                  stroke="rgba(56, 189, 248, 0.4)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                {/* Hazard Epicenter 1: Flood Inundation Zone */}
                <g transform="translate(90, 120)">
                  <circle r="28" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3">
                    <animate attributeName="r" values="20;36;20" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.2;0.8" dur="3s" repeatCount="indefinite" />
                  </circle>
                  <circle r="12" fill="#ef4444" />
                  <text x="0" y="4" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle">HZ-1</text>
                  <text x="0" y="24" fill="#fca5a5" fontSize="8.5" fontWeight="700" textAnchor="middle">Assam Delta (Flood)</text>
                </g>

                {/* Hazard Epicenter 2: Landslide Slope Zone */}
                <g transform="translate(120, 280)">
                  <circle r="24" fill="rgba(249, 115, 22, 0.15)" stroke="#f97316" strokeWidth="1">
                    <animate attributeName="r" values="18;32;18" dur="3.5s" repeatCount="indefinite" />
                  </circle>
                  <circle r="10" fill="#f97316" />
                  <text x="0" y="3" fill="#ffffff" fontSize="8" fontWeight="800" textAnchor="middle">HZ-2</text>
                  <text x="0" y="22" fill="#fed7aa" fontSize="8.5" fontWeight="700" textAnchor="middle">W-Ghats (Landslide)</text>
                </g>

                {/* Safe Haven Shelter 1 */}
                <g transform="translate(400, 90)">
                  <circle r="16" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="1.5" />
                  <circle r="9" fill="#10b981" />
                  <text x="0" y="3" fill="#ffffff" fontSize="8" fontWeight="800" textAnchor="middle">SH-1</text>
                  <text x="0" y="22" fill="#a7f3d0" fontSize="8.5" fontWeight="700" textAnchor="middle">Guwahati Haven</text>
                </g>

                {/* Safe Haven Shelter 2 */}
                <g transform="translate(420, 220)">
                  <circle r="16" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="1.5" />
                  <circle r="9" fill="#10b981" />
                  <text x="0" y="3" fill="#ffffff" fontSize="8" fontWeight="800" textAnchor="middle">SH-2</text>
                  <text x="0" y="22" fill="#a7f3d0" fontSize="8.5" fontWeight="700" textAnchor="middle">Pune Staging Camp</text>
                </g>
              </svg>

              <div className="hud-bottom-telemetry">
                <span>OPTIMIZED ALLOCATION: <strong>100% DISPATCHED</strong></span>
                <span>MEAN TRANSIT TIME: <strong>48 MIN</strong></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Problem Section */}
      <section id="problem" className="section-wrapper bg-slate">
        <div className="section-inner">
          <div className="section-header-center">
            <span className="section-eyebrow">The Evacuation Bottleneck</span>
            <h2 className="section-title">Why Traditional Disaster Management Fails</h2>
            <p className="section-desc">
              When cyclones, flash floods, or cloudbursts strike, civil protection teams face critical friction points that cost human lives.
            </p>
          </div>

          <div className="problem-grid">
            <div className="problem-card">
              <div className="problem-icon-wrap">
                <AlertTriangle size={26} />
              </div>
              <span className="problem-tag">SILOED SYSTEMS</span>
              <h3>Fragmented Response Networks</h3>
              <p>
                Weather radar feeds, district collectorates, police units, and relief shelters operate on disconnected spreadsheets without centralized spatial coordination.
              </p>
            </div>

            <div className="problem-card">
              <div className="problem-icon-wrap">
                <CloudRain size={26} />
              </div>
              <span className="problem-tag">STATIC PLANNING</span>
              <h3>Zero Real-Time Weather Adaptation</h3>
              <p>
                Pre-drawn evacuation blueprints fail when sudden 120mm downpours surge, turning designated escape routes into flooded traps and landslide blockades.
              </p>
            </div>

            <div className="problem-card">
              <div className="problem-icon-wrap">
                <Building2 size={26} />
              </div>
              <span className="problem-tag">SHELTER OVERCROWDING</span>
              <h3>Unbalanced Shelter Saturation</h3>
              <p>
                Blind evacuations push thousands of citizens toward the nearest shelter, creating 190% overcrowding while adjacent secondary safe havens sit underutilized.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Solution Section & Flow Diagram */}
      <section id="solution" className="section-wrapper bg-white">
        <div className="section-inner">
          <div className="solution-container">
            <div className="section-header-center">
              <span className="section-eyebrow">The SafeShift Paradigm</span>
              <h2 className="section-title">Algorithmic Spatial Relocation in Seconds</h2>
              <p className="section-desc">
                SafeShift connects real-time meteorological telemetry directly to mathematical linear programming, guaranteeing mathematically optimal, capacity-safe evacuations.
              </p>
            </div>

            <div className="solution-flow-grid">
              <div className="solution-item">
                <div className="solution-icon-wrap">
                  <Waves size={24} />
                </div>
                <h3>1. Real-Time Hazard Detection</h3>
                <p>
                  Dynamic rainfall ingestion via Open-Meteo API continuously monitors rainfall accumulation, slope shear stability, and river basin thresholds.
                </p>
              </div>

              <div className="solution-item">
                <div className="solution-icon-wrap">
                  <Route size={24} />
                </div>
                <h3>2. Smart Evacuation Routing</h3>
                <p>
                  SciPy Simplex optimization solves multi-zone dispatch matrices, minimizing citizen transit distance and exposure to active danger corridors.
                </p>
              </div>

              <div className="solution-item">
                <div className="solution-icon-wrap">
                  <ShieldCheck size={24} />
                </div>
                <h3>3. Shelter Capacity Balancing</h3>
                <p>
                  Live bed counters monitor influx velocities, trigger multi-zone spillover warnings, and automatically divert displaced populations to secondary safe havens.
                </p>
              </div>
            </div>

            {/* Visual Flow Diagram: Data Ingestion -> Optimization -> Highway Routing */}
            <div className="flow-diagram-card">
              <div className="flow-diagram-title">
                Autonomous Intelligence Pipeline (Data ➔ LP Engine ➔ Safe Haven)
              </div>
              <div className="flow-steps-row">
                <div className="flow-node">
                  <div className="flow-node-badge">STEP 01: INPUT</div>
                  <div className="flow-node-title">Open-Meteo & GeoJSON</div>
                </div>
                <span className="flow-arrow">➔</span>
                <div className="flow-node">
                  <div className="flow-node-badge">STEP 02: ASSESSMENT</div>
                  <div className="flow-node-title">Live vs Baseline Risk</div>
                </div>
                <span className="flow-arrow">➔</span>
                <div className="flow-node active-glow">
                  <div className="flow-node-badge">STEP 03: SOLVER</div>
                  <div className="flow-node-title">SciPy Linear Programming</div>
                </div>
                <span className="flow-arrow">➔</span>
                <div className="flow-node">
                  <div className="flow-node-badge">STEP 04: NAVIGATION</div>
                  <div className="flow-node-title">OSRM Highway Polyline</div>
                </div>
                <span className="flow-arrow">➔</span>
                <div className="flow-node">
                  <div className="flow-node-badge">STEP 05: OUTPUT</div>
                  <div className="flow-node-title">Balanced Safe Havens</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Key Features */}
      <section id="features" className="section-wrapper bg-slate">
        <div className="section-inner">
          <div className="section-header-center">
            <span className="section-eyebrow">Enterprise Features</span>
            <h2 className="section-title">Built for Mission-Critical Control Rooms</h2>
            <p className="section-desc">
              Engineered with modern web GIS, high-concurrency Python algorithms, and resilient fallback mechanisms for field emergencies.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div>
                <div className="feature-header">
                  <div className="feature-icon-box">
                    <CloudRain size={22} />
                  </div>
                  <span className="feature-pill">Real-Time</span>
                </div>
                <h3>Live Weather Ingestion</h3>
                <p>
                  Seamless integration with Open-Meteo API fetching precipitation (mm/24h), humidity, temperature, and storm conditions across 49 spatial polygons.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div>
                <div className="feature-header">
                  <div className="feature-icon-box">
                    <Layers size={22} />
                  </div>
                  <span className="feature-pill">Dual-Engine</span>
                </div>
                <h3>Dual Risk Assessment Modes</h3>
                <p>
                  Toggle instantly between <strong>Live Meteorological Urgency</strong> (weather-triggered surge) and <strong>Baseline Terrain Vulnerability</strong> (slope, soil, historic flood plains).
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div>
                <div className="feature-header">
                  <div className="feature-icon-box">
                    <Cpu size={22} />
                  </div>
                  <span className="feature-pill">SciPy Optimization</span>
                </div>
                <h3>LP Optimization Solver</h3>
                <p>
                  Mathematical linear programming solver calculates exact evacuee distributions from danger zones to safe havens under strict capacity bounds.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div>
                <div className="feature-header">
                  <div className="feature-icon-box">
                    <Building2 size={22} />
                  </div>
                  <span className="feature-pill">Influx Telemetry</span>
                </div>
                <h3>Live Shelter Capacity Guardrails</h3>
                <p>
                  Tracks real-time shelter occupancy, remaining bed counts, saturation percentages, and automated countdown alerts (30% and 10% capacity warnings).
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div>
                <div className="feature-header">
                  <div className="feature-icon-box">
                    <Route size={22} />
                  </div>
                  <span className="feature-pill">OSRM Corridors</span>
                </div>
                <h3>Real Road Highway Routing</h3>
                <p>
                  On-demand real-world highway curved polyline tracing via Open Source Routing Machine (OSRM) with sub-second client-side caching.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div>
                <div className="feature-header">
                  <div className="feature-icon-box">
                    <Compass size={22} />
                  </div>
                  <span className="feature-pill">Multi-Zone</span>
                </div>
                <h3>3-Tier Alternative Safe Havens</h3>
                <p>
                  Dynamic multi-route recommendation offering Primary, Secondary, and Tertiary alternate safe shelters when a primary shelter reaches maximum load.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. How It Works Section */}
      <section id="how-it-works" className="section-wrapper bg-white">
        <div className="section-inner">
          <div className="section-header-center">
            <span className="section-eyebrow">Operational Lifecycle</span>
            <h2 className="section-title">How SafeShift Orchestrates Evacuation</h2>
            <p className="section-desc">
              From atmospheric sensor triggers to tactical transit routes in under 400 milliseconds.
            </p>
          </div>

          <div className="timeline-grid">
            <div className="timeline-step-card">
              <span className="step-num-badge">01</span>
              <h4>Data Ingestion</h4>
              <p>
                Ingests 49 Pan-India hazard polygons, digital elevation models, population density census, and live Open-Meteo precipitation feeds.
              </p>
            </div>

            <div className="timeline-step-card">
              <span className="step-num-badge">02</span>
              <h4>Risk Evaluation</h4>
              <p>
                Calculates dynamic flood inundation indexes and slope shear saturation scores to classify zones into High, Medium, and Low risk.
              </p>
            </div>

            <div className="timeline-step-card">
              <span className="step-num-badge">03</span>
              <h4>LP Optimization</h4>
              <p>
                Formulates and solves the linear programming objective function: minimizing total travel distance weighted by active hazard risk.
              </p>
            </div>

            <div className="timeline-step-card">
              <span className="step-num-badge">04</span>
              <h4>Tactical Dispatch</h4>
              <p>
                Outputs complete relocation matrices, highway routing corridors, shelter capacity metrics, and spillover instructions to authorities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. System Preview (Mission Control Mockup) */}
      <section id="preview" className="section-wrapper bg-slate">
        <div className="section-inner">
          <div className="section-header-center">
            <span className="section-eyebrow">Interactive Preview</span>
            <h2 className="section-title">Mission-Critical Control Panel</h2>
            <p className="section-desc">
              Unified split-screen command console designed for district crisis rooms, disaster response headquarters, and field commanders.
            </p>
          </div>

          <div className="preview-shell">
            <div className="preview-top-bar">
              <div className="preview-window-dots">
                <span className="p-dot red" />
                <span className="p-dot yellow" />
                <span className="p-dot green" />
              </div>
              <div className="preview-title">SAFESHIFT_COMMAND_CENTER // SYS_STATUS: OPTIMAL</div>
              <div className="preview-tab-buttons">
                <button
                  type="button"
                  className={`btn-preview-tab ${activePreviewTab === 'map' ? 'active' : ''}`}
                  onClick={() => setActivePreviewTab('map')}
                >
                  Tactical GIS Map
                </button>
                <button
                  type="button"
                  className={`btn-preview-tab ${activePreviewTab === 'routes' ? 'active' : ''}`}
                  onClick={() => setActivePreviewTab('routes')}
                >
                  Relocation Matrix
                </button>
                <button
                  type="button"
                  className={`btn-preview-tab ${activePreviewTab === 'shelters' ? 'active' : ''}`}
                  onClick={() => setActivePreviewTab('shelters')}
                >
                  Shelter Occupancy
                </button>
              </div>
            </div>

            <div className="preview-main-body">
              <div className="mockup-split-screen">
                {/* Left Mock Map View */}
                <div className="mock-map-view">
                  <div className="radar-grid" />
                  <svg width="100%" height="100%" viewBox="0 0 450 340">
                    {/* Mock Indian Territory Grid Lines */}
                    <path d="M 60 40 L 140 100 L 220 70 L 320 120 L 380 200 L 300 300 L 180 280 L 100 200 Z" fill="none" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1.5" strokeDasharray="3 3" />
                    
                    {/* Dynamic Corridors */}
                    <path d="M 140 100 Q 240 140, 320 120" fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray="5 3" />
                    <path d="M 180 280 Q 260 250, 380 200" fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="4 2" />

                    {/* Hazard Zone Markers */}
                    <circle cx="140" cy="100" r="14" fill="#ef4444" />
                    <circle cx="140" cy="100" r="24" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />
                    <text x="140" y="104" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle">HIGH</text>

                    <circle cx="180" cy="280" r="12" fill="#f97316" />
                    <text x="180" y="284" fill="#ffffff" fontSize="8" fontWeight="800" textAnchor="middle">MED</text>

                    {/* Safe Haven Markers */}
                    <circle cx="320" cy="120" r="14" fill="#10b981" />
                    <text x="320" y="124" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle">SAFE</text>

                    <circle cx="380" cy="200" r="14" fill="#10b981" />
                    <text x="380" y="204" fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle">SAFE</text>
                  </svg>

                  <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(15,23,42,0.85)', padding: '6px 10px', borderRadius: 6, fontSize: 11, color: '#38bdf8', fontFamily: 'monospace' }}>
                    LAT: 20.5937° N | LON: 78.9629° E | MODE: LIVE_SYNC
                  </div>
                </div>

                {/* Right Mock Panel */}
                <div className="mock-side-panel">
                  <div className="mock-kpi-row">
                    <div className="mock-kpi-card">
                      <div className="mock-kpi-label">Displaced Citizens</div>
                      <div className="mock-kpi-val" style={{ color: '#ef4444' }}>84,200</div>
                    </div>
                    <div className="mock-kpi-card">
                      <div className="mock-kpi-label">Safe Bed Capacity</div>
                      <div className="mock-kpi-val" style={{ color: '#10b981' }}>130,000</div>
                    </div>
                  </div>

                  <div className="mock-table-card">
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Active Relocation Queue</span>
                      <span style={{ color: '#38bdf8' }}>LP Solved (0.38s)</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#0f172a', borderRadius: 4, borderLeft: '3px solid #ef4444' }}>
                        <span>Assam Brahmaputra Zone ➔ Guwahati Haven</span>
                        <strong style={{ color: '#10b981' }}>12,400 People (42 km)</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#0f172a', borderRadius: 4, borderLeft: '3px solid #f97316' }}>
                        <span>Western Ghats Slope ➔ Pune Sports Complex</span>
                        <strong style={{ color: '#10b981' }}>8,600 People (64 km)</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#0f172a', borderRadius: 4, borderLeft: '3px solid #ef4444' }}>
                        <span>Kosi River Basin ➔ Purnia Emergency Camp</span>
                        <strong style={{ color: '#10b981' }}>15,200 People (51 km)</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Use Cases */}
      <section id="use-cases" className="section-wrapper bg-white">
        <div className="section-inner">
          <div className="section-header-center">
            <span className="section-eyebrow">Deployment Scenarios</span>
            <h2 className="section-title">Engineered for Every Tier of Emergency Response</h2>
            <p className="section-desc">
              Scalable from municipal flood relief squads to national-level multi-state disaster coordination.
            </p>
          </div>

          <div className="usecases-grid">
            <div className="usecase-card">
              <div className="usecase-icon-box">
                <Landmark size={22} />
              </div>
              <h4>NDMA & SDMA Authorities</h4>
              <p>
                Macro-level regional evacuation planning, state-wide shelter capacity oversight, and emergency resource pre-positioning.
              </p>
            </div>

            <div className="usecase-card">
              <div className="usecase-icon-box">
                <Shield size={22} />
              </div>
              <h4>First Responders (NDRF / SDRF)</h4>
              <p>
                Micro-corridor route safety checks, road blockage avoidance, and instant safe haven navigation during active search-and-rescue.
              </p>
            </div>

            <div className="usecase-card">
              <div className="usecase-icon-box">
                <Building2 size={22} />
              </div>
              <h4>Smart City Resilience Centers</h4>
              <p>
                Simulating urban drainage failures, coastal storm surges, and testing infrastructure resilience during urban planning.
              </p>
            </div>

            <div className="usecase-card">
              <div className="usecase-icon-box">
                <Users size={22} />
              </div>
              <h4>Humanitarian Relief & NGOs</h4>
              <p>
                Accurate population displacement tracking to coordinate meal logistics, medical kit distribution, and volunteer staging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. High-Impact Call to Action */}
      <section className="section-wrapper bg-slate">
        <div className="section-inner">
          <div className="cta-banner-wrapper">
            <div className="cta-banner-bg-pulse" />
            <div className="cta-content">
              <span className="cta-badge">ZERO-DELAY DEPLOYMENT</span>
              <h2 className="cta-title">Start Smart Evacuation Planning</h2>
              <p className="cta-desc">
                Experience the next generation of mathematical disaster relocation. Launch the live interactive command center now.
              </p>
              <button
                type="button"
                className="btn-cta-launch"
                onClick={() => onLaunchCommandCenter()}
              >
                <Activity size={20} />
                <span>Open Command Center</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-top-row">
            <div className="footer-brand-info">
              <div className="landing-brand">
                <div className="brand-icon-wrap">
                  <SafeShiftLogo iconOnly size={22} />
                </div>
                <div>
                  <div className="brand-name">
                    Safe<span>Shift</span>
                  </div>
                  <span className="brand-tag">Spatial Relocation Intelligence</span>
                </div>
              </div>
              <p>
                A high-precision emergency evacuation intelligence platform powered by real-time meteorological feeds, linear programming optimization, and OpenStreetMap routing topology.
              </p>
            </div>

            <div className="footer-badges-group">
              <span className="footer-badge-title">Enterprise Tech Stack</span>
              <div className="tech-badges-list">
                <span className="tech-badge">FastAPI 0.110</span>
                <span className="tech-badge">SciPy LP Optimization</span>
                <span className="tech-badge">Open-Meteo Weather API</span>
                <span className="tech-badge">OSRM Highway Routing</span>
                <span className="tech-badge">React 18 + Leaflet GIS</span>
                <span className="tech-badge">Recharts Analytics</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom-row">
            <div>
              © 2026 SafeShift Emergency Spatial Systems. All rights reserved.
            </div>
            <div className="footer-links-list">
              <a
                href="https://github.com/Krishna05571/SafeShift"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub Repository
              </a>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#64748b' }}>Hackathon Build v2.4</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
