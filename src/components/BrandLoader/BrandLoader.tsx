import { ru } from '@/i18n/ru.ts';

import './BrandLoader.css';

/**
 * The full-screen wait: the same mark and running line as the boot splash in index.html, so the app
 * starting up and a screen that has nothing to draw yet look like one thing. Screens with a known
 * layout show a skeleton instead.
 */
export function BrandLoader() {
  return (
    <div className="brand-loader" role="status" aria-label={ru.common.loading}>
      <svg className="brand-loader__mark" width="40" height="40" viewBox="0 0 30 30" aria-hidden="true">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M30 0H0V30H30V0ZM11 5H5V11L9 15L5 19V25H11L15 21L19 25H25V19L21 15L25 11V5H19L15 9L11 5Z"
          fill="var(--brand-mark)"
        />
      </svg>
      <span className="brand-loader__bar" aria-hidden="true"/>
    </div>
  );
}
