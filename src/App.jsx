import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Storefront from './pages/Storefront';
import AllProducts from './pages/AllProducts';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import StoreLayout from './components/StoreLayout';
import './App.css';

function App() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route path="/" element={<Storefront />} />
        <Route path="/products" element={<AllProducts />} />
      </Route>
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Route>
    </Routes>
  );
}

export default App;
