/**
 * Tool Executor
 * Executes deterministic tools
 */

import { type DeterministicTool, type ToolResult, getToolRegistry } from './tool-registry.js';
import * as path from 'path';

/** Tool handler function type */
type ToolHandler = (inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;

/** Registered handlers */
const handlers: Map<string, ToolHandler> = new Map();

/**
 * Register a tool handler
 */
export function registerHandler(name: string, handler: ToolHandler): void {
    handlers.set(name, handler);
}

/**
 * Execute a tool
 */
export async function executeTool(
    tool: DeterministicTool,
    inputs: Record<string, unknown>
): Promise<ToolResult> {
    const startTime = Date.now();
    const registry = getToolRegistry();

    try {
        // Validate required inputs
        for (const param of tool.inputs) {
            if (param.required && !(param.name in inputs)) {
                throw new Error(`Missing required input: ${param.name}`);
            }
        }

        // Get handler
        const handler = handlers.get(tool.handler);
        if (!handler) {
            throw new Error(`Handler not found: ${tool.handler}`);
        }

        // Execute with timeout
        const result = await Promise.race([
            handler(inputs),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Tool timeout')), tool.timeout_ms)
            ),
        ]);

        const duration = Date.now() - startTime;

        // Update stats
        await registry.updateStats(tool.name, true, duration);

        return {
            success: true,
            output: result,
            duration_ms: duration,
            tool_id: tool.id,
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Update stats
        await registry.updateStats(tool.name, false, duration);

        return {
            success: false,
            error: errorMessage,
            duration_ms: duration,
            tool_id: tool.id,
        };
    }
}

// ============ Built-in Handlers ============

/** Git status handler */
registerHandler('handleGitStatus', async (inputs) => {
    // TODO: Implement actual git status
    const repoPath = (inputs['path'] as string) ?? process.cwd();

    return {
        branch: 'main',
        modified: [],
        staged: [],
        untracked: [],
    };
});

/** File read handler */
registerHandler('handleFileRead', async (inputs) => {
    const filePath = inputs['path'] as string;
    if (!filePath) {
        throw new Error('File path is required');
    }

    // TODO: Implement actual file reading with security checks
    // For now, return placeholder
    return {
        content: `// Contents of ${filePath}`,
        size: 0,
    };
});

/** Run tests handler */
registerHandler('handleRunTests', async (inputs) => {
    const projectPath = (inputs['path'] as string) ?? process.cwd();
    const filter = inputs['filter'] as string | undefined;

    // TODO: Implement actual test running
    // Detect test framework and execute
    return {
        passed: true,
        total: 0,
        passed_count: 0,
        failed_count: 0,
        failures: [],
    };
});

/** Lint check handler */
registerHandler('handleLintCheck', async (inputs) => {
    const targetPath = inputs['path'] as string;
    if (!targetPath) {
        throw new Error('Path is required');
    }

    // TODO: Implement actual linting
    return {
        issues: [],
        fixable: 0,
        errors: 0,
        warnings: 0,
    };
});
