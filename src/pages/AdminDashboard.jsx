import React, { Suspense, lazy } from 'react';
import usePageMeta from '../hooks/usePageMeta';
import './AdminDashboard.css';

// The dashboard (src/admin) is its own chunk, so storefront visitors never download it.
const AdminApp = lazy(() => import('../admin/AdminApp'));

export default function AdminDashboard() {
    usePageMeta({ title: 'Admin dashboard', noindex: true });
    return (
        <Suspense
            fallback={(
                <div className="adm-boot" role="status">
                    <span className="adm-boot__spinner" aria-hidden="true" />
                    <span>Loading dashboard…</span>
                </div>
            )}
        >
            <AdminApp />
        </Suspense>
    );
}
