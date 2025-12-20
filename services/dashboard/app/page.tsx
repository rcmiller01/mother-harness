'use client';

import { useState } from 'react';

export default function HomePage() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ task_id: string; status: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    user_id: 'user-1', // TODO: Get from auth
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

    return (
        <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Mother-Harness</h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
                Multi-agent orchestration for research, coding, analysis, and design.
            </p>

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
