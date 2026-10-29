import type {
  Accounts,
  Asset,
  ClientType,
  CryptoRequisites,
  Deal,
  FiatRequisites,
  SavedRequisite,
  Stats,
  User,
  WithdrawNetworkOption,
} from '@/api/types.ts';

export const MOCK_USERS: Record<ClientType, User> = {
  UL: {
    clientName: 'ООО «Альфа Трейд»',
    clientType: 'UL',
    verified: true,
    securityLevel: 'LOW',
    otcAccess: 'GRANTED',
    email: 'karimov@gmail.com',
    phone: '+996 500 123 456',
    userId: '8f3a92c17b4e55d0a6f23e81c94b1d07',
    webCabinetUrl: 'https://xruby.example/cabinet',
    supportUrl: 'https://t.me/xruby_support',
    faqUrl: 'https://xruby.example/faq',
    aboutUrl: 'https://xruby.example/about',
    authenticatorEnabled: true,
  },
  FL: {
    clientName: 'Каримов Азамат',
    clientType: 'FL',
    verified: true,
    securityLevel: 'MEDIUM',
    otcAccess: 'GRANTED',
    email: 'karimov@gmail.com',
    phone: '+996 500 123 456',
    userId: '8f3a92c17b4e55d0a6f23e81c94b1d07',
    webCabinetUrl: 'https://xruby.example/cabinet',
    supportUrl: 'https://t.me/xruby_support',
    faqUrl: 'https://xruby.example/faq',
    aboutUrl: 'https://xruby.example/about',
    authenticatorEnabled: false,
  },
};

export const MOCK_STATS: Stats = { activeDeals: 5, volume30d: '100.24M', volumeAsset: 'KGS' };

export const MOCK_DEALS: Deal[] = [
  {
    id: 'OTC-1055',
    status: 'RATE_ACTIVE',
    date: '19.08.2026 09:12',
    direction: 'SELL',
    from: '25 000 USDT',
    to: '100 954 500 KGS',
    rate: '4 038.18 KGS',
    ticker: 'USDT',
    ratePerUnit: '4 038.18',
    rateUnitLabel: 'KGS за 1 USDT',
    quoteExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'OTC-1054',
    status: 'RATE_STALE',
    date: '18.08.2026 18:03',
    direction: 'EXCHANGE',
    from: '4 000 000 KGS',
    to: null,
    rate: null,
    ticker: 'KGS',
  },
  {
    id: 'OTC-1053',
    status: 'AWAITING_FUNDS',
    date: '17.08.2026 16:40',
    direction: 'BUY',
    from: '2.540000 BTC',
    to: '159 275 USD',
    rate: '62 706.69 USD',
    ticker: 'BTC',
  },
  {
    id: 'OTC-1051',
    status: 'RATE_PENDING',
    date: '15.08.2026 11:05',
    direction: 'SELL',
    from: '209 000 USDT',
    to: '81 420 000 KGS',
    rate: null,
    ticker: 'USDT',
  },
  {
    id: 'OTC-1049',
    status: 'RUNNING',
    date: '14.08.2026 08:51',
    direction: 'SELL',
    from: '20 000 USDT',
    to: '7 420 000 KGS',
    rate: '371.00 KGS',
    ticker: 'USDT',
  },
  {
    id: 'OTC-1048',
    status: 'DONE',
    date: '12.08.2026 12:23',
    direction: 'BUY',
    from: '1 000 000 KGS',
    to: '8 500.51 USDT',
    rate: '117.64 KGS',
    ticker: 'KGS',
  },
  {
    id: 'OTC-1047',
    status: 'DECLINED',
    date: '10.08.2026 15:47',
    direction: 'EXCHANGE',
    from: '4 000 000 KGS',
    to: '11 454.75 USDT',
    rate: '349.20 KGS',
    ticker: 'KGS',
  },
  {
    id: 'OTC-1044',
    status: 'DONE',
    date: '08.08.2026 14:02',
    direction: 'EXCHANGE',
    from: '10 000 USD',
    to: '890 000 000 KGS',
    rate: '89 000.00 KGS',
    ticker: 'USD',
  },
  {
    id: 'OTC-1040',
    status: 'DONE',
    date: '02.08.2026 10:15',
    direction: 'BUY',
    from: '3 000 000 KGS',
    to: '25 500.00 USDT',
    rate: '117.65 KGS',
    ticker: 'KGS',
  },
  {
    id: 'OTC-1036',
    status: 'DONE',
    date: '25.07.2026 13:47',
    direction: 'SELL',
    from: '18 000 USDC',
    to: '6 300 000 KGS',
    rate: '350.00 KGS',
    ticker: 'USDC',
  },
  {
    id: 'OTC-1029',
    status: 'DONE',
    date: '14.07.2026 09:30',
    direction: 'EXCHANGE',
    from: '5 000 USD',
    to: '445 000 000 KGS',
    rate: '89 000.00 KGS',
    ticker: 'USD',
  },
  {
    id: 'OTC-1018',
    status: 'DECLINED',
    date: '20.06.2026 17:22',
    direction: 'BUY',
    from: '800 000 RUB',
    to: '9 150.00 USDT',
    rate: '87.43 RUB',
    ticker: 'RUB',
  },
  {
    id: 'OTC-1005',
    status: 'DONE',
    date: '15.05.2026 12:00',
    direction: 'SELL',
    from: '0.300000 BTC',
    to: '1 800 000 KGS',
    rate: '6 000 000.00 KGS',
    ticker: 'BTC',
  },
];

