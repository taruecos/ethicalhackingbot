import React from 'react';
import { ds } from './tokens';

export type BadgeSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type BadgeStatus =
  | 'NEW'
  | 'CONFIRMED'
  | 'FALSE_POSITIVE'
  | 'FIXED'
  | 'ACCEPTED'
  | 'REPORTED';
export type BadgeSize = 'sm' | 'md';

type DSBadgeProps =
  | { type: 'severity'; severity: BadgeSeverity; size?: BadgeSize }
  | { type: 'status'; status: BadgeStatus; size?: BadgeSize };

interface BadgeConfig {
  color: string;
  bg: string;
  label: string;
}

const severityMap: Record<BadgeSeverity, BadgeConfig> = {
  critical: { color: ds.severity.critical, bg: ds.severity.criticalBg, label: 'Critical' },
  high:     { color: ds.severity.high,     bg: ds.severity.highBg,     label: 'High' },
  medium:   { color: ds.severity.medium,   bg: ds.severity.mediumBg,   label: 'Medium' },
  low:      { color: ds.severity.low,      bg: ds.severity.lowBg,      label: 'Low' },
  info:     { color: ds.severity.info,     bg: ds.severity.infoBg,     label: 'Info' },
};

const statusMap: Record<BadgeStatus, BadgeConfig> = {
  NEW:            { color: ds.severity.info,     bg: ds.severity.infoBg,              label: 'New' },
  CONFIRMED:      { color: ds.severity.high,     bg: ds.severity.highBg,              label: 'Confirmed' },
  FALSE_POSITIVE: { color: ds.text.muted,        bg: 'rgba(113,113,122,0.15)',         label: 'False Positive' },
  FIXED:          { color: ds.accent.default,    bg: ds.accent.bg15,                  label: 'Fixed' },
  ACCEPTED:       { color: ds.severity.medium,   bg: ds.severity.mediumBg,            label: 'Accepted' },
  REPORTED:       { color: ds.severity.info,     bg: ds.severity.infoBg,              label: 'Reported' },
};

export function DSBadge(props: DSBadgeProps) {
  const size = props.size ?? 'md';
  const config =
    props.type === 'severity' ? severityMap[props.severity] : statusMap[props.status];

  const h  = size === 'sm' ? 20 : 24;
  const px = size === 'sm' ? 8  : 10;
  const fs = size === 'sm' ? ds.size.xs : ds.size.sm;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: h,
        padding: `0 ${px}px`,
        backgroundColor: config.bg,
        borderRadius: ds.radius.md,
        fontSize: fs,
        fontWeight: ds.weight.medium,
        fontFamily: 'Inter, sans-serif',
        color: config.color,
        whiteSpace: 'nowrap' as const,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: config.color,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}
