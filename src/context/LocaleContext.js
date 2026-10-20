import { createContext, useContext } from 'react';
export const LocaleContext = createContext({ language: 'en', setLanguage: () => {}, t: (text) => text });
export const useLocale = () => useContext(LocaleContext);
