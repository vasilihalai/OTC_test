import type { ReactNode } from 'react';

/** Kyrgyzstan flag: red field, a small gold sun around the tunduk. */
function KgsFlagIcon() {
  const rays = Array.from({ length: 20 }, (_, i) => (i * 18 * Math.PI) / 180);
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#E8112D"/>
      <g stroke="#FFC72C" strokeWidth="1.3" strokeLinecap="round">
        {rays.map((angle) => (
          <line
            key={angle}
            x1={20 + 8.4 * Math.cos(angle)}
            y1={20 + 8.4 * Math.sin(angle)}
            x2={20 + 12 * Math.cos(angle)}
            y2={20 + 12 * Math.sin(angle)}
          />
        ))}
      </g>
      <circle cx="20" cy="20" r="6.2" fill="none" stroke="#FFC72C" strokeWidth="1.3"/>
      <path d="M15.6 18.2c3 1.6 5.8 1.6 8.8 0M15.6 21.8c3-1.6 5.8-1.6 8.8 0M18.2 15.6c-1.6 3-1.6 5.8 0 8.8M21.8 15.6c1.6 3 1.6 5.8 0 8.8" fill="none" stroke="#FFC72C" strokeWidth="0.9"/>
    </svg>
  );
}

/** United States flag: red/white stripes, blue canton with a 3x3 star grid. */
function UsdFlagIcon() {
  const stripeHeight = 40 / 7;
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <clipPath id="usd-flag-clip">
          <circle cx="20" cy="20" r="20"/>
        </clipPath>
      </defs>
      <g clipPath="url(#usd-flag-clip)">
        <rect width="40" height="40" fill="#fff"/>
        {[0, 2, 4, 6].map((i) => (
          <rect key={i} y={i * stripeHeight} width="40" height={stripeHeight} fill="#B22234"/>
        ))}
        <rect width="20" height="18" fill="#3C3B6E"/>
        {[4, 9.5, 15].map((x) =>
          [3.5, 8.7, 13.9].map((y) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="#fff"/>
          )),
        )}
      </g>
    </svg>
  );
}

/** Tether's mark: the "T" through a ring. */
function UsdtCoinIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#26A17B"/>
      <path
        fill="#fff"
        d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117"
      />
    </svg>
  );
}

/** USD Coin: blue field, a circular double-arrow with a $ mark. */
function UsdcCoinIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#2775CA"/>
      <path d="M15.5 12.8a10 10 0 0 0 0 14.4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M24.5 12.8a10 10 0 0 1 0 14.4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <text x="20" y="25.5" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">$</text>
    </svg>
  );
}

/** Ethereum: indigo field, the stacked-diamond mark. */
function EthCoinIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#627EEA"/>
      <polygon points="20,9 20,17.9 27.8,21.6" fill="#fff" fillOpacity="0.6"/>
      <polygon points="20,9 12.2,21.6 20,17.9" fill="#fff"/>
      <polygon points="20,23.2 20,31 27.8,23.1" fill="#fff" fillOpacity="0.6"/>
      <polygon points="20,31 20,23.2 12.2,23.1" fill="#fff"/>
      <polygon points="20,21.6 27.8,17.4 20,13.4" fill="#fff" fillOpacity="0.2"/>
      <polygon points="12.2,17.4 20,21.6 20,13.4" fill="#fff" fillOpacity="0.6"/>
    </svg>
  );
}

/** Bitcoin's mark: the tilted, double-barred B. */
function BtcCoinIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#F7931A"/>
      <path
        fill="#fff"
        d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z"
      />
    </svg>
  );
}

/** Russian ruble: sky-blue field, the ₽ mark. */
function RubCoinIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#5AC8FA"/>
      <path d="M16 31V9.5h6.5a6.5 6.5 0 0 1 0 13H12M12 26.5h11" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Solid-color circle with a plain text symbol — the fallback for any other ticker. */
function SymbolCoinIcon({ symbol }: { symbol: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#2A2C31"/>
      <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">{symbol}</text>
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  KGS: <KgsFlagIcon/>,
  USD: <UsdFlagIcon/>,
  USDT: <UsdtCoinIcon/>,
  USDC: <UsdcCoinIcon/>,
  ETH: <EthCoinIcon/>,
  BTC: <BtcCoinIcon/>,
  RUB: <RubCoinIcon/>,
};

export interface CurrencyIconProps {
  ticker: string;
  size?: number;
}

/** Flat brand-ish icon per ticker (mocked — swap for real assets later). */
export function CurrencyIcon({ ticker, size = 40 }: CurrencyIconProps) {
  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}
    >
      {ICONS[ticker] ?? <SymbolCoinIcon symbol={ticker.slice(0, 1)}/>}
    </div>
  );
}
