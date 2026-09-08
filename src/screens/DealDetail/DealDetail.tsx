import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { Panel } from '@/components/Panel/Panel.tsx';
import { KeyValueRow } from '@/components/KeyValueRow/KeyValueRow.tsx';
import { StatusChip } from '@/components/StatusChip/StatusChip.tsx';
import { StatusHero } from '@/components/StatusHero/StatusHero.tsx';
import { BalanceBlock } from '@/components/BalanceBlock/BalanceBlock.tsx';
import { Callout } from '@/components/Callout/Callout.tsx';
import { RequisitesPanel } from '@/components/RequisitesPanel/RequisitesPanel.tsx';
import { DocumentRow } from '@/components/DocumentRow/DocumentRow.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog.tsx';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';
import {
  USE_REAL_API,
  acceptQuote,
  cancelDeal,
  confirmHold,
  expireQuote,
  getAccounts,
  getDealById,
  getRequisites,
  rejectQuote,
  requestNewRate,
  setDepositBalanceForTesting,
} from '@/api/index.ts';
import type { Deal, Requisites } from '@/api/index.ts';
import { useRequireSession } from '@/store/session.ts';
import { useUiStore } from '@/store/ui.ts';
import { useTransferModalStore } from '@/store/transferModal.ts';
import { DEAL_STATUS_META, getDocumentAvailability, isHoldConfirmationStatus, isTerminalDealStatus, showsFullDetailsRows } from '@/lib/dealStatus.ts';
import { computeScenarioBalance, getMinDealAmount, isBalanceScenario, parseAmountValue } from '@/lib/balanceScenario.ts';
import { formatAmount, parseAmountWithTicker } from '@/lib/money.ts';
import { formatCountdown, msUntil } from '@/lib/countdown.ts';
import { usePolling } from '@/lib/usePolling.ts';
import { renderTemplate } from '@/lib/template.tsx';
import { SAMPLE_DOCUMENT_URL } from '@/lib/sampleDocument.ts';
import { openExternalLink } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './DealDetail.css';

const DIRECTION_LABEL: Record<Deal['direction'], string> = {
  BUY: ru.deals.directionBuy,
  SELL: ru.deals.directionSell,
  EXCHANGE: ru.deals.directionExchange,
};

function openDocument(href?: string) {
  openExternalLink(href ?? SAMPLE_DOCUMENT_URL);
}

// §7.5: "nameKey maps to a display name through i18n/ru.ts — do not render
// the raw key." No vocabulary is documented anywhere in the eight Swagger
// files, so this covers the three names the mock's own fixed table already
// used (the most likely real ones) and falls back to the raw key itself —
// visibly wrong is better than silently missing a document row.
const DOCUMENT_NAME_KEYS: Record<string, string> = {
  ACCEPT: ru.dealDetail.documentAccept,
  PAYMENT: ru.dealDetail.documentPayment,
  CERTIFICATE: ru.dealDetail.documentCertificate,
};

