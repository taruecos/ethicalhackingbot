"use client";

import React, { useState } from 'react';
import { Search, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { ds } from './tokens';

export type InputVariant = 'default' | 'focus' | 'error' | 'disabled';
export type InputType = 'text' | 'password' | 'search';

interface DSInputProps {
  inputType?: InputType;
  placeholder?: string;
  defaultValue?: string;
  label?: string;
  errorMessage?: string;
  forceVariant?: InputVariant;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onChange?: (v: string) => void;
  style?: React.CSSProperties;
}

export function DSInput({
  inputType = 'text',
  placeholder,
  defaultValue = '',
  label,
  errorMessage,
  forceVariant,
  leftIcon,
  rightIcon,
  onChange,
  style: styleProp,
}: DSInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [value, setValue] = useState(defaultValue);

  const variant: InputVariant =
    forceVariant ?? (isFocused ? 'focus' : 'default');

  const disabled = variant === 'disabled';
  const isError  = variant === 'error';
  const isFocus  = variant === 'focus';

  const borderColor = isError ? ds.severity.critical : isFocus ? ds.accent.default : ds.border.default;
  const boxShadow   = isError
    ? '0 0 0 3px rgba(239,68,68,0.12)'
    : isFocus
      ? `0 0 0 3px ${ds.border.accent20}`
      : 'none';

  const hasLeft  = inputType === 'search' || !!leftIcon;
  const hasRight = inputType === 'password' || !!rightIcon;
  const nativeType = inputType === 'password' ? (showPwd ? 'text' : 'password') : 'text';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...styleProp }}>
      {label && (
        <label
          style={{
            fontSize: ds.size.sm,
            fontWeight: ds.weight.medium,
            color: ds.text.secondary,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {hasLeft && (
          <span
            style={{
              position: 'absolute',
              left: 10,
              display: 'flex',
              alignItems: 'center',
              color: isError ? ds.severity.critical : ds.text.muted,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            {inputType === 'search' ? <Search size={14} /> : leftIcon}
          </span>
        )}

        <input
          type={nativeType}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            onChange?.(e.target.value);
          }}
          onFocus={() => !forceVariant && setIsFocused(true)}
          onBlur ={() => !forceVariant && setIsFocused(false)}
          style={{
            width: '100%',
            height: 36,
            backgroundColor: ds.bg.surface,
            border: `1px solid ${borderColor}`,
            borderRadius: ds.radius.md,
            fontSize: ds.size.sm,
            fontFamily: 'Inter, sans-serif',
            color: ds.text.primary,
            paddingLeft: hasLeft ? 32 : 12,
            paddingRight: hasRight ? 36 : 12,
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.4 : 1,
            boxShadow,
            transition: 'all 0.15s ease',
          }}
        />

        {inputType === 'password' && (
          <button
            type="button"
            style={{
              position: 'absolute',
              right: 10,
              display: 'flex',
              alignItems: 'center',
              color: ds.text.muted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              zIndex: 1,
            }}
            onClick={() => setShowPwd((p) => !p)}
          >
            {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}

        {inputType !== 'password' && hasRight && (
          <span
            style={{
              position: 'absolute',
              right: 10,
              display: 'flex',
              alignItems: 'center',
              color: ds.text.muted,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            {rightIcon}
          </span>
        )}
      </div>

      {isError && errorMessage && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: ds.size.xs,
            color: ds.severity.critical,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <AlertCircle size={11} />
          {errorMessage}
        </span>
      )}
    </div>
  );
}
