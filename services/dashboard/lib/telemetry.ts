/**
 * Telemetry Utility
 * Centralized error logging and event tracking
 * Sends to console in dev, can integrate with external services in prod
 */

interface ErrorContext {
    componentStack?: string | null;
    source?: string;
    userId?: string;
    sessionId?: string;
    [key: string]: unknown;
}

interface EventContext {
    userId?: string;
    sessionId?: string;
    [key: string]: unknown;
}

// Generate session ID once per page load
const SESSION_ID = typeof window !== 'undefined'
    ? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
    : 'server';

/**
 * Log an error with context
 */
export function logError(error: Error, context: ErrorContext = {}): void {
    const errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        sessionId: SESSION_ID,
        ...context,
    };

    // Always log to console in development
    console.error('[Telemetry] Error:', errorData);

    // In production, send to external service
    if (process.env.NODE_ENV === 'production') {
        sendToTelemetryService('error', errorData).catch(console.error);
    }
}

/**
 * Log a custom event
 */
export function logEvent(
    eventName: string,
    eventData: Record<string, unknown> = {},
    context: EventContext = {}
): void {
    const event = {
        name: eventName,
        data: eventData,
        timestamp: new Date().toISOString(),
        sessionId: SESSION_ID,
        ...context,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
        console.log('[Telemetry] Event:', event);
    }

    // In production, send to external service
    if (process.env.NODE_ENV === 'production') {
        sendToTelemetryService('event', event).catch(console.error);
    }
}

/**
 * Log a performance metric
 */
export function logPerformance(
    metricName: string,
    durationMs: number,
    context: Record<string, unknown> = {}
): void {
    const metric = {
        name: metricName,
        duration: durationMs,
        timestamp: new Date().toISOString(),
        sessionId: SESSION_ID,
        ...context,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
        console.log('[Telemetry] Performance:', metric);
    }

    // In production, send to external service
    if (process.env.NODE_ENV === 'production') {
        sendToTelemetryService('performance', metric).catch(console.error);
    }
}

/**
 * Send telemetry to external service
 * Currently logs to console, can be extended to:
 * - Sentry
 * - LogRocket
 * - Custom backend
 */
async function sendToTelemetryService(
    type: 'error' | 'event' | 'performance',
    data: Record<string, unknown>
): Promise<void> {
    const telemetryEndpoint = process.env.NEXT_PUBLIC_TELEMETRY_URL;

    if (!telemetryEndpoint) {
        // No telemetry endpoint configured, just log
        return;
    }

    try {
        await fetch(telemetryEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, ...data }),
        });
    } catch (error) {
        // Don't throw - telemetry should never break the app
        console.warn('[Telemetry] Failed to send:', error);
    }
}

/**
 * Performance timing helper
 */
export function measurePerformance<T>(
    metricName: string,
    fn: () => T
): T {
    const start = performance.now();
    try {
        const result = fn();
        const duration = performance.now() - start;
        logPerformance(metricName, duration);
        return result;
    } catch (error) {
        const duration = performance.now() - start;
        logPerformance(`${metricName}_error`, duration);
        throw error;
    }
}

/**
 * Async performance timing helper
 */
export async function measurePerformanceAsync<T>(
    metricName: string,
    fn: () => Promise<T>
): Promise<T> {
    const start = performance.now();
    try {
        const result = await fn();
        const duration = performance.now() - start;
        logPerformance(metricName, duration);
        return result;
    } catch (error) {
        const duration = performance.now() - start;
        logPerformance(`${metricName}_error`, duration);
        throw error;
    }
}
