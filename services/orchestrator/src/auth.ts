/**
 * Authentication Middleware
 * JWT-based authentication for API endpoints
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getRedisClient } from '@mother-harness/shared';

/** JWT payload structure */
export interface JWTPayload {
    sub: string;          // User ID
    email?: string;
    name?: string;
    roles: string[];
    iat: number;
    exp: number;
}

/** User session */
export interface UserSession {
    user_id: string;
    email?: string;
    name?: string;
    roles: string[];
    created_at: string;
    last_activity: string;
}

/** API Key record */
export interface APIKey {
    id: string;
    key_hash: string;
    user_id: string;
    name: string;
    permissions: string[];
    rate_limit: number;
    created_at: string;
    last_used_at?: string;
    expires_at?: string;
    revoked: boolean;
}

/**
 * Register authentication plugin
 */
export async function registerAuth(app: FastifyInstance): Promise<void> {
    const redis = getRedisClient();
    const jwtSecret = process.env['JWT_SECRET'] ?? 'development-secret-change-in-production';

    // Decorate request with user
    app.decorateRequest('user', null);

    // Authentication hook
    app.addHook('onRequest', async (request, reply) => {
        // Skip auth for health endpoint
        if (request.url === '/health') return;

        // Skip OPTIONS requests
        if (request.method === 'OPTIONS') return;

        // Try Bearer token first
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const user = await validateJWT(token, jwtSecret);
            if (user) {
                (request as any).user = user;
                return;
            }
        }

        // Try API key
        const apiKey = request.headers['x-api-key'] as string | undefined;
        if (apiKey) {
            const keyData = await validateAPIKey(redis, apiKey);
            if (keyData) {
                (request as any).user = {
                    user_id: keyData.user_id,
                    roles: keyData.permissions,
                };
                return;
            }
        }

        // No valid auth - for now, allow anonymous with limited access
        // In production, this should return 401
        (request as any).user = {
            user_id: 'anonymous',
            roles: ['read'],
        };
    });
}

/**
 * Validate JWT token
 */
async function validateJWT(token: string, secret: string): Promise<UserSession | null> {
    try {
        // Simple JWT validation (in production, use jsonwebtoken library)
        const [headerB64, payloadB64, signature] = token.split('.');

        if (!headerB64 || !payloadB64 || !signature) {
            return null;
        }

        // Decode payload
        const payload = JSON.parse(
            Buffer.from(payloadB64, 'base64url').toString('utf-8')
        ) as JWTPayload;

        // Check expiration
        if (payload.exp && payload.exp < Date.now() / 1000) {
            return null;
        }

        // TODO: Verify signature with secret
        // For now, trust the payload structure

        return {
            user_id: payload.sub,
            email: payload.email,
            name: payload.name,
            roles: payload.roles,
            created_at: new Date(payload.iat * 1000).toISOString(),
            last_activity: new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

/**
 * Validate API key
 */
async function validateAPIKey(
    redis: ReturnType<typeof getRedisClient>,
    apiKey: string
): Promise<APIKey | null> {
    try {
        // Hash the API key to look up
        const keyHash = hashAPIKey(apiKey);

        const keyData = await redis.get(`apikey:${keyHash}`);
        if (!keyData) return null;

        const key = JSON.parse(keyData) as APIKey;

        // Check if revoked
        if (key.revoked) return null;

        // Check expiration
        if (key.expires_at && new Date(key.expires_at) < new Date()) {
            return null;
        }

        // Update last used
        key.last_used_at = new Date().toISOString();
        await redis.set(`apikey:${keyHash}`, JSON.stringify(key));

        return key;
    } catch {
        return null;
    }
}

/**
 * Hash API key for storage lookup
 */
function hashAPIKey(key: string): string {
    // Simple hash - in production use crypto.createHash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

/**
 * Role-based access control middleware
 */
export function requireRole(...roles: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = (request as any).user as UserSession | undefined;

        if (!user) {
            reply.status(401).send({ error: 'Authentication required' });
            return;
        }

        const hasRole = roles.some(role => user.roles.includes(role));
        if (!hasRole) {
            reply.status(403).send({ error: 'Insufficient permissions' });
            return;
        }
    };
}

/**
 * Rate limiting middleware
 */
export function rateLimit(options: {
    max: number;
    windowMs: number;
}) {
    const requests = new Map<string, { count: number; resetAt: number }>();

    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = (request as any).user as UserSession | undefined;
        const key = user?.user_id ?? request.ip;

        const now = Date.now();
        const record = requests.get(key);

        if (!record || record.resetAt < now) {
            requests.set(key, { count: 1, resetAt: now + options.windowMs });
            return;
        }

        record.count++;

        if (record.count > options.max) {
            reply.status(429).send({
                error: 'Too many requests',
                retry_after: Math.ceil((record.resetAt - now) / 1000),
            });
            return;
        }
    };
}
