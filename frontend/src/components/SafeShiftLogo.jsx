import React from 'react';

/**
 * SafeShift logo lockup — shield mark + wordmark, sized for a site header.
 *
 * Usage:
 *   <SafeShiftLogo />                      // icon + wordmark
 *   <SafeShiftLogo showTagline />          // + tagline underneath
 *   <SafeShiftLogo iconOnly size={32} />   // just the shield (e.g. favicon-style use)
 */
export default function SafeShiftLogo({
  size = 44,
  showTagline = false,
  iconOnly = false,
  className = '',
}) {
  return (
    <div className={`ssl-root ${className}`}>
      <style>{`
        .ssl-root {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif;
        }
        .ssl-text-block {
          display: flex;
          flex-direction: column;
          line-height: 1;
        }
        .ssl-word {
          font-size: ${Math.round(size * 0.62)}px;
          font-weight: 800;
          letter-spacing: -0.01em;
          display: flex;
          align-items: center;
        }
        .ssl-word .navy { color: #0B2A4A; }
        .dark-theme .ssl-word .navy { color: #f8fafc; }
        .ssl-word .grad {
          background: linear-gradient(90deg, #0FA36B, #14B8A6);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .ssl-tagline {
          margin-top: 3px;
          font-size: ${Math.max(9, Math.round(size * 0.19))}px;
          font-weight: 700;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        .ssl-tagline .navy { color: #0B2A4A; }
        .dark-theme .ssl-tagline .navy { color: #94a3b8; }
        .ssl-tagline .green { color: #0FA36B; }
      `}</style>

      <svg
        width={size}
        height={size * 1.1}
        viewBox="0 0 120 132"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SafeShift shield logo"
      >
        <defs>
          <linearGradient id="ssl-flood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <linearGradient id="ssl-land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#BBF7D0" />
            <stop offset="100%" stopColor="#15803D" />
          </linearGradient>
          <linearGradient id="ssl-slide" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDBA74" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>
          <linearGradient id="ssl-base" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0FA36B" />
            <stop offset="100%" stopColor="#0B2A4A" />
          </linearGradient>
          <clipPath id="ssl-shield-clip">
            <path d="M60 4 L112 22 V60 C112 92 90 114 60 128 C30 114 8 92 8 60 V22 Z" />
          </clipPath>
        </defs>

        {/* shield outline */}
        <path
          d="M60 4 L112 22 V60 C112 92 90 114 60 128 C30 114 8 92 8 60 V22 Z"
          fill="#0B2A4A"
        />

        <g clipPath="url(#ssl-shield-clip)">
          {/* three hazard panels */}
          <polygon points="8,20 60,20 60,110 8,60" fill="url(#ssl-flood)" />
          <polygon points="40,20 80,20 80,120 40,100" fill="url(#ssl-land)" opacity="0.95" />
          <polygon points="60,20 112,20 112,60 90,115 60,110" fill="url(#ssl-slide)" />

          {/* rain lines (flood side) */}
          <g stroke="#E0F2FE" strokeWidth="2" strokeLinecap="round" opacity="0.85">
            <line x1="20" y1="34" x2="16" y2="44" />
            <line x1="28" y1="34" x2="24" y2="44" />
            <line x1="36" y1="34" x2="32" y2="44" />
          </g>

          {/* river */}
          <path
            d="M18 118 C30 100 26 88 38 74 C50 60 46 48 58 30"
            fill="none"
            stroke="#BAE6FD"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.9"
          />

          {/* mountain peak (center) */}
          <polygon points="58,40 70,64 46,64" fill="#F0FDF4" opacity="0.9" />
          <polygon points="58,40 64,52 52,52" fill="#DCFCE7" />

          {/* rockslide chunks */}
          <g fill="#7C2D12" opacity="0.85">
            <circle cx="86" cy="70" r="5" />
            <circle cx="96" cy="82" r="6" />
            <circle cx="80" cy="90" r="4" />
            <circle cx="92" cy="98" r="5" />
          </g>

          {/* base band with people mark */}
          <path
            d="M8 96 C8 96 30 130 60 132 C90 130 112 96 112 96 L112 60 L8 60 Z"
            fill="url(#ssl-base)"
            opacity="0.001"
          />
        </g>

        {/* protective hands + people, drawn over the clipped shield */}
        <path
          d="M18 96 C10 100 6 112 10 122 C22 116 30 112 40 108"
          fill="none"
          stroke="#0FA36B"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M102 96 C110 100 114 112 110 122 C98 116 90 112 80 108"
          fill="none"
          stroke="#0B2A4A"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="60" cy="98" r="16" fill="#FFFFFF" />
        <g fill="#0B2A4A">
          <circle cx="52" cy="93" r="4.2" />
          <circle cx="68" cy="93" r="4.2" />
          <circle cx="60" cy="90" r="5" />
          <path d="M45 106 C45 98 52 95 52 95 C55 99 65 99 68 95 C68 95 75 98 75 106 C75 109 45 109 45 106 Z" />
        </g>
      </svg>

      {!iconOnly && (
        <div className="ssl-text-block">
          <div className="ssl-word">
            <span className="navy">Safe</span>
            <span className="grad">Shift</span>
          </div>
          {showTagline && (
            <div className="ssl-tagline">
              <span className="navy">Intelligent Decisions.</span>{' '}
              <span className="green">Safer Communities.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
