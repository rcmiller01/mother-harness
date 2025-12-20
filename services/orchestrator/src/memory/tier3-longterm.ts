/**
 * Tier 3 Memory - Long-term Vector Memory
 * Semantic search over embedded memories
 */

import type { LongTermMemory, Project } from '@mother-harness/shared';
import { getRedisClient, getRedisJSON } from '@mother-harness/shared';
import { nanoid } from 'nanoid';

/** Memory categories */
export type MemoryCategory =
    | 'decision'     // Important decisions made
    | 'finding'      // Key research findings
    | 'preference'   // User preferences learned
    | 'process'      // Process/workflow information
    | 'entity'       // Important entities mentioned
    | 'other';

/** Memory with embedding */
interface EmbeddedMemory extends LongTermMemory {
    category: MemoryCategory;
    importance: number; // 0-1 scale
    access_count: number;
    last_accessed: string;
}

export class Tier3Memory {
    private redis = getRedisJSON();
    private redisClient = getRedisClient();
    private readonly memoryPrefix = 'memory:';

    /**
     * Store a long-term memory
     */
    async storeMemory(
        projectId: string,
        content: string,
        metadata: {
            source: string;
            category?: MemoryCategory;
            importance?: number;
        }
    ): Promise<LongTermMemory> {
        // Generate embedding (placeholder)
        const embedding = await this.generateEmbedding(content);

        const memory: EmbeddedMemory = {
            id: `mem-${nanoid()}`,
            content,
            embedding,
            source: metadata.source,
            created_at: new Date().toISOString(),
            category: metadata.category ?? 'other',
            importance: metadata.importance ?? 0.5,
            access_count: 0,
            last_accessed: new Date().toISOString(),
        };

        // Store in Redis with vector
        await this.redis.set(`${this.memoryPrefix}${memory.id}`, '$', memory);

        // Update project's long-term memory reference
        await this.addToProject(projectId, memory);

        return memory;
    }

    /**
     * Retrieve relevant memories using semantic search
     */
    async retrieveRelevant(
        projectId: string,
        query: string,
        limit: number = 5
    ): Promise<LongTermMemory[]> {
        // Generate query embedding
        const queryEmbedding = await this.generateEmbedding(query);

        // TODO: Implement actual vector search using RediSearch
        // FT.SEARCH idx:memories "*=>[KNN $k @embedding $query_vec AS score]"
        //   PARAMS 4 k <limit> query_vec <embedding>
        //   SORTBY score
        //   DIALECT 2

        // For now, return most recent memories from project
        const project = await this.redis.get<Project>(`project:${projectId}`);
        const memories: LongTermMemory[] = [];

        if (project?.long_term_memory) {
            for (const mem of project.long_term_memory.slice(-limit)) {
                memories.push(mem);
                // Update access stats
                await this.recordAccess(mem.id);
            }
        }

        return memories;
    }

    /**
     * Get formatted context from long-term memory
     */
    async getContextString(projectId: string, query: string): Promise<string> {
        const memories = await this.retrieveRelevant(projectId, query);

        if (memories.length === 0) {
            return 'No relevant long-term memories.';
        }

        return 'Relevant long-term memories:\n' +
            memories
                .map((m, i) => `${i + 1}. [${m.source}] ${m.content}`)
                .join('\n');
    }

    /**
     * Extract and store important information from task results
     */
    async extractAndStore(
        projectId: string,
        taskId: string,
        content: string
    ): Promise<number> {
        // TODO: Use LLM to extract important information
        // For now, store the entire content as a single memory

        const memory = await this.storeMemory(projectId, content, {
            source: `task:${taskId}`,
            category: 'finding',
            importance: 0.6,
        });

        return 1; // Number of memories stored
    }

    /**
     * Generate embedding for content
     */
    private async generateEmbedding(content: string): Promise<number[]> {
        // TODO: Call actual embedding API (Ollama or cloud)
        // For now, return zero vector placeholder
        return new Array(768).fill(0);
    }

    /**
     * Add memory reference to project
     */
    private async addToProject(projectId: string, memory: LongTermMemory): Promise<void> {
        const project = await this.redis.get<Project>(`project:${projectId}`);
        if (!project) return;

        const memories = [...(project.long_term_memory ?? []), memory];

        // Keep only the most recent 100 references
        const trimmed = memories.slice(-100);

        await this.redis.set(`project:${projectId}`, '$.long_term_memory', trimmed);
    }

    /**
     * Record memory access for ranking
     */
    private async recordAccess(memoryId: string): Promise<void> {
        const key = `${this.memoryPrefix}${memoryId}`;
        const memory = await this.redis.get<EmbeddedMemory>(key);

        if (memory) {
            memory.access_count++;
            memory.last_accessed = new Date().toISOString();
            await this.redis.set(key, '$', memory);
        }
    }

    /**
     * Forget memories older than a threshold (with low importance)
     */
    async forget(
        projectId: string,
        options: {
            older_than_days?: number;
            importance_below?: number;
        } = {}
    ): Promise<number> {
        const threshold = options.older_than_days ?? 90;
        const importanceThreshold = options.importance_below ?? 0.3;
        const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);

        const project = await this.redis.get<Project>(`project:${projectId}`);
        if (!project?.long_term_memory) return 0;

        let forgotten = 0;
        const kept: LongTermMemory[] = [];

        for (const mem of project.long_term_memory) {
            const memFull = await this.redis.get<EmbeddedMemory>(`${this.memoryPrefix}${mem.id}`);

            const isOld = new Date(mem.created_at) < cutoff;
            const isLowImportance = (memFull?.importance ?? 1) < importanceThreshold;
            const isLowAccess = (memFull?.access_count ?? 0) < 3;

            if (isOld && isLowImportance && isLowAccess) {
                // Forget this memory
                await this.redis.del(`${this.memoryPrefix}${mem.id}`);
                forgotten++;
            } else {
                kept.push(mem);
            }
        }

        await this.redis.set(`project:${projectId}`, '$.long_term_memory', kept);

        return forgotten;
    }
}
