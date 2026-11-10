import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Panel } from '@/components/Panel/Panel.tsx';
import { KeyValueRow } from '@/components/KeyValueRow/KeyValueRow.tsx';
import { StatusHero } from '@/components/StatusHero/StatusHero.tsx';
import { BalanceBlock, BalanceBlockSkeleton } from '@/components/BalanceBlock/BalanceBlock.tsx';
import { Callout } from '@/components/Callout/Callout.tsx';
import { RequisitesPanel, RequisitesPanelSkeleton } from '@/components/RequisitesPanel/RequisitesPanel.tsx';
import { DocumentRow } from '@/components/DocumentRow/DocumentRow.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog.tsx';
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
  mapApiError,
  openDealDocument,
  rejectQuote,
  rejectReprice,
  rejectTerms,
  requestNewRate,
  setDepositBalanceForTesting,
} from '@/api/index.ts';
import type { ConfirmDealPatch, Deal, DealDocument, DealDocumentKind } from '@/api/index.ts';
import { DIRECTION_LABEL, DealHeader, DealPlaceholder } from '@/screens/DealDetail/DealDetailSkeleton.tsx';
import { useRequireSession } from '@/store/session.ts';
import { useToastStore } from '@/store/toast.ts';
import { useUiStore } from '@/store/ui.ts';
import { useTransferModalStore } from '@/store/transferModal.ts';
import { getDetailRows, isTerminalDealStatus } from '@/lib/dealStatus.ts';
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
import { dealChanged, useAccounts, useDeal, useDealRequisites } from '@/lib/queries.ts';
import { usePolling } from '@/lib/usePolling.ts';
import { renderTemplate } from '@/lib/template.tsx';
import { SAMPLE_DOCUMENT_URL } from '@/lib/sampleDocument.ts';
import { notifyError, openExternalLink } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './DealDetail.css';

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

/** The last stretch of a quote's life, when its timer starts to pulse. */
const TIMER_URGENT_MS = 30_000;

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
      // The list, the dashboard counters and the balances are re-read when their screens open.
      dealChanged();
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
  // The card last seen (within a minute) is shown at once and re-read underneath. A slow poll can't
  // overwrite what a later action already showed: reads are numbered, and only one newer than what
  // is on screen is applied (`lib/query.ts`).
  const { deal, preview, notFound, failed, refresh, show } = useDeal(id);

  // A failed re-read is simply retried by the next one.
  const refreshCard = useCallback(() => void refresh(), [refresh]);

  usePolling(refreshCard, POLL_MS, USE_REAL_API && !!deal && !isTerminalDealStatus(deal.status));

  if (failed) {
    return (
      <div className="deal-detail">
        <LoadError message={ru.dealDetail.loadError} onRetry={refreshCard}/>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="deal-detail">
        <p className="deal-detail__not-found rise">{ru.dealDetail.notFound}</p>
      </div>
    );
  }

  if (!deal) {
    // What the list said about the deal fills the header; the rest keeps its shape until the card is in.
    return (
      <div className="deal-detail">
        <DealHeader deal={preview}/>
        <DealPlaceholder preview={preview}/>
      </div>
    );
  }

  const detailRows = getDetailRows(deal.status);
  const bodyProps = { deal, onUpdate: show, refresh: refreshCard };
  const amounts = settledAmounts(deal);

  return (
    <div className="deal-detail">
      <DealHeader deal={deal}/>

      {/* Keyed by the status: the card of a new stage arrives, it doesn't swap in place. */}
      <div key={deal.status} className="deal-detail__body rise">
        <DealBody {...bodyProps}/>
      </div>

      <div className="deal-detail__section reveal">
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

      <DealDocuments {...bodyProps}/>
    </div>
  );
}

/** A danger link that asks before it acts: "Отклонить" and "Отменить заявку" on every card. */
function ConfirmedLink({ label, title, body, loading, disabled, onConfirm }: {
  label: string;
  title: string;
  body?: string;
  loading: boolean;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="link" danger loading={loading} disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        title={title}
        body={body}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
        onCancel={() => setOpen(false)}
      />
    </>
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
    <div className="deal-detail__section reveal">
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
        {ru.dealDetail.quoteFixedLabel} <Timer remainingMs={remainingMs}/>
      </p>
      <div className="quote-card__rows">
        <KeyValueRow label={ru.dealDetail.giveLabel} value={deal.from}/>
        <KeyValueRow label={ru.dealDetail.receiveLabel} value={<span className="quote-card__positive">{deal.to ?? ru.common.tbd}</span>}/>
      </div>
      <Button variant="accent" loading={busy === 'accept'} disabled={!!busy} onClick={() => void run('accept', () => acceptQuote(deal))}>
        {ru.dealDetail.confirmDealAction}
      </Button>
      <ConfirmedLink
        label={ru.dealDetail.declineAction}
        title={ru.dealDetail.declineConfirmTitle}
        loading={busy === 'decline'}
        disabled={!!busy}
        onConfirm={() => void run('decline', () => rejectQuote(deal))}
      />
    </div>
  );
}

