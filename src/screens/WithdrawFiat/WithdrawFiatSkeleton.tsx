import { Button } from '@/components/Button/Button.tsx';
import { FieldSkeleton } from '@/components/Skeleton/FieldSkeleton.tsx';
import { SkeletonGroup } from '@/components/Skeleton/Skeleton.tsx';
import { SummaryCardSkeleton } from '@/components/SummaryCard/SummaryCard.tsx';
import { ru } from '@/i18n/ru.ts';

import './WithdrawFiat.css';

/** The rows of the fiat summary card, known before any number is. */
export const FIAT_SUMMARY_LABELS = [ru.withdraw.minAmountLabel, ru.withdraw.limitLabel, ru.withdraw.enteredAmountLabel, ru.withdraw.feeLabel];

/**
 * The form before the client's currencies are known: headings, labels and the button are already in
 * place, the fields are bars. Shown by the screen while it loads, and by the route while the screen's
 * own code is still on its way.
 */
export function WithdrawFiatSkeleton() {
  return (
    <div className="withdraw-fiat">
      <SkeletonGroup className="withdraw-fiat__scroll">
        <h2 className="withdraw-fiat__section-title">{ru.withdraw.chooseCurrencyMethodTitle}</h2>
        <FieldSkeleton label={ru.withdraw.currencyLabel}/>
        <FieldSkeleton label={ru.withdraw.methodLabel}/>
        <h2 className="withdraw-fiat__section-title">{ru.withdraw.amountSectionTitle}</h2>
        <FieldSkeleton label={ru.withdraw.sendLabel}/>
        <SummaryCardSkeleton labels={FIAT_SUMMARY_LABELS} totalLabel={ru.withdraw.totalDebitLabel}/>
      </SkeletonGroup>
      <div className="withdraw-fiat__submit">
        <Button variant="accent" disabled>{ru.withdraw.confirmAction}</Button>
      </div>
    </div>
  );
}
