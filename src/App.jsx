import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Storefront from './pages/Storefront';
import ShoppingHelp from './pages/ShoppingHelp';
import AllProducts from './pages/AllProducts';
import ProductDetails from './pages/ProductDetails';
import About from './pages/About';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import WholesaleLogin from './pages/WholesaleLogin';
import ProtectedRoute from './components/ProtectedRoute';
import StoreLayout from './components/StoreLayout';
import ScrollToTop from './components/ScrollToTop';
import AuthProvider from './components/AuthProvider';
import WholesaleProvider from './components/WholesaleProvider';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <WholesaleProvider>
        <ScrollToTop />
        <Routes>
          <Route element={<StoreLayout />}>
            <Route path="/" element={<Storefront />} />
            <Route path="/products" element={<AllProducts />} />
                    <Route path="/brands/:brand" element={<AllProducts />} />
            <Route path="/product/:slug" element={<ProductDetails />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/help/:topic" element={<ShoppingHelp />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/wholesale/login" element={<WholesaleLogin />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </WholesaleProvider>
    </AuthProvider>
  );
}

export default App;
