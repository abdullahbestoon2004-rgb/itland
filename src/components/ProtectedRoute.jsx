import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
    const { session, isAdmin, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="auth-loading">
                <p>Checking access…</p>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/admin/login" replace />;
    }

    if (!isAdmin) {
        return <Navigate to="/admin/login" replace state={{ denied: true }} />;
    }

    return <Outlet />;
}
