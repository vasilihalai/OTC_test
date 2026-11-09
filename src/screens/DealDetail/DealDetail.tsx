import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

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
import { LoadError } from '@/components/LoadError/LoadError.tsx';
import {
  ApiError,
  DocumentUnavailableError,
  USE_REAL_API,
  acceptQuote,
  acceptReprice,
  acceptTerms,
  cancelDeal,
  confirmHold,
  expireQuote,
  getAccounts,
  getDealById,
  getDealRequisites,
  mapApiError,
  openDealDocument,
  rejectQuote,
  rejectReprice,
  rejectTerms,
  requestNewRate,
  setDepositBalanceForTesting,
} from '@/api/index.ts';
import type { ConfirmDealPatch, Deal, DealDocument, DealDocumentKind, Requisites } from '@/api/index.ts';
import { useRequireSession } from '@/store/session.ts';
import { useToastStore } from '@/store/toast.ts';
import { useUiStore } from '@/store/ui.ts';
import { useTransferModalStore } from '@/store/transferModal.ts';
import { DEAL_STATUS_META, getDetailRows, isTerminalDealStatus } from '@/lib/dealStatus.ts';
import {
  computeScenarioBalance,
  decimalString,
  holdBranch,
  isBalanceScenario,
  parseAmountValue,
  shortfallOf,
} from '@/lib/balanceScenario.ts';
import { formatAmount, parseAmountWithTicker } from '@/lib/money.ts';
import { formatCountdown, msUntil } from '@/lib/countdown.ts';
import { usePolling } from '@/lib/usePolling.ts';
import { renderTemplate } from '@/lib/template.tsx';
import { SAMPLE_DOCUMENT_URL } from '@/lib/sampleDocument.ts';
import { notifyError, openExternalLink } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './DealDetail.css';

const DIRECTION_LABEL: Record<Deal['direction'], string> = {
  BUY: ru.deals.directionBuy,
  SELL: ru.deals.directionSell,
  EXCHANGE: ru.deals.directionExchange,
};

const DOCUMENT_NAMES: Record<DealDocumentKind, string> = {
  accept: ru.dealDetail.documentAccept,
  payment: ru.dealDetail.documentPayment,
  certificate: ru.dealDetail.documentCertificate,
};

/** All three rows always show, as in the frames and BRD FR-7; a document the backend hasn't sent stays locked. */
const DOCUMENT_ORDER: DealDocumentKind[] = ['accept', 'payment', 'certificate'];

/**
 * The card — status, balance, shortfall — is re-read over REST every 20 seconds while the screen is open,
 * and at once when the app comes back to the foreground.
 */
const POLL_MS = 20_000;

function showDealError(err: unknown, fallback: string) {
  console.error('[DealDetail] action failed', err);
  notifyError();
  useToastStore.getState().show(err instanceof ApiError ? mapApiError(err) : fallback);
}

interface BodyProps {
  deal: Deal;
  onUpdate: (deal: Deal) => void;
  /** Re-reads the card — after any failed action the screen must show the deal's real state. */
  refresh: () => void;
}

/** One action at a time per card; the button that started it shows the spinner. */
function useDealAction({ onUpdate, refresh }: Pick<BodyProps, 'onUpdate' | 'refresh'>) {
  const [busy, setBusy] = useState<string>();
  // The state lands a render later: a double tap would get through it and send the command twice (Н-24).
  const running = useRef(false);

  async function run(name: string, action: () => Promise<Deal | undefined>) {
    if (running.current) {
      return;
    }
    running.current = true;
    setBusy(name);
    try {
      const updated = await action();
      if (updated) {
        onUpdate(updated);
      }
    } catch (err) {
      showDealError(err, ru.common.errorGeneric);
      refresh();
    } finally {
      running.current = false;
      setBusy(undefined);
    }
  }

  return { busy, run };
}

