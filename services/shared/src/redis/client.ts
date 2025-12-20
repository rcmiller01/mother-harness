/**
 * Redis Client
 * Singleton Redis connection with JSON operations
 */

import Redis from 'ioredis';

/** Redis connection configuration */
export interface RedisConfig {
    url?: string;                  // Full Redis URL (overrides other options)
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
}

/** Default configuration */
const DEFAULT_CONFIG: RedisConfig = {
    host: 'localhost',
    port: 6379,
    db: 0,
};

/** Redis client singleton */
let client: Redis | null = null;

/**
 * Get or create Redis client instance
 */
export function getRedisClient(config: RedisConfig = {}): Redis {
    if (client) return client;

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    if (mergedConfig.url) {
        client = new Redis(mergedConfig.url);
    } else {
        client = new Redis({
            host: mergedConfig.host,
            port: mergedConfig.port,
            password: mergedConfig.password,
            db: mergedConfig.db,
            keyPrefix: mergedConfig.keyPrefix,
        });
    }

    // Error handling
    client.on('error', (err) => {
        console.error('[Redis] Connection error:', err.message);
    });

    client.on('connect', () => {
        console.log('[Redis] Connected successfully');
    });

    return client;
}

/**
 * Close Redis connection
 */
export async function closeRedisClient(): Promise<void> {
    if (client) {
        await client.quit();
        client = null;
        console.log('[Redis] Connection closed');
    }
}

/**
 * RedisJSON operations wrapper
 * Note: Requires Redis Stack with RedisJSON module
 */
export class RedisJSON {
    private redis: Redis;

    constructor(redisClient?: Redis) {
        this.redis = redisClient ?? getRedisClient();
    }

    /**
     * Set a JSON value at key
     */
    async set<T>(key: string, path: string, value: T): Promise<'OK'> {
        const result = await this.redis.call(
            'JSON.SET',
            key,
            path,
            JSON.stringify(value)
        );
        return result as 'OK';
    }

    /**
     * Get a JSON value from key
     */
    async get<T>(key: string, path: string = '$'): Promise<T | null> {
        const result = await this.redis.call('JSON.GET', key, path);
        if (!result) return null;
        const parsed = JSON.parse(result as string);
        // JSON.GET with $ returns an array, extract first element
        return path === '$' ? parsed[0] : parsed;
    }

    /**
     * Delete a key or path within a key
     */
    async del(key: string, path: string = '$'): Promise<number> {
        const result = await this.redis.call('JSON.DEL', key, path);
        return result as number;
    }

    /**
     * Append to an array at path
     */
    async arrAppend<T>(key: string, path: string, ...values: T[]): Promise<number> {
        const args = values.map(v => JSON.stringify(v));
        const result = await this.redis.call('JSON.ARRAPPEND', key, path, ...args);
        return result as number;
    }

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        const result = await this.redis.exists(key);
        return result === 1;
    }

    /**
     * Get all keys matching pattern
     */
    async keys(pattern: string): Promise<string[]> {
        return await this.redis.keys(pattern);
    }
}

/**
 * Get RedisJSON instance
 */
export function getRedisJSON(redisClient?: Redis): RedisJSON {
    return new RedisJSON(redisClient);
}
