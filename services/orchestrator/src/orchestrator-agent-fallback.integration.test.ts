/**
 * Integration tests for local agent execution fallback
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Redis and dependencies
const redisStore = new Map<string, unknown>();

vi.mock('@mother-harness/shared', async () => {
    const actual = await vi.importActual('@mother-harness/shared');
    return {
        ...actual,
        getRedisJSON: () => ({
            get: async (key: string) => redisStore.get(key),
            set: async (key: string, path: string, value: unknown) => {
                redisStore.set(key, value);
            },
            keys: async (pattern: string) => {
                const allKeys = Array.from(redisStore.keys());
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                return allKeys.filter(key => regex.test(key));
            },
        }),
        getRedisClient: () => ({
            xadd: vi.fn(async () => 'test-event-id'),
            quit: vi.fn(async () => undefined),
        }),
        getLLMClient: () => ({
            chat: vi.fn(),
        }),
        getRoleRegistry: () => ({
            getContract: vi.fn(async () => ({
                role: 'test',
                description: 'test',
                required_inputs: [],
                optional_inputs: [],
                required_outputs: [],
                optional_outputs: [],
                required_artifacts: [],
                optional_artifacts: [],
                allowed_artifact_types: [],
                max_cost_usd: 1.0,
            })),
        }),
        getContractEnforcer: () => ({
            validateInputAllowlist: vi.fn(async () => ({ valid: true, errors: [] })),
            validateRequiredArtifacts: vi.fn(async () => ({ valid: true, errors: [] })),
            validateOutputs: vi.fn(async () => ({ valid: true, errors: [] })),
        }),
    };
});

vi.mock('@mother-harness/agents', () => ({
    createAgent: (agentType: string) => ({
        execute: vi.fn(async () => ({
            result: {
                answer: 'Test result from local agent',
                sources: ['local'],
            },
            artifacts: [],
            explanation: 'Local agent execution',
            tokens_used: 100,
            duration_ms: 50,
            model_used: 'local-model',
        })),
    }),
}));

import { Orchestrator, clearAgentExecutors, hasAgentExecutor } from './orchestrator.js';

describe('Orchestrator local agent fallback', () => {
    beforeEach(() => {
        redisStore.clear();
        clearAgentExecutors();
        vi.clearAllMocks();
    });

    it('executes agent locally when no executor is registered and workflow fails', async () => {
        // Mock fetch to simulate workflow failure
        const fetchMock = vi.fn(async () => ({
            ok: false,
            status: 500,
            text: async () => 'Workflow unavailable',
        }));
        vi.stubGlobal('fetch', fetchMock);

        const orchestrator = new Orchestrator();
        const task = await orchestrator.createTask('user-local-test', 'Test local execution');

        expect(hasAgentExecutor('researcher')).toBe(false);

        await orchestrator.executeTask(task.id);

        const result = await orchestrator.getTask(task.id);

        expect(result?.status).toBe('completed');
        expect(result?.todo_list[0]?.status).toBe('completed');
        expect(result?.todo_list[0]?.result?.outputs).toMatchObject({
            answer: 'Test result from local agent',
        });
    });

    it('uses workflow when available before falling back to local agent', async () => {
        const workflowResponse = {
            success: true,
            outputs: { answer: 'Workflow result' },
            artifacts: [],
            tokens_used: 200,
        };

        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => workflowResponse,
        }));
        vi.stubGlobal('fetch', fetchMock);

        const orchestrator = new Orchestrator();
        const task = await orchestrator.createTask('user-workflow-test', 'Test workflow priority');

        await orchestrator.executeTask(task.id);

        const result = await orchestrator.getTask(task.id);

        expect(fetchMock).toHaveBeenCalled();
        expect(result?.status).toBe('completed');
        expect(result?.todo_list[0]?.result?.outputs).toMatchObject({
            answer: 'Workflow result',
        });
    });

    it('falls back to local agent when workflow returns error', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                success: false,
                error: { message: 'Workflow execution failed' },
            }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        const orchestrator = new Orchestrator();
        const task = await orchestrator.createTask('user-fallback-test', 'Test error fallback');

        await orchestrator.executeTask(task.id);

        const result = await orchestrator.getTask(task.id);

        expect(fetchMock).toHaveBeenCalled();
        expect(result?.status).toBe('completed');
        expect(result?.todo_list[0]?.status).toBe('completed');
        expect(result?.todo_list[0]?.result?.outputs).toMatchObject({
            answer: 'Test result from local agent',
        });
    });

    it('uses local agent for all supported agent types', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: false,
            status: 503,
        }));
        vi.stubGlobal('fetch', fetchMock);

        const orchestrator = new Orchestrator();

        // Test different agent types
        const agentTypes = ['researcher', 'coder', 'analyst', 'critic'];

        for (const agentType of agentTypes) {
            redisStore.clear();
            const task = await orchestrator.createTask(
                'user-test',
                `Test ${agentType} local execution`
            );

            await orchestrator.executeTask(task.id);

            const result = await orchestrator.getTask(task.id);
            expect(result?.status).toBe('completed');
            expect(result?.todo_list[0]?.result?.outputs).toBeDefined();
        }
    });
});
