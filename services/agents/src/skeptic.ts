/**
 * Skeptic Agent
 * Devils advocate - challenges proposals and identifies weaknesses
 */

import type { AgentType } from '@mother-harness/shared';
import { getLLMClient } from '@mother-harness/shared';
import { BaseAgent, type AgentContext, type AgentResult } from './base-agent.js';

/** Concern severity */
type ConcernLevel = 'critical' | 'significant' | 'minor' | 'consideration';

/** Identified concern */
interface Concern {
    level: ConcernLevel;
    area: string;
    issue: string;
    potential_impact: string;
    mitigation?: string;
}

/** Alternative approach */
interface Alternative {
    name: string;
    description: string;
    trade_offs: string;
    when_preferred: string;
}

const SKEPTIC_SYSTEM_PROMPT = `You are a devil's advocate and critical thinker. Your role is to:
1. Challenge assumptions and identify blind spots
2. Find weaknesses in proposals before they become problems
3. Present alternative viewpoints constructively
4. Stress-test ideas with edge cases and failure scenarios
5. Be thorough but fair - acknowledge strengths while highlighting risks

Your goal is to IMPROVE proposals, not tear them down. Be constructive in your criticism.`;

const CRITIQUE_PROMPT = `Critically analyze this proposal:

Proposal: {proposal}
Context: {context}

Return a JSON object:
{
  "overall_assessment": "brief assessment of the proposal's soundness",
  "concerns": [
    {
      "level": "critical" | "significant" | "minor" | "consideration",
      "area": "which aspect (technical, business, security, etc.)",
      "issue": "what the concern is",
      "potential_impact": "what could go wrong",
      "mitigation": "how to address it"
    }
  ],
  "blind_spots": ["assumptions or areas not considered"],
  "edge_cases": ["scenarios that might break this"],
  "alternatives": [
    {
      "name": "alternative approach name",
      "description": "what this alternative entails",
      "trade_offs": "pros and cons vs original",
      "when_preferred": "conditions where this is better"
    }
  ],
  "strengths": ["what the proposal does well"],
  "verdict": "proceed" | "proceed_with_changes" | "reconsider" | "reject",
  "verdict_rationale": "why this verdict"
}`;

export class SkepticAgent extends BaseAgent {
    readonly agentType: AgentType = 'skeptic';
    private llm = getLLMClient();

    protected async run(inputs: string, context: AgentContext): Promise<AgentResult> {
        const startTime = Date.now();

        const critique = await this.analyzeProposal(inputs, context);

        const criticalCount = critique.concerns.filter(c => c.level === 'critical').length;
        const significantCount = critique.concerns.filter(c => c.level === 'significant').length;
        const challenges = critique.concerns.reduce<Record<string, Concern[]>>((grouped, concern) => {
            const area = concern.area || 'general';
            if (!grouped[area]) {
                grouped[area] = [];
            }
            grouped[area]!.push(concern);
            return grouped;
        }, {});

        return {
            success: true,
            outputs: {
                assessment: critique.overall_assessment,
                concerns: critique.concerns,
                challenges,
                blind_spots: critique.blind_spots,
                edge_cases: critique.edge_cases,
                alternatives: critique.alternatives,
                strengths: critique.strengths,
                verdict: critique.verdict,
                verdict_rationale: critique.verdict_rationale,
            },
            explanation: `Critique complete: ${critique.verdict} (${criticalCount} critical, ${significantCount} significant concerns)`,
            tokens_used: critique.tokens,
            duration_ms: Date.now() - startTime,
        };
    }

    private async analyzeProposal(
        proposal: string,
        context: AgentContext
    ): Promise<{
        overall_assessment: string;
        concerns: Concern[];
        blind_spots: string[];
        edge_cases: string[];
        alternatives: Alternative[];
        strengths: string[];
        verdict: 'proceed' | 'proceed_with_changes' | 'reconsider' | 'reject';
        verdict_rationale: string;
        tokens: number;
    }> {
        const prompt = CRITIQUE_PROMPT
            .replace('{proposal}', proposal)
            .replace('{context}', context.recent_context ?? 'No additional context');

        const result = await this.llm.json<{
            overall_assessment: string;
            concerns: Concern[];
            blind_spots: string[];
            edge_cases: string[];
            alternatives: Alternative[];
            strengths: string[];
            verdict: 'proceed' | 'proceed_with_changes' | 'reconsider' | 'reject';
            verdict_rationale: string;
        }>(prompt, {
            system: SKEPTIC_SYSTEM_PROMPT,
            temperature: 0.5, // Some creativity for finding issues
            max_tokens: 4096,
        });

        if (result.data) {
            return {
                ...result.data,
                tokens: result.raw.tokens_used.total,
            };
        }

        return {
            overall_assessment: 'Unable to complete critique.',
            concerns: [],
            blind_spots: [],
            edge_cases: [],
            alternatives: [],
            strengths: [],
            verdict: 'reconsider',
            verdict_rationale: 'Critique could not be completed due to processing error.',
            tokens: result.raw.tokens_used.total,
        };
    }
}
