import React, { useState, useEffect, useRef } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { Activity, Zap, TrendingUp, BarChart2 } from 'lucide-react';
import { formatBytes } from '../services/device.ts';

interface SpeedDataPoint {
  time: string;
  mbps: number;
  rawBytesPerSec: number;
  timestamp: number;
}

interface SpeedChartProps {
  speedBytesPerSec: number;
  bytesTransferred: number;
  totalBytes: number;
  isActive: boolean;
  isCompleted: boolean;
  speedType: 'upload' | 'download';
}

export const SpeedChart: React.FC<SpeedChartProps> = ({
  speedBytesPerSec,
  bytesTransferred,
  totalBytes,
  isActive,
  isCompleted,
  speedType
}) => {
  const [dataPoints, setDataPoints] = useState<SpeedDataPoint[]>([]);
  const [peakMbps, setPeakMbps] = useState<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  // Convert bytes/sec to Megabits per second (Mbps)
  const currentMbps = Number(((speedBytesPerSec * 8) / 1_000_000).toFixed(2));

  // Update peak Mbps
  useEffect(() => {
    if (currentMbps > peakMbps) {
      setPeakMbps(currentMbps);
    }
  }, [currentMbps, peakMbps]);

  // Record history sample points
  useEffect(() => {
    if (!isActive && !isCompleted) {
      return;
    }

    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const label = `T+${elapsedSec}s`;

      setDataPoints(prev => {
        const nextPoint: SpeedDataPoint = {
          time: label,
          mbps: currentMbps,
          rawBytesPerSec: speedBytesPerSec,
          timestamp: Date.now()
        };
        // Keep last 30 data points
        const updated = [...prev, nextPoint];
        return updated.slice(-30);
      });
    }, 750);

    return () => clearInterval(interval);
  }, [isActive, isCompleted, currentMbps, speedBytesPerSec]);

  // Reset timeline on restart
  useEffect(() => {
    if (bytesTransferred === 0 && !isActive && !isCompleted) {
      setDataPoints([]);
      setPeakMbps(0);
      startTimeRef.current = Date.now();
    }
  }, [bytesTransferred, isActive, isCompleted]);

  // Calculate Average Speed
  const avgMbps = dataPoints.length > 0
    ? Number((dataPoints.reduce((acc, p) => acc + p.mbps, 0) / dataPoints.length).toFixed(2))
    : currentMbps;

  // Theme color variables
  const isUpload = speedType === 'upload';
  const strokeColor = isUpload ? '#1a73e8' : '#34A853';
  const fillColor = isUpload ? '#1a73e8' : '#34A853';
  const gradientId = isUpload ? 'uploadSpeedGradient' : 'downloadSpeedGradient';

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      const raw = payload[0].payload.rawBytesPerSec;
      return (
        <div className="bg-white border border-[#dadce0] p-2.5 rounded-xl shadow-lg text-xs space-y-1">
          <p className="font-mono text-[#5f6368] text-[10px]">{label}</p>
          <div className="flex items-center gap-1.5 font-bold">
            <span className={`w-2 h-2 rounded-full ${isUpload ? 'bg-[#1a73e8]' : 'bg-[#34A853]'}`} />
            <span className="text-[#202124]">{val} Mbps</span>
          </div>
          <p className="text-[10px] text-[#70757a] font-mono">
            ({formatBytes(raw)}/s)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[#dadce0] shadow-xs space-y-4">
      {/* Header Metrics Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f3f4] pb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUpload ? 'bg-blue-50 text-[#1a73e8]' : 'bg-green-50 text-[#34A853]'
          }`}>
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-[#202124] flex items-center gap-1.5">
              <span>{isUpload ? 'Upload Throughput Chart' : 'Download Throughput Chart'}</span>
              <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-semibold ${
                isUpload ? 'bg-blue-50 text-[#1a73e8] border border-blue-200' : 'bg-green-50 text-[#34A853] border border-green-200'
              }`}>
                Live Recharts
              </span>
            </h5>
            <p className="text-[11px] text-[#5f6368]">
              Real-time Megabits per second (Mbps) telemetry
            </p>
          </div>
        </div>

        {/* Live Mbps Numerical Display */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-[10px] text-[#5f6368] uppercase tracking-wider block">Current</span>
            <span className={`text-base font-black ${isUpload ? 'text-[#1a73e8]' : 'text-[#34A853]'}`}>
              {isCompleted ? '0.00' : currentMbps.toFixed(2)} <span className="text-xs font-normal">Mbps</span>
            </span>
          </div>

          <div className="text-right border-l border-[#dadce0] pl-3">
            <span className="text-[10px] text-[#5f6368] uppercase tracking-wider block">Peak</span>
            <span className="text-base font-black text-[#202124]">
              {peakMbps.toFixed(2)} <span className="text-xs font-normal">Mbps</span>
            </span>
          </div>

          <div className="text-right border-l border-[#dadce0] pl-3">
            <span className="text-[10px] text-[#5f6368] uppercase tracking-wider block">Avg</span>
            <span className="text-base font-black text-[#5f6368]">
              {avgMbps.toFixed(2)} <span className="text-xs font-normal">Mbps</span>
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Live Line/Area Canvas */}
      <div className="h-44 w-full">
        {dataPoints.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={fillColor} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={fillColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" vertical={false} />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10, fill: '#70757a' }} 
                axisLine={{ stroke: '#dadce0' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#70757a' }} 
                axisLine={false}
                tickLine={false}
                unit=" Mbps"
                domain={[0, 'dataMax + 5']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="mbps" 
                stroke={strokeColor} 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill={`url(#${gradientId})`} 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[#5f6368] bg-[#f8f9fa] rounded-2xl border border-dashed border-[#dadce0]">
            <BarChart2 className="w-6 h-6 text-[#1a73e8] mb-1 animate-pulse" />
            <p className="font-medium">Sampling WebRTC throughput...</p>
            <p className="text-[11px] text-[#70757a]">Speed curve renders dynamically in Mbps as data flows.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#70757a] font-mono pt-1">
        <span>Transferred: {formatBytes(bytesTransferred)} / {formatBytes(totalBytes)}</span>
        <span>1 Byte = 8 bits • Direct DataChannel</span>
      </div>
    </div>
  );
};
