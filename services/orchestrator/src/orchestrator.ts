/**
 * Mother Orchestrator
 * Main orchestration class for task planning, routing, and execution
 */

import { nanoid } from 'nanoid';
import {
    type Task,
    type Project,
    type Approval,
    type TodoItem,
    type AgentType,
    createTask,
    createProject,
    getRedisJSON,
    getContractEnforcer,
    getRoleRegistry,
    TaskSchema,
    ProjectSchema,
    ApprovalSchema,
} from '@mother-harness/shared';
import { TaskPlanner } from './planner.js';
import { Tier1Memory } from './memory/tier1-recent.js';
import { Tier2Memory } from './memory/tier2-summaries.js';
import { Tier3Memory } from './memory/tier3-longterm.js';

/** Agent dispatch result */
interface AgentResult {
    success: boolean;
    outputs: Record<string, unknown>;
    artifacts?: string[];
    explanation?: string;
    tokens_used?: number;
    duration_ms?: number;
}

/** Agent executor interface */
type AgentExecutor = (inputs: string, context: Record<string, unknown>) => Promise<AgentResult>;

/** Registered agent executors */
const agentExecutors: Map<AgentType, AgentExecutor> = new Map();

/**
 * Register an agent executor
 */
export function registerAgentExecutor(agentType: AgentType, executor: AgentExecutor): void {
    agentExecutors.set(agentType, executor);
}

export class Orchestrator {
    private redis = getRedisJSON();
    private planner = new TaskPlanner();
    private tier1 = new Tier1Memory();
    private tier2 = new Tier2Memory();
    private tier3 = new Tier3Memory();
    private enforcer = getContractEnforcer();
    private registry = getRoleRegistry();

    /**
     * Create a new task from user query
     */
    async createTask(
        userId: string,
        query: string,
        projectId?: string
    ): Promise<Task> {
        const taskId = `task-${nanoid()}`;

        // Create or get project
        const actualProjectId = projectId ?? await this.getOrCreateDefaultProject(userId);

        // Create task
        const task = createTask(taskId, actualProjectId, userId, query);

        // Add user message to tier 1 memory
        await this.tier1.addMessage(taskId, 'user', query);

        // Get context from memory for planning
        const recentContext = await this.tier1.getContextString(taskId);
        const summaryContext = await this.tier2.getContextString(actualProjectId, 3);
        const longTermContext = await this.tier3.getContextString(actualProjectId, query);

        // Generate execution plan with context
        const plan = await this.planner.createPlan(query, {
            project_id: actualProjectId,
            user_id: userId,
            context: `${recentContext}\n\n${summaryContext}\n\n${longTermContext}`,
        });

        task.todo_list = plan.steps;
        task.execution_plan = plan;
        task.status = 'planning';

        // Store in Redis
        await this.redis.set(`task:${taskId}`, '$', task);

        // Add task to project threads
        await this.redis.arrAppend(`project:${actualProjectId}`, '$.threads', taskId);

        return task;
    }

    /**
     * Get task by ID
     */
    async getTask(taskId: string): Promise<Task | null> {
        const task = await this.redis.get(`task:${taskId}`) as Task | null;
        if (!task) return null;

        // Validate schema
        const result = TaskSchema.safeParse(task);
        if (!result.success) {
            console.error('Invalid task data:', result.error);
            return null;
        }

        return result.data;
    }

