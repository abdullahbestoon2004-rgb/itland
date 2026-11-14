import { PageDataContext } from './context/PageDataContext';
import { RouteLocaleContext } from './context/LocaleContext';
import { LOCALES, localeFromPath } from './utils/locale';
import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

const initial = JSON.parse(document.getElementById('itland-page-data')?.textContent || '{}');
// "/ar/products" is the Arabic shop: the router works under that prefix, so every link keeps the language.
const locale = localeFromPath(window.location.pathname);
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouteLocaleContext.Provider value={locale}><PageDataContext.Provider value={initial}><BrowserRouter basename={LOCALES[locale].prefix || undefined}>
      <App />
    </BrowserRouter></PageDataContext.Provider></RouteLocaleContext.Provider>
  </StrictMode>,
)