/** The quote's countdown. Its last half-minute pulses: the figure alone doesn't say "hurry". */
function Timer({ remainingMs }: { remainingMs: number }) {
  const urgent = remainingMs > 0 && remainingMs <= TIMER_URGENT_MS;
  return (
    <span className={urgent ? 'quote-card__timer quote-card__timer--urgent' : 'quote-card__timer'}>
      {formatCountdown(remainingMs)} {ru.dealDetail.quoteSecondsSuffix}
    </span>
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
          {ru.dealDetail.termsValidLabel} <Timer remainingMs={remainingMs}/>
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
      <ConfirmedLink
        label={ru.dealDetail.declineAction}
        title={ru.dealDetail.rejectTermsConfirmTitle}
        body={ru.dealDetail.rejectTermsConfirmBody}
        loading={busy === 'decline'}
        disabled={!!busy}
        onConfirm={() => void run('decline', () => rejectTerms(deal))}
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
      <ConfirmedLink
        label={ru.dealDetail.declineAction}
        title={ru.dealDetail.rejectRepriceConfirmTitle}
        body={ru.dealDetail.rejectRepriceConfirmBody}
        loading={busy === 'decline'}
        disabled={!!busy}
        onConfirm={() => void run('decline', () => rejectReprice(deal))}
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
  const { busy, run } = useDealAction({ onUpdate, refresh });

  const amount = deal.amount ?? String(parseAmountValue(deal.from));
  const minAmount = deal.minAmount ?? '0';
  // The card's balance is the server's own figure; the deposit balance is only a fallback for a card without one.
  const cardBalance = USE_REAL_API ? deal.balance : undefined;
  const accounts = useAccounts(cardBalance === undefined);
  const refetchAccounts = accounts.refetch;
  const balance = cardBalance ?? (accounts.data && decimalString(Number(accounts.data.deposit[deal.ticker] ?? '0')));
  const branch = balance === undefined ? undefined : holdBranch(balance, amount, minAmount);
  const showRequisites = branch === 'short' || branch === 'belowmin';

  // Read once per visit, and only from the moment the panel first shows (the method isn't meant for
  // polling); a failure offers a retry in the panel's place.
  const requisitesWanted = useRef(false);
  requisitesWanted.current ||= showRequisites;
  const requisites = useDealRequisites(deal.id, requisitesWanted.current);

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

  // Explicit dev override only — forces the mock deposit balance to whatever produces the requested
  // case, then reads it. (A transfer re-reads it by itself: `balancesChanged` in lib/queries.ts.)
  useEffect(() => {
    if (!scenario) {
      return;
    }
    const target = computeScenarioBalance(Number(amount), Number(minAmount), scenario);
    setDepositBalanceForTesting(deal.ticker, target);
    void refetchAccounts();
  }, [scenario, deal.ticker, amount, minAmount, refetchAccounts]);

  if (balance === undefined || branch === undefined) {
    return accounts.failed
      ? <LoadError message={ru.home.balancesError} onRetry={() => void refetchAccounts()}/>
      : <BalanceBlockSkeleton dealAmount={deal.from}/>;
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

      {/* Keyed, so a balance that moves the deal into another case brings that case's note in anew. */}
      {branch === 'sufficient' && <Callout key={branch} variant="neutral">{ru.dealDetail.calloutSufficient}</Callout>}
      {branch === 'short1' && (
        <Callout key={branch} variant="warning">
          {renderTemplate(ru.dealDetail.calloutShort1, { balance: recalculatedFrom, recalculated: recalculatedTo })}
        </Callout>
      )}
      {branch === 'short' && (
        <Callout key={branch} variant="warning">
          {renderTemplate(ru.dealDetail.calloutShort, { balance: balanceLabel })}
        </Callout>
      )}
      {branch === 'belowmin' && (
        <Callout key={branch} variant="danger">
          {renderTemplate(ru.dealDetail.calloutBelowMin, { min: minLabel })}
        </Callout>
      )}

      <Button variant="accent" loading={busy === 'confirm'} disabled={branch === 'belowmin' || !!busy} onClick={confirm}>
        {ru.dealDetail.confirmDealAction}
      </Button>
      <ConfirmedLink
        label={ru.dealDetail.declineAction}
        title={ru.dealDetail.declineConfirmTitle}
        loading={busy === 'decline'}
        disabled={!!busy}
        // CANCEL: REJECT_QUOTE is only for a quote, here it would get 409.
        onConfirm={() => void run('decline', () => cancelDeal(deal))}
      />

      {showRequisites && (
        requisites.data ? <RequisitesPanel requisites={requisites.data}/>
          : requisites.failed ? (
            <Panel fill="surface" radius="16px" className="rise">
              <h2 className="deal-detail__requisites-title">{ru.dealDetail.requisitesTitle}</h2>
              <LoadError message={ru.dealDetail.requisitesError} onRetry={() => void requisites.refetch()}/>
            </Panel>
          ) : <RequisitesPanelSkeleton/>
      )}
    </>
  );
}

function StatusHeroBody({ deal, onUpdate, refresh }: BodyProps) {
  const navigate = useNavigate();
  // One action at a time for the whole card: while one of its buttons works, the other waits.
  const { busy, run } = useDealAction({ onUpdate, refresh });
  const amounts = settledAmounts(deal);
  const cancelLink = (
    <ConfirmedLink
      label={ru.dealDetail.cancelRequestAction}
      title={ru.dealDetail.cancelRequestConfirmTitle}
      loading={busy === 'cancel'}
      disabled={!!busy}
      onConfirm={() => void run('cancel', () => cancelDeal(deal))}
    />
  );

  switch (deal.status) {
    case 'RATE_PENDING':
      return (
        <StatusHero
          icon="spinner"
          tone="pending"
          title={ru.dealDetail.heroRatePendingTitle}
          subtitle={ru.dealDetail.heroRatePendingSubtitle}
          action={cancelLink}
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
              <Button variant="accent" loading={busy === 'request'} disabled={!!busy} onClick={() => void run('request', () => requestNewRate(deal))}>
                {ru.dealDetail.requestNewRateAction}
              </Button>
              {cancelLink}
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
          action={cancelLink}
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
