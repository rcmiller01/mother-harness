'use client';

import { useState, FormEvent } from 'react';
import { useAuth, getAuthHeaders } from '../lib/auth';

export default function HomePage() {
    const { user, loading: authLoading, isAuthenticated, login, logout } = useAuth();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ task_id: string; status: string } | null>(null);

    // Login form state
    const [showLogin, setShowLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setLoginError('');
        const success = await login(email, password);
        if (success) {
            setShowLogin(false);
            setEmail('');
            setPassword('');
        } else {
            setLoginError('Invalid credentials');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify({
                    query,
                    user_id: user?.id ?? 'anonymous',
                }),
            });

            const data = await response.json();
            setResult(data);
        } catch (error) {
            console.error('Failed to submit:', error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <main style={{ padding: '2rem', textAlign: 'center' }}>
                <p>Loading...</p>
            </main>
        );
    }

    return (
        <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            {/* Header with auth controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Mother-Harness</h1>
                    <p style={{ color: '#666', margin: 0 }}>
                        Multi-agent orchestration for research, coding, analysis, and design.
                    </p>
                </div>
                <div>
                    {isAuthenticated ? (
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, marginBottom: '0.5rem', fontWeight: 500 }}>
                                {user?.name ?? user?.email ?? user?.id}
                            </p>
                            <button
                                onClick={logout}
                                style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.875rem',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                }}
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowLogin(true)}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                backgroundColor: '#0070f3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                            }}
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </div>

            {/* Login modal */}
            {showLogin && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '400px',
                    }}>
                        <h2 style={{ marginTop: 0 }}>Sign In</h2>
                        <form onSubmit={handleLogin}>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    marginBottom: '1rem',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: '1rem',
                                }}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    marginBottom: '1rem',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: '1rem',
                                }}
                                required
                            />
                            {loginError && (
                                <p style={{ color: 'red', marginBottom: '1rem' }}>{loginError}</p>
                            )}
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    type="submit"
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        fontSize: '1rem',
                                        backgroundColor: '#0070f3',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowLogin(false)}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        fontSize: '1rem',
                                        backgroundColor: 'transparent',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User info banner */}
            {isAuthenticated && (
                <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#e6f7e6',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    fontSize: '0.875rem',
                }}>
                    ✓ Authenticated as <strong>{user?.email ?? user?.id}</strong>
                    {user?.roles && user.roles.length > 0 && (
                        <span style={{ color: '#666' }}> · Roles: {user.roles.join(', ')}</span>
                    )}
                </div>
            )}

            {/* Query form */}
            <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="What would you like help with?"
                    style={{
                        width: '100%',
                        minHeight: '120px',
                        padding: '1rem',
                        fontSize: '1rem',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        marginBottom: '1rem',
                    }}
                />
                <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    style={{
                        padding: '0.75rem 1.5rem',
                        fontSize: '1rem',
                        backgroundColor: '#0070f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        opacity: loading || !query.trim() ? 0.6 : 1,
                    }}
                >
                    {loading ? 'Processing...' : 'Submit'}
                </button>
            </form>

            {result && (
                <div
                    style={{
                        padding: '1rem',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '8px',
                    }}
                >
                    <p>
                        <strong>Task ID:</strong> {result.task_id}
                    </p>
                    <p>
                        <strong>Status:</strong> {result.status}
                    </p>
                </div>
            )}
        </main>
    );
}
