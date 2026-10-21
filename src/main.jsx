import { PageDataContext } from './context/PageDataContext';
import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

const initial = JSON.parse(document.getElementById('itland-page-data')?.textContent || '{}');
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PageDataContext.Provider value={initial}><BrowserRouter>
      <App />
    </BrowserRouter></PageDataContext.Provider>
  </StrictMode>,
)
