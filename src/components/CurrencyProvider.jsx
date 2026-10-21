import { usePageData } from '../context/PageDataContext';
import { useEffect, useState } from 'react';
import { CurrencyContext } from '../context/CurrencyContext';
import { isFreshRate } from '../utils/currency';
export default function CurrencyProvider({
  children
}) {
  const initial = usePageData();
  const [state, setState] = useState({
    snapshot: isFreshRate(initial.snapshot) ? initial.snapshot : null,
    loading: !initial.serverRendered
  });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch('/api/currency', {
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Unavailable');
        const snapshot = await response.json();
        if (!isFreshRate(snapshot)) throw new Error('Stale rate');
        if (active) setState({
          snapshot,
          loading: false
        });
      } catch {
        if (active) setState(previous => ({
          snapshot: isFreshRate(previous.snapshot) ? previous.snapshot : null,
          loading: false
        }));
      }
    };
    load();
    const timer = setInterval(load, 5 * 60_000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  return <CurrencyContext.Provider value={state}>{children}</CurrencyContext.Provider>;
}
