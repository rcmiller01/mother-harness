/**
 * Document Processor
 * Handles document extraction, chunking, and embedding
 */

import type { DocumentChunk, Library, DoclingJob } from '@mother-harness/shared';
import { getRedisJSON, getRedisClient } from '@mother-harness/shared';
import { nanoid } from 'nanoid';
import * as path from 'path';
import * as crypto from 'crypto';

/** Docling API configuration */
interface DoclingConfig {
    apiUrl: string;
    timeout: number;
    maxRetries: number;
}

/** Extraction result from Docling API */
interface ExtractionResult {
    text: string;
    pages: Array<{
        page_number: number;
        content: string;
        tables?: Array<{ content: string; caption?: string }>;
        images?: Array<{ path: string; caption?: string }>;
    }>;
    metadata: {
        title?: string;
        author?: string;
        created_date?: string;
        page_count: number;
    };
}

/** Chunk with embedding placeholder */
interface ProcessedChunk {
    content: string;
    page_number?: number;
    section_title?: string;
    hierarchy: string[];
    images: DocumentChunk['images'];
    tables: DocumentChunk['tables'];
}

export class DocumentProcessor {
    private redis = getRedisJSON();
    private redisClient = getRedisClient();
    private config: DoclingConfig;

    /** Chunking parameters */
    private readonly CHUNK_SIZE = 450; // tokens (approx 4 chars per token)
    private readonly CHUNK_OVERLAP = 80;
    private readonly CHARS_PER_TOKEN = 4;

    constructor(config?: Partial<DoclingConfig>) {
        this.config = {
            apiUrl: config?.apiUrl ?? process.env['DOCLING_API_URL'] ?? 'http://localhost:8000',
            timeout: config?.timeout ?? 300000, // 5 minutes
            maxRetries: config?.maxRetries ?? 3,
        };
    }

    /**
     * Process a document ingestion job
     */
    async processJob(job: DoclingJob): Promise<{ success: boolean; chunks: number; error?: string }> {
        const startTime = Date.now();

        try {
            // Update job status to processing
            await this.updateJobStatus(job.id, 'processing');

            // Extract content from document
            const extraction = await this.extractDocument(job.file_path);

            // Chunk the content
            const chunks = this.chunkDocument(extraction, job);

            // Generate embeddings (placeholder - would call embedding API)
            const chunksWithEmbeddings = await this.generateEmbeddings(chunks);

            // Store chunks in Redis
            await this.storeChunks(job.library_id, chunksWithEmbeddings);

            // Update library stats
            await this.updateLibraryStats(job.library_id, chunks.length);

            // Update job status to completed
            await this.updateJobStatus(job.id, 'completed', {
                chunks_created: chunks.length,
                duration_ms: Date.now() - startTime,
            });

            return { success: true, chunks: chunks.length };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Update job status to failed
            await this.updateJobStatus(job.id, 'failed', { error: errorMessage });

            // Move file to _failed folder if max retries exceeded
            await this.handleFailure(job, errorMessage);

            return { success: false, chunks: 0, error: errorMessage };
        }
    }

    /**
     * Extract content from document using Docling API
     */
    private async extractDocument(filePath: string): Promise<ExtractionResult> {
        // TODO: Implement actual Docling API call
        // For now, return placeholder

        console.log(`[Processor] Would extract: ${filePath}`);

        return {
            text: `Extracted content from ${path.basename(filePath)}`,
            pages: [
                {
                    page_number: 1,
                    content: 'Page 1 content...',
                },
            ],
            metadata: {
                title: path.basename(filePath, path.extname(filePath)),
                page_count: 1,
            },
        };
    }

