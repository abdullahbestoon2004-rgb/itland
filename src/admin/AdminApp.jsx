import React from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
    Activity, ClipboardList, ExternalLink, Images, LogOut, Mail, MessageSquare, Package, Settings, ShoppingBag, Sparkles, Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInbox, useOrders } from './context';
import { CatalogProvider, InboxProvider, OrdersProvider, ToastProvider } from './providers';
import OrdersPage from './OrdersPage';
import ProductsPage from './ProductsPage';
import CarouselPage from './CarouselPage';
import SettingsPage from './SettingsPage';
import { MessagesPage, ReviewsPage } from './InboxPages';
import { Stat } from './ui';
import { formatIqd } from './lib';
import './admin.css';

const BASE = '/admin/dashboard';

export default function AdminApp() {
    return (
        <ToastProvider>
            <CatalogProvider>
                <OrdersProvider>
                    <InboxProvider>
                        <Shell />
                    </InboxProvider>
                </OrdersProvider>
            </CatalogProvider>
        </ToastProvider>
    );
}

function Shell() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { stats, status: ordersStatus } = useOrders();
    const { unhandled, pendingReviews } = useInbox();

    const nav = [
        { to: BASE, end: true, label: 'Orders', icon: ShoppingBag, badge: stats.fresh },
        { to: `${BASE}/products`, label: 'Products', icon: Package },
        { to: `${BASE}/carousel`, label: 'Carousel', icon: Images },
        { to: `${BASE}/settings`, label: 'Settings', icon: Settings },
        { to: `${BASE}/messages`, label: 'Messages', icon: Mail, badge: unhandled },
        { to: `${BASE}/reviews`, label: 'Reviews', icon: MessageSquare, badge: pendingReviews },
    ];

    const handleSignOut = async () => {
        await signOut();
        navigate('/admin/login');
    };

    return (
        <div className="adm-root">
            <aside className="adm-side">
                <Link to={BASE} className="adm-brand" aria-label="ITland admin home">
                    <img src="/newitlandlogo.png" alt="" className="adm-brand__logo" />
                    <span className="adm-brand__text">ITland <em>Admin</em></span>
                </Link>
                <nav className="adm-nav" aria-label="Dashboard sections">
                    {nav.map(({ to, end, label, icon, badge }) => (
                        <NavLink key={to} to={to} end={end} className={({ isActive }) => `adm-nav__link ${isActive ? 'is-active' : ''}`}>
                            {React.createElement(icon, { size: 18, 'aria-hidden': true })}
                            <span>{label}</span>
                            {badge > 0 && <span className="adm-nav__badge" aria-label={`${badge} new`}>{badge}</span>}
                        </NavLink>
                    ))}
                </nav>
                <div className="adm-side__foot">
                    <a href="/" target="_blank" rel="noreferrer" className="adm-side__link"><ExternalLink size={16} /> View website</a>
                    {user?.email && <span className="adm-side__user" title={user.email}>{user.email}</span>}
                    <button type="button" className="adm-side__link" onClick={handleSignOut}><LogOut size={16} /> Sign out</button>
                </div>
            </aside>

            <header className="adm-top">
                <Link to={BASE} className="adm-brand adm-brand--small" aria-label="ITland admin home">
                    <img src="/newitlandlogo.png" alt="" className="adm-brand__logo" />
                    <span className="adm-brand__text">Admin</span>
                </Link>
                <div className="adm-row">
                    <a href="/" target="_blank" rel="noreferrer" className="adm-icon-btn" aria-label="View website"><ExternalLink size={18} /></a>
                    <button type="button" className="adm-icon-btn" onClick={handleSignOut} aria-label="Sign out"><LogOut size={18} /></button>
                </div>
                <nav className="adm-topnav" aria-label="Dashboard sections">
                    {nav.map(({ to, end, label, icon, badge }) => (
                        <NavLink key={to} to={to} end={end} className={({ isActive }) => `adm-topnav__link ${isActive ? 'is-active' : ''}`}>
                            {React.createElement(icon, { size: 16, 'aria-hidden': true })}
                            {label}
                            {badge > 0 && <span className="adm-nav__badge">{badge}</span>}
                        </NavLink>
                    ))}
                </nav>
            </header>

            <main className="adm-main">
                {ordersStatus !== 'error' && (
                    <div className="adm-stats" aria-label="Today">
                        <Stat icon={Sparkles} label="New orders today" value={ordersStatus === 'ready' ? stats.newToday : '…'} tone="info" />
                        <Stat icon={Activity} label="Open orders" value={ordersStatus === 'ready' ? stats.active : '…'} sub={stats.fresh ? `${stats.fresh} waiting to confirm` : 'none waiting'} tone="warn" />
                        <Stat icon={Wallet} label="Revenue completed today" value={ordersStatus === 'ready' ? formatIqd(stats.revenueToday) : '…'} sub="delivered or picked up today, excl. cancelled/refunded" tone="ok" />
                        <Stat icon={ClipboardList} label="Completed today" value={ordersStatus === 'ready' ? stats.completedToday : '…'} sub="delivered or picked up today" />
                    </div>
                )}
                <Routes>
                    <Route index element={<OrdersPage />} />
                    <Route path="products" element={<ProductsPage />} />
                    <Route path="carousel" element={<CarouselPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="messages" element={<MessagesPage />} />
                    <Route path="reviews" element={<ReviewsPage />} />
                    <Route path="*" element={<Navigate to={BASE} replace />} />
                </Routes>
            </main>
        </div>
    );
}
