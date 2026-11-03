import { useToastStore } from '@/store/toast.ts';
import { ru } from '@/i18n/ru.ts';

const MAX_SHOWN_ID_LENGTH = 8;

/** The frames land a confirmed withdrawal on Home with this notice on top. */
export function showWithdrawalAccepted(id: string | undefined): void {
  const message = id && id.length <= MAX_SHOWN_ID_LENGTH
    ? ru.withdraw.acceptedToast.replace('{id}', id)
    : ru.withdraw.acceptedToastNoId;
  useToastStore.getState().show(message, 'notice');
}
