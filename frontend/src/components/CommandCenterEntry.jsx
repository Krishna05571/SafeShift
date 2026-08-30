import React, { useState } from 'react';
import {
  Shield,
  MapPin,
  ChevronDown,
  Users,
  ShieldCheck,
  BarChart3,
  Waves,
  Mountain,
  CloudRain,
  AlertTriangle,
  AlertOctagon,
  Target,
  ArrowRight,
  Check,
} from 'lucide-react';

const HAZARD_OPTIONS = [
  {
    id: 'multi',
    icon: Waves,
    title: 'Multi-Hazard Grid',
    subtitle: 'Floods & Landslides',
  },
  {
    id: 'flood',
    icon: Waves,
    title: 'Flood Inundation',
    subtitle: 'River basins & coastal deltas',
  },
  {
    id: 'landslide',
    icon: Mountain,
    title: 'Landslide Corridor',
    subtitle: 'Himalayan & Ghats slopes',
  },
];

const SEVERITY_OPTIONS = [
  {
    id: 'baseline',
    icon: BarChart3,
    tier: 'T0',
    tierLabel: 'Baseline',
    detail: 'Normal monitoring',
    color: '#16A34A',
  },
  {
    id: 'moderate',
    icon: CloudRain,
    tier: 'T1',
    tierLabel: 'Moderate',
    detail: 'Inundation surge (+35%)',
    color: '#F59E0B',
  },
  {
    id: 'severe',
    icon: AlertTriangle,
    tier: 'T2',
    tierLabel: 'Severe',
    detail: 'High-risk spread (+65%)',
    color: '#F97316',
  },
  {
    id: 'extreme',
    icon: AlertOctagon,
    tier: 'T3',
    tierLabel: 'Extreme',
    detail: 'Peak outbreak (+95%)',
    color: '#DC2626',
  },
];

const SIDE_ITEMS = [
  { icon: Users, label: 'Protecting Lives', tint: '#DCFCE7', fg: '#16A34A' },
  { icon: MapPin, label: 'Smart Relocation', tint: '#DBEAFE', fg: '#2563EB' },
  { icon: ShieldCheck, label: 'Real-time Intelligence', tint: '#FFEDD5', fg: '#EA580C' },
  { icon: BarChart3, label: 'Data-driven Decisions', tint: '#EDE9FE', fg: '#7C3AED' },
];

const REGIONS = [
  'Pan-India National Grid (49 Active Spatial Zones)',
  'Northeast Corridor (12 Active Spatial Zones)',
  'Western Ghats Belt (18 Active Spatial Zones)',
  'Himalayan Frontier (21 Active Spatial Zones)',
];

