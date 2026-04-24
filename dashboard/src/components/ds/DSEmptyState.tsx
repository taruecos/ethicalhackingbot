import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ds } from './tokens';
import { DSButton } from './DSButton';

interface DSEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  style?: React.CSSProperties;
}

export function DSEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
  style: styleProp,
}: DSEmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 48,
        ...styleProp,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: ds.radius.xl,
          backgroundColor: ds.bg.elevated,
          border: `1px solid ${ds.border.default}`,
          marginBottom: 20,
        }}
      >
        <Icon size={28} style={{ color: ds.text.muted }} />
      </div>

      <h3
        style={{
          margin: '0 0 8px',
          fontSize: ds.size['2xl'],
          fontWeight: ds.weight.semibold,
          color: ds.text.primary,
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: '0 0 24px',
          fontSize: ds.size.sm,
          color: ds.text.muted,
          fontFamily: 'Inter, sans-serif',
          maxWidth: 320,
          lineHeight: 1.65,
        }}
      >
        {description}
      </p>

      {ctaLabel && (
        <DSButton variant="primary" size="md" onClick={onCta}>
          {ctaLabel}
        </DSButton>
      )}
    </div>
  );
}
