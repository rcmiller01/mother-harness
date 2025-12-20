/**
 * Librarian Agent
 * Manages document libraries, ingestion, and organization
 */

import type { AgentType, Library } from '@mother-harness/shared';
import { getLLMClient, getRedisJSON } from '@mother-harness/shared';
import { BaseAgent, type AgentContext, type AgentResult } from './base-agent.js';
import { nanoid } from 'nanoid';

/** Librarian command types */
type LibrarianCommand = 'create_library' | 'add_document' | 'search' | 'organize' | 'status';

const LIBRARIAN_SYSTEM_PROMPT = `You are a knowledge management specialist. Your role is to:
1. Organize and categorize documents effectively
2. Create meaningful tags and metadata
3. Ensure documents are easily discoverable
4. Maintain library structure and organization
5. Help users find relevant information

Be systematic and consistent in your organization approach.`;

const PARSE_COMMAND_PROMPT = `Parse this librarian command:

Input: {input}

Return a JSON object:
{
  "command": "create_library" | "add_document" | "search" | "organize" | "status",
  "library_name": "name if creating/targeting a library",
  "documents": ["paths to documents if adding"],
  "search_query": "search query if searching",
  "metadata": { "any additional metadata" }
}`;

const ORGANIZE_PROMPT = `Suggest organization for these documents:

Documents: {documents}
Current Library: {library}

Return a JSON object:
{
  "suggested_tags": ["array of suggested tags"],
  "suggested_categories": ["array of categories"],
  "document_assignments": [
    { "document": "doc name", "tags": ["tag1"], "category": "category" }
  ],
  "summary": "brief summary of the organization scheme"
}`;

export class LibrarianAgent extends BaseAgent {
    readonly agentType: AgentType = 'librarian';
    private llm = getLLMClient();
    private redis = getRedisJSON();

    protected async run(inputs: string, context: AgentContext): Promise<AgentResult> {
        const startTime = Date.now();
        let totalTokens = 0;

        // Parse the command
        const command = await this.parseCommand(inputs);
        totalTokens += command.tokens;

        // Execute the command
        const result = await this.executeCommand(command, context);
        totalTokens += result.tokens;

        return {
            success: result.success,
            outputs: result.data,
            explanation: result.message,
            tokens_used: totalTokens,
            duration_ms: Date.now() - startTime,
        };
    }

    private async parseCommand(inputs: string): Promise<{
        command: LibrarianCommand;
        library_name?: string;
        documents?: string[];
        search_query?: string;
        metadata?: Record<string, unknown>;
        tokens: number;
    }> {
        const prompt = PARSE_COMMAND_PROMPT.replace('{input}', inputs);

        const result = await this.llm.json<{
            command: LibrarianCommand;
            library_name?: string;
            documents?: string[];
            search_query?: string;
            metadata?: Record<string, unknown>;
        }>(prompt, {
            system: LIBRARIAN_SYSTEM_PROMPT,
            temperature: 0.2,
        });

        if (result.data) {
            return {
                ...result.data,
                tokens: result.raw.tokens_used.total,
            };
        }

        // Default to status if parsing fails
        return {
            command: 'status',
            tokens: result.raw.tokens_used.total,
        };
    }

    private async executeCommand(
        command: Awaited<ReturnType<typeof this.parseCommand>>,
        context: AgentContext
    ): Promise<{
        success: boolean;
        data: Record<string, unknown>;
        message: string;
        tokens: number;
    }> {
        switch (command.command) {
            case 'create_library':
                return this.createLibrary(command.library_name ?? 'Untitled Library', command.metadata);

            case 'add_document':
                return this.addDocuments(
                    command.library_name ?? context.library_ids?.[0] ?? 'default',
                    command.documents ?? []
                );

            case 'search':
                return this.searchLibrary(
                    command.library_name ?? context.library_ids?.[0],
                    command.search_query ?? ''
                );

            case 'organize':
                return this.organizeLibrary(command.library_name ?? context.library_ids?.[0]);

            case 'status':
            default:
                return this.getStatus(context.library_ids);
        }
    }

