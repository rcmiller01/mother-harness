/**
 * WebSocket Connection Manager
 * Handles real-time communication with orchestrator
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://192.168.50.219:8002';

type MessageHandler = (message: WebSocketMessage) => void;

export interface WebSocketMessage {
    type: string;
    task_id?: string;
    run_id?: string;
    data?: unknown;
    timestamp?: string;
}

export interface TaskUpdateMessage extends WebSocketMessage {
    type: 'task_update';
    data: {
        status: string;
        current_step?: string;
        progress?: number;
    };
}

export interface AgentEventMessage extends WebSocketMessage {
    type: 'agent_event';
    data: {
        agent: string;
        event: 'started' | 'progress' | 'completed' | 'error';
        message?: string;
        tokens_used?: number;
    };
}

export interface ApprovalNeededMessage extends WebSocketMessage {
    type: 'approval_needed';
    data: {
        approval_id: string;
        agent: string;
        description: string;
        risk_level: 'low' | 'medium' | 'high';
    };
}

export interface StreamContentMessage extends WebSocketMessage {
    type: 'stream_content';
    data: {
        content: string;
        agent?: string;
        done?: boolean;
    };
}

class WebSocketConnection {
    private ws: WebSocket | null = null;
    private handlers: Map<string, Set<MessageHandler>> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private pingInterval: NodeJS.Timeout | null = null;
    private taskId: string | null = null;

    constructor() {
        // Bind methods
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.send = this.send.bind(this);
    }

    connect(taskId?: string): void {
        if (typeof window === 'undefined') return;

        this.taskId = taskId || null;

        // Get user_id from identity store (persisted in localStorage)
        let userId: string | null = null;
        try {
            const identityData = localStorage.getItem('mother-harness-identity');
            if (identityData) {
                const parsed = JSON.parse(identityData);
                userId = parsed?.state?.identity?.id || null;
            }
        } catch (e) {
            console.warn('[WS] Failed to get identity from localStorage:', e);
        }

        // Build URL with user_id for simplified auth
        let url = `${WS_URL}/ws`;
        const params = new URLSearchParams();
        if (taskId) params.set('task_id', taskId);
        if (userId) params.set('user_id', userId);

        // Also try legacy token if available
        const token = localStorage.getItem('auth_token');
        if (token) params.set('token', token);

        const queryString = params.toString();
        const urlWithParams = queryString ? `${url}?${queryString}` : url;

        try {
            this.ws = new WebSocket(urlWithParams);

            this.ws.onopen = () => {
                console.log('[WS] Connected');
                this.reconnectAttempts = 0;
                this.startPing();
                this.emit({ type: 'connection', data: { status: 'connected' } });
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    this.emit(message);
                } catch (error) {
                    console.error('[WS] Failed to parse message:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('[WS] Disconnected:', event.code, event.reason);
                this.stopPing();
                this.emit({ type: 'connection', data: { status: 'disconnected' } });

                // Attempt reconnection
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
                    setTimeout(() => this.connect(this.taskId || undefined), delay);
                }
            };

            this.ws.onerror = (error) => {
                console.error('[WS] Error:', error);
                this.emit({ type: 'connection', data: { status: 'error' } });
            };
        } catch (error) {
            console.error('[WS] Failed to connect:', error);
        }
    }

    disconnect(): void {
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    send(message: WebSocketMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    on(type: string, handler: MessageHandler): () => void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type)!.add(handler);

        // Return unsubscribe function
        return () => {
            this.handlers.get(type)?.delete(handler);
        };
    }

    onAll(handler: MessageHandler): () => void {
        return this.on('*', handler);
    }

    private emit(message: WebSocketMessage): void {
        // Emit to specific type handlers
        const typeHandlers = this.handlers.get(message.type);
        if (typeHandlers) {
            typeHandlers.forEach((handler) => handler(message));
        }

        // Emit to wildcard handlers
        const wildcardHandlers = this.handlers.get('*');
        if (wildcardHandlers) {
            wildcardHandlers.forEach((handler) => handler(message));
        }
    }

    private startPing(): void {
        this.pingInterval = setInterval(() => {
            this.send({ type: 'ping' });
        }, 30000);
    }

    private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

// Export singleton instance
export const wsConnection = new WebSocketConnection();

// React hook for WebSocket
export function useWebSocket(taskId?: string) {
    if (typeof window !== 'undefined' && !wsConnection.isConnected) {
        wsConnection.connect(taskId);
    }

    return {
        connect: wsConnection.connect,
        disconnect: wsConnection.disconnect,
        send: wsConnection.send,
        on: wsConnection.on,
        onAll: wsConnection.onAll,
        isConnected: wsConnection.isConnected,
    };
}