export default function CommandCenterEntry({
  onEnterCommandCenter,
  initialScenario = 'multi',
  initialTimeStep = 0,
  isApiOnline = true,
}) {
  const [hazard, setHazard] = useState(
    initialScenario === 'all' ? 'multi' : initialScenario || 'multi'
  );
  const [severity, setSeverity] = useState(
    initialTimeStep === 1
      ? 'moderate'
      : initialTimeStep === 2
      ? 'severe'
      : initialTimeStep === 3
      ? 'extreme'
      : 'baseline'
  );
  const [region, setRegion] = useState(REGIONS[0]);
  const [regionOpen, setRegionOpen] = useState(false);
  const [launching, setLaunching] = useState(false);

  const handleLaunch = () => {
    setLaunching(true);
    setTimeout(() => {
      if (onEnterCommandCenter) {
        onEnterCommandCenter({
          scenario: hazard === 'multi' ? 'all' : hazard,
          region,
          timeStep:
            severity === 'baseline'
              ? 0
              : severity === 'moderate'
              ? 1
              : severity === 'severe'
              ? 2
              : 3,
        });
      }
      setLaunching(false);
    }, 500);
  };

  return (
    <div className="scc-root">
      <style>{`
        .scc-root {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 28px 24px 48px;
          box-sizing: border-box;
          isolation: isolate;
          z-index: 9999;
        }
        .scc-bg {
          position: absolute;
          inset: 0;
          z-index: -2;
          background-image:
            linear-gradient(180deg, rgba(210,230,247,0.55) 0%, rgba(247,220,200,0.35) 45%, rgba(120,150,130,0.55) 78%, rgba(40,60,50,0.75) 100%),
            url("https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80");
          background-size: cover;
          background-position: center 30%;
        }
        .scc-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 8%, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%);
        }

        .scc-topbar {
          width: 100%;
          max-width: 1180px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 34px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .scc-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.6);
          border-radius: 999px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #1E293B;
          box-shadow: 0 2px 10px rgba(15,23,42,0.06);
        }
        .scc-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .scc-pill-group {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .scc-hero {
          text-align: center;
          margin-bottom: 30px;
          max-width: 720px;
        }
        .scc-logo-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-bottom: 10px;
        }
        .scc-shield {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(160deg, #3B82F6, #1D4ED8);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(29,78,216,0.35);
          flex-shrink: 0;
        }
        .scc-title {
          font-size: 46px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1;
        }
        .scc-title .navy { color: #0B3D59; }
        .scc-title .grad {
          background: linear-gradient(90deg, #16A34A, #0EA5A6);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .scc-subtitle {
          font-size: 17px;
          font-weight: 600;
          color: #1E3A5F;
          margin: 6px 0 10px;
        }
        .scc-tagline {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #0F766E;
        }
        .scc-tagline .dash {
          width: 26px;
          height: 1.5px;
          background: #0F766E;
          opacity: 0.6;
        }

        .scc-layout {
          position: relative;
          display: flex;
          width: 100%;
          max-width: 1180px;
          align-items: center;
          justify-content: center;
        }

        .scc-side {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 26px;
          width: 130px;
          z-index: 2;
        }
        .scc-side-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-align: center;
        }
        .scc-side-icon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(15,23,42,0.08);
        }
        .scc-side-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #334155;
          text-shadow: 0 1px 2px rgba(255,255,255,0.8);
        }

        .scc-card {
          background: rgba(255,255,255,0.94);
          backdrop-filter: blur(10px);
          border-radius: 22px;
          box-shadow: 0 24px 60px rgba(15,23,42,0.18);
          padding: 30px 34px 26px;
          width: 100%;
          max-width: 780px;
          margin: 0 auto;
          position: relative;
          z-index: 3;
        }

        .scc-section { margin-bottom: 22px; }
        .scc-section-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }
        .scc-step-badge {
          background: #1D4ED8;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          letter-spacing: 0.03em;
        }
        .scc-section-title {
          font-size: 12.5px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #0F172A;
        }

        .scc-hazard-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .scc-option {
          border: 1.5px solid #E2E8F0;
          background: #fff;
          border-radius: 14px;
          padding: 14px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
          position: relative;
        }
        .scc-option:hover { transform: translateY(-1px); }
        .scc-option.selected {
          border-color: #3B82F6;
          background: #EFF6FF;
        }
        .scc-option-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: #EFF6FF;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .scc-option-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #1D4ED8;
          margin-bottom: 2px;
        }
        .scc-option-sub {
          font-size: 11.5px;
          color: #64748B;
          font-weight: 500;
        }
        .scc-check {
          position: absolute;
          top: 10px;
          right: 10px;
          color: #2563EB;
        }

        .scc-region-select {
          position: relative;
        }
        .scc-region-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1.5px solid #E2E8F0;
          background: #fff;
          border-radius: 14px;
          padding: 13px 16px;
          cursor: pointer;
          font-size: 13.5px;
          font-weight: 600;
          color: #1E293B;
        }
        .scc-region-bar svg:first-child { color: #64748B; flex-shrink: 0; }
        .scc-region-bar .chev {
          margin-left: auto;
          color: #94A3B8;
          transition: transform 0.15s ease;
        }
        .scc-region-bar .chev.open { transform: rotate(180deg); }
        .scc-region-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          box-shadow: 0 12px 28px rgba(15,23,42,0.12);
          overflow: hidden;
          z-index: 5;
        }
        .scc-region-item {
          padding: 11px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #334155;
          cursor: pointer;
        }
        .scc-region-item:hover { background: #F1F5F9; }

        .scc-severity-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .scc-severity {
          border: 1.5px solid #E2E8F0;
          background: #fff;
          border-radius: 14px;
          padding: 13px;
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .scc-severity.selected {
          border-color: var(--sev-color);
          background: color-mix(in srgb, var(--sev-color) 8%, white);
        }
        .scc-severity-top {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .scc-severity-detail {
          font-size: 11px;
          color: #64748B;
          font-weight: 500;
        }

        .scc-cta {
          width: 100%;
          border: none;
          border-radius: 14px;
          padding: 16px;
          background: linear-gradient(90deg, #2563EB, #16A34A);
          color: #fff;
          font-size: 14.5px;
          font-weight: 800;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          margin-top: 4px;
          box-shadow: 0 10px 24px rgba(37,99,235,0.28);
          transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .scc-cta:active { transform: scale(0.99); }
        .scc-cta:disabled { opacity: 0.75; cursor: default; }

        .scc-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid #E2E8F0;
          font-size: 11.5px;
          color: #64748B;
          font-weight: 500;
          flex-wrap: wrap;
          gap: 8px;
        }
        .scc-footer b { color: #1E293B; }
        .scc-footer-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        @media (max-width: 900px) {
          .scc-side { display: none; }
          .scc-title { font-size: 34px; }
          .scc-hazard-grid { grid-template-columns: 1fr; }
          .scc-severity-grid { grid-template-columns: 1fr 1fr; }
          .scc-card { padding: 22px; }
        }
      `}</style>

      <div className="scc-bg" />

      <div className="scc-topbar">
        <div className="scc-pill">
          <span className="scc-dot" style={{ background: '#16A34A' }} />
          System Status&nbsp;&nbsp;All Systems Operational
        </div>
        <div className="scc-pill-group">
          <div className="scc-pill">
            <span className="scc-dot" style={{ background: isApiOnline ? '#16A34A' : '#EF4444' }} />
            {isApiOnline ? 'API Connected' : 'Connecting API...'}
          </div>
          <div className="scc-pill">
            <span className="scc-dot" style={{ background: '#A855F7' }} />
            AI Engine Ready
          </div>
        </div>
      </div>

      <div className="scc-hero">
        <div className="scc-logo-row">
          <h1 className="scc-title">
            <span className="navy">Safe</span>
            <span className="grad">Shift</span>
          </h1>
        </div>
        <p className="scc-subtitle">
          Multi-Hazard Spatial Relocation &amp; Evacuation Intelligence
        </p>
        <div className="scc-tagline">
          <span className="dash" />
          Intelligent Decisions. Safer Communities.
          <span className="dash" />
        </div>
      </div>

      <div className="scc-layout">
        <div className="scc-side">
          {SIDE_ITEMS.map((item) => (
            <div className="scc-side-item" key={item.label}>
              <div className="scc-side-icon" style={{ background: item.tint }}>
                <item.icon size={20} color={item.fg} />
              </div>
              <span className="scc-side-label">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="scc-card">
          <div className="scc-section">
            <div className="scc-section-head">
              <span className="scc-step-badge">01</span>
              <span className="scc-section-title">SELECT HAZARD SCENARIO</span>
            </div>
            <div className="scc-hazard-grid">
              {HAZARD_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = hazard === opt.id;
                return (
                  <button
                    key={opt.id}
                    className={`scc-option${isSelected ? ' selected' : ''}`}
                    onClick={() => setHazard(opt.id)}
                    type="button"
                  >
                    {isSelected && <Check size={16} className="scc-check" />}
                    <div className="scc-option-icon">
                      <Icon size={18} color="#2563EB" />
                    </div>
                    <div>
                      <div className="scc-option-title">{opt.title}</div>
                      <div className="scc-option-sub">{opt.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="scc-section">
            <div className="scc-section-head">
              <span className="scc-step-badge">02</span>
              <span className="scc-section-title">OPERATIONAL REGION &amp; COVERAGE</span>
            </div>
            <div className="scc-region-select">
              <div className="scc-region-bar" onClick={() => setRegionOpen((o) => !o)}>
                <MapPin size={16} />
                {region}
                <ChevronDown size={16} className={`chev${regionOpen ? ' open' : ''}`} />
              </div>
              {regionOpen && (
                <div className="scc-region-menu">
                  {REGIONS.map((r) => (
                    <div
                      key={r}
                      className="scc-region-item"
                      onClick={() => {
                        setRegion(r);
                        setRegionOpen(false);
                      }}
                    >
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="scc-section">
            <div className="scc-section-head">
              <span className="scc-step-badge">03</span>
              <span className="scc-section-title">DISASTER SEVERITY &amp; SIMULATION PHASE</span>
            </div>
            <div className="scc-severity-grid">
              {SEVERITY_OPTIONS.map((sev) => {
                const Icon = sev.icon;
                const isSelected = severity === sev.id;
                return (
                  <button
                    key={sev.id}
                    className={`scc-severity${isSelected ? ' selected' : ''}`}
                    style={{ '--sev-color': sev.color }}
                    onClick={() => setSeverity(sev.id)}
                    type="button"
                  >
                    <div className="scc-severity-top" style={{ color: sev.color }}>
                      <Icon size={15} />
                      {sev.tier} {sev.tierLabel}
                    </div>
                    <div className="scc-severity-detail">{sev.detail}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button className="scc-cta" onClick={handleLaunch} disabled={launching} type="button">
            <Target size={17} />
            {launching ? 'INITIALIZING...' : 'INITIALIZE COMMAND CENTER'}
            {!launching && <ArrowRight size={17} />}
          </button>

          <div className="scc-footer">
            <span>
              <Shield size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              Built for Smart India Hackathon — <b>SafeShift AI</b>
            </span>
            <span className="scc-footer-right">In alignment with NDMA &amp; SDMA Protocols</span>
          </div>
        </div>
      </div>
    </div>
  );
}
