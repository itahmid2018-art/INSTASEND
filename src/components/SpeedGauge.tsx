import React, { useMemo } from 'react';
import { Gauge, Zap, TrendingUp, ShieldCheck } from 'lucide-react';

interface SpeedGaugeProps {
  speedBytesPerSec: number;
  isActive: boolean;
  isCompleted: boolean;
  speedType: 'upload' | 'download';
  peakMbps?: number;
}

export const SpeedGauge: React.FC<SpeedGaugeProps> = ({
  speedBytesPerSec,
  isActive,
  isCompleted,
  speedType,
  peakMbps: externalPeakMbps
}) => {
  const [internalPeakMbps, setInternalPeakMbps] = React.useState<number>(0);

  // Convert bytes/sec to Megabits per second (Mbps)
  const currentMbps = Number(((speedBytesPerSec * 8) / 1_000_000).toFixed(2));
  const effectiveSpeed = isCompleted ? 0 : currentMbps;

  // Track peak speed
  React.useEffect(() => {
    if (currentMbps > internalPeakMbps) {
      setInternalPeakMbps(currentMbps);
    }
  }, [currentMbps, internalPeakMbps]);

  // Reset internal peak when inactive
  React.useEffect(() => {
    if (!isActive && !isCompleted && speedBytesPerSec === 0) {
      setInternalPeakMbps(0);
    }
  }, [isActive, isCompleted, speedBytesPerSec]);

  const peakMbps = externalPeakMbps !== undefined && externalPeakMbps > 0 
    ? externalPeakMbps 
    : internalPeakMbps;

  // Determine dynamic gauge upper bound scale
  const maxScale = useMemo(() => {
    const highest = Math.max(effectiveSpeed, peakMbps);
    if (highest <= 10) return 10;
    if (highest <= 25) return 25;
    if (highest <= 50) return 50;
    if (highest <= 100) return 100;
    if (highest <= 250) return 250;
    if (highest <= 500) return 500;
    return 1000;
  }, [effectiveSpeed, peakMbps]);

  // Geometry Constants
  const cx = 120;
  const cy = 120;
  const radius = 82;
  const startAngle = -210; // degrees
  const endAngle = 30;     // degrees
  const totalSweep = endAngle - startAngle; // 240 degrees
  const totalArcLength = (2 * Math.PI * radius * totalSweep) / 360; // ~343.48 px

  // Calculate needle rotation angle in degrees relative to 12 o'clock (or 0deg transform)
  // At 0 Mbps, angle = -210 deg. At maxScale, angle = +30 deg.
  const percentage = Math.min(Math.max(effectiveSpeed / maxScale, 0), 1);
  const needleAngle = startAngle + percentage * totalSweep;

  // Peak needle angle
  const peakPercentage = Math.min(Math.max(peakMbps / maxScale, 0), 1);
  const peakNeedleAngle = startAngle + peakPercentage * totalSweep;

  // Arc path string helper
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians)
    };
  };

  const describeArc = (x: number, y: number, r: number, startA: number, endA: number) => {
    const start = polarToCartesian(x, y, r, endA);
    const end = polarToCartesian(x, y, r, startA);
    const largeArcFlag = endA - startA <= 180 ? '0' : '1';
    return [
      'M', start.x, start.y,
      'A', r, r, 0, largeArcFlag, 0, end.x, end.y
    ].join(' ');
  };

  const backgroundArcPath = describeArc(cx, cy, radius, startAngle, endAngle);

  // Colors
  const isUpload = speedType === 'upload';
  const primaryColor = isUpload ? '#1a73e8' : '#34A853';
  const accentGradientId = isUpload ? 'uploadGaugeGrad' : 'downloadGaugeGrad';

  // Major ticks (5 steps: 0%, 25%, 50%, 75%, 100%)
  const ticks = useMemo(() => {
    const steps = 5;
    return Array.from({ length: steps }).map((_, i) => {
      const stepPct = i / (steps - 1);
      const angle = startAngle + stepPct * totalSweep;
      const innerPt = polarToCartesian(cx, cy, radius - 10, angle);
      const outerPt = polarToCartesian(cx, cy, radius - 2, angle);
      const labelPt = polarToCartesian(cx, cy, radius - 22, angle);
      const val = Math.round(stepPct * maxScale);

      return {
        innerPt,
        outerPt,
        labelPt,
        val,
        angle
      };
    });
  }, [maxScale, startAngle, totalSweep]);

  // Minor ticks (17 ticks total)
  const minorTicks = useMemo(() => {
    const totalMinor = 17;
    return Array.from({ length: totalMinor }).map((_, i) => {
      const pct = i / (totalMinor - 1);
      const angle = startAngle + pct * totalSweep;
      const innerPt = polarToCartesian(cx, cy, radius - 6, angle);
      const outerPt = polarToCartesian(cx, cy, radius - 2, angle);
      return { innerPt, outerPt };
    });
  }, [startAngle, totalSweep]);

  // Active arc filled stroke length
  const filledLength = percentage * totalArcLength;

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[#dadce0] shadow-xs flex flex-col items-center space-y-3 relative overflow-hidden">
      {/* Background Soft Accent Glow */}
      <div 
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-15 pointer-events-none ${
          isUpload ? 'bg-[#1a73e8]' : 'bg-[#34A853]'
        }`} 
      />

      {/* Header Badge */}
      <div className="w-full flex items-center justify-between border-b border-[#f1f3f4] pb-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
            isUpload ? 'bg-blue-50 text-[#1a73e8]' : 'bg-green-50 text-[#34A853]'
          }`}>
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-[#202124] flex items-center gap-1.5">
              <span>{isUpload ? 'Upload Speedometer' : 'Download Speedometer'}</span>
            </h5>
            <p className="text-[10px] text-[#5f6368]">
              Dynamic WebRTC throughput gauge
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#f8f9fa] text-[#3c4043] border border-[#dadce0]">
          <Zap className={`w-3 h-3 ${isActive ? 'text-amber-500 animate-pulse' : 'text-[#70757a]'}`} />
          <span>Max: {maxScale} Mbps</span>
        </div>
      </div>

      {/* SVG Speedometer Gauge Canvas */}
      <div className="relative w-full max-w-[260px] aspect-[4/3] flex items-center justify-center">
        <svg
          viewBox="0 0 240 180"
          className="w-full h-full drop-shadow-xs select-none"
        >
          <defs>
            {/* Upload Gradient */}
            <linearGradient id="uploadGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="60%" stopColor="#1a73e8" />
              <stop offset="100%" stopColor="#d93025" />
            </linearGradient>

            {/* Download Gradient */}
            <linearGradient id="downloadGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#81c995" />
              <stop offset="60%" stopColor="#34A853" />
              <stop offset="100%" stopColor="#188038" />
            </linearGradient>

            {/* Center Cap Shadow */}
            <filter id="capShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Background Outer Ring Track */}
          <path
            d={backgroundArcPath}
            fill="none"
            stroke="#f1f3f4"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Active Gradient Filled Progress Arc */}
          <path
            d={backgroundArcPath}
            fill="none"
            stroke={`url(#${accentGradientId})`}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${filledLength} ${totalArcLength}`}
            className="transition-all duration-300 ease-out"
          />

          {/* Minor Tick Marks */}
          {minorTicks.map((tick, idx) => (
            <line
              key={`minor-${idx}`}
              x1={tick.innerPt.x}
              y1={tick.innerPt.y}
              x2={tick.outerPt.x}
              y2={tick.outerPt.y}
              stroke="#dadce0"
              strokeWidth="1"
            />
          ))}

          {/* Major Tick Marks & Numbers */}
          {ticks.map((tick, idx) => (
            <g key={`tick-${idx}`}>
              <line
                x1={tick.innerPt.x}
                y1={tick.innerPt.y}
                x2={tick.outerPt.x}
                y2={tick.outerPt.y}
                stroke="#5f6368"
                strokeWidth="2"
              />
              <text
                x={tick.labelPt.x}
                y={tick.labelPt.y + 3}
                textAnchor="middle"
                fontSize="8"
                fontWeight="600"
                fill="#5f6368"
                fontFamily="monospace"
              >
                {tick.val}
              </text>
            </g>
          ))}

          {/* Peak Speed Marker Pointer (Small triangle/dot on arc) */}
          {peakMbps > 0 && (
            <g transform={`rotate(${peakNeedleAngle}, ${cx}, ${cy})`} className="transition-transform duration-500">
              <circle
                cx={cx}
                cy={cy - radius + 1}
                r="3"
                fill="#d93025"
                stroke="#ffffff"
                strokeWidth="1"
              />
            </g>
          )}

          {/* Speedometer Needle */}
          <g
            transform={`rotate(${needleAngle}, ${cx}, ${cy})`}
            className="transition-transform duration-300 ease-out"
          >
            {/* Needle Body Line */}
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - radius + 12}
              stroke={primaryColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Needle Sharp Accent Pointer */}
            <polygon
              points={`${cx - 3},${cy} ${cx + 3},${cy} ${cx},${cy - radius + 8}`}
              fill={primaryColor}
            />
          </g>

          {/* Center Pivot Metallic Cap */}
          <circle
            cx={cx}
            cy={cy}
            r="11"
            fill="#ffffff"
            stroke="#dadce0"
            strokeWidth="2"
            filter="url(#capShadow)"
          />
          <circle
            cx={cx}
            cy={cy}
            r="5"
            fill={primaryColor}
          />

          {/* Center Digital Readout Box */}
          <g transform={`translate(${cx}, ${cy + 24})`}>
            {/* Readout Background Box */}
            <rect
              x="-48"
              y="-12"
              width="96"
              height="28"
              rx="14"
              fill="#f8f9fa"
              stroke="#dadce0"
              strokeWidth="1"
            />
            <text
              x="0"
              y="6"
              textAnchor="middle"
              fontSize="14"
              fontWeight="900"
              fill="#202124"
              fontFamily="monospace"
            >
              {isCompleted ? '0.00' : currentMbps.toFixed(2)}
            </text>
            <text
              x="0"
              y="23"
              textAnchor="middle"
              fontSize="8"
              fontWeight="600"
              fill="#70757a"
              fontFamily="monospace"
            >
              Mbps
            </text>
          </g>
        </svg>
      </div>

      {/* Bottom Status Summary Bar */}
      <div className="w-full flex items-center justify-between text-[11px] font-mono text-[#5f6368] pt-1 border-t border-[#f1f3f4]">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            isActive ? (isUpload ? 'bg-[#1a73e8] animate-ping' : 'bg-[#34A853] animate-ping') : 'bg-[#dadce0]'
          }`} />
          <span className="font-semibold text-[#202124]">
            {isActive ? 'TRANSFER ACTIVE' : isCompleted ? 'FINISHED' : 'STANDBY'}
          </span>
        </div>

        {peakMbps > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-[#70757a]">
            <TrendingUp className="w-3 h-3 text-[#1a73e8]" />
            <span>Peak: <strong className="text-[#202124]">{peakMbps.toFixed(2)} Mbps</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};
