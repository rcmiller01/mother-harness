/**
 * Model Selector
 * Determines the appropriate model (local/cloud) based on task requirements
 */

import type { AgentType, Task } from '@mother-harness/shared';
import { getRedisJSON, getRoleRegistry } from '@mother-harness/shared';

/** Model quality tiers */
export type ModelTier = 'tier1_fast' | 'tier2_balanced' | 'tier3_quality' | 'tier4_cloud';

/** Model decision record */
export interface ModelDecision {
    selected_model: string;
    tier: ModelTier;
    reasoning: string[];
    cost_estimate: number;
    fallback_chain: string[];
}

/** Context for model selection */
export interface ModelSelectionContext {
    user_id: string;
    project_id?: string;
    user_preferences?: {
        prefer_cloud?: boolean;
        prefer_local?: boolean;
        max_cost_per_request?: number;
    };
}

/** Model configuration */
export interface ModelConfig {
    id: string;
    tier: ModelTier;
    quantization?: string;
    gpu_layers?: number;
    context_size: number;
    memory_required: string;
    cost_per_1k_tokens: number;
    capabilities: string[];
}

/** Available models */
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
    'gpt-oss:20b-q4': {
        id: 'gpt-oss:20b-q4',
        tier: 'tier1_fast',
        quantization: 'Q4_K_M',
        gpu_layers: 40,
        context_size: 8192,
        memory_required: '4GB',
        cost_per_1k_tokens: 0,
        capabilities: ['text', 'code', 'reasoning'],
    },
    'gpt-oss:20b-q5': {
        id: 'gpt-oss:20b-q5',
        tier: 'tier2_balanced',
        quantization: 'Q5_K_M',
        gpu_layers: 40,
        context_size: 8192,
        memory_required: '5GB',
        cost_per_1k_tokens: 0,
        capabilities: ['text', 'code', 'reasoning'],
    },
    'gpt-oss:20b-fp8': {
        id: 'gpt-oss:20b-fp8',
        tier: 'tier3_quality',
        quantization: 'FP8',
        gpu_layers: -1,
        context_size: 16384,
        memory_required: '22GB',
        cost_per_1k_tokens: 0,
        capabilities: ['text', 'code', 'reasoning', 'complex'],
    },
    'devstral-2:123b-cloud': {
        id: 'devstral-2:123b-cloud',
        tier: 'tier4_cloud',
        context_size: 32768,
        memory_required: '0',
        cost_per_1k_tokens: 0.003,
        capabilities: ['text', 'code', 'reasoning', 'complex', 'tool_calling'],
    },
    'deepseek-v3.1:671b-cloud': {
        id: 'deepseek-v3.1:671b-cloud',
        tier: 'tier4_cloud',
        context_size: 65536,
        memory_required: '0',
        cost_per_1k_tokens: 0.004,
        capabilities: ['text', 'code', 'reasoning', 'complex', 'analysis'],
    },
    'gemini-3-flash-preview-cloud': {
        id: 'gemini-3-flash-preview-cloud',
        tier: 'tier4_cloud',
        context_size: 1000000,
        memory_required: '0',
        cost_per_1k_tokens: 0.002,
        capabilities: ['text', 'code', 'vision', 'reasoning'],
    },
};

export class ModelSelector {
    private redis = getRedisJSON();
    private registry = getRoleRegistry();

    /** Complexity thresholds */
    private readonly COMPLEXITY_THRESHOLD = 6;
    private readonly FAILURE_THRESHOLD = 2;