/** Client-side countdown to a server timestamp, re-synced on focus — never trusts elapsed device time. */
function useCountdown(expiresAt: string | undefined): number {
  const [remainingMs, setRemainingMs] = useState(() => msUntil(expiresAt));
  useEffect(() => {
    function sync() {
      setRemainingMs(msUntil(expiresAt));
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
  }, [expiresAt]);
  return remainingMs;
}

/**
 * The timer ran out. Real mode has no command for it: the server moves a quote to EXPIRED and expired
 * new terms back to TOPUP, so the card is read again. The mock does the same move itself.
 */
function useExpiry(deal: Deal, remainingMs: number, { onUpdate, refresh }: Pick<BodyProps, 'onUpdate' | 'refresh'>) {
  useEffect(() => {
    if (!deal.quoteExpiresAt || remainingMs > 0) {
      return;
    }
    if (USE_REAL_API) {
      refresh();
      return;
    }
    const updated = expireQuote(deal.id);
    if (updated) {
      onUpdate(updated);
    }
  }, [remainingMs, deal.id, deal.quoteExpiresAt, onUpdate, refresh]);
}

/** What the client actually gives and gets once the hold is made: the frozen amount and the recalculated terms. */
function settledAmounts(deal: Deal): { give: string; receive: string | null } {
  if (deal.status === 'RUNNING' || deal.status === 'DONE') {
    return { give: deal.holdAmount ?? deal.actualFrom ?? deal.from, receive: deal.actualTo ?? deal.to };
  }
  return { give: deal.from, receive: deal.to };
}

export function DealDetail() {
  useRequireSession();
  const { id } = useParams();
  const [deal, setDeal] = useState<Deal>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // A slow poll must not overwrite what a later action already showed: every read is numbered when
  // it starts, and only one newer than the last shown is applied.
  const started = useRef(0);
  const shown = useRef(0);

  const showDeal = useCallback((data: Deal) => {
    started.current += 1;
    shown.current = started.current;
    setDeal(data);
  }, []);

  useEffect(() => {
    if (!id) {
      return;
    }
    setLoading(true);
    setNotFound(false);
    setFailed(false);
    void getDealById(id).then((data) => {
      if (data) {
        showDeal(data);
      } else {
        setNotFound(true);
      }
    }).catch((err: unknown) => {
      console.error('[DealDetail] deal load failed', err);
      setFailed(true);
    }).finally(() => setLoading(false));
  }, [id, attempt, showDeal]);

  // A failed re-read is simply retried by the next one.
  const refresh = useCallback(() => {
    if (!id) {
      return;
    }
    started.current += 1;
    const mine = started.current;
    void getDealById(id).then((data) => {
      if (data && mine > shown.current) {
        shown.current = mine;
        setDeal(data);
      }
    }).catch(() => undefined);
  }, [id]);

  usePolling(refresh, POLL_MS, USE_REAL_API && !!deal && !isTerminalDealStatus(deal.status));

  if (failed && !deal) {
    return (
      <div className="deal-detail">
        <LoadError message={ru.dealDetail.loadError} onRetry={() => setAttempt((n) => n + 1)}/>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="deal-detail">
        <p className="deal-detail__not-found">{ru.dealDetail.notFound}</p>
      </div>
    );
  }

  const meta = deal && DEAL_STATUS_META[deal.status];
  const detailRows = deal && getDetailRows(deal.status);
  const bodyProps = deal && { deal, onUpdate: showDeal, refresh };
  const amounts = deal && settledAmounts(deal);

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

      {bodyProps && <DealBody {...bodyProps}/>}

      {deal && detailRows && amounts && (
        <div className="deal-detail__section">
          <h2 className="deal-detail__section-title">{ru.dealDetail.detailsTitle}</h2>
          {deal.date && <KeyValueRow label={ru.dealDetail.createdDateLabel} value={deal.date}/>}
          <KeyValueRow label={ru.dealDetail.directionLabel} value={DIRECTION_LABEL[deal.direction]}/>
          {detailRows.give && (
            <KeyValueRow
              label={deal.status === 'SHORTFALL_REVIEW' ? ru.dealDetail.dealAmountLabel : ru.dealDetail.giveLabel}
              value={amounts.give}
            />
          )}
          {detailRows.hold && (deal.holdAmount ?? deal.actualFrom) && (
            <KeyValueRow label={ru.dealDetail.holdLabel} value={deal.holdAmount ?? deal.actualFrom}/>
          )}
          {detailRows.receive && <KeyValueRow label={ru.dealDetail.receiveLabel} value={amounts.receive ?? ru.common.tbd}/>}
          {detailRows.rate && (
            <KeyValueRow
              label={ru.dealDetail.rateLabel}
              value={deal.status === 'RATE_PENDING' || deal.status === 'RATE_STALE' ? ru.common.tbd : (deal.rate ?? ru.common.tbd)}
            />
          )}
        </div>
      )}

      {bodyProps && <DealDocuments {...bodyProps}/>}
    </div>
  );
}

