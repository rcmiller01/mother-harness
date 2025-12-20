/**
 * Test Utilities
 * Shared testing helpers and fixtures
 */

import type { Task, Project, AgentType, TodoItem } from '../types/index.js';

/** Create a mock task for testing */
export function createMockTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 'task-test-123',
        project_id: 'project-test-123',
        user_id: 'user-test-123',
        query: 'Test query',
        status: 'pending',
        todo_list: [],
        artifacts: [],
        termination: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}

/** Create a mock project for testing */
export function createMockProject(overrides: Partial<Project> = {}): Project {
    return {
        id: 'project-test-123',
        name: 'Test Project',
        user_id: 'user-test-123',
        recent_messages: [],
        session_summaries: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}

/** Create a mock todo item for testing */
export function createMockTodoItem(overrides: Partial<TodoItem> = {}): TodoItem {
    return {
        id: 'todo-test-123',
        description: 'Test todo item',
        agent: 'researcher' as AgentType,
        status: 'pending',
        inputs: 'Test input',
        outputs: undefined,
        requires_approval: false,
        ...overrides,
    };
}

/** Wait for a condition to be true */
export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    options: { timeout?: number; interval?: number } = {}
): Promise<void> {
    const timeout = options.timeout ?? 5000;
    const interval = options.interval ?? 100;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Timeout waiting for condition');
}

/** Mock Redis client for testing */
export function createMockRedis(): Record<string, jest.Mock | ((...args: unknown[]) => unknown)> {
    const store = new Map<string, string>();

    return {
        get: jest.fn((key: string) => store.get(key) ?? null),
        set: jest.fn((key: string, value: string) => {
            store.set(key, value);
            return 'OK';
        }),
        del: jest.fn((key: string) => {
            const existed = store.has(key);
            store.delete(key);
            return existed ? 1 : 0;
        }),
        keys: jest.fn((pattern: string) => {
            const regex = new RegExp(pattern.replace('*', '.*'));
            return Array.from(store.keys()).filter(k => regex.test(k));
        }),
        exists: jest.fn((key: string) => store.has(key) ? 1 : 0),
        expire: jest.fn(() => 1),
        hget: jest.fn(() => null),
        hset: jest.fn(() => 1),
        hgetall: jest.fn(() => ({})),
        hincrbyfloat: jest.fn(() => 0),
        xadd: jest.fn(() => 'stream-id'),
        xread: jest.fn(() => null),
        xreadgroup: jest.fn(() => null),
        xack: jest.fn(() => 1),
        xgroup: jest.fn(() => 'OK'),
        ping: jest.fn(() => 'PONG'),
        quit: jest.fn(() => 'OK'),
        _store: store, // Expose for assertions
    };
}

/** Mock Redis JSON client for testing */
export function createMockRedisJSON(): Record<string, jest.Mock | ((...args: unknown[]) => unknown)> {
    const store = new Map<string, unknown>();

    return {
        get: jest.fn(<T>(key: string): T | null => {
            return (store.get(key) as T) ?? null;
        }),
        set: jest.fn((key: string, path: string, value: unknown) => {
            if (path === '$') {
                store.set(key, value);
            } else {
                // Handle nested paths (simplified)
                const obj = store.get(key) as Record<string, unknown> | undefined;
                if (obj) {
                    const pathParts = path.replace('$.', '').split('.');
                    let target = obj;
                    for (let i = 0; i < pathParts.length - 1; i++) {
                        target = target[pathParts[i]!] as Record<string, unknown>;
                    }
                    target[pathParts[pathParts.length - 1]!] = value;
                }
            }
            return 'OK';
        }),
        del: jest.fn((key: string) => {
            const existed = store.has(key);
            store.delete(key);
            return existed ? 1 : 0;
        }),
        keys: jest.fn((pattern: string) => {
            const regex = new RegExp(pattern.replace('*', '.*'));
            return Array.from(store.keys()).filter(k => regex.test(k));
        }),
        exists: jest.fn((key: string) => store.has(key) ? 1 : 0),
        _store: store,
    };
}
