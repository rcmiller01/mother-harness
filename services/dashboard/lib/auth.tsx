'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

/** User info from auth */
interface User {
    id: string;
    email?: string;
    name?: string;
    roles: string[];
}

/** Auth context value */
interface AuthContextValue {
    user: User | null;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Get stored token */
function getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('mother-harness-token');
}

/** Store token */
function storeToken(token: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('mother-harness-token', token);
    }
}

/** Clear token */
function clearToken(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('mother-harness-token');
    }
}

/** Decode JWT payload (no verification - that happens server-side) */
function decodeToken(token: string): User | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));

        // Check expiration
        if (payload.exp && payload.exp < Date.now() / 1000) {
            return null;
        }

        return {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            roles: payload.roles ?? ['user'],
        };
    } catch {
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check for existing token on mount
    useEffect(() => {
        const token = getStoredToken();
        if (token) {
            const decoded = decodeToken(token);
            if (decoded) {
                setUser(decoded);
            } else {
                clearToken();
            }
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.error ?? 'Login failed');
                setLoading(false);
                return false;
            }

            const { token } = await response.json();
            storeToken(token);

            const decoded = decodeToken(token);
            setUser(decoded);
            setLoading(false);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
            setLoading(false);
            return false;
        }
    }, []);

    const logout = useCallback(async (): Promise<void> => {
        clearToken();
        setUser(null);

        // Optionally call server-side logout
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // Ignore - token is already cleared locally
        }
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            login,
            logout,
            isAuthenticated: !!user,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

/** Get auth headers for API requests */
export function getAuthHeaders(): Record<string, string> {
    const token = getStoredToken();
    if (token) {
        return { Authorization: `Bearer ${token}` };
    }
    return {};
}
