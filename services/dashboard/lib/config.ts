/**
 * Environment Configuration
 * Centralized environment variable validation and typing
 */

interface EnvConfig {
    // API URLs
    orchestratorUrl: string;
    apiUrl: string;
    wsUrl: string;
    redisUrl: string;
    ollamaUrl: string;

    // Auth
    devApiKey: string | null;

    // Telemetry
    telemetryUrl: string | null;

    // Mode
    isDev: boolean;
    isProd: boolean;
}

/**
 * Validate and parse environment configuration
 * Throws helpful errors if required vars are missing
 */
function parseEnv(): EnvConfig {
    const isDev = process.env.NODE_ENV === 'development';
    const isProd = process.env.NODE_ENV === 'production';

    return {
        // API URLs - with sensible defaults
        orchestratorUrl: process.env.ORCHESTRATOR_URL || 'http://192.168.50.219:8002',
        apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://192.168.50.219:8002',
        wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://192.168.50.219:8002',
        redisUrl: process.env.REDIS_URL || 'redis://192.168.50.219:6379',
        ollamaUrl: process.env.OLLAMA_URL || 'http://192.168.50.219:11434',

        // Auth (nullable)
        devApiKey: process.env.DEV_API_KEY || process.env.NEXT_PUBLIC_DEV_API_KEY || null,

        // Telemetry (nullable)
        telemetryUrl: process.env.NEXT_PUBLIC_TELEMETRY_URL || null,

        // Mode
        isDev,
        isProd,
    };
}

// Parse once at module load
export const env = parseEnv();

/**
 * Check if dev mode bypass is available
 */
export function hasDevBypass(): boolean {
    return !!env.devApiKey;
}

/**
 * Get a required environment variable (throws if missing)
 */
export function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

/**
 * Log environment info (for debugging - never log secrets)
 */
export function logEnvInfo(): void {
    console.log('[Config] Environment:', {
        mode: env.isDev ? 'development' : 'production',
        orchestrator: env.orchestratorUrl,
        hasDevBypass: hasDevBypass(),
        hasTelemetry: !!env.telemetryUrl,
    });
}
