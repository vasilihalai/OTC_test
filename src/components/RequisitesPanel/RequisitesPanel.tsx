import { useEffect, useState } from 'react';

import { Panel } from '@/components/Panel/Panel.tsx';
import { CopyButton } from '@/components/CopyButton/CopyButton.tsx';
import { Select } from '@/components/Select/Select.tsx';
import { CurrencyIcon } from '@/components/CurrencyIcon/CurrencyIcon.tsx';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';
import { bem } from '@/css/bem.ts';
import type { CryptoRequisites, FiatRequisites } from '@/api/index.ts';
import { ru } from '@/i18n/ru.ts';

import './RequisitesPanel.css';

const [, e] = bem('requisites-panel');

function FiatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={e('row')}>
      <span className={e('row-label')}>{label}</span>
      <span className={e('row-value')}>
        <span className={e('row-value-text')}>{value}</span>
        <CopyButton value={value}/>
      </span>
    </div>
  );
}

/**
 * The fiat rows in the frame's order and wording; the contract's SWIFT, beneficiary-account and
 * correspondent/intermediary bank rows sit next to their kin. Empty fields aren't shown; the
 * beneficiary's own account only when it differs from the settlement one (SWIFT accounts).
 *
 * The backend has one name for the frame's two rows: "Наименование компании" is `recipientName`
 * (BRCE-4023 follow-up §2), so it goes there and "Получатель" appears only when a different name is
 * given for it. A correspondent account doesn't exist in the CRM's directory: the row shows only if
 * that field is ever sent.
 */
function fiatRows(requisites: FiatRequisites): [string, string][] {
  const company = requisites.companyName ?? requisites.recipientName;
  const rows: [string, string | undefined][] = [
    [ru.dealDetail.requisitesCompanyName, company],
    [ru.dealDetail.requisitesBank, requisites.bankName],
    [ru.dealDetail.requisitesBankAddress, requisites.bankAddress],
    [ru.dealDetail.requisitesBik, requisites.bic],
    [ru.dealDetail.requisitesBankSwift, requisites.bankSwift],
    [ru.dealDetail.requisitesAccount, requisites.recipientAccount],
    [
      ru.dealDetail.requisitesBeneficiaryAccount,
      requisites.account !== requisites.recipientAccount ? requisites.account : undefined,
    ],
    [ru.dealDetail.requisitesRecipient, requisites.recipientName !== company ? requisites.recipientName : undefined],
    [ru.dealDetail.requisitesRecipientAddress, requisites.recipientAddress],
    [ru.dealDetail.requisitesCorrAccount, requisites.correspondentAccount],
    [ru.dealDetail.requisitesCorrespondentBank, requisites.correspondentBankName],
    [ru.dealDetail.requisitesCorrespondentAddress, requisites.correspondentBankAddress],
    [ru.dealDetail.requisitesCorrespondentSwift, requisites.correspondentBankSwift],
    [ru.dealDetail.requisitesIntermediaryBank, requisites.intermediaryBankName],
    [ru.dealDetail.requisitesIntermediaryAddress, requisites.intermediaryBankAddress],
    [ru.dealDetail.requisitesIntermediarySwift, requisites.intermediaryBankSwift],
    [ru.dealDetail.requisitesPurpose, requisites.purpose],
  ];
  return rows.filter((row): row is [string, string] => !!row[1]);
}

export function RequisitesPanel({ requisites }: { requisites: FiatRequisites | CryptoRequisites }) {
  if (requisites.kind === 'fiat') {
    const rows = fiatRows(requisites);
    const allText = rows.map(([label, value]) => `${label}: ${value}`).join('\n');

    return (
      <Panel fill="surface" radius="16px" className="reveal">
        <h2 className={e('heading')}>{ru.dealDetail.requisitesTitle}</h2>
        {requisites.title && <p className={e('account-title')}>{requisites.title}</p>}
        {rows.map(([label, value]) => <FiatRow key={label} label={label} value={value}/>)}
        <CopyButton value={allText} className={e('copy-all')}>{ru.dealDetail.requisitesCopyAll}</CopyButton>
      </Panel>
    );
  }

  return <CryptoRequisitesBody requisites={requisites}/>;
}

