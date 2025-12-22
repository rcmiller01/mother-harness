/**
 * Activity Stream Logger
 * Writes run lifecycle events to Redis Streams
 */

import { getRedisClient } from '@mother-harness/shared';

export type ActivityEventType =
    | 'run_created'
    | 'run_started'
    | 'run_waiting_approval'
    | 'run_terminated'
    | 'step_started'
    | 'step_completed'
    | 'step_failed'
    | 'approval_requested'
    | 'approval_approved'
    | 'approval_rejected';

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

    await redis.xadd(
        STREAM_KEY,
        '*',
        'event_type',
        event.type,
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
}