    /**
     * Select the best model for a task
     */
    async selectModel(
        agent: AgentType,
        task: Task,
        context: ModelSelectionContext
    ): Promise<ModelDecision> {
        const reasoning: string[] = [];
        let selectedModel = 'gpt-oss:20b-q4';
        let tier: ModelTier = 'tier1_fast';

        // Step 1: Start with local model
        reasoning.push('Starting with local quantized model');

        // Step 2: Check complexity
        const complexity = await this.assessComplexity(task);
        if (complexity.score > this.COMPLEXITY_THRESHOLD) {
            selectedModel = 'gpt-oss:20b-fp8';
            tier = 'tier3_quality';
            reasoning.push(`High complexity (${complexity.score}/10) requires higher quality model`);
        }

        // Step 3: Check previous failures
        const history = await this.getTaskHistory(task.project_id, agent);
        if (history.recent_failures > this.FAILURE_THRESHOLD) {
            selectedModel = this.getCloudModel(agent);
            tier = 'tier4_cloud';
            reasoning.push(`${history.recent_failures} recent failures, upgrading to cloud model`);
        }

        // Step 4: User preferences
        if (context.user_preferences?.prefer_cloud) {
            selectedModel = this.getCloudModel(agent);
            tier = 'tier4_cloud';
            reasoning.push('User preference: cloud models');
        } else if (context.user_preferences?.prefer_local && tier === 'tier4_cloud') {
            // Only downgrade if not forced by failures
            if (history.recent_failures <= this.FAILURE_THRESHOLD) {
                selectedModel = 'gpt-oss:20b-fp8';
                tier = 'tier3_quality';
                reasoning.push('User preference: local models');
            }
        }

        // Step 5: Budget check
        if (tier === 'tier4_cloud') {
            const budget = await this.checkBudget(context.user_id);
            if (!budget.can_afford) {
                selectedModel = 'gpt-oss:20b-fp8';
                tier = 'tier3_quality';
                reasoning.push('Budget limit reached; using local model');
            }
        }

        // Build fallback chain
        const fallback_chain = this.buildFallbackChain(selectedModel);

        // Calculate cost estimate
        const config = MODEL_CONFIGS[selectedModel];
        const cost_estimate = config?.cost_per_1k_tokens ?? 0;

        const decision: ModelDecision = {
            selected_model: selectedModel,
            tier,
            reasoning,
            cost_estimate,
            fallback_chain,
        };

        // Record decision for audit
        await this.recordDecision(task.id, decision);

        return decision;
    }

    /**
     * Assess task complexity
     */
    private async assessComplexity(task: Task): Promise<{ score: number; factors: string[] }> {
        const factors: string[] = [];
        let score = 3; // Base score

        // Query length
        if (task.query.length > 500) {
            score += 2;
            factors.push('long_query');
        }

        // Code-related keywords
        if (/\b(implement|code|function|class|debug|fix)\b/i.test(task.query)) {
            score += 1;
            factors.push('code_related');
        }

        // Complex reasoning keywords
        if (/\b(analyze|compare|evaluate|design|architect)\b/i.test(task.query)) {
            score += 2;
            factors.push('complex_reasoning');
        }

        // Multi-step indicators
        if (task.todo_list.length > 3) {
            score += 1;
            factors.push('multi_step');
        }

        return { score: Math.min(score, 10), factors };
    }

    /**
     * Get task failure history
     */
    private async getTaskHistory(
        projectId: string,
        agent: AgentType
    ): Promise<{ recent_failures: number; total_tasks: number }> {
        // TODO: Implement actual history lookup
        return { recent_failures: 0, total_tasks: 0 };
    }

    /**
     * Get cloud model for agent
     */
    private getCloudModel(agent: AgentType): string {
        const role = this.registry.getRole(agent);
        // Default cloud models by agent type
        const cloudModels: Partial<Record<AgentType, string>> = {
            coder: 'devstral-2:123b-cloud',
            critic: 'deepseek-v3.1:671b-cloud',
            design: 'gemini-3-flash-preview-cloud',
            vision: 'gemini-3-flash-preview-cloud',
        };
        return cloudModels[agent] ?? 'devstral-2:123b-cloud';
    }

    /**
     * Check user budget
     */
    private async checkBudget(userId: string): Promise<{ can_afford: boolean; remaining: number }> {
        // TODO: Implement actual budget check
        return { can_afford: true, remaining: 100 };
    }

    /**
     * Build fallback chain
     */
    private buildFallbackChain(primaryModel: string): string[] {
        const chain: string[] = [];

        const config = MODEL_CONFIGS[primaryModel];
        if (!config) return chain;

        switch (config.tier) {
            case 'tier4_cloud':
                chain.push('gpt-oss:20b-fp8', 'gpt-oss:20b-q5', 'gpt-oss:20b-q4');
                break;
            case 'tier3_quality':
                chain.push('gpt-oss:20b-q5', 'gpt-oss:20b-q4');
                break;
            case 'tier2_balanced':
                chain.push('gpt-oss:20b-q4');
                break;
            default:
                // No fallback for tier1
                break;
        }

        return chain;
    }

    /**
     * Record decision for audit trail
     */
    private async recordDecision(taskId: string, decision: ModelDecision): Promise<void> {
        const key = `model_decision:${taskId}`;
        await this.redis.set(key, '$', {
            ...decision,
            timestamp: new Date().toISOString(),
        });
    }
}

// Singleton
let selectorInstance: ModelSelector | null = null;

export function getModelSelector(): ModelSelector {
    if (!selectorInstance) {
        selectorInstance = new ModelSelector();
    }
    return selectorInstance;
}
