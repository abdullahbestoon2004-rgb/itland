import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Storefront from './pages/Storefront';
import AllProducts from './pages/AllProducts';
import About from './pages/About';
import Contact from './pages/Contact';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import WholesaleLogin from './pages/WholesaleLogin';
import ProtectedRoute from './components/ProtectedRoute';
import StoreLayout from './components/StoreLayout';
import ScrollToTop from './components/ScrollToTop';
import { WholesaleProvider } from './context/WholesaleContext';
import './App.css';

function App() {
  return (
    <WholesaleProvider>
      <ScrollToTop />
      <Routes>
        <Route element={<StoreLayout />}>
          <Route path="/" element={<Storefront />} />
          <Route path="/products" element={<AllProducts />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Route>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/wholesale/login" element={<WholesaleLogin />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </WholesaleProvider>
  );
}

export default App;
