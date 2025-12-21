/**
 * Resource Budget Guards
 * Enforces resource limits per-run, per-user, and globally
 */

import { getRedisClient } from '@mother-harness/shared';

/** Budget types */
export type BudgetScope = 'run' | 'user' | 'global';

/** Resource types */
export type ResourceType =
    | 'tokens'           // LLM tokens
    | 'api_calls'        // External API calls
    | 'tool_executions'  // Tool runs
    | 'agent_invocations'// Agent calls
    | 'embeddings'       // Embedding generations
    | 'storage_bytes';   // Storage used

/** Budget definition */
export interface ResourceBudget {
    scope: BudgetScope;
    scope_id: string;    // run_id, user_id, or 'global'
    limits: Record<ResourceType, number>;
    used: Record<ResourceType, number>;
    warnings_sent: ResourceType[];
    created_at: string;
    updated_at: string;
}

/** Default limits */
const DEFAULT_LIMITS: Record<BudgetScope, Record<ResourceType, number>> = {
    run: {
        tokens: 100000,        // 100k tokens per run
        api_calls: 50,         // 50 API calls per run
        tool_executions: 100,  // 100 tool executions
        agent_invocations: 20, // 20 agent invocations
        embeddings: 1000,      // 1000 embeddings
        storage_bytes: 10 * 1024 * 1024, // 10MB
    },
    user: {
        tokens: 1000000,       // 1M tokens per day
        api_calls: 500,        // 500 API calls per day
        tool_executions: 1000, // 1000 tools per day
        agent_invocations: 200,// 200 agents per day
        embeddings: 10000,     // 10k embeddings per day
        storage_bytes: 100 * 1024 * 1024, // 100MB
    },
    global: {
        tokens: 10000000,      // 10M tokens global
        api_calls: 5000,       // 5000 API calls
        tool_executions: 50000,// 50k tools
        agent_invocations: 10000,
        embeddings: 100000,
        storage_bytes: 1024 * 1024 * 1024, // 1GB
    },
};

/** Warning threshold (80% of limit) */
const WARNING_THRESHOLD = 0.8;

export class ResourceBudgetGuard {
    private redis = getRedisClient();
    private readonly keyPrefix = 'budget:';

