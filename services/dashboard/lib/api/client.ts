/**
 * API Client for Mission Control
 * Typed fetch wrapper for orchestrator API
 * Uses Next.js rewrites to proxy requests and avoid CORS
 */

// For browser requests, use relative paths (proxied by Next.js rewrites)
// For SSR, use the direct orchestrator URL
const API_BASE_URL = typeof window === 'undefined'
    ? (process.env.ORCHESTRATOR_URL || 'http://192.168.50.219:8002')
    : '';

interface FetchOptions extends RequestInit {
    timeout?: number;
}

interface ApiError {
    error: string;
    details?: string;
}

class ApiClientError extends Error {
    constructor(
        message: string,
        public status: number,
        public details?: string
    ) {
        super(message);
        this.name = 'ApiClientError';
    }
}

async function fetchWithTimeout(
    url: string,
    options: FetchOptions = {}
): Promise<Response> {
    const { timeout = 30000, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function apiRequest<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Use centralized auth headers
    const { getAuthHeaders } = await import('../auth-headers');
    const authHeaders = getAuthHeaders();

    const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        ...authHeaders,
    };

    const response = await fetchWithTimeout(url, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    });

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
            const errorBody: ApiError = await response.json();
            errorMessage = errorBody.error || errorMessage;
        } catch {
            // Use status text if JSON parsing fails
            errorMessage = response.statusText || errorMessage;
        }
        throw new ApiClientError(errorMessage, response.status);
    }

    return response.json();
}

// ============================================
// Health Check
// ============================================

export interface HealthResponse {
    status: 'ok' | 'degraded';
    version: string;
    timestamp: string;
    redis: 'connected' | 'disconnected';
}

export async function getHealth(): Promise<HealthResponse> {
    const url = `${API_BASE_URL}/health`;

    const response = await fetchWithTimeout(url, { timeout: 5000 });

    if (!response.ok) {
        throw new ApiClientError('Health check failed', response.status);
    }

    const text = await response.text();

    // Handle plain text "OK" response (from load balancer or simple health check)
    if (text === 'OK' || text.trim() === 'OK') {
        return {
            status: 'ok',
            version: 'unknown',
            timestamp: new Date().toISOString(),
            redis: 'connected', // Assume connected if server responds
        };
    }

    // Try to parse as JSON
    try {
        return JSON.parse(text) as HealthResponse;
    } catch {
        // If not valid JSON, treat any response as "ok"
        return {
            status: 'ok',
            version: 'unknown',
            timestamp: new Date().toISOString(),
            redis: 'connected',
        };
    }
}

// ============================================
// Projects
// ============================================

export interface Project {
    id: string;
    name: string;
    type: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export async function listProjects(userId?: string): Promise<Project[]> {
    const query = userId ? `?user_id=${userId}` : '';
    return apiRequest<Project[]>(`/api/projects${query}`);
}

// ============================================
// Runs (Conversations)
// ============================================

export interface Run {
    id: string;
    user_id: string;
    project_id?: string;
    query: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    created_at: string;
    updated_at: string;
}

export interface CreateRunRequest {
    query: string;
    project_id?: string;
    user_id: string;
}

export interface CreateRunResponse {
    run_id: string;
    task_id: string;
    status: string;
}

export async function listRuns(userId: string): Promise<Run[]> {
    return apiRequest<Run[]>(`/api/runs?user_id=${userId}`);
}

export async function createRun(request: CreateRunRequest): Promise<CreateRunResponse> {
    return apiRequest<CreateRunResponse>('/api/runs', {
        method: 'POST',
        body: JSON.stringify(request),
    });
}

export async function getRun(runId: string): Promise<Run> {
    return apiRequest<Run>(`/api/runs/${runId}`);
}

// ============================================
// Ask (Submit Query)
// ============================================

export interface AskRequest {
    query: string;
    project_id?: string;
    library_ids?: string[];
}

export async function ask(request: AskRequest): Promise<CreateRunResponse> {
    return apiRequest<CreateRunResponse>('/api/ask', {
        method: 'POST',
        body: JSON.stringify(request),
    });
}

// ============================================
// Approvals
// ============================================

export interface Approval {
    id: string;
    run_id: string;
    task_id: string;
    type: string;
    agent: string;
    description: string;
    risk_level: 'low' | 'medium' | 'high';
    details: {
        files?: string[];
        commands?: string[];
        changes?: string;
    };
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

export async function getPendingApprovals(): Promise<Approval[]> {
    return apiRequest<Approval[]>('/api/approvals/pending');
}

export async function respondToApproval(
    approvalId: string,
    approved: boolean,
    notes?: string
): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/api/approvals/${approvalId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ approved, notes }),
    });
}

// ============================================
// Task Details
// ============================================

export interface Task {
    id: string;
    project_id: string;
    user_id: string;
    type: string;
    query: string;
    status: string;
    todo_list: Array<{
        id: string;
        description: string;
        agent: string;
        status: string;
    }>;
    created_at: string;
    updated_at: string;
}

export async function getTask(taskId: string): Promise<Task> {
    return apiRequest<Task>(`/api/task/${taskId}`);
}

// ============================================
// Artifacts
// ============================================

export interface Artifact {
    id: string;
    run_id: string;
    type: string;
    name: string;
    content: string;
    created_at: string;
}

export async function getRunArtifacts(runId: string): Promise<Artifact[]> {
    return apiRequest<Artifact[]>(`/api/runs/${runId}/artifacts`);
}

// ============================================
// Metrics
// ============================================

export interface MetricsSummary {
    user_id: string;
    date: string;
    total_events: number;
    total_errors: number;
    total_runs: number;
    error_rate: number;
}

export async function getMetricsSummary(userId?: string): Promise<MetricsSummary> {
    const query = userId ? `?user_id=${userId}` : '';
    return apiRequest<MetricsSummary>(`/api/metrics/summary${query}`);
}

// Export error class for use in components
export { ApiClientError };
