import { type CSSProperties, type RefObject, useLayoutEffect, useRef, useState } from 'react';

export interface SlidingThumb {
  /** Goes on the element that holds the items and the thumb; it must be the items' offset parent. */
  rootRef: RefObject<HTMLDivElement>;
  /** Position and width for the thumb, or `undefined` before the first measurement. */
  style: CSSProperties | undefined;
}

/**
 * The highlight behind the chosen item of a segmented control or a chip row: one element that slides
 * to the item (marked `data-active`) instead of each item switching its own background on and off.
 * Measured off the real item, so it follows label lengths, font loading and resizes.
 */
export function useSlidingThumb(value: string): SlidingThumb {
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; width: number }>();

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    function measure() {
      const active = root?.querySelector<HTMLElement>('[data-active="true"]');
      if (active) {
        const next = { x: active.offsetLeft, width: active.offsetWidth };
        setBox((current) => (current && current.x === next.x && current.width === next.width ? current : next));
      }
    }
    measure();
    // The labels change width when the web font arrives or the screen is resized.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll('[data-active]').forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [value]);

  return { rootRef, style: box && { transform: `translateX(${box.x}px)`, width: box.width } };
}
