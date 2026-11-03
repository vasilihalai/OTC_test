import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { Panel } from '@/components/Panel/Panel.tsx';
import { CopyIcon } from '@/components/CopyIcon/CopyIcon.tsx';
import { Select } from '@/components/Select/Select.tsx';
import { CurrencyIcon } from '@/components/CurrencyIcon/CurrencyIcon.tsx';
import { bem } from '@/css/bem.ts';
import { useCopy } from '@/lib/useCopy.ts';
import type { CryptoRequisites, FiatRequisites } from '@/api/index.ts';
import { ru } from '@/i18n/ru.ts';

import './RequisitesPanel.css';

const [, e] = bem('requisites-panel');

function FiatRow({ label, value, copy }: { label: string; value: string; copy: () => void }) {
  return (
    <div className={e('row')}>
      <span className={e('row-label')}>{label}</span>
      <span className={e('row-value')}>
        <span className={e('row-value-text')}>{value}</span>
        <button type="button" className={e('copy')} aria-label={ru.common.copyAction} onClick={copy}>
          <CopyIcon/>
        </button>
      </span>
    </div>
  );
}

export function RequisitesPanel({ requisites }: { requisites: FiatRequisites | CryptoRequisites }) {
  const copy = useCopy();

  if (requisites.kind === 'fiat') {
    const rows: [string, string][] = [
      [ru.dealDetail.requisitesCompanyName, requisites.companyName],
      [ru.dealDetail.requisitesBank, requisites.bank],
      [ru.dealDetail.requisitesBankAddress, requisites.bankAddress],
      [ru.dealDetail.requisitesBik, requisites.bik],
      [ru.dealDetail.requisitesAccount, requisites.account],
      [ru.dealDetail.requisitesRecipient, requisites.recipient],
      [ru.dealDetail.requisitesRecipientAddress, requisites.recipientAddress],
      [ru.dealDetail.requisitesCorrAccount, requisites.corrAccount],
      [ru.dealDetail.requisitesPurpose, requisites.purpose],
    ];
    const allText = rows.map(([label, value]) => `${label}: ${value}`).join('\n');

    return (
      <Panel fill="surface" radius="16px">
        <h2 className={e('heading')}>{ru.dealDetail.requisitesTitle}</h2>
        {rows.map(([label, value]) => (
          <FiatRow key={label} label={label} value={value} copy={() => copy(value)}/>
        ))}
        <button type="button" className={e('copy-all')} onClick={() => copy(allText)}>
          <CopyIcon/>
          {ru.dealDetail.requisitesCopyAll}
        </button>
      </Panel>
    );
  }

  return <CryptoRequisitesBody requisites={requisites}/>;
}

function CryptoRequisitesBody({ requisites }: { requisites: CryptoRequisites }) {
  const copy = useCopy();
  const [qr, setQr] = useState<string>();
  // Falls back to the single network/address pair when the backend hasn't
  // sent alternatives — the picker then has exactly one option and Select's
  // own readOnly behavior (options.length <= 1) takes over automatically.
  const networks = requisites.networks ?? [{ network: requisites.network, address: requisites.address }];
  const [selectedNetwork, setSelectedNetwork] = useState(requisites.network);
  const current = networks.find((n) => n.network === selectedNetwork) ?? networks[0];

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(current.address, {
      margin: 1,
      width: 160,
      errorCorrectionLevel: 'H',
      color: { dark: '#0D0E10', light: '#FFFFFF' },
    })
      .then((url) => { if (!cancelled) setQr(url); });
    return () => { cancelled = true; };
  }, [current.address]);

  return (
    <Panel fill="surface" radius="16px">
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
      <div className={e('qr-plate')}>
        {qr && <img src={qr} width={132} height={132} alt=""/>}
        <span className={e('qr-mark')} aria-hidden="true">X</span>
      </div>
      <p className={e('qr-caption', 'divider')}>{ru.dealDetail.requisitesOrCopy}</p>
      <div className={e('address-row')}>
        <span className={e('address-text')}>{current.address}</span>
        <button type="button" className={e('copy')} aria-label={ru.common.copyAction} onClick={() => copy(current.address)}>
          <CopyIcon/>
        </button>
      </div>
    </Panel>
  );
}