function DealBody(props: BodyProps) {
  switch (props.deal.status) {
    case 'RATE_ACTIVE':
      return <QuoteCard {...props}/>;
    case 'TERMS_PROPOSED':
      return <TermsCard {...props}/>;
    case 'REPRICE_PROPOSED':
      return <RepriceCard {...props}/>;
    case 'AWAITING_FUNDS':
      return <ConfirmationBody {...props}/>;
    default:
      return <StatusHeroBody {...props}/>;
  }
}

/**
 * The three deal documents, opened by their short-lived signed links (BRCE-4023 §7). A locked row reads
 * "Станет доступен позже", as in the frames; a declined deal's rows have no caption, since they won't
 * come.
 */
function DealDocuments({ deal, onUpdate, refresh }: BodyProps) {
  const [opening, setOpening] = useState<DealDocumentKind>();

  async function handleOpen(kind: DealDocumentKind) {
    if (!USE_REAL_API) {
      openExternalLink(SAMPLE_DOCUMENT_URL);
      return;
    }
    setOpening(kind);
    try {
      const fresh = await openDealDocument(deal, kind);
      if (fresh) {
        onUpdate(fresh);
      }
    } catch (err) {
      if (err instanceof DocumentUnavailableError) {
        useToastStore.getState().show(ru.dealDetail.documentUnavailableToast);
        refresh();
      } else {
        showDealError(err, ru.dealDetail.documentOpenError);
      }
    } finally {
      setOpening(undefined);
    }
  }

  return (
    <div className="deal-detail__section">
      <h2 className="deal-detail__section-title">{ru.dealDetail.documentsTitle}</h2>
      {DOCUMENT_ORDER.map((kind) => {
        const document: DealDocument | undefined = deal.documents?.find((item) => item.kind === kind);
        return (
          <DocumentRow
            key={kind}
            name={DOCUMENT_NAMES[kind]}
            enabled={!!document?.available && !!document.href}
            caption={deal.status === 'DECLINED' ? undefined : ru.dealDetail.documentUnavailableCaption}
            loading={opening === kind}
            onOpen={() => void handleOpen(kind)}
          />
        );
      })}
    </div>
  );
}

function QuoteCard({ deal, onUpdate, refresh }: BodyProps) {
  const remainingMs = useCountdown(deal.quoteExpiresAt);
  const { busy, run } = useDealAction({ onUpdate, refresh });
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  useExpiry(deal, remainingMs, { onUpdate, refresh });

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
      <Button variant="accent" loading={busy === 'accept'} disabled={!!busy} onClick={() => void run('accept', () => acceptQuote(deal))}>
        {ru.dealDetail.confirmDealAction}
      </Button>
      <Button type="button" variant="link" danger loading={busy === 'decline'} disabled={!!busy} onClick={() => setDeclineDialogOpen(true)}>
        {ru.dealDetail.declineAction}
      </Button>
      <ConfirmDialog
        open={declineDialogOpen}
        title={ru.dealDetail.declineConfirmTitle}
        onConfirm={() => {
          setDeclineDialogOpen(false);
          void run('decline', () => rejectQuote(deal));
        }}
        onCancel={() => setDeclineDialogOpen(false)}
      />
    </div>
  );
}

/**
 * The operator changed the amount and/or the rate after the quote was accepted (С-15): "Было / Станет /
 * Вы получите". Accepting goes back to the top-up screen with the new terms, declining keeps the old
 * ones; so does the offer running out.
 */
