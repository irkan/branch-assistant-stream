import React from 'react';
import './LoadingIndicator.css';

interface LoadingIndicatorProps {
  isVisible: boolean;
  position?: 'above-head' | 'inline' | 'centered';
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isVisible,
  position = 'above-head'
}) => {
  if (!isVisible) return null;
  
  return (
    <div className={`loading-indicator ${position}`}>
      <div className="dot"></div>
      <div className="dot"></div>
      <div className="dot"></div>
    </div>
  );
};

export default LoadingIndicator;
