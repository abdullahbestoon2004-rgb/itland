import { useEffect, useState } from 'react';
import { LocaleContext } from '../context/LocaleContext';
import translations from '../data/translations.json';
export default function LocaleProvider({
  children
}) {
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem('itland-language');
      return ['ar', 'ku'].includes(saved) ? saved : 'en';
    } catch {
      return 'en';
    }
  });
  useEffect(() => {
    document.documentElement.lang = language === 'ku' ? 'ckb' : language;
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
    try {
      localStorage.setItem('itland-language', language);
    } catch {/* Storage may be unavailable. */}
  }, [language]);
  const t = text => translations[text]?.[language] || text;
  return <LocaleContext.Provider value={{
    language,
    setLanguage,
    t
  }}>{children}</LocaleContext.Provider>;
}
