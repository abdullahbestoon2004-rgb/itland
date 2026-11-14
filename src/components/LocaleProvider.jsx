import { useCallback, useContext, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { LocaleContext, RouteLocaleContext } from '../context/LocaleContext';
import { LOCALES, localePath } from '../utils/locale';
import translations from '../data/translations.json';

// The language comes from the address (/ar, /ku, or none for English), so the
// server and the browser always agree. Choosing another language in the menu
// remembers the choice and opens the same page at that language's address.
export default function LocaleProvider({
  children
}) {
  const language = useContext(RouteLocaleContext);
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    document.documentElement.lang = LOCALES[language].lang;
    document.documentElement.dir = LOCALES[language].dir;
  }, [language]);
  const setLanguage = useCallback(next => {
    if (!LOCALES[next] || next === language) return;
    try {
      localStorage.setItem('itland-language', next);
    } catch {/* Storage may be unavailable. */}
    window.location.assign(localePath(next, `${pathname}${search}${hash}`));
  }, [language, pathname, search, hash]);
  const value = useMemo(() => ({
    language,
    localized: true,
    setLanguage,
    t: text => translations[text]?.[language] || text
  }), [language, setLanguage]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
