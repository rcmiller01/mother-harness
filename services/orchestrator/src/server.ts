/**
 * Mother Orchestrator Server
 * Main entry point for the orchestration service
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { getRedisClient, closeRedisClient, createAllIndexes, checkIndexesExist } from '@mother-harness/shared';
import { Orchestrator } from './orchestrator.js';
import { config } from './config.js';
import { getCostTracker } from './cost-tracker.js';
import { getActivityMetrics } from './activity-metrics.js';
import { startActivityMetricsConsumer } from './activity-metrics-consumer.js';

// Create Fastify instance
const app = Fastify({
    logger: {
        level: config.logLevel,
        transport: config.nodeEnv === 'development'
            ? { target: 'pino-pretty' }
            : undefined,
    },
});

// Orchestrator instance
let orchestrator: Orchestrator;
let metricsConsumer: ReturnType<typeof startActivityMetricsConsumer> | null = null;

// Register plugins
async function registerPlugins() {
    await app.register(cors, {
        origin: config.corsOrigin,
    });

    await app.register(websocket);
}

// Health check endpoint
app.get('/health', async () => {
    const redisOk = await checkRedisHealth();
    return {
        status: redisOk ? 'ok' : 'degraded',
        version: config.version,
        timestamp: new Date().toISOString(),
        redis: redisOk ? 'connected' : 'disconnected',
    };
});

// API routes
app.post('/api/ask', async (request, reply) => {
    const body = request.body as { query: string; project_id?: string; user_id: string };

    try {
        const { run, task } = await orchestrator.createRun(
            body.user_id,
            body.query,
            body.project_id
        );

        // Start execution in background
        orchestrator.executeRun(run.id).catch((err) => {
            app.log.error({ run_id: run.id, error: err }, 'Run execution failed');
        });

        return { run_id: run.id, task_id: task.id, status: run.status };
    } catch (error) {
        app.log.error(error, 'Failed to create task');
        reply.status(500);
        return { error: 'Failed to create task' };
    }
});

app.post('/api/runs', async (request, reply) => {
    const body = request.body as { query: string; project_id?: string; user_id: string };

    try {
        const { run, task } = await orchestrator.createRun(
            body.user_id,
            body.query,
            body.project_id
        );

        orchestrator.executeRun(run.id).catch((err) => {
            app.log.error({ run_id: run.id, error: err }, 'Run execution failed');
        });

        return { run_id: run.id, task_id: task.id, status: run.status };
    } catch (error) {
        app.log.error(error, 'Failed to submit run');
        reply.status(500);
        return { error: 'Failed to submit run' };
    }
});

app.get('/api/runs', async (request) => {
    const { user_id } = request.query as { user_id: string };
    return await orchestrator.listRuns(user_id);
});

app.get('/api/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
        const run = await orchestrator.getRun(id);
        if (!run) {
            reply.status(404);
            return { error: 'Run not found' };
        }
        return run;
    } catch (error) {
        app.log.error(error, 'Failed to get run');
        reply.status(500);
        return { error: 'Failed to get run' };
    }
});

app.get('/api/runs/:id/artifacts', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
        const artifacts = await orchestrator.getRunArtifacts(id);
        if (!artifacts) {
            reply.status(404);
            return { error: 'Run not found' };
        }
        return artifacts;
    } catch (error) {
        app.log.error(error, 'Failed to get run artifacts');
        reply.status(500);
        return { error: 'Failed to get run artifacts' };
    }
});

app.get('/api/artifacts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
        const artifact = await orchestrator.getArtifact(id);
        if (!artifact) {
            reply.status(404);
            return { error: 'Artifact not found' };
        }
        return artifact;
    } catch (error) {
        app.log.error(error, 'Failed to get artifact');
        reply.status(500);
        return { error: 'Failed to get artifact' };
    }
});

app.get('/api/task/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
        const task = await orchestrator.getTask(id);
        if (!task) {
            reply.status(404);
            return { error: 'Task not found' };
        }
        return task;
    } catch (error) {
        app.log.error(error, 'Failed to get task');
        reply.status(500);
        return { error: 'Failed to get task' };
    }
});

app.get('/api/projects', async (request) => {
    const { user_id } = request.query as { user_id: string };
    return await orchestrator.listProjects(user_id);
});

app.get('/api/approvals/pending', async (request) => {
    const { user_id } = request.query as { user_id: string };
    return await orchestrator.getPendingApprovals(user_id);
});

app.get('/api/metrics/activity', async (request, reply) => {
    const { user_id, days } = request.query as { user_id: string; days?: string };
    if (!user_id) {
        reply.status(400);
        return { error: 'user_id is required' };
    }
    const parsedDays = days ? Number.parseInt(days, 10) : 7;
    return await getActivityMetrics(user_id, Number.isNaN(parsedDays) ? 7 : parsedDays);
});

app.get('/api/budget', async (request, reply) => {
    const { user_id } = request.query as { user_id: string };
    if (!user_id) {
        reply.status(400);
        return { error: 'user_id is required' };
    }

    try {
        const tracker = getCostTracker();
        const [status, usage] = await Promise.all([
            tracker.getBudgetStatus(user_id),
            tracker.getUsageReport(user_id),
        ]);

        return { status, usage };
    } catch (error) {
        app.log.error(error, 'Failed to get budget metrics');
        reply.status(500);
        return { error: 'Failed to get budget metrics' };
    }
});

app.post('/api/approvals/:id/respond', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { approved, notes } = request.body as { approved: boolean; notes?: string };

    try {
        await orchestrator.respondToApproval(id, approved, notes);
        return { success: true };
    } catch (error) {
        app.log.error(error, 'Failed to respond to approval');
        reply.status(500);
        return { error: 'Failed to respond to approval' };
    }
});

// WebSocket endpoint for real-time task updates
app.get('/ws', { websocket: true }, (connection, request) => {
    const { socket } = connection;
    const taskId = new URL(request.url, 'http://localhost').searchParams.get('task_id');

    app.log.info({ task_id: taskId }, 'WebSocket connection established');

    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            app.log.debug({ data }, 'WebSocket message received');
            
            // Handle ping/pong for keepalive
            if (data.type === 'ping') {
                socket.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (error) {
            app.log.error(error, 'Failed to parse WebSocket message');
        }
    });

    socket.on('close', () => {
        app.log.info({ task_id: taskId }, 'WebSocket connection closed');
    });

    socket.on('error', (error) => {
        app.log.error({ error, task_id: taskId }, 'WebSocket error');
    });

    // Send initial connection confirmation
    socket.send(JSON.stringify({ 
        type: 'connected', 
        task_id: taskId 
    }));
});

// Check Redis health
async function checkRedisHealth(): Promise<boolean> {
    try {
        const redis = getRedisClient();
        await redis.ping();
        return true;
    } catch {
        return false;
    }
}

// Initialize Redis indexes if needed
async function initializeRedis() {
    const redis = getRedisClient({ url: config.redisUrl });

    const indexesExist = await checkIndexesExist(redis);
    if (!indexesExist) {
        app.log.info('Creating Redis indexes...');
        await createAllIndexes(redis);
        app.log.info('Redis indexes created');
    }
}

// Start server
async function start() {
    try {
        await registerPlugins();
        await initializeRedis();

        // Initialize orchestrator
        orchestrator = new Orchestrator();
        metricsConsumer = startActivityMetricsConsumer();

        await app.listen({
            port: config.port,
            host: '0.0.0.0'
        });

        app.log.info(`Mother Orchestrator running on port ${config.port}`);
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }
}

// Graceful shutdown
async function shutdown() {
    app.log.info('Shutting down...');
    if (metricsConsumer) {
        await metricsConsumer.stop();
    }
    await app.close();
    await closeRedisClient();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
