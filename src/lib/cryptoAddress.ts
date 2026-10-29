import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

/**
 * Client-side withdrawal address checks, by each blockchain's own rules (format and, where the
 * chain defines one, checksum) — a mistyped address on an irreversible withdrawal loses the funds.
 * The backend's per-network `addressRegex` (§5.1) is applied on top when it sends one.
 */

type ChainFamily = 'TRON' | 'EVM' | 'BITCOIN' | 'TON' | 'SOLANA';

export interface AddressNetwork {
  networkCode: string;
  networkLabel: string;
  addressRegex: string | null;
}

/** Network codes aren't a fixed list (TRC20, ERC20, BITCOIN in the mocks), so the family is read off code + label. */
function chainFamily(network: AddressNetwork): ChainFamily | undefined {
  const name = `${network.networkCode} ${network.networkLabel}`.toUpperCase();
  if (/TRC|TRON|\bTRX\b/.test(name)) {
    return 'TRON';
  }
  if (/ERC|BEP-?20|\bBSC\b|\bBNB SMART|\bETH|POLYGON|MATIC|ARBITRUM|\bARB\b|OPTIMISM|AVAX|\bBASE\b|\bEVM\b/.test(name)) {
    return 'EVM';
  }
  if (/BITCOIN|\bBTC\b/.test(name)) {
    return 'BITCOIN';
  }
  if (/\bTON\b|TONCOIN/.test(name)) {
    return 'TON';
  }
  if (/SOLANA|\bSOL\b|\bSPL\b/.test(name)) {
    return 'SOLANA';
  }
  return undefined;
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(input: string): Uint8Array | undefined {
  const bytes: number[] = [];
  for (const char of input) {
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry < 0) {
      return undefined;
    }
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of input) {
    if (char !== '1') {
      break;
    }
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

/** The payload of a Base58Check string (checksum = first 4 bytes of double SHA-256), or undefined if it doesn't verify. */
function base58CheckPayload(address: string): Uint8Array | undefined {
  const raw = base58Decode(address);
  if (!raw || raw.length < 5) {
    return undefined;
  }
  const payload = raw.slice(0, -4);
  const checksum = sha256(sha256(payload));
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== raw[raw.length - 4 + i]) {
      return undefined;
    }
  }
  return payload;
}

function isTronAddress(address: string): boolean {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return false;
  }
  const payload = base58CheckPayload(address);
  return payload?.length === 21 && payload[0] === 0x41;
}

/** `0x` + 40 hex; a mixed-case address encodes an EIP-55 checksum, which must then match. */
function isEvmAddress(address: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return false;
  }
  const hex = address.slice(2);
  if (hex === hex.toLowerCase() || hex === hex.toUpperCase()) {
    return true;
  }
  const hash = keccak_256(new TextEncoder().encode(hex.toLowerCase()));
  for (let i = 0; i < 40; i++) {
    const char = hex[i];
    if (char.toLowerCase() === char.toUpperCase()) {
      continue;
    }
    const nibble = (hash[i >> 1] >> (i % 2 === 0 ? 4 : 0)) & 0x0f;
    if ((nibble >= 8) !== (char === char.toUpperCase())) {
      return false;
    }
  }
  return true;
}

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

function bech32Polymod(values: number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) {
        chk ^= BECH32_GENERATOR[i];
      }
    }
  }
  return chk >>> 0;
}

function convertBits(data: number[], from: number, to: number): number[] | undefined {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const maxValue = (1 << to) - 1;
  const maxAcc = (1 << (from + to - 1)) - 1;
  for (const value of data) {
    acc = ((acc << from) | value) & maxAcc;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxValue);
    }
  }
  if (bits >= from || ((acc << (to - bits)) & maxValue)) {
    return undefined;
  }
  return out;
}

