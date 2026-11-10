import { useRef } from 'react';

import { Modal } from '@/components/Modal/Modal.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { openExternalLink } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './ExtraCheckDialog.css';

/**
 * The web cabinet: dev.xruby.kg for the dev contour (the mini app itself is served from a `.dev.` host
 * there), xruby.kg everywhere else. `VITE_WEB_CABINET_URL` overrides it for a contour that differs.
 */
const WEB_CABINET_URL = import.meta.env.VITE_WEB_CABINET_URL
  || (window.location.hostname.includes('.dev.') ? 'https://dev.xruby.kg' : 'https://xruby.kg');

/**
 * `before` — the code wasn't sent: the withdrawal is closed by tasks the client hasn't done yet, and
 * nothing has been created. `paused` — the code was accepted and the withdrawal exists, but it waits
 * for a questionnaire or tasks and goes on by itself once they are done.
 */
export type ExtraCheck = 'before' | 'paused';

export interface ExtraCheckDialogProps {
  check: ExtraCheck | undefined;
  onClose: () => void;
}

/**
 * A withdrawal stopped by a check the web cabinet walks the client through and the mini app has no
 * screens for (the anti-fraud questionnaire, user tasks — BRCE-4023 §6). Not an error: says what
 * happened to the withdrawal and where to go.
 */
export function ExtraCheckDialog({ check, onClose }: ExtraCheckDialogProps) {
  // The text stays while the dialog fades out, after `check` is already gone.
  const shown = useRef(check);
  if (check) {
    shown.current = check;
  }

  return (
    <Modal
      open={!!check}
      title={ru.withdraw.extraCheckTitle}
      onClose={onClose}
      footer={(
        <div className="button-row">
          <Button type="button" variant="secondary" onClick={onClose}>
            {ru.withdraw.extraCheckCloseAction}
          </Button>
          <Button
            variant="accent"
            onClick={() => {
              openExternalLink(WEB_CABINET_URL);
              onClose();
            }}
          >
            {ru.withdraw.extraCheckOpenAction}
          </Button>
        </div>
      )}
    >
      <p className="extra-check-dialog__body">
        {shown.current === 'before' ? ru.withdraw.extraCheckBefore : ru.withdraw.extraCheckPaused}
      </p>
    </Modal>
  );
}
