/**
 * RAG Agent
 * Retrieval-Augmented Generation - answers questions using embedded documents
 */

import type { AgentType } from '@mother-harness/shared';
import { getLLMClient, getRedisJSON } from '@mother-harness/shared';
import { BaseAgent, type AgentContext, type AgentResult } from './base-agent.js';

/** Retrieved chunk */
interface RetrievedChunk {
    id: string;
    content: string;
    source: string;
    score: number;
    metadata?: Record<string, unknown>;
}

const RAG_SYSTEM_PROMPT = `You are a helpful assistant with access to a knowledge base. Your role is to:
1. Answer questions accurately using the provided context
2. Cite sources when making claims
3. Acknowledge when information isn't in the provided context
4. Synthesize information from multiple sources when relevant
5. Be clear about what you know vs what you're inferring

IMPORTANT: Only use information from the provided context. If the context doesn't contain the answer, say so clearly.`;

const RAG_PROMPT = `Answer this question using ONLY the provided context:

Question: {question}

Context from knowledge base:
{context}

Previous conversation:
{conversation}

Return a JSON object:
{
  "answer": "Your comprehensive answer based on the context",
  "sources_used": ["list of source IDs used"],
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation of how you derived the answer",
  "related_topics": ["topics the user might want to explore next"],
  "context_sufficient": true/false
}`;

export class RAGAgent extends BaseAgent {
    readonly agentType: AgentType = 'rag';
    private llm = getLLMClient();
    private redis = getRedisJSON();

    protected async run(inputs: string, context: AgentContext): Promise<AgentResult> {
        const startTime = Date.now();
        let totalTokens = 0;

        // Retrieve relevant chunks from the knowledge base
        const chunks = await this.retrieveChunks(inputs, context.library_ids ?? []);

        // Generate answer using retrieved context
        const answer = await this.generateAnswer(inputs, chunks, context);
        totalTokens += answer.tokens;

        return {
            success: answer.context_sufficient,
            outputs: {
                answer: answer.answer,
                sources: chunks.filter(c => answer.sources_used.includes(c.id)),
                confidence: answer.confidence,
                reasoning: answer.reasoning,
                related_topics: answer.related_topics,
                chunks_retrieved: chunks.length,
            },
            explanation: answer.context_sufficient
                ? `Answered using ${answer.sources_used.length} sources (${answer.confidence} confidence)`
                : 'Insufficient context in knowledge base',
            sources: chunks.map(c => c.source),
            tokens_used: totalTokens,
            duration_ms: Date.now() - startTime,
        };
    }

    private async retrieveChunks(
        query: string,
        libraryIds: string[]
    ): Promise<RetrievedChunk[]> {
        // Generate embedding for the query
        const queryEmbedding = await this.llm.embed(query);

        if (queryEmbedding.embeddings.length === 0 ||
            queryEmbedding.embeddings[0]?.every(v => v === 0)) {
            console.warn('[RAGAgent] Failed to generate query embedding');
            return [];
        }

        const chunks: RetrievedChunk[] = [];

        // Search each library for relevant chunks
        for (const libraryId of libraryIds) {
            try {
                // Get chunk IDs for this library
                const chunkKeys = await this.redis.keys(`chunk:${libraryId}:*`);

                for (const key of chunkKeys.slice(0, 20)) { // Limit for performance
                    const chunk = await this.redis.get(key) as {
                        content?: string;
                        source?: string;
                        embedding?: number[];
                        metadata?: Record<string, unknown>;
                    } | null;

                    if (chunk?.content && chunk?.embedding) {
                        const score = this.cosineSimilarity(
                            queryEmbedding.embeddings[0]!,
                            chunk.embedding
                        );

                        if (score > 0.5) { // Relevance threshold
                            chunks.push({
                                id: key,
                                content: chunk.content,
                                source: chunk.source ?? libraryId,
                                score,
                                metadata: chunk.metadata,
                            });
                        }
                    }
                }
            } catch (error) {
                console.warn(`[RAGAgent] Error searching library ${libraryId}:`, error);
            }
        }

        // Sort by score and return top chunks
        return chunks
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
            normA += (a[i] ?? 0) ** 2;
            normB += (b[i] ?? 0) ** 2;
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }

    private async generateAnswer(
        question: string,
        chunks: RetrievedChunk[],
        context: AgentContext
    ): Promise<{
        answer: string;
        sources_used: string[];
        confidence: 'high' | 'medium' | 'low';
        reasoning: string;
        related_topics: string[];
        context_sufficient: boolean;
        tokens: number;
    }> {
        const chunkContext = chunks.length > 0
            ? chunks.map((c, i) => `[Source ${i + 1}: ${c.id}]\n${c.content}`).join('\n\n')
            : 'No relevant context found in the knowledge base.';

        const prompt = RAG_PROMPT
            .replace('{question}', question)
            .replace('{context}', chunkContext)
            .replace('{conversation}', context.recent_context ?? 'No previous conversation');

        const result = await this.llm.json<{
            answer: string;
            sources_used: string[];
            confidence: 'high' | 'medium' | 'low';
            reasoning: string;
            related_topics: string[];
            context_sufficient: boolean;
        }>(prompt, {
            system: RAG_SYSTEM_PROMPT,
            temperature: 0.3,
            max_tokens: 2048,
        });

        if (result.data) {
            return {
                ...result.data,
                tokens: result.raw.tokens_used.total,
            };
        }

        return {
            answer: 'Unable to generate an answer.',
            sources_used: [],
            confidence: 'low',
            reasoning: 'Answer generation failed.',
            related_topics: [],
            context_sufficient: false,
            tokens: result.raw.tokens_used.total,
        };
    }
}