/** Widths of the value bars: bank details are lines of very different length. */
const ROW_WIDTHS = ['62%', '78%', '46%', '70%', '54%'];

/** The panel while its requisites load: its heading is already there, the rows are bars. */
export function RequisitesPanelSkeleton() {
  return (
    <Panel fill="surface" radius="16px">
      <h2 className={e('heading')}>{ru.dealDetail.requisitesTitle}</h2>
      <div aria-hidden="true">
        {ROW_WIDTHS.map((width, index) => (
          <div key={width} className={e('row')}>
            <Skeleton width={index % 2 ? 148 : 112} height={12} line={20} radius={6}/>
            <Skeleton width={width} height={12} line={20} radius={6}/>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CryptoRequisitesBody({ requisites }: { requisites: CryptoRequisites }) {
  // The code and the address it was drawn for: a code is only ever shown next to its own address.
  const [qr, setQr] = useState<{ address: string; url: string }>();
  // Falls back to the single network/address pair when the backend hasn't
  // sent alternatives — the picker then has exactly one option and Select's
  // own readOnly behavior (options.length <= 1) takes over automatically.
  const networks = requisites.networks ?? [{ network: requisites.network, address: requisites.address }];
  const [selectedNetwork, setSelectedNetwork] = useState(requisites.network);
  const current = networks.find((n) => n.network === selectedNetwork) ?? networks[0];
  const { address } = current;

  useEffect(() => {
    let cancelled = false;
    // The generator is only needed here, so it is fetched here rather than shipped with the deal screen.
    void import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(address, {
        margin: 1,
        width: 160,
        errorCorrectionLevel: 'H',
        color: { dark: '#0D0E10', light: '#FFFFFF' },
      }))
      .then((url) => {
        if (!cancelled) {
          setQr({ address, url });
        }
      })
      .catch((err: unknown) => console.error('[RequisitesPanel] QR code failed', err));
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <Panel fill="surface" radius="16px" className="reveal">
      <h2 className={e('heading')}>{ru.dealDetail.requisitesTitle}</h2>
      <div className={e('select')}>
        <Select
          label={ru.dealDetail.requisitesAssetLabel}
          layout="asset"
          options={[{
            value: requisites.asset,
            label: requisites.asset,
            secondary: requisites.assetName,
            icon: <CurrencyIcon ticker={requisites.asset} size={24}/>,
          }]}
          value={requisites.asset}
          onChange={() => {}}
        />
      </div>
      <div className={e('select', 'network')}>
        <Select
          label={ru.dealDetail.requisitesNetworkLabel}
          layout="plain"
          options={networks.map((n) => ({ value: n.network, label: n.network }))}
          value={selectedNetwork}
          onChange={setSelectedNetwork}
        />
      </div>
      <p className={e('qr-caption')}>{ru.dealDetail.requisitesScanQr}</p>
      {qr?.address === address ? (
        // Keyed by the address: a newly chosen network's code fades in instead of swapping under the eye.
        <div key={address} className={e('qr-plate')}>
          <img src={qr.url} width={132} height={132} alt=""/>
          <span className={e('qr-mark')} aria-hidden="true">X</span>
        </div>
      ) : (
        <Skeleton width={148} height={148} radius={12} className={e('qr-wait')}/>
      )}
      <p className={e('qr-caption', 'divider')}>{ru.dealDetail.requisitesOrCopy}</p>
      <div className={e('address-row')}>
        <span key={address} className={e('address-text')}>{address}</span>
        <CopyButton value={address}/>
      </div>
    </Panel>
  );
}
