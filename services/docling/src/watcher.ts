/**
 * Library Watcher
 * Monitors library folders for file changes using chokidar
 */

import chokidar from 'chokidar';
import type { Library } from '@mother-harness/shared';
import { getRedisClient } from '@mother-harness/shared';
import { nanoid } from 'nanoid';

/** Supported file extensions for ingestion */
const SUPPORTED_EXTENSIONS = [
    '.pdf', '.epub', '.html', '.htm', '.md', '.txt',
    '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls',
];

/** File event types */
type FileEvent = 'add' | 'change' | 'unlink';

/** Ingestion job to be published */
interface IngestionJob {
    id: string;
    library_id: string;
    library_name: string;
    file_path: string;
    event: FileEvent;
    priority: 'high' | 'normal' | 'low';
    created_at: string;
}

export class LibraryWatcher {
    private watchers: Map<string, chokidar.FSWatcher> = new Map();
    private redis = getRedisClient();
    private readonly streamKey = 'stream:docling';

    /**
     * Start watching a library folder
     */
    async watchLibrary(library: Library): Promise<void> {
        if (this.watchers.has(library.id)) {
            console.log(`[Watcher] Already watching library: ${library.name}`);
            return;
        }

        const watcher = chokidar.watch(library.folder_path, {
            ignored: [
                /[\/\\]\./, // Ignore dotfiles
                /[\/\\]_failed[\/\\]/, // Ignore _failed folder
                /[\/\\]_images[\/\\]/, // Ignore _images folder
            ],
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100,
            },
        });

        watcher.on('add', async (filePath) => {
            if (this.isSupportedFile(filePath)) {
                await this.publishJob(library, filePath, 'add');
            }
        });

        watcher.on('change', async (filePath) => {
            if (this.isSupportedFile(filePath)) {
                await this.publishJob(library, filePath, 'change');
            }
        });

        watcher.on('unlink', async (filePath) => {
            if (this.isSupportedFile(filePath)) {
                await this.publishJob(library, filePath, 'unlink');
            }
        });

        watcher.on('error', (error) => {
            console.error(`[Watcher] Error watching ${library.name}:`, error);
        });

        watcher.on('ready', () => {
            console.log(`[Watcher] Started watching library: ${library.name} at ${library.folder_path}`);
        });

        this.watchers.set(library.id, watcher);
    }

    /**
     * Stop watching a library
     */
    async stopWatching(libraryId: string): Promise<void> {
        const watcher = this.watchers.get(libraryId);
        if (watcher) {
            await watcher.close();
            this.watchers.delete(libraryId);
            console.log(`[Watcher] Stopped watching library: ${libraryId}`);
        }
    }

    /**
     * Stop all watchers
     */
    async stopAll(): Promise<void> {
        for (const [id, watcher] of this.watchers) {
            await watcher.close();
            console.log(`[Watcher] Stopped watching library: ${id}`);
        }
        this.watchers.clear();
    }

    /**
     * Check if file has a supported extension
     */
    private isSupportedFile(filePath: string): boolean {
        const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
        return SUPPORTED_EXTENSIONS.includes(ext);
    }

    /**
     * Publish ingestion job to Redis Stream
     */
    private async publishJob(
        library: Library,
        filePath: string,
        event: FileEvent
    ): Promise<void> {
        const job: IngestionJob = {
            id: `job-${nanoid()}`,
            library_id: library.id,
            library_name: library.name,
            file_path: filePath,
            event,
            priority: event === 'add' ? 'normal' : event === 'change' ? 'normal' : 'low',
            created_at: new Date().toISOString(),
        };

        // Add to Redis Stream
        await this.redis.xadd(
            this.streamKey,
            '*',
            'job',
            JSON.stringify(job)
        );

        console.log(`[Watcher] Published ${event} job for: ${filePath}`);
    }

    /**
     * Get count of active watchers
     */
    getActiveWatcherCount(): number {
        return this.watchers.size;
    }
}

// Singleton
let watcherInstance: LibraryWatcher | null = null;

export function getLibraryWatcher(): LibraryWatcher {
    if (!watcherInstance) {
        watcherInstance = new LibraryWatcher();
    }
    return watcherInstance;
}
