import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
    const isAuthenticated = localStorage.getItem('logi_admin_auth') === 'true';

    if (!isAuthenticated) {
        return <Navigate to="/admin/login" replace />;
    }

    return <Outlet />;
}
