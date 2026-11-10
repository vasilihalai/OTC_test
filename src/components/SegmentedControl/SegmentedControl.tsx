import { bem } from '@/css/bem.ts';
import { useSlidingThumb } from '@/lib/useSlidingThumb.ts';
import { hapticSelection } from '@/telegram/adapter.ts';

import './SegmentedControl.css';

const [b, e] = bem('segmented-control');

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const thumb = useSlidingThumb(value);

  function select(next: T) {
    if (next !== value) {
      hapticSelection();
      onChange(next);
    }
  }

  return (
    <div className={b()} ref={thumb.rootRef}>
      {thumb.style && <span className={e('thumb')} style={thumb.style} aria-hidden="true"/>}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={e('item', { active: option.value === value })}
          data-active={option.value === value}
          aria-pressed={option.value === value}
          onClick={() => select(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
