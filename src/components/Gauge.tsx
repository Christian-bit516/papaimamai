import React from 'react';

interface GaugeProps {
  value: number; // 0 to 100
  size?: number;
}

export const Gauge: React.FC<GaugeProps> = ({ value, size = 250 }) => {
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  // Calculate dash offset based on percentage
  const strokeDashoffset = circumference - (value / 100) * circumference;
  
  // Determine color based on value
  let color = '#ef4444'; // Red for cold
  if (value >= 80) {
    color = '#10b981'; // Green for hot
  } else if (value >= 50) {
    color = '#f59e0b'; // Orange/Yellow for warm
  }

  return (
    <div className="gauge-container" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="gauge-svg"
      >
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="gauge-circle"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </svg>
      <div className="gauge-value" style={{ color }}>
        {value}%
      </div>
      <div className="gauge-label">Probabilidad</div>
    </div>
  );
};
