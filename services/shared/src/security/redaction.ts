/**
 * PII Redaction Utilities
 */

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    {
        pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
        replacement: '[REDACTED_EMAIL]',
    },
    {
        pattern: /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
        replacement: '[REDACTED_PHONE]',
    },
    {
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        replacement: '[REDACTED_SSN]',
    },
    {
        pattern: /\b(?:\d[ -]*?){13,16}\b/g,
        replacement: '[REDACTED_CARD]',
    },
];

/**
 * Redact PII from a string
 */
export function redactPII(input: string): string {
    return PII_PATTERNS.reduce(
        (value, { pattern, replacement }) => value.replace(pattern, replacement),
        input
    );
}

/**
 * Redact PII from an unknown structure
 */
export function redactPIIFromObject<T>(value: T): T {
    if (typeof value === 'string') {
        return redactPII(value) as T;
    }

    if (Array.isArray(value)) {
        return value.map(item => redactPIIFromObject(item)) as T;
    }

    if (value && typeof value === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            sanitized[key] = redactPIIFromObject(entry);
        }
        return sanitized as T;
    }

    return value;
}
