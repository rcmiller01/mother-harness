/**
 * Login Page
 * Simple login form that doesn't pollute other components
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import styles from './login.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { login, error, isAuthenticated, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/';

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated && !loading) {
            router.push(redirectTo);
        }
    }, [isAuthenticated, loading, router, redirectTo]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const success = await login(email, password);

        if (success) {
            router.push(redirectTo);
        }

        setIsSubmitting(false);
    };

    // Show loading while checking auth
    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Loading...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Mother-Harness</h1>
                    <p className={styles.subtitle}>Sign in to Mission Control</p>
                </div>

                {error && (
                    <div className={styles.error}>
                        {error}
                    </div>
                )}

                <div className={styles.field}>
                    <label htmlFor="email" className={styles.label}>Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={styles.input}
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="password" className={styles.label}>Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={styles.input}
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                    />
                </div>

                <button
                    type="submit"
                    className={styles.button}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>

                <div className={styles.devNote}>
                    <p>Dev mode: Set <code>DEV_API_KEY</code> env var to bypass auth</p>
                </div>
            </form>
        </div>
    );
}
