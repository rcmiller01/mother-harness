/**
 * Plugin SDK Types
 * Core interfaces for the Mission Control plugin system
 */

/** Plugin metadata */
export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    icon?: string;
    homepage?: string;
    repository?: string;
    keywords?: string[];

    // Plugin capabilities
    capabilities: PluginCapability[];

    // Required permissions
    permissions?: PluginPermission[];

    // Entry points
    main?: string;  // Main JS entry
    styles?: string; // Optional CSS
}

/** Plugin capabilities */
export type PluginCapability =
    | 'panel'           // Adds a panel to the right sidebar
    | 'command'         // Adds commands to command palette
    | 'message-action'  // Adds actions to messages
    | 'agent-widget'    // Adds widget to agent cards
    | 'status-item'     // Adds item to status bar
    | 'theme'           // Provides theme customization
    | 'tool';           // Provides new agent tools

/** Plugin permissions */
export type PluginPermission =
    | 'read:messages'    // Read message content
    | 'read:agents'      // Read agent status
    | 'read:files'       // Read file context
    | 'write:messages'   // Send messages
    | 'write:files'      // Modify file context
    | 'network'          // Make network requests
    | 'storage';         // Use local storage

/** Plugin lifecycle hooks */
export interface PluginLifecycle {
    /** Called when plugin is activated */
    activate?: () => void | Promise<void>;

    /** Called when plugin is deactivated */
    deactivate?: () => void | Promise<void>;
}

/** Plugin API context provided to plugins */
export interface PluginContext {
    // Plugin info
    manifest: PluginManifest;

    // UI APIs
    ui: {
        /** Register a panel for the right sidebar */
        registerPanel: (panel: PanelRegistration) => void;

        /** Register a command for the command palette */
        registerCommand: (command: CommandRegistration) => void;

        /** Register a status bar item */
        registerStatusItem: (item: StatusItemRegistration) => void;

        /** Show a toast notification */
        toast: {
            success: (message: string) => void;
            error: (message: string) => void;
            warning: (message: string) => void;
            info: (message: string) => void;
        };
    };

    // Data APIs
    data: {
        /** Subscribe to messages */
        onMessage: (callback: (message: MessageData) => void) => () => void;

        /** Subscribe to agent status changes */
        onAgentStatus: (callback: (agents: AgentData[]) => void) => () => void;

        /** Get current thread messages */
        getMessages: () => MessageData[];

        /** Get current agents */
        getAgents: () => AgentData[];
    };

    // Storage APIs
    storage: {
        /** Get stored value */
        get: <T>(key: string) => T | null;

        /** Set stored value */
        set: <T>(key: string, value: T) => void;

        /** Remove stored value */
        remove: (key: string) => void;
    };
}

/** Panel registration */
export interface PanelRegistration {
    id: string;
    title: string;
    icon: string;  // Lucide icon name
    render: () => HTMLElement | React.ReactNode;
    badge?: () => number | undefined;
}

/** Command registration */
export interface CommandRegistration {
    id: string;
    title: string;
    description?: string;
    icon?: string;
    shortcut?: string;
    execute: () => void;
}

/** Status item registration */
export interface StatusItemRegistration {
    id: string;
    render: () => HTMLElement | React.ReactNode;
    position?: 'left' | 'right';
    priority?: number;
}

/** Message data exposed to plugins */
export interface MessageData {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool' | 'approval';
    content: string;
    timestamp: string;
    agentType?: string;
    agentName?: string;
}

/** Agent data exposed to plugins */
export interface AgentData {
    type: string;
    name: string;
    status: 'active' | 'idle' | 'error';
    currentTask?: string;
}

/** Plugin module interface (what plugin exports) */
export interface PluginModule extends PluginLifecycle {
    /** Plugin manifest */
    manifest: PluginManifest;
}

/** Plugin instance (loaded plugin) */
export interface PluginInstance {
    manifest: PluginManifest;
    module: PluginModule;
    context: PluginContext;
    status: 'active' | 'inactive' | 'error';
    error?: string;
}
