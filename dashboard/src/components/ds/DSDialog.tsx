"use client";

import React from 'react';
import { X } from 'lucide-react';
import { ds } from './tokens';
import { DSButton } from './DSButton';

interface DSDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function DSDialog({ isOpen, onClose, title, children, footer }: DSDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: ds.bg.elevated,
          border: `1px solid ${ds.border.default}`,
          borderRadius: ds.radius.xl,
          padding: 24,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: ds.size['2xl'],
              fontWeight: ds.weight.semibold,
              color: ds.text.primary,
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>
          <DSButton
            variant="icon-only"
            size="sm"
            icon={<X size={14} />}
            onClick={onClose}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {children}
        </div>

        {footer && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 24,
              paddingTop: 20,
              borderTop: `1px solid ${ds.border.default}`,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