function TermsCard({ deal, onUpdate, refresh }: BodyProps) {
  const remainingMs = useCountdown(deal.quoteExpiresAt);
  const { busy, run } = useDealAction({ onUpdate, refresh });
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  useExpiry(deal, remainingMs, { onUpdate, refresh });

  const previous = deal.previous;
  const amountChanged = !!previous && previous.from !== deal.from;
  const rateChanged = !!previous && !!previous.rate && previous.rate !== deal.rate;
  const acceptLabel = amountChanged && !rateChanged
    ? ru.dealDetail.acceptNewAmountAction
    : rateChanged && !amountChanged
      ? ru.dealDetail.acceptNewRateAction
      : ru.dealDetail.acceptNewTermsAction;

  return (
    <div className="quote-card">
      <p className="quote-card__prepared">{ru.dealDetail.termsPrepared}</p>
      {deal.quoteExpiresAt && (
        <p className="quote-card__countdown quote-card__countdown--top">
          {ru.dealDetail.termsValidLabel} <span className="quote-card__timer">{formatCountdown(remainingMs)} {ru.dealDetail.quoteSecondsSuffix}</span>
        </p>
      )}
      <div className="quote-card__rows">
        {amountChanged && previous && (
          <>
            <KeyValueRow label={ru.dealDetail.termsWasLabel} value={<span className="quote-card__was">{previous.from}</span>}/>
            <KeyValueRow label={ru.dealDetail.termsBecomesLabel} value={<b className="quote-card__new">{deal.from}</b>}/>
          </>
        )}
        {rateChanged && previous && (
          <>
            <KeyValueRow label={ru.dealDetail.rateWasLabel} value={<span className="quote-card__was">{previous.rate}</span>}/>
            <KeyValueRow label={ru.dealDetail.newRateLabel} value={<b className="quote-card__new">{deal.rate}</b>}/>
          </>
        )}
        {!amountChanged && !rateChanged && (
          <>
            <KeyValueRow label={ru.dealDetail.newAmountLabel} value={deal.from}/>
            <KeyValueRow label={ru.dealDetail.rateLabel} value={deal.rate ?? ru.common.tbd}/>
          </>
        )}
        <KeyValueRow label={ru.dealDetail.receiveLabel} value={<span className="quote-card__positive">{deal.to ?? ru.common.tbd}</span>}/>
      </div>
      <Button variant="accent" loading={busy === 'accept'} disabled={!!busy} onClick={() => void run('accept', () => acceptTerms(deal))}>
        {acceptLabel}
      </Button>
      <Button type="button" variant="link" danger loading={busy === 'decline'} disabled={!!busy} onClick={() => setDeclineDialogOpen(true)}>
        {ru.dealDetail.declineAction}
      </Button>
      <ConfirmDialog
        open={declineDialogOpen}
        title={ru.dealDetail.rejectTermsConfirmTitle}
        body={ru.dealDetail.rejectTermsConfirmBody}
        onConfirm={() => {
          setDeclineDialogOpen(false);
          void run('decline', () => rejectTerms(deal));
        }}
        onCancel={() => setDeclineDialogOpen(false)}
      />
    </div>
  );
}

/**
 * Less than the deal was frozen and the operator offers a new rate on that amount (С-14, 3б). Accepting
 * sends the deal to execution, declining hands it back to the operator.
 */
