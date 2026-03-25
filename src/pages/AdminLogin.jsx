import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorPlay, Lock } from 'lucide-react';
import './AdminLogin.css';

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (localStorage.getItem('logi_admin_auth') === 'true') {
            navigate('/admin/dashboard');
        }
    }, [navigate]);

    const handleLogin = (e) => {
        e.preventDefault();
        // Mock authentication
        if (username === 'admin' && password === 'password') {
            localStorage.setItem('logi_admin_auth', 'true');
            navigate('/admin/dashboard');
        } else {
            setError('Invalid credentials. Use admin / password');
        }
    };

    return (
        <div className="admin-login-container">
            <div className="login-card">
                <div className="login-header">
                    <MonitorPlay className="logo-icon mb-4" size={48} />
                    <h2>Admin Access</h2>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter admin username"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary login-btn">
                        <Lock size={18} style={{ marginRight: '8px' }} />
                        Login
                    </button>
                </form>

                <div className="login-footer">
                    <a href="/" className="back-link">Return to Storefront</a>
                </div>
            </div>
        </div>
    );
}
