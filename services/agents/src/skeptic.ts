/**
 * Skeptic Agent
 * Challenges assumptions, proposes alternatives, plays devil's advocate
 */

import type { AgentType } from '@mother-harness/shared';
import { BaseAgent, type AgentContext, type AgentResult } from './base-agent.js';

/** Challenge to a proposal or decision */
export interface Challenge {
    aspect: string;
    concern: string;
    severity: 'minor' | 'moderate' | 'significant';
    evidence?: string;
}

/** Alternative approach */
export interface Alternative {
    name: string;
    description: string;
    advantages: string[];
    disadvantages: string[];
    conditions: string; // When this alternative would be better
}

export class SkepticAgent extends BaseAgent {
    readonly agentType: AgentType = 'skeptic';

    protected async run(inputs: string, context: AgentContext): Promise<AgentResult> {
        const startTime = Date.now();

        // Analyze the proposal/decision
        const challenges = await this.findChallenges(inputs, context);

        // Generate alternatives
        const alternatives = await this.generateAlternatives(inputs, context);

        // Assess overall risk
        const riskAssessment = this.assessRisk(challenges);

        return {
            success: true,
            outputs: {
                challenges,
                alternatives,
                risk_assessment: riskAssessment,
            },
            explanation: `Identified ${challenges.length} potential concerns and ${alternatives.length} alternatives`,
            tokens_used: 350,
            duration_ms: Date.now() - startTime,
        };
    }

    private async findChallenges(
        inputs: string,
        _context: AgentContext
    ): Promise<Challenge[]> {
        // TODO: Use LLM to critically analyze the proposal
        // Look for:
        // - Unstated assumptions
        // - Potential failure modes
        // - Missing considerations
        // - Logical inconsistencies

        return [
            {
                aspect: 'Scalability',
                concern: 'The proposed approach may not scale beyond 10x current load',
                severity: 'moderate',
                evidence: 'Based on similar systems, O(n²) complexity typically becomes problematic around this scale',
            },
            {
                aspect: 'Dependencies',
                concern: 'Single point of failure in the proposed architecture',
                severity: 'significant',
                evidence: 'No redundancy mentioned for the central coordinator',
            },
            {
                aspect: 'Timeline',
                concern: 'Estimated timeline may be optimistic',
                severity: 'minor',
                evidence: 'Similar projects typically take 20-30% longer than initial estimates',
            },
        ];
    }

    private async generateAlternatives(
        _inputs: string,
        _context: AgentContext
    ): Promise<Alternative[]> {
        // TODO: Use LLM to generate alternative approaches

        return [
            {
                name: 'Distributed Approach',
                description: 'Use a distributed architecture instead of centralized',
                advantages: [
                    'Better fault tolerance',
                    'Linear scalability',
                    'No single point of failure',
                ],
                disadvantages: [
                    'Higher complexity',
                    'More difficult debugging',
                    'Eventual consistency challenges',
                ],
                conditions: 'Better when high availability is critical and team has distributed systems experience',
            },
            {
                name: 'Phased Rollout',
                description: 'Implement in phases instead of big-bang release',
                advantages: [
                    'Lower risk',
                    'Earlier feedback',
                    'Easier rollback',
                ],
                disadvantages: [
                    'Longer overall timeline',
                    'May need temporary compatibility layers',
                ],
                conditions: 'Better when requirements are uncertain or when disruption must be minimized',
            },
        ];
    }

    private assessRisk(challenges: Challenge[]): {
        level: 'low' | 'medium' | 'high';
        summary: string;
        mitigations: string[];
    } {
        const significantCount = challenges.filter(c => c.severity === 'significant').length;
        const moderateCount = challenges.filter(c => c.severity === 'moderate').length;

        let level: 'low' | 'medium' | 'high';
        if (significantCount >= 2) {
            level = 'high';
        } else if (significantCount >= 1 || moderateCount >= 2) {
            level = 'medium';
        } else {
            level = 'low';
        }

        return {
            level,
            summary: `Overall risk is ${level} based on ${significantCount} significant and ${moderateCount} moderate concerns`,
            mitigations: [
                'Address significant concerns before proceeding',
                'Create contingency plans for moderate concerns',
                'Consider alternative approaches for high-risk aspects',
            ],
        };
    }
}