    /**
     * Execute a task
     */
    async executeTask(taskId: string): Promise<void> {
        const task = await this.getTask(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        // Update status to executing
        await this.updateTaskStatus(taskId, 'executing');

        const agentsInvoked: Array<{ agent: AgentType; step_id: string; tokens: number }> = [];
        let totalTokens = 0;

        // Execute steps in order
        for (const step of task.todo_list) {
            // Check dependencies
            const depsMet = await this.checkDependencies(task, step);
            if (!depsMet) continue;

            // Update step status
            await this.updateStepStatus(taskId, step.id, 'in_progress');

            try {
                // Check if approval is required
                if (step.require_approval) {
                    await this.createApprovalRequest(task, step);
                    await this.updateTaskStatus(taskId, 'approval_needed');
                    return;
                }

                // Execute the step
                const result = await this.executeStep(task, step);

                // Track agent invocation
                agentsInvoked.push({
                    agent: step.agent,
                    step_id: step.id,
                    tokens: result.tokens_used ?? 0,
                });
                totalTokens += result.tokens_used ?? 0;

                // Add assistant response to tier 1 memory
                if (result.explanation) {
                    await this.tier1.addMessage(taskId, 'assistant', result.explanation);
                }

                // Update step with result
                await this.updateStepResult(taskId, step.id, result);
                await this.updateStepStatus(taskId, step.id, 'completed');

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                await this.updateStepStatus(taskId, step.id, 'failed', errorMessage);
                await this.updateTaskStatus(taskId, 'failed');
                return;
            }
        }

        // Update token usage
        await this.redis.set(`task:${taskId}`, '$.tokens_used', totalTokens);

        // All steps completed - finalize with memory updates
        await this.finalizeTask(taskId, agentsInvoked);
    }

    /**
     * Execute a single step by dispatching to the appropriate agent
     */
    private async executeStep(task: Task, step: TodoItem): Promise<AgentResult> {
        const executor = agentExecutors.get(step.agent);
        const contract = await this.registry.getContract(step.agent);

        if (!contract) {
            throw new Error(`Contract not found for agent: ${step.agent}`);
        }

        const allowlistValidation = await this.enforcer.validateAllowlist(
            step.agent,
            contract.default_action
        );

        if (!allowlistValidation.valid) {
            throw new Error(allowlistValidation.errors.join('; '));
        }

        if (!executor) {
            console.warn(`No executor registered for agent: ${step.agent}`);
            const requiredArtifactsValidation = await this.enforcer.validateRequiredArtifacts(
                step.agent,
                []
            );

            if (!requiredArtifactsValidation.valid) {
                throw new Error(requiredArtifactsValidation.errors.join('; '));
            }

            // Return placeholder result
            return {
                success: true,
                outputs: {
                    agent: step.agent,
                    description: step.description,
                    executed_at: new Date().toISOString(),
                    note: 'No agent executor registered - using placeholder',
                },
                artifacts: [],
                explanation: `Executed step: ${step.description}`,
                tokens_used: 0,
                duration_ms: 0,
            };
        }

        // Build context for agent
        const recentContext = await this.tier1.getContextString(task.id);
        const longTermContext = await this.tier3.getContextString(task.project_id, step.description);

        const context = {
            task_id: task.id,
            project_id: task.project_id,
            user_id: task.user_id,
            step_id: step.id,
            recent_context: recentContext,
            rag_context: longTermContext,
            library_ids: [], // Would be populated from project settings
        };

        // Execute the agent
        const startTime = Date.now();
        const result = await executor(step.description, context);
        result.duration_ms = Date.now() - startTime;

        const requiredArtifactsValidation = await this.enforcer.validateRequiredArtifacts(
            step.agent,
            result.artifacts ?? []
        );

        if (!requiredArtifactsValidation.valid) {
            throw new Error(requiredArtifactsValidation.errors.join('; '));
        }

        return result;
    }

    /**
     * Finalize completed task with memory updates
     */
    private async finalizeTask(
        taskId: string,
        agentsInvoked: Array<{ agent: AgentType; step_id: string; tokens: number }>
    ): Promise<void> {
        const task = await this.getTask(taskId);
        if (!task) return;

        await this.updateTaskStatus(taskId, 'completed');
        await this.redis.set(`task:${taskId}`, '$.completed_at', new Date().toISOString());

        // Compile results for memory
        const results = task.todo_list
            .filter(s => s.result)
            .map(s => {
                const result = s.result as { explanation?: string; outputs?: Record<string, unknown> };
                return result.explanation || JSON.stringify(result.outputs || {}).substring(0, 200);
            })
            .join('\n');

        // Generate session summary (Tier 2 memory)
        try {
            await this.tier2.createSummary(task.project_id, taskId, {
                goal: task.original_query,
                outcome: task.status === 'completed' ? 'Successfully completed' : 'Failed',
                agents_invoked: agentsInvoked,
                raw_results: results,
            });
        } catch (error) {
            console.error('[Orchestrator] Failed to create tier 2 summary:', error);
        }

        // Extract and embed important findings (Tier 3 memory)
        try {
            const memoriesStored = await this.tier3.extractAndStore(task.project_id, taskId, results);
            console.log(`[Orchestrator] Stored ${memoriesStored} long-term memories from task ${taskId}`);
        } catch (error) {
            console.error('[Orchestrator] Failed to extract tier 3 memories:', error);
        }
    }

    /**
     * Get or create default project for user
     */
    private async getOrCreateDefaultProject(userId: string): Promise<string> {
        // Check for existing default project
        const existingKeys = await this.redis.keys('project:*');
        for (const key of existingKeys) {
            const project = await this.redis.get(key) as Project | null;
            if (project?.status === 'active') {
                return project.id;
            }
        }

        // Create new project
        const projectId = `proj-${nanoid()}`;
        const project = createProject(projectId, 'Default Project');
        await this.redis.set(`project:${projectId}`, '$', project);

        return projectId;
    }

    /**
     * Update task status
     */
    private async updateTaskStatus(taskId: string, status: Task['status']): Promise<void> {
        await this.redis.set(`task:${taskId}`, '$.status', status);
        await this.redis.set(`task:${taskId}`, '$.updated_at', new Date().toISOString());
    }

    /**
     * Update step status
     */
    private async updateStepStatus(
        taskId: string,
        stepId: string,
        status: TodoItem['status'],
        error?: string
    ): Promise<void> {
        const task = await this.getTask(taskId);
        if (!task) return;

        const stepIndex = task.todo_list.findIndex(s => s.id === stepId);
        if (stepIndex === -1) return;

        task.todo_list[stepIndex]!.status = status;
        if (status === 'in_progress') {
            task.todo_list[stepIndex]!.started_at = new Date().toISOString();
        }
        if (status === 'completed' || status === 'failed') {
            task.todo_list[stepIndex]!.completed_at = new Date().toISOString();
        }
        if (error) {
            task.todo_list[stepIndex]!.error = error;
        }

        await this.redis.set(`task:${taskId}`, '$.todo_list', task.todo_list);
    }

    /**
     * Update step result
     */
    private async updateStepResult(taskId: string, stepId: string, result: AgentResult): Promise<void> {
        const task = await this.getTask(taskId);
        if (!task) return;

        const stepIndex = task.todo_list.findIndex(s => s.id === stepId);
        if (stepIndex === -1) return;

        task.todo_list[stepIndex]!.result = result;
        await this.redis.set(`task:${taskId}`, '$.todo_list', task.todo_list);

        // Add to completed steps
        await this.redis.arrAppend(`task:${taskId}`, '$.steps_completed', stepId);
    }

    /**
     * Check if step dependencies are met
     */
    private async checkDependencies(task: Task, step: TodoItem): Promise<boolean> {
        if (step.depends_on.length === 0) return true;

        const completedSteps = task.steps_completed;
        return step.depends_on.every(dep => completedSteps.includes(dep));
    }

    /**
     * Create approval request for a step
     */
    private async createApprovalRequest(task: Task, step: TodoItem): Promise<Approval> {
        const approval: Approval = {
            id: `approval-${nanoid()}`,
            task_id: task.id,
            project_id: task.project_id,
            step_id: step.id,
            user_id: task.user_id,
            type: step.approval_type ?? 'code_execution',
            description: step.description,
            risk_level: step.risk ?? 'medium',
            preview: {},
            status: 'pending',
            created_at: new Date().toISOString(),
        };

        await this.redis.set(`approval:${approval.id}`, '$', approval);
        return approval;
    }

    /**
     * List projects for a user
     */
    async listProjects(_userId: string): Promise<Project[]> {
        const keys = await this.redis.keys('project:*');
        const projects: Project[] = [];

        for (const key of keys) {
            const project = await this.redis.get(key) as Project | null;
            if (project) {
                const result = ProjectSchema.safeParse(project);
                if (result.success) {
                    projects.push(result.data);
                }
            }
        }

        return projects;
    }

    /**
     * Get pending approvals for user
     */
    async getPendingApprovals(userId: string): Promise<Approval[]> {
        const keys = await this.redis.keys('approval:*');
        const approvals: Approval[] = [];

        for (const key of keys) {
            const approval = await this.redis.get(key) as Approval | null;
            if (approval?.status === 'pending' && approval.user_id === userId) {
                const result = ApprovalSchema.safeParse(approval);
                if (result.success) {
                    approvals.push(result.data);
                }
            }
        }

        return approvals;
    }

    /**
     * Respond to an approval request
     */
    async respondToApproval(approvalId: string, approved: boolean, notes?: string): Promise<void> {
        const approval = await this.redis.get(`approval:${approvalId}`) as Approval | null;
        if (!approval) throw new Error(`Approval not found: ${approvalId}`);

        await this.redis.set(`approval:${approvalId}`, '$.status', approved ? 'approved' : 'rejected');
        await this.redis.set(`approval:${approvalId}`, '$.responded_at', new Date().toISOString());
        if (notes) {
            await this.redis.set(`approval:${approvalId}`, '$.response_notes', notes);
        }

        // Resume task execution if approved
        if (approved) {
            await this.updateStepStatus(approval.task_id, approval.step_id, 'completed');
            // Continue task execution in background
            this.executeTask(approval.task_id).catch(console.error);
        } else {
            await this.updateTaskStatus(approval.task_id, 'failed');
        }
    }

    /**
     * Get memory context for a task
     */
    async getMemoryContext(taskId: string, projectId: string, query: string): Promise<{
        recent: string;
        summaries: string;
        longTerm: string;
    }> {
        return {
            recent: await this.tier1.getContextString(taskId),
            summaries: await this.tier2.getContextString(projectId),
            longTerm: await this.tier3.getContextString(projectId, query),
        };
    }
}
