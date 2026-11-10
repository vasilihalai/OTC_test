import { Button } from '@/components/Button/Button.tsx';
import { FieldSkeleton } from '@/components/Skeleton/FieldSkeleton.tsx';
import { Skeleton, SkeletonGroup } from '@/components/Skeleton/Skeleton.tsx';
import { ru } from '@/i18n/ru.ts';

import './WithdrawCrypto.css';

/**
 * The form before the client's assets are known: its headings, labels and button are already in place,
 * the fields are bars. Shown by the screen while it loads, and by the route while the screen's own
 * code is still on its way.
 */
export function WithdrawCryptoSkeleton() {
  return (
    <div className="withdraw-crypto">
      <SkeletonGroup className="withdraw-crypto__scroll">
        <h2 className="withdraw-crypto__section-title">{ru.withdraw.chooseAssetTitle}</h2>
        <FieldSkeleton label={ru.withdraw.assetLabel}/>
        <h2 className="withdraw-crypto__section-title">{ru.withdraw.chooseAddressNetworkTitle}</h2>
        <FieldSkeleton label={ru.withdraw.addressLabel}/>
        <h2 className="withdraw-crypto__section-title">{ru.withdraw.amountSectionTitle}</h2>
        <FieldSkeleton label={ru.withdraw.sendLabel}/>
        <Skeleton height={124} radius={12}/>
      </SkeletonGroup>
      <div className="withdraw-crypto__submit">
        <Button variant="accent" disabled>{ru.withdraw.confirmAction}</Button>
      </div>
    </div>
  );
}
