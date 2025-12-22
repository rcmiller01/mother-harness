/**
 * Activity Stream Logger
 * Writes run lifecycle events to Redis Streams
 */

import { getRedisClient } from '@mother-harness/shared';
import { getActivityEventTaxonomy, type ActivityEventType } from './event-taxonomy.js';
import { logger } from './logger.js';

export interface ActivityEvent {
    type: ActivityEventType;
    run_id: string;
    task_id: string;
    project_id: string;
    user_id: string;
    timestamp?: string;
    details?: Record<string, unknown>;
}

const STREAM_KEY = 'stream:activity';

export async function logActivity(event: ActivityEvent): Promise<void> {
    const redis = getRedisClient();
    const timestamp = event.timestamp ?? new Date().toISOString();
    const payload = JSON.stringify(event.details ?? {});
    const taxonomy = getActivityEventTaxonomy(event.type);

    await redis.xadd(
        STREAM_KEY,
        '*',
        'event_type',
        event.type,
        'event_category',
        taxonomy.category,
        'event_action',
        taxonomy.action,
        'event_outcome',
        taxonomy.outcome,
        'event_severity',
        taxonomy.severity,
        'run_id',
        event.run_id,
        'task_id',
        event.task_id,
        'project_id',
        event.project_id,
        'user_id',
        event.user_id,
        'timestamp',
        timestamp,
        'details',
        payload
    );

    logger.event('info', {
        name: event.type,
        category: taxonomy.category,
        action: taxonomy.action,
        outcome: taxonomy.outcome,
        severity: taxonomy.severity,
    }, 'Activity event logged', {
        run_id: event.run_id,
        task_id: event.task_id,
        project_id: event.project_id,
        user_id: event.user_id,
    });
}