function RepriceCard({ deal, onUpdate, refresh }: BodyProps) {
  const { busy, run } = useDealAction({ onUpdate, refresh });
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const reprice = deal.reprice;

  return (
    <div className="quote-card">
      <p className="quote-card__prepared">{ru.dealDetail.repricePrepared}</p>
      <p className="quote-card__rate-label">{ru.dealDetail.newRateLabel}</p>
      <p className="quote-card__rate">
        <span className="quote-card__rate-value">{reprice?.ratePerUnit ?? ru.common.tbd}</span>
        {reprice?.rateUnitLabel && <span className="quote-card__rate-unit"> {reprice.rateUnitLabel}</span>}
      </p>
      <div className="quote-card__rows quote-card__rows--spaced">
        <KeyValueRow label={ru.dealDetail.rateWasLabel} value={<span className="quote-card__was">{deal.rate ?? ru.common.tbd}</span>}/>
        <KeyValueRow label={ru.dealDetail.giveLabel} value={reprice?.from || deal.holdAmount || ru.common.tbd}/>
        <KeyValueRow label={ru.dealDetail.receiveLabel} value={<span className="quote-card__positive">{reprice?.to ?? ru.common.tbd}</span>}/>
      </div>
      <Button variant="accent" loading={busy === 'accept'} disabled={!!busy} onClick={() => void run('accept', () => acceptReprice(deal))}>
        {ru.dealDetail.acceptNewRateAction}
      </Button>
      <Button type="button" variant="link" danger loading={busy === 'decline'} disabled={!!busy} onClick={() => setDeclineDialogOpen(true)}>
        {ru.dealDetail.declineAction}
      </Button>
      <ConfirmDialog
        open={declineDialogOpen}
        title={ru.dealDetail.rejectRepriceConfirmTitle}
        body={ru.dealDetail.rejectRepriceConfirmBody}
        onConfirm={() => {
          setDeclineDialogOpen(false);
          void run('decline', () => rejectReprice(deal));
        }}
        onCancel={() => setDeclineDialogOpen(false)}
      />
    </div>
  );
}

/**
 * Top up and confirm the hold (С-01, С-13, С-14, С-16). Real mode reads the balance, the shortfall and
 * the minimum off the card, which the server computes at the moment it's read; the mock reads its own
 * deposit balance. The branch mirrors the server's CONFIRM_HOLD rule, so the only blocked case is the
 * one the server would answer without freezing anything.
 */
