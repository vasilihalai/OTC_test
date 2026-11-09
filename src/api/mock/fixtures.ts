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
    supportUrl: 'https://t.me/xruby_support',
    faqUrl: 'https://xruby.example/faq',
    aboutUrl: 'https://xruby.example/about',
    authenticatorEnabled: false,
  },
};

export const MOCK_STATS: Stats = { activeDeals: 5, volume30d: '100.24M', volumeAsset: 'KGS' };

/**
 * One deal per screen the client can land on (BRCE-4023 §2). `amount`, `minAmount` and `documents`
 * are filled in by `store.ts`, the way the backend sends them.
 */
export const MOCK_DEALS: Deal[] = [
  {
    id: 'OTC-1059',
    status: 'REPRICE_PROPOSED',
    date: '20.08.2026 11:40',
    direction: 'BUY',
    from: '5 000 000 KGS',
    to: '57 175.53 USDT',
    rate: '1 USDT = 87.45 KGS',
    ratePerUnit: '87.45',
    rateUnitLabel: 'KGS за 1 USDT',
    ticker: 'KGS',
    toTicker: 'USDT',
    holdAmount: '2 000 000 KGS',
    reprice: {
      from: '2 000 000 KGS',
      to: '22 727.27 USDT',
      rate: '1 USDT = 88 KGS',
      ratePerUnit: '88',
      rateUnitLabel: 'KGS за 1 USDT',
    },
  },
  {
    id: 'OTC-1058',
    status: 'SHORTFALL_REVIEW',
    date: '20.08.2026 10:05',
    direction: 'BUY',
    from: '5 000 000 KGS',
    to: '57 175.53 USDT',
    rate: '1 USDT = 87.45 KGS',
    ticker: 'KGS',
    toTicker: 'USDT',
    holdAmount: '2 000 000 KGS',
  },
  {
    id: 'OTC-1057',
    status: 'TERMS_PROPOSED',
    date: '19.08.2026 16:20',
    direction: 'SELL',
    from: '25 000 USDT',
    to: '2 177 500 KGS',
    rate: '1 USDT = 87.1 KGS',
    ratePerUnit: '87.1',
    rateUnitLabel: 'KGS за 1 USDT',
    ticker: 'USDT',
    toTicker: 'KGS',
    quoteExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    previous: {
      from: '25 000 USDT',
      to: '2 186 250 KGS',
      rate: '1 USDT = 87.45 KGS',
      ratePerUnit: '87.45',
      rateUnitLabel: 'KGS за 1 USDT',
    },
  },
  {
    id: 'OTC-1056',
    status: 'TERMS_PROPOSED',
    date: '19.08.2026 14:02',
    direction: 'BUY',
    from: '3 000 000 KGS',
    to: '34 305.32 USDT',
    rate: '1 USDT = 87.45 KGS',
    ratePerUnit: '87.45',
    rateUnitLabel: 'KGS за 1 USDT',
    ticker: 'KGS',
    toTicker: 'USDT',
    quoteExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    previous: {
      from: '5 000 000 KGS',
      to: '57 175.53 USDT',
      rate: '1 USDT = 87.45 KGS',
      ratePerUnit: '87.45',
      rateUnitLabel: 'KGS за 1 USDT',
    },
  },
  {
    id: 'OTC-1055',
    status: 'RATE_ACTIVE',
    date: '19.08.2026 09:12',
    direction: 'SELL',
    from: '25 000 USDT',
    to: '100 954 500 KGS',
    rate: '1 USDT = 4 038.18 KGS',
    ticker: 'USDT',
    toTicker: 'KGS',
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
    rate: '1 BTC = 62 706.69 USD',
    ticker: 'BTC',
    toTicker: 'USD',
  },
  {
    id: 'OTC-1052',
    status: 'AWAITING_FUNDS',
    date: '16.08.2026 12:30',
    direction: 'BUY',
    from: '4 000 000 KGS',
    to: '45 740.42 USDT',
    rate: '1 USDT = 87.45 KGS',
    ticker: 'KGS',
    toTicker: 'USDT',
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
    toTicker: 'KGS',
  },
  {
    id: 'OTC-1050',
    status: 'SHORTFALL_REVIEW',
    date: '14.08.2026 17:45',
    direction: 'SELL',
    from: '30 000 USDT',
    to: '2 623 500 KGS',
    rate: '1 USDT = 87.45 KGS',
    ticker: 'USDT',
    toTicker: 'KGS',
    holdAmount: '18 000 USDT',
    repriceRejected: true,
  },
  {
    id: 'OTC-1049',
    status: 'RUNNING',
    date: '14.08.2026 08:51',
    direction: 'SELL',
    from: '20 000 USDT',
    to: '7 420 000 KGS',
    rate: '1 USDT = 371.00 KGS',
    ticker: 'USDT',
    toTicker: 'KGS',
    holdAmount: '20 000 USDT',
  },
  {
    id: 'OTC-1048',
    status: 'DONE',
    date: '12.08.2026 12:23',
    direction: 'BUY',
    from: '1 000 000 KGS',
    to: '8 500.51 USDT',
    rate: '1 USDT = 117.64 KGS',
    ticker: 'KGS',
    toTicker: 'USDT',
    holdAmount: '1 000 000 KGS',
  },
  {
    id: 'OTC-1047',
    status: 'DECLINED',
    date: '10.08.2026 15:47',
    direction: 'EXCHANGE',
    from: '4 000 000 KGS',
    to: '11 454.75 USDT',
    rate: '1 USDT = 349.20 KGS',
    ticker: 'KGS',
    toTicker: 'USDT',
  },
  {
    id: 'OTC-1044',
    status: 'DONE',
    date: '08.08.2026 14:02',
    direction: 'EXCHANGE',
    from: '10 000 USD',
    to: '890 000 000 KGS',
    rate: '1 USD = 89 000.00 KGS',
    ticker: 'USD',
    toTicker: 'KGS',
  },
  {
    id: 'OTC-1040',
    status: 'DONE',
    date: '02.08.2026 10:15',
    direction: 'BUY',
    from: '3 000 000 KGS',
    to: '25 500.00 USDT',
    rate: '1 USDT = 117.65 KGS',
    ticker: 'KGS',
    toTicker: 'USDT',
  },
  {
    id: 'OTC-1036',
    status: 'DONE',
    date: '25.07.2026 13:47',
    direction: 'SELL',
    from: '18 000 USDC',
    to: '6 300 000 KGS',
    rate: '1 USDC = 350.00 KGS',
    ticker: 'USDC',
    toTicker: 'KGS',
  },
  {
    id: 'OTC-1029',
    status: 'DONE',
    date: '14.07.2026 09:30',
    direction: 'EXCHANGE',
    from: '5 000 USD',
    to: '445 000 000 KGS',
    rate: '1 USD = 89 000.00 KGS',
    ticker: 'USD',
    toTicker: 'KGS',
  },
  {
    id: 'OTC-1018',
    status: 'DECLINED',
    date: '20.06.2026 17:22',
    direction: 'BUY',
    from: '800 000 RUB',
    to: '9 150.00 USDT',
    rate: '1 USDT = 87.43 RUB',
    ticker: 'RUB',
    toTicker: 'USDT',
  },
  {
    id: 'OTC-1005',
    status: 'DONE',
    date: '15.05.2026 12:00',
    direction: 'SELL',
    from: '0.300000 BTC',
    to: '1 800 000 KGS',
    rate: '1 BTC = 6 000 000.00 KGS',
    ticker: 'BTC',
    toTicker: 'KGS',
  },
];

