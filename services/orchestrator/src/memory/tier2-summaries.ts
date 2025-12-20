/**
 * Tier 2 Memory - Session Summaries
 * Structured summaries stored after task completion
 */

import type { SessionSummary, Project } from '@mother-harness/shared';
import { getRedisJSON } from '@mother-harness/shared';
import { nanoid } from 'nanoid';

/** Maximum session summaries per project */
const MAX_SESSION_SUMMARIES = 20;

export class Tier2Memory {
    private redis = getRedisJSON();

    /**
     * Create a session summary after task completion
     */
    async createSummary(
        projectId: string,
        taskId: string,
        details: {
            goal: string;
            outcome: string;
            key_findings: string[];
            agents_invoked: SessionSummary['agents_invoked'];
        }
    ): Promise<SessionSummary> {
        const summary: SessionSummary = {
            id: `summary-${nanoid()}`,
            task_id: taskId,
            summary: `${details.goal} - ${details.outcome}`,
            key_findings: details.key_findings,
            agents_invoked: details.agents_invoked,
            timestamp: new Date().toISOString(),
        };

        // Get current project
        const project = await this.redis.get<Project>(`project:${projectId}`);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }

        // Add summary and trim to max
        const summaries = [...project.session_summaries, summary];
        const trimmed = summaries.slice(-MAX_SESSION_SUMMARIES);

        await this.redis.set(`project:${projectId}`, '$.session_summaries', trimmed);

        return summary;
    }

    /**
     * Get session summaries for a project
     */
    async getSummaries(projectId: string): Promise<SessionSummary[]> {
        const project = await this.redis.get<Project>(`project:${projectId}`);
        return project?.session_summaries ?? [];
    }

    /**
     * Get formatted context from session summaries
     */
    async getContextString(projectId: string, limit: number = 5): Promise<string> {
        const summaries = await this.getSummaries(projectId);
        const recent = summaries.slice(-limit);

        if (recent.length === 0) {
            return 'No previous session summaries.';
        }

        return recent
            .map((s, i) => {
                const agents = s.agents_invoked.map(a => a.agent).join(', ');
                const findings = s.key_findings.slice(0, 2).join('; ');
                return `Session ${i + 1} (${new Date(s.timestamp).toLocaleDateString()}):\n  Summary: ${s.summary}\n  Agents: ${agents}\n  Key Findings: ${findings}`;
            })
            .join('\n\n');
    }

    /**
     * Search summaries by keyword
     */
    async searchSummaries(projectId: string, keyword: string): Promise<SessionSummary[]> {
        const summaries = await this.getSummaries(projectId);
        const lowerKeyword = keyword.toLowerCase();

        return summaries.filter(s =>
            s.summary.toLowerCase().includes(lowerKeyword) ||
            s.key_findings.some(f => f.toLowerCase().includes(lowerKeyword))
        );
    }

    /**
     * Get summary by task ID
     */
    async getSummaryByTask(projectId: string, taskId: string): Promise<SessionSummary | undefined> {
        const summaries = await this.getSummaries(projectId);
        return summaries.find(s => s.task_id === taskId);
    }
}