function ConfirmationBody({ deal, onUpdate, refresh }: BodyProps) {
  const [searchParams] = useSearchParams();
  const urlScenario = searchParams.get('scenario');
  const storeScenario = useUiStore((s) => s.balanceScenario);
  const cycleScenario = useUiStore((s) => s.cycleBalanceScenario);
  const balancesVersion = useUiStore((s) => s.balancesVersion);
  const openTransferModal = useTransferModalStore((s) => s.open);
  // null = no dev override, show the real deposit balance.
  const scenario = USE_REAL_API ? null : (isBalanceScenario(urlScenario) ? urlScenario : storeScenario);
  const [requisites, setRequisites] = useState<Requisites>();
  const [requisitesFailed, setRequisitesFailed] = useState(false);
  const [requisitesAttempt, setRequisitesAttempt] = useState(0);
  const [accountBalance, setAccountBalance] = useState<string>();
  const [balanceFailed, setBalanceFailed] = useState(false);
  const [balanceAttempt, setBalanceAttempt] = useState(0);
  const { busy, run } = useDealAction({ onUpdate, refresh });
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);

  const amount = deal.amount ?? String(parseAmountValue(deal.from));
  const minAmount = deal.minAmount ?? '0';
  // The card's balance is the server's own figure; the deposit balance is only a fallback for a card without one.
  const cardBalance = USE_REAL_API ? deal.balance : undefined;
  const balance = cardBalance ?? accountBalance;
  const branch = balance === undefined ? undefined : holdBranch(balance, amount, minAmount);
  const showRequisites = branch === 'short' || branch === 'belowmin';

  // Read once, and only when the panel is shown (the method isn't meant for polling); a failure offers a
  // retry in the panel's place.
  useEffect(() => {
    if (!showRequisites || requisites) {
      return;
    }
    setRequisitesFailed(false);
    void getDealRequisites(deal.id).then((data) => {
      if (data) {
        setRequisites(data);
      } else {
        setRequisitesFailed(true);
      }
    }).catch((err: unknown) => {
      console.error('[DealDetail] requisites load failed', err);
      setRequisitesFailed(true);
    });
  }, [deal.id, showRequisites, requisites, requisitesAttempt]);

  // A transfer between the client's accounts changes the card's balance: re-read it at once, and once
  // more a few seconds later in case the balance landed after the transfer's own answer.
  const balancesVersionAtOpen = useRef(balancesVersion);
  useEffect(() => {
    if (!USE_REAL_API || balancesVersion === balancesVersionAtOpen.current) {
      return;
    }
    refresh();
    const again = setTimeout(refresh, 3000);
    return () => clearTimeout(again);
  }, [balancesVersion, refresh]);

  // Explicit dev override only — forces the mock deposit balance to whatever produces the requested case.
  useEffect(() => {
    if (!scenario) {
      return;
    }
    const target = computeScenarioBalance(Number(amount), Number(minAmount), scenario);
    setDepositBalanceForTesting(deal.ticker, target);
  }, [scenario, deal.ticker, amount, minAmount]);

  useEffect(() => {
    if (cardBalance !== undefined) {
      return;
    }
    setBalanceFailed(false);
    void getAccounts()
      .then((accounts) => setAccountBalance(decimalString(Number(accounts.deposit[deal.ticker] ?? '0'))))
      .catch((err: unknown) => {
        console.error('[DealDetail] balance load failed', err);
        setBalanceFailed(true);
      });
  }, [cardBalance, deal.ticker, scenario, balancesVersion, balanceAttempt]);

  if (balance === undefined || branch === undefined) {
    return balanceFailed
      ? <LoadError message={ru.home.balancesError} onRetry={() => setBalanceAttempt((n) => n + 1)}/>
      : <Skeleton height={90} radius={14}/>;
  }

  const shortfall = deal.missingAmount && Number(deal.missingAmount) > 0 ? deal.missingAmount : shortfallOf(balance, amount);
  const balanceLabel = `${formatAmount(balance, deal.ticker)} ${deal.ticker}`;
  const minLabel = `${formatAmount(minAmount, deal.ticker)} ${deal.ticker}`;
  // A ≤1% shortfall: the server sends what the deal becomes; the mock recalculates at the same rate.
  const counter = deal.to ? parseAmountWithTicker(deal.to) : undefined;
  const recalculatedFrom = deal.actualFrom ?? balanceLabel;
  const recalculatedTo = deal.actualTo ?? (counter && Number(amount) > 0
    ? `${formatAmount(String((Number(balance) / Number(amount)) * counter.value), counter.ticker)} ${counter.ticker}`
    : balanceLabel);

  function confirm() {
    const patch: ConfirmDealPatch = branch === 'short1'
      ? { status: 'RUNNING', from: recalculatedFrom, to: recalculatedTo, holdAmount: recalculatedFrom }
      : branch === 'short'
        ? { status: 'SHORTFALL_REVIEW', holdAmount: balanceLabel }
        : { status: 'RUNNING', holdAmount: deal.from };
    void run('confirm', () => confirmHold(deal, patch));
  }

  return (
    <>
      <BalanceBlock
        balance={formatAmount(balance, deal.ticker)}
        ticker={deal.ticker}
        dealAmount={deal.from}
        shortfall={branch !== 'sufficient' ? `${formatAmount(shortfall, deal.ticker)} ${deal.ticker}` : undefined}
        onTransfer={openTransferModal}
        onLongPressBalance={USE_REAL_API ? undefined : cycleScenario}
      />

      {branch === 'sufficient' && <Callout variant="neutral">{ru.dealDetail.calloutSufficient}</Callout>}
      {branch === 'short1' && (
        <Callout variant="warning">
          {renderTemplate(ru.dealDetail.calloutShort1, { balance: recalculatedFrom, recalculated: recalculatedTo })}
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

      <Button variant="accent" loading={busy === 'confirm'} disabled={branch === 'belowmin' || !!busy} onClick={confirm}>
        {ru.dealDetail.confirmDealAction}
      </Button>
      <Button
        type="button"
        variant="link"
        danger
        loading={busy === 'decline'}
        disabled={!!busy}
        onClick={() => setDeclineDialogOpen(true)}
      >
        {ru.dealDetail.declineAction}
      </Button>

      {showRequisites && (
        requisites ? <RequisitesPanel requisites={requisites}/>
          : requisitesFailed ? (
            <Panel fill="surface" radius="16px">
              <h2 className="deal-detail__requisites-title">{ru.dealDetail.requisitesTitle}</h2>
              <LoadError message={ru.dealDetail.requisitesError} onRetry={() => setRequisitesAttempt((n) => n + 1)}/>
            </Panel>
          ) : <Skeleton height={200} radius={16}/>
      )}

      <ConfirmDialog
        open={declineDialogOpen}
        title={ru.dealDetail.declineConfirmTitle}
        onConfirm={() => {
          setDeclineDialogOpen(false);
          // CANCEL: REJECT_QUOTE is only for a quote, here it would get 409.
          void run('decline', () => cancelDeal(deal));
        }}
        onCancel={() => setDeclineDialogOpen(false)}
      />
    </>
  );
}

function CancelLink({ deal, onUpdate, refresh, disabled = false }: BodyProps & { disabled?: boolean }) {
  const { busy, run } = useDealAction({ onUpdate, refresh });
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="link" danger loading={!!busy} disabled={disabled} onClick={() => setDialogOpen(true)}>
        {ru.dealDetail.cancelRequestAction}
      </Button>
      <ConfirmDialog
        open={dialogOpen}
        title={ru.dealDetail.cancelRequestConfirmTitle}
        onConfirm={() => {
          setDialogOpen(false);
          void run('cancel', () => cancelDeal(deal));
        }}
        onCancel={() => setDialogOpen(false)}
      />
    </>
  );
}