/** OTC minimum deal size per source asset — used by the confirmation body's callout branches. */
export const MOCK_MIN_DEAL: Record<string, string> = {
  KGS: '1000000',
  RUB: '1000000',
  USD: '12000',
  USDT: '12000',
  USDC: '12000',
  BTC: '0.15',
};

export const MOCK_REQUISITES_FIAT: FiatRequisites = {
  kind: 'fiat',
  companyName: 'ОАО «СО ЕЭС»',
  bank: 'ОАО «БАКАЙ БАНК»',
  bankAddress: 'Кыргызская Республика, 720040, г. Бишкек, ул. Исанова 105',
  bik: '124032',
  account: '1240020001397008',
  recipient: 'ОАО «БитРуби»',
  recipientAddress: 'Кыргызская Республика, г. Бишкек, Ленинский район, ул. Тыныстанова 249',
  corrAccount: '30100012345678976190',
  purpose: 'Оплата по заявке № ОТС–1052. НДС не облагается',
};

export const MOCK_REQUISITES_CRYPTO: CryptoRequisites = {
  kind: 'crypto',
  asset: 'USDT',
  assetName: 'Tether',
  network: 'TRON (TRC-20)',
  address: 'bnb1mrzq7fenlfxx59usn2fn8aygdyfrsku4jz8k9r',
  networks: [
    { network: 'TRON (TRC-20)', address: 'bnb1mrzq7fenlfxx59usn2fn8aygdyfrsku4jz8k9r' },
    { network: 'Ethereum (ERC-20)', address: '0x71C7656EC7ab88b098defB7501B1f9A5C2b3E4d' },
  ],
};

export const MOCK_ASSETS: Asset[] = [
  { ticker: 'KGS', name: 'Кыргызский сом', balance: '10000000', group: 'fiat' },
  { ticker: 'RUB', name: 'Российский рубль', balance: '5000000', group: 'fiat' },
  { ticker: 'USD', name: 'Доллар США', balance: '200000', group: 'fiat' },
  { ticker: 'USDT', name: 'Tether', balance: '56889.65', group: 'crypto' },
  { ticker: 'USDC', name: 'USD Coin', balance: '12500.00', group: 'crypto' },
  { ticker: 'BTC', name: 'Bitcoin', balance: '0.420000', group: 'crypto' },
  // Dust (~$0.70) — what Home's "hide balances under $1" checkbox is for.
  { ticker: 'ETH', name: 'Ethereum', balance: '0.0002', group: 'crypto' },
];

/** Approximate USD rates for the mock `usdValue` — ordering and the under-$1 filter only. */
export const MOCK_USD_RATES: Record<string, number> = {
  KGS: 0.0114, RUB: 0.0125, USD: 1, USDT: 1, USDC: 1, BTC: 65000, ETH: 3500,
};

/** Deposit vs. trading account balances — the mutable source of truth lives in `accountsStore.ts`. */
export const MOCK_ACCOUNTS: Accounts = {
  deposit: { KGS: '10000000', RUB: '5000000', USD: '200000', USDT: '56889.65', USDC: '12500.00', BTC: '0.420000', ETH: '0.0002' },
  trading: { KGS: '1000000', RUB: '0', USD: '0', USDT: '50000.00', USDC: '0', BTC: '0', ETH: '0' },
};

