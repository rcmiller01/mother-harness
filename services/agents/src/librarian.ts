/**
 * Librarian Agent
 * Ingests documents, creates embeddings, manages libraries
 */

import type { AgentType, Library, DoclingJob } from '@mother-harness/shared';
import { getRedisJSON, createLibrary } from '@mother-harness/shared';
import { BaseAgent, type AgentContext, type AgentResult } from './base-agent.js';
import { nanoid } from 'nanoid';

/** Ingestion report */
export interface IngestionReport {
    library_id: string;
    library_name: string;
    files_processed: number;
    chunks_created: number;
    embeddings_generated: number;
    images_extracted: number;
    errors: Array<{ file: string; error: string }>;
    duration_seconds: number;
}

export class LibrarianAgent extends BaseAgent {
    readonly agentType: AgentType = 'librarian';
    private redis = getRedisJSON();

    protected async run(inputs: string, context: AgentContext): Promise<AgentResult> {
        const startTime = Date.now();

        // Parse the librarian task
        const task = this.parseTask(inputs);

        let report: IngestionReport;

        switch (task.action) {
            case 'create_library':
                report = await this.createLibraryAction(task.name!, task.path!, context);
                break;
            case 'ingest':
                report = await this.ingestDocuments(task.library_id!, task.files, context);
                break;
            case 'scan':
                report = await this.scanLibrary(task.library_id!, context);
                break;
            default:
                throw new Error(`Unknown librarian action: ${task.action}`);
        }

        return {
            success: true,
            outputs: {
                ingestion_report: report,
                chunk_count: report.chunks_created,
                embedding_stats: {
                    total: report.embeddings_generated,
                    failed: report.errors.length,
                },
            },
            explanation: `Processed ${report.files_processed} files, created ${report.chunks_created} chunks`,
            tokens_used: 100,
            duration_ms: Date.now() - startTime,
        };
    }

    private parseTask(inputs: string): {
        action: 'create_library' | 'ingest' | 'scan';
        library_id?: string;
        name?: string;
        path?: string;
        files?: string[];
    } {
        // TODO: Parse the librarian command
        // For now, default to scan action
        return {
            action: 'scan',
            library_id: 'default',
        };
    }

    private async createLibraryAction(
        name: string,
        path: string,
        _context: AgentContext
    ): Promise<IngestionReport> {
        const libraryId = `lib-${nanoid()}`;
        const library = createLibrary(libraryId, name, path, true);

        await this.redis.set(`library:${libraryId}`, '$', library);

        return {
            library_id: libraryId,
            library_name: name,
            files_processed: 0,
            chunks_created: 0,
            embeddings_generated: 0,
            images_extracted: 0,
            errors: [],
            duration_seconds: 0,
        };
    }

    private async ingestDocuments(
        libraryId: string,
        files: string[] | undefined,
        _context: AgentContext
    ): Promise<IngestionReport> {
        // TODO: Implement actual document ingestion
        // 1. Read files from library path
        // 2. Send to Docling for processing
        // 3. Chunk the extracted content
        // 4. Generate embeddings
        // 5. Store in Redis with vectors

        const library = await this.redis.get<Library>(`library:${libraryId}`);

        return {
            library_id: libraryId,
            library_name: library?.name ?? 'Unknown',
            files_processed: files?.length ?? 0,
            chunks_created: 0,
            embeddings_generated: 0,
            images_extracted: 0,
            errors: [],
            duration_seconds: 0,
        };
    }

    private async scanLibrary(
        libraryId: string,
        _context: AgentContext
    ): Promise<IngestionReport> {
        // TODO: Scan library folder and ingest new/modified files

        const library = await this.redis.get<Library>(`library:${libraryId}`);

        return {
            library_id: libraryId,
            library_name: library?.name ?? 'Unknown',
            files_processed: 0,
            chunks_created: 0,
            embeddings_generated: 0,
            images_extracted: 0,
            errors: [],
            duration_seconds: 0,
        };
    }

    /**
     * Create a Docling job for async processing
     */
    async createDoclingJob(
        libraryId: string,
        filePath: string,
        operation: DoclingJob['operation'] = 'ingest'
    ): Promise<DoclingJob> {
        const library = await this.redis.get<Library>(`library:${libraryId}`);

        const job: DoclingJob = {
            id: `docling-${nanoid()}`,
            library_id: libraryId,
            library_name: library?.name ?? 'Unknown',
            file_path: filePath,
            operation,
            priority: 'normal',
            status: 'pending',
            created_at: new Date().toISOString(),
        };

        // TODO: Publish to Redis Stream for processing
        // await redis.xadd('stream:docling', '*', { job: JSON.stringify(job) });

        return job;
    }
}
