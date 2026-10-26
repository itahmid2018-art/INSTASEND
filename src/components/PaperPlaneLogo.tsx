import React from 'react';

interface PaperPlaneLogoProps {
  className?: string;
  size?: number;
  showMotionTrails?: boolean;
}

export const PaperPlaneLogo: React.FC<PaperPlaneLogoProps> = ({
  className = '',
  size = 32,
  showMotionTrails = true
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none transform group-hover:scale-105 group-hover:-translate-y-0.5 transition-all duration-300 ${className}`}
    >
      <defs>
        {/* Blue Primary Wing Gradient */}
        <linearGradient id="headerBlueWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#1a73e8" />
        </linearGradient>

        {/* Green Right Fold Gradient */}
        <linearGradient id="headerGreenWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34A853" />
          <stop offset="100%" stopColor="#188038" />
        </linearGradient>

        {/* Red Under-body Keel Gradient */}
        <linearGradient id="headerRedKeelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EA4335" />
          <stop offset="100%" stopColor="#d93025" />
        </linearGradient>

        {/* Yellow Inner Fold Accent Gradient */}
        <linearGradient id="headerYellowFoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBC05" />
          <stop offset="100%" stopColor="#f29900" />
        </linearGradient>

        {/* Soft Drop Shadow for Depth */}
        <filter id="headerPlaneGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#1a73e8" floodOpacity="0.2" />
        </filter>
      </defs>

      {/* Dynamic Speed Trails */}
      {showMotionTrails && (
        <g className="opacity-80 transition-opacity group-hover:opacity-100">
          <path
            d="M 24 185 C 45 195, 80 180, 110 162"
            fill="none"
            stroke="#4285F4"
            strokeWidth="5"
            strokeDasharray="8 6"
            strokeLinecap="round"
          />
          <path
            d="M 12 160 C 35 170, 65 155, 95 138"
            fill="none"
            stroke="#EA4335"
            strokeWidth="4"
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
          <path
            d="M 40 205 C 65 212, 95 198, 125 180"
            fill="none"
            stroke="#FBBC05"
            strokeWidth="4.5"
            strokeDasharray="7 5"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Faceted Google 4-Color Paper Plane */}
      <g filter="url(#headerPlaneGlow)">
        {/* 1. Primary Left Wing (Google Blue) */}
        <polygon points="228,32 36,124 136,156" fill="url(#headerBlueWingGrad)" />

        {/* 2. Right Fold Wing (Google Green) */}
        <polygon points="228,32 136,156 188,212" fill="url(#headerGreenWingGrad)" />

        {/* 3. Under-body Keel Shadow (Google Red) */}
        <polygon points="228,32 108,176 136,156" fill="url(#headerRedKeelGrad)" />

        {/* 4. Center Fold Accent (Google Yellow) */}
        <polygon points="108,176 128,206 188,212 136,156" fill="url(#headerYellowFoldGrad)" />
      </g>

      {/* Sparkle Highlight at Nose Tip */}
      <circle cx="228" cy="32" r="4.5" fill="#ffffff" />
    </svg>
  );
};