/**
 * api-integration.md §5.1 — one entry per (currency, paymentType) pair,
 * each with its own limits/commission, mirroring
 * `MOCK_WITHDRAW_CRYPTO_NETWORKS`'s restructuring for the fiat side.
 * `operationOption` is a single fixed value per payment type here since
 * nothing in the doc describes multiple options per type or how a UI would
 * expose picking between them.
 */
export const MOCK_WITHDRAW_FIAT_METHODS: { currency: string; paymentType: string; operationOption: string; minimalAmount: string; maximumAmount: string; commissionPercent: string; commissionFixed: string }[] = [
  { currency: 'KGS', paymentType: 'BAKAI_BUSINESS', operationOption: 'DEFAULT', minimalAmount: '100000', maximumAmount: '15000000', commissionPercent: '1.0', commissionFixed: '0' },
  { currency: 'KGS', paymentType: 'INTER_BANK_KG_BUSINESS', operationOption: 'DEFAULT', minimalAmount: '100000', maximumAmount: '15000000', commissionPercent: '1.5', commissionFixed: '0' },
  { currency: 'RUB', paymentType: 'INTER_BANK_RU_BUSINESS', operationOption: 'DEFAULT', minimalAmount: '100000', maximumAmount: '10000000', commissionPercent: '1.5', commissionFixed: '0' },
  { currency: 'USD', paymentType: 'SWIFT', operationOption: 'DEFAULT', minimalAmount: '1000', maximumAmount: '200000', commissionPercent: '2.0', commissionFixed: '0' },
];

/**
 * api-integration.md §5.1 — one entry per (currency, network) pair, each
 * with its own limits/commission, matching the real directory's shape
 * (`cryptoCurrencies`) instead of the old one-limits-object-per-asset mock.
 */
export const MOCK_WITHDRAW_CRYPTO_NETWORKS: (WithdrawNetworkOption & { currency: string })[] = [
  {
    currency: 'USDT', currencyNetworkId: 'usdt-trc20', networkCode: 'TRC20', networkLabel: 'TRON (TRC-20)',
    contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4frsku4u7', addressRegex: null,
    minimalAmount: '7', maximumAmount: '30000', commissionPercent: '0', commissionFixed: '0.50',
  },
  {
    currency: 'USDT', currencyNetworkId: 'usdt-erc20', networkCode: 'ERC20', networkLabel: 'Ethereum (ERC-20)',
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13a1c9e2b4', addressRegex: null,
    minimalAmount: '7', maximumAmount: '30000', commissionPercent: '0', commissionFixed: '0.50',
  },
  {
    currency: 'USDC', currencyNetworkId: 'usdc-erc20', networkCode: 'ERC20', networkLabel: 'Ethereum (ERC-20)',
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606a1c9e2b4', addressRegex: null,
    minimalAmount: '7', maximumAmount: '12500', commissionPercent: '0', commissionFixed: '0.50',
  },
  {
    currency: 'BTC', currencyNetworkId: 'btc-bitcoin', networkCode: 'BITCOIN', networkLabel: 'Bitcoin',
    contractAddress: null, addressRegex: null,
    minimalAmount: '0.0005', maximumAmount: '0.42', commissionPercent: '0', commissionFixed: '0.0002',
  },
];

export const MOCK_SAVED_REQUISITES: SavedRequisite[] = [
  { id: 'req-1', transferType: 'internal', label: 'Свой счёт xRuby · 1234…3456', account: '12345678901234563456' },
  {
    id: 'req-2',
    transferType: 'kg',
    label: 'Optima Bank · 1234…3456',
    account: '1234567890123456',
    bankName: 'ОАО «Optima Bank»',
    bic: '129001',
    inn: '01234567891011',
  },
  {
    id: 'req-3',
    transferType: 'ru',
    label: 'Т-Банк · 4081…2345',
    account: '40817810000000012345',
    bankName: 'АО «Т-Банк»',
    bic: '044525974',
    inn: '7710140679',
    correspondentAccount: '30101810145250000974',
  },
];

export function mockDelay(): Promise<void> {
  const ms = 400 + Math.random() * 400;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
