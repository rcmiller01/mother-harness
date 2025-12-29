/**
 * Auth Headers Utility
 * Centralized token management for API requests
 * Supports both JWT and dev-mode API keys
 */

const TOKEN_KEY = 'mother-harness-token';
const DEV_API_KEY = process.env.NEXT_PUBLIC_DEV_API_KEY;

/**
 * Get stored auth token
 */
export function getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store auth token
 */
export function storeToken(token: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, token);
    }
}

/**
 * Clear auth token
 */
export function clearToken(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
    }
}

/**
 * Get auth headers for API requests
 * Automatically handles:
 * - JWT Bearer token (from localStorage)
 * - Dev mode API key (from env var, for homelab)
 */
export function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // Priority 1: JWT token
    const token = getStoredToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    // Priority 2: Dev mode API key (for homelab without auth)
    if (DEV_API_KEY) {
        headers['X-API-Key'] = DEV_API_KEY;
        return headers;
    }

    return headers;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
    const token = getStoredToken();
    if (!token) return false;

    // Check if token is expired
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;

        const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && payload.exp < Date.now() / 1000) {
            clearToken();
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Get user info from token
 */
export function getUserFromToken(): { id: string; email?: string; name?: string; roles: string[] } | null {
    const token = getStoredToken();
    if (!token) return null;

    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));

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
