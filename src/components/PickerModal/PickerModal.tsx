import { bem } from '@/css/bem.ts';
import { useDelayedUnmount } from '@/lib/useDelayedUnmount.ts';
import { hapticSelection } from '@/telegram/adapter.ts';

import './PickerModal.css';

const [b, e] = bem('picker-sheet');
/** Keep in sync with `picker-sheet-out` in PickerModal.css. */
const EXIT_DURATION_MS = 200;

export interface PickerModalOption<T extends string> {
  value: T;
  label: string;
}

export interface PickerModalProps<T extends string> {
  open: boolean;
  title: string;
  options: PickerModalOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

export function PickerModal<T extends string>({ open, title, options, value, onSelect, onClose }: PickerModalProps<T>) {
  const rendered = useDelayedUnmount(open, EXIT_DURATION_MS);
  if (!rendered) {
    return null;
  }

  return (
    <div className={e('scrim', { closing: !open })} onClick={onClose}>
      <div className={b({ closing: !open })} onClick={(ev) => ev.stopPropagation()}>
        <div className={e('handle')}/>
        <span className={e('title')}>{title}</span>
        <div className={e('list')}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={e('row', { selected: option.value === value })}
              onClick={() => {
                hapticSelection();
                onSelect(option.value);
                onClose();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