/** BIP-173 (bech32, witness v0) / BIP-350 (bech32m, v1+) mainnet `bc1…` address. */
function isBitcoinSegwitAddress(address: string): boolean {
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
    return false;
  }
  const lower = address.toLowerCase();
  const separator = lower.lastIndexOf('1');
  if (lower.length > 90 || lower.slice(0, separator) !== 'bc') {
    return false;
  }
  const data: number[] = [];
  for (const char of lower.slice(separator + 1)) {
    const value = BECH32_CHARSET.indexOf(char);
    if (value < 0) {
      return false;
    }
    data.push(value);
  }
  if (data.length < 7) {
    return false;
  }
  const hrpCodes = [...'bc'].map((char) => char.charCodeAt(0));
  const expandedHrp = [...hrpCodes.map((code) => code >> 5), 0, ...hrpCodes.map((code) => code & 31)];
  const version = data[0];
  if (version > 16 || bech32Polymod([...expandedHrp, ...data]) !== (version === 0 ? BECH32_CONST : BECH32M_CONST)) {
    return false;
  }
  const program = convertBits(data.slice(1, -6), 5, 8);
  if (!program || program.length < 2 || program.length > 40) {
    return false;
  }
  return version !== 0 || program.length === 20 || program.length === 32;
}

/** Legacy P2PKH (`1…`, version 0x00) or P2SH (`3…`, version 0x05) mainnet address, or segwit `bc1…`. */
function isBitcoinAddress(address: string): boolean {
  if (/^bc1/i.test(address)) {
    return isBitcoinSegwitAddress(address);
  }
  if (!/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address)) {
    return false;
  }
  const payload = base58CheckPayload(address);
  return payload?.length === 21 && (payload[0] === 0x00 || payload[0] === 0x05);
}

function crc16Xmodem(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/** Raw `workchain:hex64`, or the 48-char user-friendly form: flags, workchain, 32-byte hash, CRC16. */
function isTonAddress(address: string): boolean {
  const raw = /^(-?\d+):[0-9a-fA-F]{64}$/.exec(address);
  if (raw) {
    return raw[1] === '0' || raw[1] === '-1';
  }
  if (!/^[A-Za-z0-9+/_-]{48}$/.test(address)) {
    return false;
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(address.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
  } catch {
    return false;
  }
  // 0x11 bounceable / 0x51 non-bounceable, optionally with the 0x80 test-network flag.
  const tag = bytes[0] & 0x7f;
  if (bytes.length !== 36 || (tag !== 0x11 && tag !== 0x51) || (bytes[1] !== 0x00 && bytes[1] !== 0xff)) {
    return false;
  }
  const crc = crc16Xmodem(bytes.subarray(0, 34));
  return bytes[34] === crc >> 8 && bytes[35] === (crc & 0xff);
}

function isSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) && base58Decode(address)?.length === 32;
}

const FAMILY_CHECK: Record<ChainFamily, (address: string) => boolean> = {
  TRON: isTronAddress,
  EVM: isEvmAddress,
  BITCOIN: isBitcoinAddress,
  TON: isTonAddress,
  SOLANA: isSolanaAddress,
};

/** §5.1: a malformed backend regex counts as "no regex", not as every address being invalid. */
function compileRegex(pattern: string | null): RegExp | undefined {
  if (!pattern) {
    return undefined;
  }
  try {
    return new RegExp(pattern);
  } catch {
    return undefined;
  }
}

export function isValidCryptoAddress(address: string, network: AddressNetwork): boolean {
  if (!address || /\s/.test(address)) {
    return false;
  }
  const family = chainFamily(network);
  if (family && !FAMILY_CHECK[family](address)) {
    return false;
  }
  return compileRegex(network.addressRegex)?.test(address) ?? true;
}

/**
 * Wallet QR codes often carry a payment URI rather than a bare address — `tron:T…`,
 * `ethereum:0x…@56?value=…`, `bitcoin:bc1…?amount=…`, `ton://transfer/EQ…`. For an EIP-681 token
 * transfer the path is the token contract and the recipient is the `address` parameter.
 */
export function extractAddressFromQr(text: string): string {
  const trimmed = text.trim();
  const uri = /^[a-z][a-z0-9+.-]*:(?:\/\/)?(?:transfer\/)?([^?@/#]+)[^?#]*(?:\?([^#]*))?/i.exec(trimmed);
  if (!uri) {
    return trimmed;
  }
  return (uri[2] ? new URLSearchParams(uri[2]).get('address') : null) ?? uri[1];
}
