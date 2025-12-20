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
        const task = await orchestrator.createTask(
            body.user_id,
            body.query,
            body.project_id
        );

        // Start execution in background
        orchestrator.executeTask(task.id).catch((err) => {
            app.log.error({ task_id: task.id, error: err }, 'Task execution failed');
        });

        return { task_id: task.id, status: task.status };
    } catch (error) {
        app.log.error(error, 'Failed to create task');
        reply.status(500);
        return { error: 'Failed to create task' };
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
    await app.close();
    await closeRedisClient();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
