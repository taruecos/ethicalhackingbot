"use client";

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ds } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon-only';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonState = 'default' | 'hover' | 'active' | 'disabled' | 'loading';

interface DSButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  forceState?: ButtonState;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const heights: Record<ButtonSize, number> = { sm: 28, md: 36, lg: 44 };
const padX: Record<ButtonSize, number> = { sm: 10, md: 14, lg: 18 };
const iconSz: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 17 };

export function DSButton({
  variant = 'primary',
  size = 'md',
  forceState,
  children,
  icon,
  onClick,
  style: styleProp,
}: DSButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const state: ButtonState =
    forceState ?? (isActive ? 'active' : isHovered ? 'hover' : 'default');

  const disabled = state === 'disabled';
  const loading = state === 'loading';

  const h = heights[size];
  const isIconOnly = variant === 'icon-only';

  const getStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: h,
      width: isIconOnly ? h : undefined,
      padding: isIconOnly ? 0 : `0 ${padX[size]}px`,
      borderRadius: ds.radius.md,
      fontSize: size === 'sm' ? ds.size.xs : ds.size.sm,
      fontWeight: ds.weight.medium,
      fontFamily: 'Inter, sans-serif',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'all 0.15s ease',
      border: '1px solid transparent',
      outline: 'none',
      whiteSpace: 'nowrap' as const,
      flexShrink: 0,
      userSelect: 'none' as const,
      ...styleProp,
    };

    if (variant === 'primary') {
      return {
        ...base,
        backgroundColor:
          state === 'hover' || state === 'active' ? ds.accent.hover : ds.accent.default,
        color: '#000',
        boxShadow: state === 'hover' ? `0 0 0 3px ${ds.accent.bg15}` : undefined,
      };
    }
    if (variant === 'secondary') {
      return {
        ...base,
        backgroundColor:
          state === 'hover' ? ds.border.zinc30 : state === 'active' ? ds.border.zinc50 : 'transparent',
        color: ds.text.primary,
        borderColor: state === 'hover' ? ds.border.zinc80 : ds.border.default,
      };
    }
    if (variant === 'ghost') {
      return {
        ...base,
        backgroundColor:
          state === 'hover' ? ds.border.zinc30 : state === 'active' ? ds.border.zinc50 : 'transparent',
        color: state === 'hover' ? ds.text.primary : ds.text.secondary,
      };
    }
    if (variant === 'danger') {
      return {
        ...base,
        backgroundColor:
          state === 'hover' ? '#dc2626' : state === 'active' ? '#b91c1c' : ds.severity.critical,
        color: '#fff',
        boxShadow: state === 'hover' ? '0 0 0 3px rgba(239,68,68,0.15)' : undefined,
      };
    }
    return {
      ...base,
      backgroundColor: state === 'hover' ? ds.border.zinc30 : 'transparent',
      color: state === 'hover' ? ds.text.primary : ds.text.secondary,
      borderColor: state === 'hover' ? ds.border.default : 'transparent',
    };
  };

  return (
    <button
      style={getStyle()}
      disabled={disabled || loading}
      onClick={onClick}
      onMouseEnter={() => !forceState && setIsHovered(true)}
      onMouseLeave={() => {
        if (!forceState) {
          setIsHovered(false);
          setIsActive(false);
        }
      }}
      onMouseDown={() => !forceState && setIsActive(true)}
      onMouseUp={() => !forceState && setIsActive(false)}
    >
      {loading ? (
        <Loader2 size={iconSz[size]} className="animate-spin" />
      ) : (
        <>
          {icon && (
            <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
          )}
          {!isIconOnly && children}
        </>
      )}
    </button>
  );
}
