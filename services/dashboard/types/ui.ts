/**
 * UI Types for Mission Control
 */

// Local type to avoid ESM issues with shared package during build
export type AgentType =
    | 'orchestrator' | 'researcher' | 'coder' | 'design'
    | 'analyst' | 'critic' | 'skeptic' | 'rag'
    | 'librarian' | 'vision' | 'update' | 'toolsmith';

/** Agent status for display */
export interface AgentStatus {
    type: AgentType;
    name: string;
    status: 'active' | 'idle' | 'error';
    currentTask?: string;
    tokensUsed: number;
    lastActive: string;
}

/** Conversation for sidebar */
export interface Conversation {
    id: string;
    title: string;
    preview: string;
    createdAt: string;
    updatedAt: string;
    isPinned: boolean;
    messageCount: number;
    agentsInvolved: AgentType[];
}

/** Message for chat display */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    agentType?: AgentType;
    agentName?: string;
    metadata?: {
        tokensUsed?: number;
        durationMs?: number;
        model?: string;
    };
    attachments?: MessageAttachment[];
    isStreaming?: boolean;
}

/** Message attachment */
export interface MessageAttachment {
    id: string;
    type: 'file' | 'image' | 'code';
    name: string;
    content?: string;
    url?: string;
}

/** Approval for display */
export interface ApprovalDisplay {
    id: string;
    agentType: AgentType;
    agentName: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
    type: string;
    preview: {
        files?: string[];
        commands?: string[];
    };
    createdAt: string;
    status: 'pending' | 'approved' | 'rejected';
}

/** Task for display */
export interface TaskDisplay {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    agentType: AgentType;
    progress?: number;
    createdAt: string;
}

/** Context file for display */
export interface ContextFile {
    id: string;
    name: string;
    path: string;
    type: 'document' | 'code' | 'image' | 'data';
    size: number;
    addedAt: string;
}

/** Right panel tab options */
export type RightPanelTab = 'agents' | 'context' | 'tasks' | 'files' | 'approvals';

/** Connection status */
export interface ConnectionStatus {
    redis: 'connected' | 'disconnected' | 'error';
    ollama: 'connected' | 'disconnected' | 'error';
    api: 'connected' | 'disconnected' | 'error';
}

/** Token usage stats */
export interface TokenUsage {
    local: number;
    cloud: number;
    cost: number;
}

/** Event from agent activity stream */
export interface AgentEvent {
    id: string;
    type: 'started' | 'progress' | 'completed' | 'error' | 'approval_needed';
    agentType: AgentType;
    message: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
