import { useLocale } from '../context/LocaleContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatIqd, isFreshRate } from '../utils/currency';
export default function Price({
  usd
}) {
  const {
    t
  } = useLocale();
  const {
    snapshot,
    loading
  } = useCurrency();
  return <bdi className="iqd-price">{formatIqd(usd, snapshot) ?? (loading ? t('Loading IQD price…') : t('Confirm IQD price'))}</bdi>;
}
export function CurrencyNote() {
  const {
    t
  } = useLocale();
  const {
    snapshot,
    loading
  } = useCurrency();
  if (!isFreshRate(snapshot)) return <p className="currency-note" role="status">{loading ? t("Loading IQD prices\u2026") : t("IQD rate unavailable. Confirm prices on WhatsApp.")}</p>;
  return <details className="currency-note"><summary>{t("Prices in IQD \xB7 final total confirmed on WhatsApp")}</summary>
        <p>Indicative conversion using <a href="https://iraqsm.com" target="_blank" rel="noreferrer">IQWealth Baghdad market</a>, the average of buy and sell rates.</p>
        <p><bdi>1 USD = {snapshot.rate.toLocaleString('en-US')} IQD</bdi> · Updated {new Date(snapshot.asOf).toLocaleString('en-GB', {
        timeZone: 'Asia/Baghdad'
      })} (Baghdad).</p>
    </details>;
}
