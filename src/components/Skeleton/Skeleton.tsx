import { type CSSProperties, type ReactNode, useLayoutEffect, useRef } from 'react';

import { classNames } from '@/css/classnames.ts';
import { ru } from '@/i18n/ru.ts';

import './Skeleton.css';

/** One sweep of the highlight, in ms. Keep in sync with `skeleton-sweep` in Skeleton.css. */
const SWEEP_MS = 1700;

const waiting = new Set<HTMLElement>();
let scheduled = false;

/**
 * The highlight is one beam crossing the whole screen, not a blink per bar: every bar shows the slice
 * of it that falls on its own place. For that each bar needs to know where it is inside the app shell
 * and to run in phase with the others, whenever it was mounted. All bars mounted in one commit are
 * measured together and only then written to, so a screenful of them costs one layout.
 */
function align(): void {
  scheduled = false;
  const measured = [...waiting].filter((element) => element.isConnected).map((element) => {
    const shell = (element.closest('.app-shell') ?? document.documentElement).getBoundingClientRect();
    return { element, left: element.getBoundingClientRect().left - shell.left, width: shell.width };
  });
  waiting.clear();
  const phase = `${-Math.round(performance.now() % SWEEP_MS)}ms`;
  for (const { element, left, width } of measured) {
    element.style.setProperty('--skeleton-x', `${Math.round(left)}px`);
    element.style.setProperty('--skeleton-w', `${Math.round(width)}px`);
    element.style.setProperty('--skeleton-phase', phase);
  }
}

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  /**
   * The line height of the text this bar stands for. The bar is centred in a box that tall, so the
   * text taking its place moves nothing around it.
   */
  line?: number;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, line, className, style }: SkeletonProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      waiting.add(ref.current);
      if (!scheduled) {
        scheduled = true;
        // After this commit's layout effects, before the browser paints.
        queueMicrotask(align);
      }
    }
  }, []);

  const margin = line !== undefined && typeof height === 'number' ? Math.max(0, (line - height) / 2) : undefined;

  return (
    <span
      ref={ref}
      className={classNames('skeleton', className)}
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, marginBlock: margin, ...style }}
    />
  );
}

/** Wraps a group of placeholders: a screen reader hears one "loading", not a list of empty boxes. */
export function SkeletonGroup({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={classNames('skeleton-group', className)} role="status" aria-busy="true" aria-label={ru.common.loading}>
      {children}
    </div>
  );
}
