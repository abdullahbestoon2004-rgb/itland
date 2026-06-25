import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useWholesale } from '../context/WholesaleContext';
import './WholesaleLogin.css';

export default function WholesaleLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useWholesale();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email.trim(), password);
            navigate('/products');
        } catch (err) {
            setError(err.message || 'Invalid email or password.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="wholesale-login-page">
            <div className="wholesale-login-card">
                <div className="wholesale-login-header">
                    <div className="wholesale-icon-wrapper">
                        <LogIn size={28} />
                    </div>
                    <h1 className="wholesale-login-title">Wholesale Portal</h1>
                    <p className="wholesale-login-subtitle">
                        Sign in with your wholesale account to view exclusive pricing.
                    </p>
                </div>

                <form className="wholesale-login-form" onSubmit={handleSubmit}>
                    {error && <div className="wholesale-error">{error}</div>}

                    <div className="wholesale-field">
                        <label htmlFor="wholesale-email">Email</label>
                        <input
                            id="wholesale-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@company.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="wholesale-field">
                        <label htmlFor="wholesale-password">Password</label>
                        <input
                            id="wholesale-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="wholesale-submit-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="wholesale-contact-note">
                    Don't have a wholesale account?{' '}
                    <a href="/contact">Contact us</a> to apply.
                </p>
            </div>
        </div>
    );
}
