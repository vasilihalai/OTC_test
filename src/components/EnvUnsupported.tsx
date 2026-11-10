import { ru } from '@/i18n/ru.ts';

/**
 * The app couldn't start in this Telegram client (the launch parameters or the SDK failed). Plain
 * markup with inline styles on purpose: this renders instead of the app, when nothing else may have
 * loaded.
 */
export function EnvUnsupported() {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        textAlign: 'center',
        background: '#0C0E12',
        color: '#CECFD2',
        font: "400 15px/22px -apple-system, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <strong style={{ fontSize: 18, lineHeight: '26px', color: '#F7F7F7' }}>{ru.common.updateTelegram}</strong>
      <span style={{ maxWidth: 280, color: '#94979C' }}>{ru.common.unsupportedClient}</span>
    </div>
  );
}