/** OTC minimum deal size per source asset — the backend's `minAmount` on every mock deal. */
export const MOCK_MIN_DEAL: Record<string, string> = {
  KGS: '1000000',
  RUB: '1000000',
  USD: '12000',
  USDT: '12000',
  USDC: '12000',
  BTC: '0.15',
};

/** `kind: FIAT` of the requisites method: a KGS account at a local bank, picked by the operator. */
export const MOCK_REQUISITES_FIAT: FiatRequisites = {
  kind: 'fiat',
  title: 'Бакай, KGS',
  recipientName: 'ОАО «БитРуби»',
  recipientAddress: 'Кыргызская Республика, г. Бишкек, Ленинский район, ул. Тыныстанова 249',
  recipientAccount: '1240020001397008',
  bankName: 'ОАО «БАКАЙ БАНК»',
  bankAddress: 'Кыргызская Республика, 720040, г. Бишкек, ул. Исанова 105',
  bic: '124032',
  purpose: 'Оплата по заявке № {requestNumber}. НДС не облагается',
};

/** A SWIFT account: the beneficiary's own account differs from the settlement one, plus a correspondent bank. */
export const MOCK_REQUISITES_FIAT_SWIFT: FiatRequisites = {
  kind: 'fiat',
  title: 'Бакай, SWIFT USD',
  recipientName: 'OJSC BitRuby',
  recipientAddress: '249 Tynystanov St, Bishkek 720040, Kyrgyz Republic',
  recipientAccount: '36312345678901234567',
  account: '1240020001397990',
  bankName: 'OJSC Bakai Bank',
  bankAddress: '105 Isanov St, Bishkek 720040, Kyrgyz Republic',
  bankSwift: 'BAKAKG22',
  correspondentBankName: 'Halyk Bank of Kazakhstan JSC',
  correspondentBankAddress: '40 Al-Farabi Ave, Almaty 050059, Kazakhstan',
  correspondentBankSwift: 'HSBKKZKX',
  purpose: 'Payment under request No. {requestNumber}. VAT exempt',
};

/** `kind: CRYPTO`: the client's own deposit address, one network per asset, as the method sends it. */
export const MOCK_CRYPTO_DEPOSIT: Record<string, Omit<CryptoRequisites, 'kind' | 'asset'>> = {
  USDT: { assetName: 'Tether', network: 'TRON (TRC-20)', address: 'TQmVaGCVZ8bYtq1cJ4pF7nR2wS9dLxK3Yu' },
  USDC: { assetName: 'USD Coin', network: 'Ethereum (ERC-20)', address: '0x71C7656EC7ab88b098defB7501B1f9A5C2b3E4d' },
  BTC: { assetName: 'Bitcoin', network: 'Bitcoin', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
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
    kpp: '771001001',
    correspondentAccount: '30101810145250000974',
  },
];

export function mockDelay(): Promise<void> {
  const ms = 400 + Math.random() * 400;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