function StatusHeroBody(props: BodyProps) {
  const { deal, onUpdate, refresh } = props;
  const navigate = useNavigate();
  const { busy, run } = useDealAction({ onUpdate, refresh });
  const amounts = settledAmounts(deal);

  switch (deal.status) {
    case 'RATE_PENDING':
      return (
        <StatusHero
          icon="spinner"
          tone="pending"
          title={ru.dealDetail.heroRatePendingTitle}
          subtitle={ru.dealDetail.heroRatePendingSubtitle}
          action={<CancelLink {...props}/>}
        />
      );
    case 'RATE_STALE':
      return (
        <StatusHero
          icon="hourglass"
          tone="stale"
          title={ru.dealDetail.heroRateStaleTitle}
          // The cancel link isn't in the frame: without it a client couldn't drop a deal whose quote ran out.
          action={(
            <>
              <Button variant="accent" loading={!!busy} onClick={() => void run('request', () => requestNewRate(deal))}>
                {ru.dealDetail.requestNewRateAction}
              </Button>
              <CancelLink {...props} disabled={!!busy}/>
            </>
          )}
        />
      );
    case 'SHORTFALL_REVIEW': {
      const frozen = deal.holdAmount ?? deal.actualFrom ?? ru.common.tbd;
      return (
        <StatusHero
          icon="spinner"
          tone="pending"
          title={ru.dealDetail.heroShortfallTitle}
          subtitle={renderTemplate(
            deal.repriceRejected ? ru.dealDetail.heroShortfallRejectedSubtitle : ru.dealDetail.heroShortfallSubtitle,
            { amount: frozen },
          )}
          action={<CancelLink {...props}/>}
        />
      );
    }
    case 'RUNNING':
      // No cancel here: the desk is covering the volume (decision Р4).
      return (
        <StatusHero
          icon="spinner"
          tone="running"
          title={ru.dealDetail.heroRunningTitle}
          subtitle={renderTemplate(ru.dealDetail.heroRunningSubtitle, { amount: amounts.give })}
        />
      );
    case 'DONE':
      return (
        <StatusHero
          icon="check"
          tone="success"
          title={ru.dealDetail.heroDoneTitle}
          subtitle={renderTemplate(ru.dealDetail.heroDoneSubtitle, { amount: amounts.receive ?? amounts.give })}
          // BRD FR-13.5: the mini app's only history is the OTC deals list.
          action={(
            <Button type="button" variant="link" className="status-hero__history" onClick={() => navigate('/deals')}>
              {ru.dealDetail.historyAction}
            </Button>
          )}
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
    default:
      return null;
  }
}
