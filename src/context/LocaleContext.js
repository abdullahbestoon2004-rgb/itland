import { createContext, useContext } from 'react';
// The language of the address being shown ("/ar/..." is Arabic). Set once at the
// top of the app, in the browser and on the server, so both render the same page.
export const RouteLocaleContext = createContext('en');
// `localized` is true only inside the store pages, which exist in every language.
export const LocaleContext = createContext({ language: 'en', localized: false, setLanguage: () => {}, t: (text) => text });
export const useLocale = () => useContext(LocaleContext);
