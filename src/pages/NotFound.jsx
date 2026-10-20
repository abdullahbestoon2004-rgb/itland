import React from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import './NotFound.css';

export default function NotFound() {
    usePageMeta({
        title: 'Page not found',
        description: 'The page you are looking for does not exist on IT Land.',
    });

    return (
        <div className="not-found-page">
            <p className="not-found-code">404</p>
            <h1 className="not-found-title">This page doesn&apos;t exist</h1>
            <p className="not-found-text">
                The link may be broken, or the page may have moved.
            </p>
            <div className="not-found-actions">
                <Link to="/" className="btn btn-primary">Back to Home</Link>
                <Link to="/products" className="btn btn-secondary">Browse Products</Link>
            </div>
        </div>
    );
}
