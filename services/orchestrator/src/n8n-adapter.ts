/**
 * N8N Adapter
 * Interfaces with n8n workflows for agent execution
 */

import { config } from './config.js';

/** Workflow execution result */
export interface WorkflowResult {
    success: boolean;
    data?: unknown;
    error?: string;
    execution_id?: string;
    duration_ms: number;
}

/** Workflow trigger options */
export interface WorkflowOptions {
    timeout?: number;
    retries?: number;
    fallback_to_direct?: boolean;
}

export class N8nAdapter {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly defaultTimeout = 300000; // 5 minutes
    private readonly defaultRetries = 2;

    constructor() {
        this.baseUrl = config.n8nUrl;
        this.apiKey = config.n8nApiKey;
    }

    /**
     * Trigger an n8n workflow
     */
    async triggerWorkflow(
        workflowName: string,
        data: Record<string, unknown>,
        options: WorkflowOptions = {}
    ): Promise<WorkflowResult> {
        const startTime = Date.now();
        const timeout = options.timeout ?? this.defaultTimeout;
        const maxRetries = options.retries ?? this.defaultRetries;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await Promise.race([
                    this.executeWorkflow(workflowName, data),
                    this.timeoutPromise(timeout),
                ]);

                return {
                    success: true,
                    data: result,
                    duration_ms: Date.now() - startTime,
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                if (attempt === maxRetries) {
                    // Final failure
                    console.error(`[N8nAdapter] Workflow ${workflowName} failed after ${attempt + 1} attempts:`, errorMessage);

                    if (options.fallback_to_direct) {
                        console.log(`[N8nAdapter] Falling back to direct execution`);
                        return {
                            success: false,
                            error: errorMessage,
                            duration_ms: Date.now() - startTime,
                        };
                    }

                    throw error;
                }

                // Retry with exponential backoff
                const backoff = 5000 * Math.pow(2, attempt);
                console.log(`[N8nAdapter] Retry ${attempt + 1}/${maxRetries} after ${backoff}ms`);
                await this.sleep(backoff);
            }
        }

        // Should never reach here
        return {
            success: false,
            error: 'Unknown error',
            duration_ms: Date.now() - startTime,
        };
    }

    /**
     * Execute workflow via webhook
     */
    private async executeWorkflow(
        workflowName: string,
        data: Record<string, unknown>
    ): Promise<unknown> {
        const webhookUrl = `${this.baseUrl}/webhook/${workflowName}`;

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Workflow failed: ${response.status} - ${errorText}`);
        }

        return response.json();
    }

    /**
     * Create a timeout promise
     */
    private timeoutPromise(ms: number): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Workflow timeout after ${ms}ms`)), ms);
        });
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get workflow execution status
     */
    async getExecutionStatus(executionId: string): Promise<{
        status: 'running' | 'success' | 'error';
        data?: unknown;
        error?: string;
    }> {
        const url = `${this.baseUrl}/executions/${executionId}`;

        const response = await fetch(url, {
            headers: {
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get execution status: ${response.status}`);
        }

        const result = await response.json() as { finished: boolean; data?: unknown; stoppedAt?: string };

        if (!result.finished) {
            return { status: 'running' };
        }

        if (result.stoppedAt) {
            return {
                status: 'error',
                error: 'Execution stopped',
            };
        }

        return {
            status: 'success',
            data: result.data,
        };
    }

    /**
     * List available workflows
     */
    async listWorkflows(): Promise<Array<{ id: string; name: string; active: boolean }>> {
        const url = `${this.baseUrl}/workflows`;

        const response = await fetch(url, {
            headers: {
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to list workflows: ${response.status}`);
        }

        const result = await response.json() as { data: Array<{ id: string; name: string; active: boolean }> };
        return result.data;
    }
}

// Singleton
let adapterInstance: N8nAdapter | null = null;

export function getN8nAdapter(): N8nAdapter {
    if (!adapterInstance) {
        adapterInstance = new N8nAdapter();
    }
    return adapterInstance;
}
