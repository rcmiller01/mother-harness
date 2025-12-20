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
    TaskSchema,
    ProjectSchema,
    ApprovalSchema,
} from '@mother-harness/shared';
import { TaskPlanner } from './planner.js';
import { Tier1Memory } from './memory/tier1-recent.js';

export class Orchestrator {
    private redis = getRedisJSON();
    private planner = new TaskPlanner();
    private tier1 = new Tier1Memory();

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

        // Generate execution plan
        const plan = await this.planner.createPlan(query, {
            project_id: actualProjectId,
            user_id: userId,
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
        const task = await this.redis.get<Task>(`task:${taskId}`);
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
     * Execute a task (runs in background)
     */
    async executeTask(taskId: string): Promise<void> {
        const task = await this.getTask(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        // Update status to executing
        await this.updateTaskStatus(taskId, 'executing');

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
                    // Wait for approval (this would be handled by a separate mechanism)
                    return;
                }

                // Execute the step (placeholder - would dispatch to agents)
                const result = await this.executeStep(task, step);

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

        // All steps completed
        await this.finalizeTask(taskId);
    }

    /**
     * Get or create default project for user
     */
    private async getOrCreateDefaultProject(userId: string): Promise<string> {
        // Check for existing default project
        const existingKeys = await this.redis.keys(`project:*`);
        for (const key of existingKeys) {
            const project = await this.redis.get<Project>(key);
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
    private async updateStepResult(taskId: string, stepId: string, result: unknown): Promise<void> {
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
     * Execute a single step (placeholder - would dispatch to agents)
     */
    private async executeStep(task: Task, step: TodoItem): Promise<unknown> {
        // TODO: Implement agent dispatch via n8n or direct execution
        console.log(`Executing step ${step.id} with agent ${step.agent}`);

        // Placeholder result
        return {
            agent: step.agent,
            description: step.description,
            executed_at: new Date().toISOString(),
        };
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
     * Finalize completed task
     */
    private async finalizeTask(taskId: string): Promise<void> {
        await this.updateTaskStatus(taskId, 'completed');
        await this.redis.set(`task:${taskId}`, '$.completed_at', new Date().toISOString());

        // TODO: Generate session summary (Tier 2 memory)
        // TODO: Embed important findings (Tier 3 memory)
    }

    /**
     * List projects for a user
     */
    async listProjects(userId: string): Promise<Project[]> {
        // TODO: Implement proper search with RediSearch
        const keys = await this.redis.keys('project:*');
        const projects: Project[] = [];

        for (const key of keys) {
            const project = await this.redis.get<Project>(key);
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
        // TODO: Implement proper search with RediSearch
        const keys = await this.redis.keys('approval:*');
        const approvals: Approval[] = [];

        for (const key of keys) {
            const approval = await this.redis.get<Approval>(key);
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
        const approval = await this.redis.get<Approval>(`approval:${approvalId}`);
        if (!approval) throw new Error(`Approval not found: ${approvalId}`);

        await this.redis.set(`approval:${approvalId}`, '$.status', approved ? 'approved' : 'rejected');
        await this.redis.set(`approval:${approvalId}`, '$.responded_at', new Date().toISOString());
        if (notes) {
            await this.redis.set(`approval:${approvalId}`, '$.response_notes', notes);
        }

        // Resume task execution if approved
        if (approved) {
            // Update step status and resume execution
            await this.updateStepStatus(approval.task_id, approval.step_id, 'completed');

            // Continue task execution in background
            this.executeTask(approval.task_id).catch(console.error);
        } else {
            // Mark task as failed due to rejection
            await this.updateTaskStatus(approval.task_id, 'failed');
        }
    }
}