    private async createLibrary(
        name: string,
        metadata?: Record<string, unknown>
    ): Promise<{ success: boolean; data: Record<string, unknown>; message: string; tokens: number }> {
        const libraryId = `lib-${nanoid(10)}`;
        const library: Library = {
            id: libraryId,
            name,
            description: (metadata?.description as string) ?? '',
            folder_path: (metadata?.folder_path as string) ?? `/libraries/${libraryId}`,
            watch_enabled: false,
            document_count: 0,
            chunk_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        await this.redis.set(`library:${libraryId}`, '$', library);

        return {
            success: true,
            data: { library },
            message: `Created library "${name}" with ID ${libraryId}`,
            tokens: 0,
        };
    }

    private async addDocuments(
        libraryId: string,
        documents: string[]
    ): Promise<{ success: boolean; data: Record<string, unknown>; message: string; tokens: number }> {
        if (documents.length === 0) {
            return {
                success: false,
                data: {},
                message: 'No documents specified',
                tokens: 0,
            };
        }

        // Queue documents for processing
        const jobs = documents.map(doc => ({
            id: `job-${nanoid(10)}`,
            library_id: libraryId,
            file_path: doc,
            status: 'queued' as const,
            created_at: new Date().toISOString(),
        }));

        for (const job of jobs) {
            await this.redis.set(`docjob:${job.id}`, '$', job);
        }

        return {
            success: true,
            data: { jobs, count: jobs.length },
            message: `Queued ${jobs.length} document(s) for processing`,
            tokens: 0,
        };
    }

    private async searchLibrary(
        libraryId: string | undefined,
        query: string
    ): Promise<{ success: boolean; data: Record<string, unknown>; message: string; tokens: number }> {
        if (!libraryId) {
            return {
                success: false,
                data: {},
                message: 'No library specified',
                tokens: 0,
            };
        }

        // Generate embedding for search
        const embedding = await this.llm.embed(query);

        // Note: Full vector search would use RediSearch FT.SEARCH
        // This is a simplified implementation
        return {
            success: true,
            data: {
                query,
                library_id: libraryId,
                results: [],
                message: 'Search results would appear here with full RediSearch integration',
            },
            message: `Searched library ${libraryId} for "${query}"`,
            tokens: 0,
        };
    }

    private async organizeLibrary(
        libraryId: string | undefined
    ): Promise<{ success: boolean; data: Record<string, unknown>; message: string; tokens: number }> {
        if (!libraryId) {
            return {
                success: false,
                data: {},
                message: 'No library specified',
                tokens: 0,
            };
        }

        const library = await this.redis.get(`library:${libraryId}`) as Library | null;
        if (!library) {
            return {
                success: false,
                data: {},
                message: `Library ${libraryId} not found`,
                tokens: 0,
            };
        }

        const prompt = ORGANIZE_PROMPT
            .replace('{documents}', `${library.document_count} documents`)
            .replace('{library}', library.name);

        const result = await this.llm.json<{
            suggested_tags: string[];
            suggested_categories: string[];
            summary: string;
        }>(prompt, {
            system: LIBRARIAN_SYSTEM_PROMPT,
            temperature: 0.4,
        });

        return {
            success: true,
            data: result.data ?? {},
            message: `Organization suggestions for ${library.name}`,
            tokens: result.raw.tokens_used.total,
        };
    }

    private async getStatus(
        libraryIds?: string[]
    ): Promise<{ success: boolean; data: Record<string, unknown>; message: string; tokens: number }> {
        const libraries: Library[] = [];

        if (libraryIds && libraryIds.length > 0) {
            for (const id of libraryIds) {
                const lib = await this.redis.get(`library:${id}`) as Library | null;
                if (lib) libraries.push(lib);
            }
        }

        return {
            success: true,
            data: {
                libraries,
                total_count: libraries.length,
            },
            message: `Found ${libraries.length} library(ies)`,
            tokens: 0,
        };
    }
}
