/**
 * Plugin Registry
 * Manages plugin registration, loading, and lifecycle
 */

import type {
    PluginManifest,
    PluginModule,
    PluginInstance,
    PluginContext,
    PanelRegistration,
    CommandRegistration,
    StatusItemRegistration,
} from './types';

class PluginRegistry {
    private plugins: Map<string, PluginInstance> = new Map();
    private panels: Map<string, PanelRegistration> = new Map();
    private commands: Map<string, CommandRegistration> = new Map();
    private statusItems: Map<string, StatusItemRegistration> = new Map();

    private listeners: {
        plugins: Set<(plugins: PluginInstance[]) => void>;
        panels: Set<(panels: PanelRegistration[]) => void>;
        commands: Set<(commands: CommandRegistration[]) => void>;
    } = {
            plugins: new Set(),
            panels: new Set(),
            commands: new Set(),
        };

    /** Register a plugin */
    async register(module: PluginModule): Promise<void> {
        const { manifest } = module;

        if (this.plugins.has(manifest.id)) {
            console.warn(`Plugin ${manifest.id} is already registered`);
            return;
        }

        // Create plugin context
        const context = this.createContext(manifest);

        const instance: PluginInstance = {
            manifest,
            module,
            context,
            status: 'inactive',
        };

        this.plugins.set(manifest.id, instance);
        this.notifyPluginsChanged();

        console.log(`Plugin registered: ${manifest.name} v${manifest.version}`);
    }

    /** Activate a plugin */
    async activate(pluginId: string): Promise<void> {
        const instance = this.plugins.get(pluginId);
        if (!instance) {
            throw new Error(`Plugin ${pluginId} not found`);
        }

        if (instance.status === 'active') {
            return;
        }

        try {
            // Call activate hook
            if (instance.module.activate) {
                await instance.module.activate();
            }

            instance.status = 'active';
            instance.error = undefined;
            this.notifyPluginsChanged();

            console.log(`Plugin activated: ${instance.manifest.name}`);
        } catch (error) {
            instance.status = 'error';
            instance.error = error instanceof Error ? error.message : 'Unknown error';
            this.notifyPluginsChanged();
            throw error;
        }
    }

    /** Deactivate a plugin */
    async deactivate(pluginId: string): Promise<void> {
        const instance = this.plugins.get(pluginId);
        if (!instance) {
            throw new Error(`Plugin ${pluginId} not found`);
        }

        if (instance.status !== 'active') {
            return;
        }

        try {
            // Call deactivate hook
            if (instance.module.deactivate) {
                await instance.module.deactivate();
            }

            // Remove registrations from this plugin
            this.removePluginRegistrations(pluginId);

            instance.status = 'inactive';
            this.notifyPluginsChanged();

            console.log(`Plugin deactivated: ${instance.manifest.name}`);
        } catch (error) {
            console.error(`Error deactivating plugin ${pluginId}:`, error);
            throw error;
        }
    }

    /** Unregister a plugin */
    async unregister(pluginId: string): Promise<void> {
        const instance = this.plugins.get(pluginId);
        if (!instance) return;

        if (instance.status === 'active') {
            await this.deactivate(pluginId);
        }

        this.plugins.delete(pluginId);
        this.notifyPluginsChanged();

        console.log(`Plugin unregistered: ${instance.manifest.name}`);
    }

    /** Get all plugins */
    getPlugins(): PluginInstance[] {
        return Array.from(this.plugins.values());
    }

    /** Get plugin by ID */
    getPlugin(id: string): PluginInstance | undefined {
        return this.plugins.get(id);
    }

    /** Get all registered panels */
    getPanels(): PanelRegistration[] {
        return Array.from(this.panels.values());
    }

    /** Get all registered commands */
    getCommands(): CommandRegistration[] {
        return Array.from(this.commands.values());
    }

    /** Get all status items */
    getStatusItems(): StatusItemRegistration[] {
        return Array.from(this.statusItems.values());
    }

    /** Subscribe to plugin changes */
    onPluginsChange(callback: (plugins: PluginInstance[]) => void): () => void {
        this.listeners.plugins.add(callback);
        return () => this.listeners.plugins.delete(callback);
    }

    /** Subscribe to panel changes */
    onPanelsChange(callback: (panels: PanelRegistration[]) => void): () => void {
        this.listeners.panels.add(callback);
        return () => this.listeners.panels.delete(callback);
    }

    /** Subscribe to command changes */
    onCommandsChange(callback: (commands: CommandRegistration[]) => void): () => void {
        this.listeners.commands.add(callback);
        return () => this.listeners.commands.delete(callback);
    }

    // Private methods

    private createContext(manifest: PluginManifest): PluginContext {
        const pluginId = manifest.id;

        return {
            manifest,

            ui: {
                registerPanel: (panel) => {
                    const fullId = `${pluginId}:${panel.id}`;
                    this.panels.set(fullId, { ...panel, id: fullId });
                    this.notifyPanelsChanged();
                },

                registerCommand: (command) => {
                    const fullId = `${pluginId}:${command.id}`;
                    this.commands.set(fullId, { ...command, id: fullId });
                    this.notifyCommandsChanged();
                },

                registerStatusItem: (item) => {
                    const fullId = `${pluginId}:${item.id}`;
                    this.statusItems.set(fullId, { ...item, id: fullId });
                },

                toast: {
                    success: (message) => console.log(`[Toast:success] ${message}`),
                    error: (message) => console.log(`[Toast:error] ${message}`),
                    warning: (message) => console.log(`[Toast:warning] ${message}`),
                    info: (message) => console.log(`[Toast:info] ${message}`),
                },
            },

            data: {
                onMessage: () => () => { },
                onAgentStatus: () => () => { },
                getMessages: () => [],
                getAgents: () => [],
            },

            storage: {
                get: <T>(key: string): T | null => {
                    try {
                        const stored = localStorage.getItem(`plugin:${pluginId}:${key}`);
                        return stored ? JSON.parse(stored) : null;
                    } catch {
                        return null;
                    }
                },
                set: <T>(key: string, value: T) => {
                    try {
                        localStorage.setItem(`plugin:${pluginId}:${key}`, JSON.stringify(value));
                    } catch (e) {
                        console.error('Plugin storage error:', e);
                    }
                },
                remove: (key: string) => {
                    localStorage.removeItem(`plugin:${pluginId}:${key}`);
                },
            },
        };
    }

    private removePluginRegistrations(pluginId: string): void {
        // Remove panels
        for (const [id] of this.panels) {
            if (id.startsWith(`${pluginId}:`)) {
                this.panels.delete(id);
            }
        }
        this.notifyPanelsChanged();

        // Remove commands
        for (const [id] of this.commands) {
            if (id.startsWith(`${pluginId}:`)) {
                this.commands.delete(id);
            }
        }
        this.notifyCommandsChanged();

        // Remove status items
        for (const [id] of this.statusItems) {
            if (id.startsWith(`${pluginId}:`)) {
                this.statusItems.delete(id);
            }
        }
    }

    private notifyPluginsChanged(): void {
        const plugins = this.getPlugins();
        this.listeners.plugins.forEach((cb) => cb(plugins));
    }

    private notifyPanelsChanged(): void {
        const panels = this.getPanels();
        this.listeners.panels.forEach((cb) => cb(panels));
    }

    private notifyCommandsChanged(): void {
        const commands = this.getCommands();
        this.listeners.commands.forEach((cb) => cb(commands));
    }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();

// Export type
export type { PluginRegistry };
