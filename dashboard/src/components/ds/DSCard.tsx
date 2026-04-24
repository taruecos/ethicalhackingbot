"use client";

import React, { useState } from 'react';
import { ds } from './tokens';

export type CardVariant = 'default' | 'hover' | 'selected';

interface DSCardProps {
  forceVariant?: CardVariant;
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function DSCard({ forceVariant, children, onClick, style: styleProp }: DSCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const variant: CardVariant = forceVariant ?? (isHovered ? 'hover' : 'default');

  const getBorder = () => {
    if (variant === 'selected') return `1px solid ${ds.accent.default}`;
    if (variant === 'hover') return `1px solid ${ds.border.accent20}`;
    return `1px solid ${ds.border.default}`;
  };

  const getShadow = () => {
    if (variant === 'hover') return '0 4px 24px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)';
    if (variant === 'selected') return `0 0 0 1px ${ds.accent.default}40`;
    return 'none';
  };

  return (
    <div
      style={{
        backgroundColor: ds.bg.surface,
        border: getBorder(),
        borderRadius: ds.radius.lg,
        padding: 16,
        transition: 'all 0.15s ease',
        boxShadow: getShadow(),
        transform: variant === 'hover' ? 'translateY(-2px)' : 'translateY(0)',
        cursor: onClick ? 'pointer' : 'default',
        ...styleProp,
      }}
      onClick={onClick}
      onMouseEnter={() => !forceVariant && setIsHovered(true)}
      onMouseLeave={() => !forceVariant && setIsHovered(false)}
    >
      {children}
    </div>
  );
}
