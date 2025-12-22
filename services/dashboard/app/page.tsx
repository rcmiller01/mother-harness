'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useAuth, getAuthHeaders } from '../lib/auth';

interface RunHistoryItem {
    id: string;
    status: string;
    created_at: string;
    updated_at: string;
    task_id: string;
}

interface BudgetSummary {
    status: {
        daily_spend: number;
        monthly_spend: number;
        daily_remaining: number;
        monthly_remaining: number;
        daily_warning: boolean;
        monthly_warning: boolean;
        can_use_cloud: boolean;
    };
    usage: {
        daily: Record<string, number>;
        monthly: Record<string, number>;
        by_model: Record<string, number>;
    };
}

interface ActivityMetricsSnapshot {
    user_id: string;
    days: Array<{
        date: string;
        activity: Record<string, number>;
        errors: Record<string, number>;
        runs: Record<string, number>;
    }>;
}

export default function HomePage() {
    const { user, loading: authLoading, isAuthenticated, login, logout } = useAuth();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ task_id: string; status: string } | null>(null);
    const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([]);
    const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
    const [activityMetrics, setActivityMetrics] = useState<ActivityMetricsSnapshot | null>(null);
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardError, setDashboardError] = useState('');

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

    useEffect(() => {
        if (!isAuthenticated || !user?.id) {
            setRunHistory([]);
            setBudgetSummary(null);
            setActivityMetrics(null);
            return;
        }

        const loadDashboardData = async () => {
            setDashboardLoading(true);
            setDashboardError('');

            try {
                const [runsResponse, budgetResponse, metricsResponse] = await Promise.all([
                    fetch(`/api/runs?user_id=${user.id}`),
                    fetch(`/api/budget?user_id=${user.id}`),
                    fetch(`/api/metrics/activity?user_id=${user.id}&days=7`),
                ]);

                if (!runsResponse.ok || !budgetResponse.ok || !metricsResponse.ok) {
                    throw new Error('Failed to load dashboard data');
                }

                const runsData = await runsResponse.json();
                const budgetData = await budgetResponse.json();
                const metricsData = await metricsResponse.json();

                setRunHistory(runsData);
                setBudgetSummary(budgetData);
                setActivityMetrics(metricsData);
            } catch (error) {
                console.error('Failed to load dashboard data', error);
                setDashboardError('Unable to load dashboard data.');
            } finally {
                setDashboardLoading(false);
            }
        };

        loadDashboardData();
    }, [isAuthenticated, user?.id]);

    const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

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

            <section style={{ marginTop: '3rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Operational Dashboards</h2>
                {!isAuthenticated && (
                    <p style={{ color: '#666' }}>Sign in to view run history, budgets, and error trends.</p>
                )}
                {isAuthenticated && dashboardError && (
                    <p style={{ color: 'red' }}>{dashboardError}</p>
                )}
                {isAuthenticated && dashboardLoading && (
                    <p style={{ color: '#666' }}>Loading dashboard data...</p>
                )}

                {isAuthenticated && !dashboardLoading && (
                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        <div style={{ border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Run History</h3>
                            {runHistory.length === 0 ? (
                                <p style={{ color: '#666' }}>No runs yet.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', color: '#666' }}>
                                            <th style={{ paddingBottom: '0.5rem' }}>Run</th>
                                            <th style={{ paddingBottom: '0.5rem' }}>Status</th>
                                            <th style={{ paddingBottom: '0.5rem' }}>Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {runHistory.slice(0, 6).map((run) => (
                                            <tr key={run.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                                                <td style={{ padding: '0.5rem 0', fontWeight: 500 }}>{run.id}</td>
                                                <td style={{ padding: '0.5rem 0', textTransform: 'capitalize' }}>{run.status}</td>
                                                <td style={{ padding: '0.5rem 0', color: '#666' }}>{new Date(run.created_at).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div style={{ border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Budget Usage</h3>
                            {budgetSummary ? (
                                <>
                                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                        <div>
                                            <p style={{ margin: 0, color: '#666' }}>Daily Spend</p>
                                            <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                                                {formatCurrency(budgetSummary.status.daily_spend)}
                                            </p>
                                            <p style={{ margin: 0, color: budgetSummary.status.daily_warning ? '#d97706' : '#666' }}>
                                                Remaining: {formatCurrency(budgetSummary.status.daily_remaining)}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, color: '#666' }}>Monthly Spend</p>
                                            <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                                                {formatCurrency(budgetSummary.status.monthly_spend)}
                                            </p>
                                            <p style={{ margin: 0, color: budgetSummary.status.monthly_warning ? '#d97706' : '#666' }}>
                                                Remaining: {formatCurrency(budgetSummary.status.monthly_remaining)}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '1rem' }}>
                                        <p style={{ marginBottom: '0.5rem', color: '#666' }}>Spend by Model (Monthly)</p>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                            {Object.entries(budgetSummary.usage.by_model).map(([model, spend]) => (
                                                <li key={model} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                                                    <span>{model}</span>
                                                    <span style={{ fontWeight: 500 }}>{formatCurrency(spend)}</span>
                                                </li>
                                            ))}
                                            {Object.keys(budgetSummary.usage.by_model).length === 0 && (
                                                <li style={{ color: '#666' }}>No spend recorded yet.</li>
                                            )}
                                        </ul>
                                    </div>
                                </>
                            ) : (
                                <p style={{ color: '#666' }}>Budget data unavailable.</p>
                            )}
                        </div>

                        <div style={{ border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Error Trends (Last 7 Days)</h3>
                            {activityMetrics ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {activityMetrics.days.map((day) => {
                                        const totalErrors = Object.values(day.errors).reduce((sum, value) => sum + value, 0);
                                        const barWidth = Math.min(totalErrors * 20, 240);
                                        return (
                                            <div key={day.date} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{ width: '90px', fontSize: '0.8rem', color: '#666' }}>{day.date}</span>
                                                <div style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${barWidth}px`, height: '8px', backgroundColor: totalErrors > 0 ? '#ef4444' : '#a3a3a3' }} />
                                                </div>
                                                <span style={{ minWidth: '24px', textAlign: 'right', fontSize: '0.8rem' }}>{totalErrors}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p style={{ color: '#666' }}>No error data available.</p>
                            )}
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}
