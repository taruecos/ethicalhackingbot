import React from 'react';
import { ds } from './ds/tokens';

export function PageHeader({
  frame,
  title,
  description,
}: {
  frame: string;
  title: string;
  description?: string;
}) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: ds.size.xs,
            fontWeight: ds.weight.medium,
            color: ds.accent.default,
            fontFamily: 'Inter, monospace',
            backgroundColor: ds.accent.bg15,
            padding: '2px 8px',
            borderRadius: ds.radius.md,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: ds.accent.default,
            }}
          />
          Frame
        </span>
        <span
          style={{
            fontSize: ds.size.xs,
            color: ds.text.muted,
            fontFamily: 'Inter, monospace',
          }}
        >
          {frame}
        </span>
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: ds.size['3xl'],
          fontWeight: ds.weight.bold,
          color: ds.text.primary,
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h1>
      {description && (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: ds.size.base,
            color: ds.text.muted,
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export function ShowcaseSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <span
          style={{
            fontSize: ds.size.xs,
            fontWeight: ds.weight.semibold,
            color: ds.text.muted,
            fontFamily: 'Inter, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {title}
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            backgroundColor: ds.border.default,
          }}
        />
      </div>
      {children}
    </div>
  );
}

export function VariantItem({
  label,
  sublabel,
  children,
  align = 'start',
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
  align?: 'start' | 'center';
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        gap: 10,
      }}
    >
      {children}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: ds.size.xs,
            fontWeight: ds.weight.medium,
            color: ds.text.secondary,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {label}
        </span>
        {sublabel && (
          <span
            style={{
              fontSize: ds.size.xs,
              color: ds.text.muted,
              fontFamily: 'Inter, monospace',
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function VariantRow({
  children,
  gap = 32,
  wrap = false,
  align = 'start',
}: {
  children: React.ReactNode;
  gap?: number;
  wrap?: boolean;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap,
        alignItems: align === 'start' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end',
      }}
    >
      {children}
    </div>
  );
}

export function CanvasFrame({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        backgroundColor: ds.bg.surface,
        border: `1px solid ${ds.border.default}`,
        borderRadius: ds.radius['2xl'],
        padding: 28,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function TokenChip({
  name,
  value,
  mono = false,
}: {
  name: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '4px 10px',
        backgroundColor: ds.bg.elevated,
        borderRadius: ds.radius.md,
        border: `1px solid ${ds.border.default}`,
      }}
    >
      <span
        style={{
          fontSize: ds.size.xs,
          color: ds.text.secondary,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontSize: ds.size.xs,
          color: ds.text.muted,
          fontFamily: mono ? 'monospace' : 'Inter, sans-serif',
        }}
      >
        {value}
      </span>
    </div>
  );
}