    /**
     * Get or create budget for a scope
     */
    async getBudget(scope: BudgetScope, scopeId: string): Promise<ResourceBudget> {
        const key = `${this.keyPrefix}${scope}:${scopeId}`;
        const existing = await this.redis.get(key);

        if (existing) {
            return JSON.parse(existing) as ResourceBudget;
        }

        // Create new budget
        const budget: ResourceBudget = {
            scope,
            scope_id: scopeId,
            limits: { ...DEFAULT_LIMITS[scope] },
            used: {
                tokens: 0,
                api_calls: 0,
                tool_executions: 0,
                agent_invocations: 0,
                embeddings: 0,
                storage_bytes: 0,
            },
            warnings_sent: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        await this.saveBudget(budget);
        return budget;
    }

    /**
     * Check if resource use is allowed
     */
    async canUse(
        scope: BudgetScope,
        scopeId: string,
        resource: ResourceType,
        amount: number = 1
    ): Promise<{ allowed: boolean; remaining: number; warning?: string }> {
        const budget = await this.getBudget(scope, scopeId);
        const limit = budget.limits[resource] ?? 0;
        const used = budget.used[resource] ?? 0;
        const remaining = limit - used;

        if (amount > remaining) {
            return {
                allowed: false,
                remaining,
                warning: `Budget exhausted: ${resource} limit reached`,
            };
        }

        // Check for warning threshold
        const newUsed = used + amount;
        const usagePercent = newUsed / limit;

        if (usagePercent >= WARNING_THRESHOLD && !budget.warnings_sent.includes(resource)) {
            return {
                allowed: true,
                remaining: remaining - amount,
                warning: `Budget warning: ${resource} at ${Math.round(usagePercent * 100)}% of limit`,
            };
        }

        return { allowed: true, remaining: remaining - amount };
    }

    /**
     * Record resource usage
     */
    async recordUsage(
        scope: BudgetScope,
        scopeId: string,
        resource: ResourceType,
        amount: number = 1
    ): Promise<void> {
        const budget = await this.getBudget(scope, scopeId);

        budget.used[resource] = (budget.used[resource] ?? 0) + amount;
        budget.updated_at = new Date().toISOString();

        // Check for warning
        const limit = budget.limits[resource] ?? 0;
        const usagePercent = budget.used[resource] / limit;

        if (usagePercent >= WARNING_THRESHOLD && !budget.warnings_sent.includes(resource)) {
            budget.warnings_sent.push(resource);
            await this.sendWarning(scope, scopeId, resource, usagePercent);
        }

        await this.saveBudget(budget);
    }

    /**
     * Check all scopes for a run
     */
    async checkAllScopes(
        runId: string,
        userId: string,
        resource: ResourceType,
        amount: number = 1
    ): Promise<{ allowed: boolean; blockedBy?: BudgetScope; warning?: string }> {
        // Check run budget
        const runCheck = await this.canUse('run', runId, resource, amount);
        if (!runCheck.allowed) {
            return { allowed: false, blockedBy: 'run', warning: runCheck.warning };
        }

        // Check user budget
        const userCheck = await this.canUse('user', userId, resource, amount);
        if (!userCheck.allowed) {
            return { allowed: false, blockedBy: 'user', warning: userCheck.warning };
        }

        // Check global budget
        const globalCheck = await this.canUse('global', 'global', resource, amount);
        if (!globalCheck.allowed) {
            return { allowed: false, blockedBy: 'global', warning: globalCheck.warning };
        }

        // Aggregate warnings
        const warnings = [runCheck.warning, userCheck.warning, globalCheck.warning].filter(Boolean);

        return {
            allowed: true,
            warning: warnings.length > 0 ? warnings.join('; ') : undefined,
        };
    }

    /**
     * Record usage across all scopes
     */
    async recordUsageAllScopes(
        runId: string,
        userId: string,
        resource: ResourceType,
        amount: number = 1
    ): Promise<void> {
        await this.recordUsage('run', runId, resource, amount);
        await this.recordUsage('user', userId, resource, amount);
        await this.recordUsage('global', 'global', resource, amount);
    }

    /**
     * Save budget to Redis
     */
    private async saveBudget(budget: ResourceBudget): Promise<void> {
        const key = `${this.keyPrefix}${budget.scope}:${budget.scope_id}`;
        await this.redis.set(key, JSON.stringify(budget));

        // Set expiration based on scope
        if (budget.scope === 'run') {
            await this.redis.expire(key, 24 * 60 * 60); // 24 hours
        } else if (budget.scope === 'user') {
            await this.redis.expire(key, 24 * 60 * 60); // Reset daily
        }
        // Global doesn't expire
    }

    /**
     * Send warning using AlertManager
     */
    private async sendWarning(
        scope: BudgetScope,
        scopeId: string,
        resource: ResourceType,
        usagePercent: number
    ): Promise<void> {
        const { getAlertManager } = await import('./alert-manager.js');
        const alert = getAlertManager();

        const percentStr = Math.round(usagePercent * 100);
        await alert.sendAlert(
            'warning',
            'budget',
            `Resource limit warning: ${resource}`,
            `${scope}:${scopeId} has reached ${percentStr}% of ${resource} budget`,
            { scope, scopeId, resource, usagePercent: percentStr }
        );
    }

    /**
     * Get usage report
     */
    async getUsageReport(
        scope: BudgetScope,
        scopeId: string
    ): Promise<Record<ResourceType, { used: number; limit: number; percent: number }>> {
        const budget = await this.getBudget(scope, scopeId);
        const report: Record<string, { used: number; limit: number; percent: number }> = {};

        for (const [resource, limit] of Object.entries(budget.limits)) {
            const used = budget.used[resource as ResourceType] ?? 0;
            report[resource] = {
                used,
                limit,
                percent: Math.round((used / limit) * 100),
            };
        }

        return report as Record<ResourceType, { used: number; limit: number; percent: number }>;
    }
}

// Singleton
let guardInstance: ResourceBudgetGuard | null = null;

export function getResourceBudgetGuard(): ResourceBudgetGuard {
    if (!guardInstance) {
        guardInstance = new ResourceBudgetGuard();
    }
    return guardInstance;
}
