import type { ReactNode } from 'react';

import { bem } from '@/css/bem.ts';

import './Badge.css';

const [b] = bem('badge');

export interface BadgeProps {
  variant?: 'success' | 'neutral';
  children: ReactNode;
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={b(variant)}>{children}</span>;
}