    /**
     * Chunk document content
     */
    private chunkDocument(extraction: ExtractionResult, job: DoclingJob): ProcessedChunk[] {
        const chunks: ProcessedChunk[] = [];
        const chunkSize = this.CHUNK_SIZE * this.CHARS_PER_TOKEN;
        const overlap = this.CHUNK_OVERLAP * this.CHARS_PER_TOKEN;

        // Process each page
        for (const page of extraction.pages) {
            const content = page.content;
            let startIndex = 0;

            while (startIndex < content.length) {
                const endIndex = Math.min(startIndex + chunkSize, content.length);
                const chunkContent = content.slice(startIndex, endIndex);

                chunks.push({
                    content: chunkContent,
                    page_number: page.page_number,
                    hierarchy: extraction.metadata.title ? [extraction.metadata.title] : [],
                    images: (page.images ?? []).map(img => ({
                        id: `img-${nanoid()}`,
                        file_path: img.path,
                        caption: img.caption,
                        page_number: page.page_number,
                    })),
                    tables: (page.tables ?? []).map(tbl => ({
                        id: `tbl-${nanoid()}`,
                        content: tbl.content,
                        caption: tbl.caption,
                        page_number: page.page_number,
                    })),
                });

                // Move start with overlap
                startIndex = endIndex - overlap;
                if (startIndex >= content.length - overlap) break;
            }
        }

        return chunks;
    }

    /**
     * Generate embeddings for chunks
     */
    private async generateEmbeddings(
        chunks: ProcessedChunk[]
    ): Promise<Array<ProcessedChunk & { embedding: number[] }>> {
        // TODO: Call actual embedding API (Ollama or cloud)
        // For now, generate zero vectors as placeholders

        return chunks.map(chunk => ({
            ...chunk,
            embedding: new Array(768).fill(0), // 768-dim placeholder
        }));
    }

    /**
     * Store chunks in Redis
     */
    private async storeChunks(
        libraryId: string,
        chunks: Array<ProcessedChunk & { embedding: number[] }>
    ): Promise<void> {
        for (const chunk of chunks) {
            const chunkId = `chunk-${nanoid()}`;
            const docChunk: DocumentChunk = {
                id: chunkId,
                library: libraryId,
                document_id: `doc-${nanoid()}`,
                document_name: 'Processed Document',
                file_path: '',
                content: chunk.content,
                embedding: chunk.embedding,
                images: chunk.images,
                tables: chunk.tables,
                page_number: chunk.page_number,
                section_title: chunk.section_title,
                hierarchy: chunk.hierarchy,
                chunk_type: 'text',
                indexed_at: new Date().toISOString(),
                source_modified_at: new Date().toISOString(),
                searchable: chunk.embedding.some(v => v !== 0),
            };

            await this.redis.set(`doc:${chunkId}`, '$', docChunk);
        }
    }

    /**
     * Update library statistics
     */
    private async updateLibraryStats(libraryId: string, newChunks: number): Promise<void> {
        const library = await this.redis.get<Library>(`library:${libraryId}`);
        if (library) {
            const updatedCount = library.document_count + 1;
            await this.redis.set(`library:${libraryId}`, '$.document_count', updatedCount);
            await this.redis.set(`library:${libraryId}`, '$.last_scanned', new Date().toISOString());
        }
    }

    /**
     * Update job status
     */
    private async updateJobStatus(
        jobId: string,
        status: DoclingJob['status'],
        metadata?: Record<string, unknown>
    ): Promise<void> {
        const key = `docling_job:${jobId}`;
        await this.redis.set(key, '$.status', status);
        if (metadata) {
            for (const [k, v] of Object.entries(metadata)) {
                await this.redis.set(key, `$.${k}`, v);
            }
        }
    }

    /**
     * Handle processing failure
     */
    private async handleFailure(job: DoclingJob, error: string): Promise<void> {
        // Log the failure
        console.error(`[Processor] Job ${job.id} failed: ${error}`);

        // TODO: Move file to _failed folder if max retries exceeded
        // TODO: Send alert if configured
    }

    /**
     * Generate content hash for deduplication
     */
    private hashContent(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }
}

// Singleton
let processorInstance: DocumentProcessor | null = null;

export function getDocumentProcessor(): DocumentProcessor {
    if (!processorInstance) {
        processorInstance = new DocumentProcessor();
    }
    return processorInstance;
}
