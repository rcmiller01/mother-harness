/**
 * Critic Agent
 * Reviews work, validates quality, checks security
 */

import type { AgentType } from '@mother-harness/shared';
import { BaseAgent, type AgentContext, type AgentResult } from './base-agent.js';

/** Issue severity levels */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Issue found during review */
export interface ReviewIssue {
    severity: IssueSeverity;
    category: 'security' | 'quality' | 'performance' | 'style' | 'logic';
    description: string;
    location?: string;
    suggestion?: string;
}

export class CriticAgent extends BaseAgent {
    readonly agentType: AgentType = 'critic';

    protected async run(inputs: string, context: AgentContext): Promise<AgentResult> {
        const startTime = Date.now();

        // Parse the work to review
        const workToReview = this.parseInputs(inputs);

        // Conduct comprehensive review
        const review = await this.conductReview(workToReview, context);

        return {
            success: true,
            outputs: {
                review_report: review.report,
                issues_found: review.issues,
                suggestions: review.suggestions,
                security_notes: review.security_notes,
                approval_recommended: review.issues.filter(i =>
                    i.severity === 'critical' || i.severity === 'high'
                ).length === 0,
            },
            explanation: `Reviewed work and found ${review.issues.length} issue(s)`,
            tokens_used: review.tokens,
            duration_ms: Date.now() - startTime,
        };
    }

    private parseInputs(inputs: string): {
        type: 'code' | 'document' | 'plan' | 'mixed';
        content: string;
        metadata?: Record<string, unknown>;
    } {
        // TODO: Parse the inputs to determine what type of work is being reviewed
        return {
            type: 'mixed',
            content: inputs,
        };
    }

    private async conductReview(
        work: ReturnType<typeof this.parseInputs>,
        _context: AgentContext
    ): Promise<{
        report: string;
        issues: ReviewIssue[];
        suggestions: string[];
        security_notes: string[];
        tokens: number;
    }> {
        // TODO: Implement actual review using LLM
        // Check for security vulnerabilities
        // Validate code quality
        // Check for logical errors
        // Verify grounding (are claims supported?)

        const issues: ReviewIssue[] = [];
        const suggestions: string[] = [];
        const security_notes: string[] = [];

        // Placeholder review
        if (work.type === 'code') {
            // Code-specific checks
            suggestions.push('Consider adding unit tests for new functionality');
            suggestions.push('Ensure error handling is comprehensive');
        }

        const report = `## Review Report\n\n### Summary\nReviewed ${work.type} content.\n\n### Issues Found\n${issues.length === 0 ? 'No critical issues found.' : issues.map(i => `- [${i.severity.toUpperCase()}] ${i.description}`).join('\n')}\n\n### Suggestions\n${suggestions.map(s => `- ${s}`).join('\n')}\n\n### Security Notes\n${security_notes.length === 0 ? 'No security concerns identified.' : security_notes.map(n => `- ${n}`).join('\n')}`;

        return {
            report,
            issues,
            suggestions,
            security_notes,
            tokens: 300,
        };
    }
}