export function DealDetail() {
  useRequireSession();
  const { id } = useParams();
  const [deal, setDeal] = useState<Deal>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    setLoading(true);
    setNotFound(false);
    void getDealById(id).then((data) => {
      if (data) {
        setDeal(data);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [id]);

  // §7.7 — real mode only, and only while the deal is still in a
  // non-terminal status; nothing about a DONE/DECLINED deal changes again.
  usePolling(() => {
    if (id) {
      void getDealById(id).then((data) => data && setDeal(data));
    }
  }, 10_000, USE_REAL_API && !!deal && !isTerminalDealStatus(deal.status));

  if (notFound) {
    return (
      <div className="deal-detail">
        <p className="deal-detail__not-found">{ru.dealDetail.notFound}</p>
      </div>
    );
  }

  const meta = deal && DEAL_STATUS_META[deal.status];
  // Real mode: documents come from the deal itself (§7.5, preferred over a
  // separate call). Mock mode: the static per-status table, unchanged.
  const mockDocs = deal && !USE_REAL_API ? getDocumentAvailability(deal.status) : undefined;
  const showDetails = deal && showsFullDetailsRows(deal.status);

  return (
    <div className="deal-detail">
      <div className="deal-detail__header">
        {loading ? <Skeleton width={120} height={26}/> : <h1 className="deal-detail__id">{deal?.requestNumber ?? deal?.id}</h1>}
        {deal && meta && <StatusChip tone={deal.status} size="lg">{meta.detailLabel}</StatusChip>}
      </div>
      {deal && <p className="deal-detail__direction">{DIRECTION_LABEL[deal.direction]}</p>}

      {loading && (
        <Panel fill="surface" radius="16px">
          <Skeleton height={90} radius={14}/>
        </Panel>
      )}

      {deal && (
        deal.status === 'RATE_ACTIVE' ? <QuoteCard deal={deal} onUpdate={setDeal}/>
          : isHoldConfirmationStatus(deal.status) ? <ConfirmationBody deal={deal} onUpdate={setDeal}/>
            : <StatusHeroBody deal={deal} onUpdate={setDeal}/>
      )}

      {deal && (
        <div className="deal-detail__section">
          <h2 className="deal-detail__section-title">{ru.dealDetail.detailsTitle}</h2>
          {showDetails && (
            <>
              {/* Real mode's detail response carries no createdAt (§7.4) — only the list does, and this screen can be deep-linked without ever having fetched that. Row just doesn't show rather than displaying blank. */}
              {deal.date && <KeyValueRow label={ru.dealDetail.createdDateLabel} value={deal.date}/>}
              <KeyValueRow label={ru.dealDetail.directionLabel} value={DIRECTION_LABEL[deal.direction]}/>
              <KeyValueRow label={ru.dealDetail.giveLabel} value={deal.from}/>
              <KeyValueRow label={ru.dealDetail.receiveLabel} value={deal.to ?? ru.common.tbd}/>
            </>
          )}
          <KeyValueRow
            label={ru.dealDetail.rateLabel}
            value={deal.status === 'RATE_PENDING' || deal.status === 'RATE_STALE' ? ru.common.tbd : (deal.rate ?? ru.common.tbd)}
          />
        </div>
      )}

      {mockDocs && (
        <div className="deal-detail__section">
          <h2 className="deal-detail__section-title">{ru.dealDetail.documentsTitle}</h2>
          <DocumentRow
            name={ru.dealDetail.documentAccept}
            enabled={mockDocs.accept}
            caption={mockDocs.showCaption ? ru.dealDetail.documentUnavailableCaption : undefined}
            onOpen={() => openDocument()}
          />
          <DocumentRow
            name={ru.dealDetail.documentPayment}
            enabled={mockDocs.payment}
            caption={mockDocs.showCaption ? ru.dealDetail.documentUnavailableCaption : undefined}
            onOpen={() => openDocument()}
          />
          <DocumentRow
            name={ru.dealDetail.documentCertificate}
            enabled={mockDocs.certificate}
            caption={mockDocs.showCaption ? ru.dealDetail.documentUnavailableCaption : undefined}
            onOpen={() => openDocument()}
          />
        </div>
      )}

      {deal?.documents && deal.documents.length > 0 && (
        <div className="deal-detail__section">
          <h2 className="deal-detail__section-title">{ru.dealDetail.documentsTitle}</h2>
          {deal.documents.map((document) => (
            <DocumentRow
              key={document.nameKey}
              name={DOCUMENT_NAME_KEYS[document.nameKey] ?? document.nameKey}
              enabled={document.available}
              caption={document.availabilityHint}
              onOpen={() => openDocument(document.href)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteCard({ deal, onUpdate }: { deal: Deal; onUpdate: (deal: Deal) => void }) {
  const [remainingMs, setRemainingMs] = useState(() => msUntil(deal.quoteExpiresAt));
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);

  useEffect(() => {
    function sync() {
      setRemainingMs(msUntil(deal.quoteExpiresAt));
    }
    sync();
    const interval = setInterval(sync, 1000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [deal.quoteExpiresAt]);

  useEffect(() => {
    if (remainingMs > 0) {
      return;
    }
    if (USE_REAL_API) {
      // No command exists for "the countdown ran out" (§7.6's nine don't
      // include one — the server just eventually reflects EXPIRED on its
      // own) — an immediate one-off refetch here is snappier than waiting
      // out the rest of the 10s poll interval below for the same update.
      void getDealById(deal.id).then((updated) => updated && onUpdate(updated));
    } else {
      const updated = expireQuote(deal.id);
      if (updated) {
        onUpdate(updated);
      }
    }
  }, [remainingMs, deal.id, onUpdate]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const updated = await acceptQuote(deal.id);
      if (updated) {
        onUpdate(updated);
      }
    } finally {
      setConfirming(false);
    }
  }

  async function handleDecline() {
    setDeclineDialogOpen(false);
    setDeclining(true);
    try {
      const updated = await rejectQuote(deal.id);
      if (updated) {
        onUpdate(updated);
      }
    } finally {
      setDeclining(false);
    }
  }

  return (
    <div className="quote-card">
      <p className="quote-card__prepared">{ru.dealDetail.quotePreparedByManager}</p>
      <p className="quote-card__rate-label">{ru.dealDetail.quoteRateForYou}</p>
      <p className="quote-card__rate">
        <span className="quote-card__rate-value">{deal.ratePerUnit}</span>
        {deal.rateUnitLabel && <span className="quote-card__rate-unit"> {deal.rateUnitLabel}</span>}
      </p>
      <p className="quote-card__countdown">
        {ru.dealDetail.quoteFixedLabel} <span className="quote-card__timer">{formatCountdown(remainingMs)} {ru.dealDetail.quoteSecondsSuffix}</span>
      </p>
      <div className="quote-card__rows">
        <KeyValueRow label={ru.dealDetail.giveLabel} value={deal.from}/>
        <KeyValueRow label={ru.dealDetail.receiveLabel} value={<span className="quote-card__positive">{deal.to ?? ru.common.tbd}</span>}/>
      </div>
      <Button variant="accent" loading={confirming} onClick={() => void handleConfirm()}>
        {ru.dealDetail.confirmDealAction}
      </Button>
      <Button type="button" variant="link" danger loading={declining} onClick={() => setDeclineDialogOpen(true)}>
        {ru.dealDetail.declineAction}
      </Button>
      <ConfirmDialog
        open={declineDialogOpen}
        title={ru.dealDetail.declineConfirmTitle}
        onConfirm={() => void handleDecline()}
        onCancel={() => setDeclineDialogOpen(false)}
      />
    </div>
  );
}

type Branch = 'sufficient' | 'short1' | 'short' | 'belowmin';

function ConfirmationBody({ deal, onUpdate }: { deal: Deal; onUpdate: (deal: Deal) => void }) {
  const [searchParams] = useSearchParams();
  const urlScenario = searchParams.get('scenario');
  const storeScenario = useUiStore((s) => s.balanceScenario);
  const cycleScenario = useUiStore((s) => s.cycleBalanceScenario);
  const balancesVersion = useUiStore((s) => s.balancesVersion);
  const openTransferModal = useTransferModalStore((s) => s.open);
  // null = no dev override, show the real deposit balance.
  const scenario = isBalanceScenario(urlScenario) ? urlScenario : storeScenario;
  const [requisites, setRequisites] = useState<Requisites>();
  const [balance, setBalance] = useState<number>();
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);

  useEffect(() => {
    void getRequisites(deal.id).then(setRequisites);
  }, [deal.id]);

  const dealAmount = parseAmountValue(deal.from);

  // Explicit dev override only — forces the deposit balance to whatever
  // produces the requested case for this deal, then it's read back below
  // like any other real balance. Meaningless in real mode (the mock
  // accounts store it writes to has no bearing on a real getAccounts()
  // result), so skipped there rather than left as harmless dead code.
  useEffect(() => {
    if (!scenario || USE_REAL_API) {
      return;
    }
    const target = computeScenarioBalance(dealAmount, deal.ticker, scenario);
    setDepositBalanceForTesting(deal.ticker, target);
  }, [scenario, deal.ticker, dealAmount]);

  useEffect(() => {
    void getAccounts().then((accounts) => setBalance(Number(accounts.deposit[deal.ticker] ?? '0')));
  }, [deal.ticker, scenario, balancesVersion]);

  const minDeal = getMinDealAmount(deal.ticker);

  if (balance === undefined) {
    return <Skeleton height={90} radius={14}/>;
  }

  // §7.3.2's exact order: sufficient, then the ≤1% case, then below-minimum,
  // else short — belowmin can never coincide with short1 by construction.
  let branch: Branch;
  if (balance >= dealAmount) {
    branch = 'sufficient';
  } else if ((dealAmount - balance) / dealAmount <= 0.01) {
    branch = 'short1';
  } else if (balance < minDeal) {
    branch = 'belowmin';
  } else {
    branch = 'short';
  }

  const balanceLabel = `${formatAmount(String(balance), deal.ticker)} ${deal.ticker}`;
  const minLabel = `${formatAmount(String(minDeal), deal.ticker)} ${deal.ticker}`;
  const counter = deal.to ? parseAmountWithTicker(deal.to) : undefined;
  const recalculatedValue = counter ? (balance / dealAmount) * counter.value : undefined;
  const recalculated = counter && recalculatedValue !== undefined
    ? `${formatAmount(String(recalculatedValue), counter.ticker)} ${counter.ticker}`
    : balanceLabel;

  async function handleConfirm() {
    setConfirming(true);
    try {
      // Freezing an amount well short of the deal (the "short" branch,
      // beyond short1's ≤1% auto-recalculation) isn't a plain hold — it's
      // literally a request for new terms against the smaller frozen
      // amount, i.e. the deal moves into renegotiation, not straight to
      // RUNNING. Confirmed by the user directly — this is one of
      // RATE_RENEGOTIATING's two real triggers (the other is
      // `requestNewRate`, see actions.mock.ts).
      const patch = branch === 'short1'
        ? { status: 'RUNNING' as const, from: balanceLabel, to: recalculated }
        : branch === 'short'
          ? { status: 'RATE_RENEGOTIATING' as const }
          : { status: 'RUNNING' as const };
      const updated = await confirmHold(deal.id, patch);
      if (updated) {
        onUpdate(updated);
      }
    } finally {
      setConfirming(false);
    }
  }

  async function handleDecline() {
    setDeclineDialogOpen(false);
    setDeclining(true);
    try {
      const updated = await rejectQuote(deal.id);
      if (updated) {
        onUpdate(updated);
      }
    } finally {
      setDeclining(false);
    }
  }

  return (
    <>
      <BalanceBlock
        balance={formatAmount(String(balance), deal.ticker)}
        ticker={deal.ticker}
        dealAmount={deal.from}
        shortfall={branch !== 'sufficient' ? `${formatAmount(String(dealAmount - balance), deal.ticker)} ${deal.ticker}` : undefined}
        onTransfer={openTransferModal}
        onLongPressBalance={cycleScenario}
      />

      {branch === 'sufficient' && <Callout variant="neutral">{ru.dealDetail.calloutSufficient}</Callout>}
      {branch === 'short1' && (
        <Callout variant="warning">
          {renderTemplate(ru.dealDetail.calloutShort1, { balance: balanceLabel, recalculated })}
        </Callout>
      )}
      {branch === 'short' && (
        <Callout variant="warning">
          {renderTemplate(ru.dealDetail.calloutShort, { balance: balanceLabel })}
        </Callout>
      )}
      {branch === 'belowmin' && (
        <Callout variant="danger">
          {renderTemplate(ru.dealDetail.calloutBelowMin, { min: minLabel })}
        </Callout>
      )}

      <Button variant="accent" loading={confirming} disabled={branch === 'belowmin'} onClick={() => void handleConfirm()}>
        {ru.dealDetail.confirmPaymentAction}
      </Button>
      <Button
        type="button"
        variant="link"
        danger
        loading={declining}
        onClick={() => setDeclineDialogOpen(true)}
      >
        {ru.dealDetail.declineAction}
      </Button>

      {(branch === 'short' || branch === 'belowmin') && requisites && <RequisitesPanel requisites={requisites}/>}

      <ConfirmDialog
        open={declineDialogOpen}
        title={ru.dealDetail.declineConfirmTitle}
        onConfirm={() => void handleDecline()}
        onCancel={() => setDeclineDialogOpen(false)}
      />
    </>
  );
}

function StatusHeroBody({ deal, onUpdate }: { deal: Deal; onUpdate: (deal: Deal) => void }) {
  const [busy, setBusy] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  async function handleRequestNewRate() {
    setBusy(true);
    try {
      const updated = await requestNewRate(deal.id);
      if (updated) {
        onUpdate(updated);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setCancelDialogOpen(false);
    setBusy(true);
    try {
      const updated = await cancelDeal(deal.id);
      if (updated) {
        onUpdate(updated);
      }
    } finally {
      setBusy(false);
    }
  }

  switch (deal.status) {
    case 'RATE_PENDING':
      return (
        <>
          <StatusHero
            icon="spinner"
            tone="pending"
            title={ru.dealDetail.heroRatePendingTitle}
            subtitle={ru.dealDetail.heroRatePendingSubtitle}
            action={(
              <Button
                type="button"
                variant="link"
                danger
                loading={busy}
                onClick={() => setCancelDialogOpen(true)}
              >
                {ru.dealDetail.cancelRequestAction}
              </Button>
            )}
          />
          <ConfirmDialog
            open={cancelDialogOpen}
            title={ru.dealDetail.cancelRequestConfirmTitle}
            onConfirm={() => void handleCancel()}
            onCancel={() => setCancelDialogOpen(false)}
          />
        </>
      );
    case 'RATE_STALE':
      return (
        <StatusHero
          icon="hourglass"
          tone="stale"
          title={ru.dealDetail.heroRateStaleTitle}
          action={<Button variant="accent" loading={busy} onClick={() => void handleRequestNewRate()}>{ru.dealDetail.requestNewRateAction}</Button>}
        />
      );
    case 'RUNNING':
      return (
        <StatusHero
          icon="spinner"
          tone="running"
          title={ru.dealDetail.heroRunningTitle}
          subtitle={renderTemplate(ru.dealDetail.heroRunningSubtitle, { amount: deal.from })}
        />
      );
    case 'DONE':
      return (
        <StatusHero
          icon="check"
          tone="success"
          title={ru.dealDetail.heroDoneTitle}
          subtitle={renderTemplate(ru.dealDetail.heroDoneSubtitle, { amount: deal.to ?? deal.from })}
        />
      );
    case 'DECLINED':
      return (
        <StatusHero
          icon="cross"
          tone="danger"
          title={ru.dealDetail.heroDeclinedTitle}
          subtitle={ru.dealDetail.heroDeclinedSubtitle}
        />
      );
    case 'RATE_RENEGOTIATING':
      // api-integration.md §7.6 — the backend's REQUOTE status has two real
      // client-facing steps (accept/reject an adjusted amount, accept/reject
      // a new rate) that have no screen yet: "designing the two missing
      // screens is a separate task — flag it to the analyst, do not
      // improvise them." `CANCEL` *is* wired for real (`cancelDeal`, same
      // command RATE_PENDING uses) — the doc's own explicit MVP call was to
      // offer only that, "honest and shippable," until those two screens exist.
      return (
        <>
          <StatusHero
            icon="spinner"
            tone="pending"
            title={ru.dealDetail.heroRenegotiatingTitle}
            subtitle={ru.dealDetail.heroRenegotiatingSubtitle}
            action={(
              <Button
                type="button"
                variant="link"
                danger
                loading={busy}
                onClick={() => setCancelDialogOpen(true)}
              >
                {ru.dealDetail.cancelRequestAction}
              </Button>
            )}
          />
          <ConfirmDialog
            open={cancelDialogOpen}
            title={ru.dealDetail.cancelRequestConfirmTitle}
            onConfirm={() => void handleCancel()}
            onCancel={() => setCancelDialogOpen(false)}
          />
        </>
      );
    default:
      return null;
  }
}
