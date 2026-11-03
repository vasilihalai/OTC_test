import { Spinner } from '@/components/Spinner/Spinner.tsx';
import { bem } from '@/css/bem.ts';

import './DocumentRow.css';

const [b, e] = bem('document-row');

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v7.5m0 0L5 6.5m3 3l3-3M2.5 10.5V12A1.5 1.5 0 0 0 4 13.5h8a1.5 1.5 0 0 0 1.5-1.5v-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export interface DocumentRowProps {
  name: string;
  enabled: boolean;
  caption?: string;
  loading?: boolean;
  onOpen: () => void;
}

export function DocumentRow({ name, enabled, caption, loading = false, onOpen }: DocumentRowProps) {
  return (
    <div className={b({ disabled: !enabled })}>
      <button
        type="button"
        className={e('main')}
        disabled={!enabled || loading}
        onClick={enabled ? onOpen : undefined}
      >
        {loading ? <Spinner size={16}/> : <DownloadIcon/>}
        <span className={e('name')}>{name}</span>
      </button>
      {!enabled && caption && <span className={e('caption')}>{caption}</span>}
    </div>
  );
}
