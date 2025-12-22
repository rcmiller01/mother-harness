'use client';

import { useState, useEffect, FormEvent, type CSSProperties } from 'react';
import { useAuth, getAuthHeaders } from '../lib/auth';

type Project = {
    id: string;
    name: string;
    type: string;
    status: string;
    threads: string[];
    last_activity: string;
};

type Run = {
    id: string;
    task_id: string;
    project_id: string;
    status: string;
    created_at: string;
    updated_at: string;
};

type Artifact = {
    id: string;
    name: string;
    type: string;
    format: string;
    content?: string;
    created_at: string;
};

type Library = {
    id: string;
    name: string;
    folder_path: string;
    description?: string;
    document_count: number;
    scan_status: string;
    last_scanned: string;
    auto_scan: boolean;
};

type ApprovalPreview = {
    files?: string[];
    commands?: string[];
    workflow?: Record<string, unknown>;
    api_calls?: Array<{ method: string; url: string; description: string }>;
};

type Approval = {
    id: string;
    task_id: string;
    run_id: string;
    project_id: string;
    type: string;
    description: string;
    risk_level: string;
    preview: ApprovalPreview;
    created_at: string;
};

const cardStyle: CSSProperties = {
    padding: '1rem',
    border: '1px solid #e5e5e5',
    borderRadius: '12px',
    backgroundColor: '#fff',
};

export default function HomePage() {
    const { user, loading: authLoading, isAuthenticated, login, logout } = useAuth();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ task_id: string; status: string } | null>(null);

    const [projects, setProjects] = useState<Project[]>([]);
    const [projectLoading, setProjectLoading] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    const [runs, setRuns] = useState<Run[]>([]);
    const [runsLoading, setRunsLoading] = useState(false);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [artifactLoading, setArtifactLoading] = useState(false);
    const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

    const [libraries, setLibraries] = useState<Library[]>([]);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [librarySearch, setLibrarySearch] = useState('');
    const [libraryName, setLibraryName] = useState('');
    const [libraryPath, setLibraryPath] = useState('');
    const [libraryDescription, setLibraryDescription] = useState('');
    const [libraryAutoScan, setLibraryAutoScan] = useState(true);
    const [libraryMessage, setLibraryMessage] = useState('');

    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [approvalsLoading, setApprovalsLoading] = useState(false);
    const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
    const [approvalMessage, setApprovalMessage] = useState('');

    // Login form state
    const [showLogin, setShowLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const userId = user?.id ?? 'anonymous';

    const fetchProjects = async () => {
        if (!user?.id) return;
        setProjectLoading(true);
        try {
            const response = await fetch(`/api/projects?user_id=${encodeURIComponent(user.id)}`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            setProjects(data);
            if (!selectedProjectId && data.length > 0) {
                setSelectedProjectId(data[0].id);
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            setProjectLoading(false);
        }
    };

    const fetchRuns = async () => {
        if (!user?.id) return;
        setRunsLoading(true);
        try {
            const response = await fetch(`/api/runs?user_id=${encodeURIComponent(user.id)}`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            setRuns(data);
            if (!selectedRunId && data.length > 0) {
                setSelectedRunId(data[0].id);
            }
        } catch (error) {
            console.error('Failed to load runs:', error);
        } finally {
            setRunsLoading(false);
        }
    };

    const fetchArtifacts = async (runId: string) => {
        setArtifactLoading(true);
        try {
            const response = await fetch(`/api/runs/${runId}/artifacts`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            setArtifacts(data);
            setSelectedArtifact(null);
        } catch (error) {
            console.error('Failed to load artifacts:', error);
        } finally {
            setArtifactLoading(false);
        }
    };

    const fetchArtifactDetail = async (artifactId: string) => {
        try {
            const response = await fetch(`/api/artifacts/${artifactId}`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            setSelectedArtifact(data);
        } catch (error) {
            console.error('Failed to load artifact:', error);
        }
    };

    const fetchLibraries = async (search = '') => {
        setLibraryLoading(true);
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : '';
            const response = await fetch(`/api/libraries${params}`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            setLibraries(data);
        } catch (error) {
            console.error('Failed to load libraries:', error);
        } finally {
            setLibraryLoading(false);
        }
    };

    const fetchApprovals = async () => {
        if (!user?.id) return;
        setApprovalsLoading(true);
        try {
            const response = await fetch(`/api/approvals/pending?user_id=${encodeURIComponent(user.id)}`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            setApprovals(data);
        } catch (error) {
            console.error('Failed to load approvals:', error);
        } finally {
            setApprovalsLoading(false);
        }
    };

    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;
        fetchProjects();
        fetchRuns();
        fetchLibraries();
        fetchApprovals();
    }, [isAuthenticated, user?.id]);

    useEffect(() => {
        if (selectedRunId) {
            fetchArtifacts(selectedRunId);
        }
    }, [selectedRunId]);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setLoginError('');
        const success = await login(email, password);
        if (success) {
            setShowLogin(false);
            setEmail('');
            setPassword('');
        } else {
            setLoginError('Invalid credentials');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify({
                    query,
                    user_id: userId,
                    project_id: selectedProjectId ?? undefined,
                }),
            });

            const data = await response.json();
            setResult(data);
            fetchRuns();
        } catch (error) {
            console.error('Failed to submit:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLibrary = async (e: FormEvent) => {
        e.preventDefault();
        setLibraryMessage('');
        try {
            const response = await fetch('/api/libraries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify({
                    name: libraryName,
                    folder_path: libraryPath,
                    description: libraryDescription || undefined,
                    auto_scan: libraryAutoScan,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                setLibraryMessage(error.error ?? 'Failed to create library');
                return;
            }

            setLibraryName('');
            setLibraryPath('');
            setLibraryDescription('');
            setLibraryAutoScan(true);
            setLibraryMessage('Library created successfully.');
            fetchLibraries(librarySearch);
        } catch (error) {
            console.error('Failed to create library:', error);
            setLibraryMessage('Failed to create library');
        }
    };

    const handleRescanLibrary = async (libraryId: string) => {
        setLibraryMessage('');
        try {
            const response = await fetch(`/api/libraries/${libraryId}/rescan`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                const error = await response.json();
                setLibraryMessage(error.error ?? 'Failed to rescan library');
                return;
            }
            fetchLibraries(librarySearch);
        } catch (error) {
            console.error('Failed to rescan library:', error);
            setLibraryMessage('Failed to rescan library');
        }
    };

    const handleLibrarySearch = async (e: FormEvent) => {
        e.preventDefault();
        fetchLibraries(librarySearch);
    };

    const handleApprovalResponse = async (approvalId: string, approved: boolean) => {
        setApprovalMessage('');
        try {
            const response = await fetch(`/api/approvals/${approvalId}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify({
                    approved,
                    notes: approvalNotes[approvalId],
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                setApprovalMessage(error.error ?? 'Failed to respond to approval');
                return;
            }

            setApprovalNotes((prev) => ({ ...prev, [approvalId]: '' }));
            setApprovalMessage(approved ? 'Approval submitted.' : 'Approval rejected.');
            fetchApprovals();
        } catch (error) {
            console.error('Failed to respond to approval:', error);
            setApprovalMessage('Failed to respond to approval');
        }
    };

    if (authLoading) {
        return (
            <main style={{ padding: '2rem', textAlign: 'center' }}>
                <p>Loading...</p>
            </main>
        );
    }

    return (
        <main style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header with auth controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Mother-Harness</h1>
                    <p style={{ color: '#666', margin: 0 }}>
                        Multi-agent orchestration for research, coding, analysis, and design.
                    </p>
                </div>
                <div>
                    {isAuthenticated ? (
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, marginBottom: '0.5rem', fontWeight: 500 }}>
                                {user?.name ?? user?.email ?? user?.id}
                            </p>
                            <button
                                onClick={logout}
                                style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.875rem',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                }}
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowLogin(true)}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                backgroundColor: '#0070f3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                            }}
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </div>

            {/* Login modal */}
            {showLogin && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '400px',
                    }}>
                        <h2 style={{ marginTop: 0 }}>Sign In</h2>
                        <form onSubmit={handleLogin}>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    marginBottom: '1rem',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: '1rem',
                                }}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    marginBottom: '1rem',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: '1rem',
                                }}
                                required
                            />
                            {loginError && (
                                <p style={{ color: 'red', marginBottom: '1rem' }}>{loginError}</p>
                            )}
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    type="submit"
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        fontSize: '1rem',
                                        backgroundColor: '#0070f3',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowLogin(false)}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        fontSize: '1rem',
                                        backgroundColor: 'transparent',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User info banner */}
            {isAuthenticated && (
                <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#e6f7e6',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    fontSize: '0.875rem',
                }}>
                    ✓ Authenticated as <strong>{user?.email ?? user?.id}</strong>
                    {user?.roles && user.roles.length > 0 && (
                        <span style={{ color: '#666' }}> · Roles: {user.roles.join(', ')}</span>
                    )}
                </div>
            )}

            <section style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ marginBottom: '1rem' }}>New Run</h2>
                <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Describe the workflow you want to run"
                        style={{
                            width: '100%',
                            minHeight: '120px',
                            padding: '1rem',
                            fontSize: '1rem',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            marginBottom: '1rem',
                        }}
                    />
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '1rem',
                                backgroundColor: '#0070f3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                opacity: loading || !query.trim() ? 0.6 : 1,
                            }}
                        >
                            {loading ? 'Processing...' : 'Submit'}
                        </button>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <label htmlFor="project-select" style={{ fontSize: '0.875rem', color: '#555' }}>
                                Project
                            </label>
                            <select
                                id="project-select"
                                value={selectedProjectId ?? ''}
                                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    minWidth: '220px',
                                }}
                            >
                                <option value="">Default</option>
                                {projects.map((project) => (
                                    <option key={project.id} value={project.id}>
                                        {project.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </form>
                {result && (
                    <div
                        style={{
                            padding: '1rem',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '8px',
                        }}
                    >
                        <p>
                            <strong>Task ID:</strong> {result.task_id}
                        </p>
                        <p>
                            <strong>Status:</strong> {result.status}
                        </p>
                    </div>
                )}
            </section>

            <section style={{ marginBottom: '2.5rem', display: 'grid', gap: '1.5rem' }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ margin: 0 }}>Project List</h2>
                        <button
                            type="button"
                            onClick={fetchProjects}
                            style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Refresh
                        </button>
                    </div>
                    {projectLoading ? (
                        <p style={{ color: '#666' }}>Loading projects...</p>
                    ) : (
                        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                            {projects.length === 0 ? (
                                <p style={{ color: '#666' }}>No projects yet. Submit a run to create one.</p>
                            ) : (
                                projects.map((project) => (
                                    <div
                                        key={project.id}
                                        style={{
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            border: project.id === selectedProjectId ? '1px solid #0070f3' : '1px solid #eee',
                                            backgroundColor: project.id === selectedProjectId ? '#f0f6ff' : '#fafafa',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => setSelectedProjectId(project.id)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') setSelectedProjectId(project.id);
                                        }}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div>
                                                <strong>{project.name}</strong>
                                                <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>{project.type}</p>
                                            </div>
                                            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#666' }}>
                                                <div>{project.status}</div>
                                                <div>{new Date(project.last_activity).toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#999' }}>
                                            Threads: {project.threads.length}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ margin: 0 }}>Run Status</h2>
                        <button
                            type="button"
                            onClick={fetchRuns}
                            style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Refresh
                        </button>
                    </div>
                    {runsLoading ? (
                        <p style={{ color: '#666' }}>Loading runs...</p>
                    ) : (
                        <div style={{ marginTop: '1rem' }}>
                            {runs.length === 0 ? (
                                <p style={{ color: '#666' }}>No runs yet.</p>
                            ) : (
                                <>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label htmlFor="run-select" style={{ fontSize: '0.875rem', color: '#555' }}>
                                            Select run
                                        </label>
                                        <select
                                            id="run-select"
                                            value={selectedRunId ?? ''}
                                            onChange={(e) => setSelectedRunId(e.target.value || null)}
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: '6px',
                                                border: '1px solid #ddd',
                                                width: '100%',
                                                marginTop: '0.5rem',
                                            }}
                                        >
                                            {runs.map((run) => (
                                                <option key={run.id} value={run.id}>
                                                    {run.id} · {run.status}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        {runs.slice(0, 4).map((run) => (
                                            <div key={run.id} style={{ padding: '0.75rem', border: '1px solid #eee', borderRadius: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <strong>{run.id}</strong>
                                                    <span style={{ fontSize: '0.75rem', color: '#666' }}>{run.status}</span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                                    Task: {run.task_id}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                                                    Updated {new Date(run.updated_at).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div style={cardStyle}>
                    <h2 style={{ marginTop: 0 }}>Artifacts View</h2>
                    {selectedRunId ? (
                        <>
                            {artifactLoading ? (
                                <p style={{ color: '#666' }}>Loading artifacts...</p>
                            ) : (
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {artifacts.length === 0 ? (
                                        <p style={{ color: '#666' }}>No artifacts for this run yet.</p>
                                    ) : (
                                        artifacts.map((artifact) => (
                                            <div key={artifact.id} style={{ padding: '0.75rem', border: '1px solid #eee', borderRadius: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <strong>{artifact.name}</strong>
                                                    <span style={{ fontSize: '0.75rem', color: '#666' }}>{artifact.type}</span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                                                    Format: {artifact.format}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => fetchArtifactDetail(artifact.id)}
                                                    style={{
                                                        marginTop: '0.5rem',
                                                        padding: '0.4rem 0.75rem',
                                                        borderRadius: '6px',
                                                        border: '1px solid #ddd',
                                                        backgroundColor: 'white',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                    }}
                                                >
                                                    View details
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <p style={{ color: '#666' }}>Select a run to view artifacts.</p>
                    )}
                    {selectedArtifact && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                            <strong>{selectedArtifact.name}</strong>
                            <p style={{ fontSize: '0.75rem', color: '#666' }}>{selectedArtifact.type} · {selectedArtifact.format}</p>
                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem', color: '#333' }}>
                                {selectedArtifact.content ?? 'No content available.'}
                            </pre>
                        </div>
                    )}
                </div>
            </section>

            <section style={{ marginBottom: '2.5rem', display: 'grid', gap: '1.5rem' }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ margin: 0 }}>Library Management</h2>
                        <button
                            type="button"
                            onClick={() => fetchLibraries(librarySearch)}
                            style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Refresh
                        </button>
                    </div>
                    <form onSubmit={handleLibrarySearch} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            value={librarySearch}
                            onChange={(e) => setLibrarySearch(e.target.value)}
                            placeholder="Search libraries"
                            style={{
                                flex: '1 1 220px',
                                padding: '0.5rem',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Search
                        </button>
                    </form>
                    {libraryLoading ? (
                        <p style={{ color: '#666' }}>Loading libraries...</p>
                    ) : (
                        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                            {libraries.length === 0 ? (
                                <p style={{ color: '#666' }}>No libraries found.</p>
                            ) : (
                                libraries.map((library) => (
                                    <div key={library.id} style={{ padding: '0.75rem', border: '1px solid #eee', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div>
                                                <strong>{library.name}</strong>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>{library.folder_path}</p>
                                            </div>
                                            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#666' }}>
                                                <div>{library.scan_status}</div>
                                                <div>{library.document_count} docs</div>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#999' }}>
                                                Last scanned {new Date(library.last_scanned).toLocaleString()}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: '#999' }}>
                                                Auto-scan {library.auto_scan ? 'on' : 'off'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRescanLibrary(library.id)}
                                            style={{
                                                marginTop: '0.5rem',
                                                padding: '0.4rem 0.75rem',
                                                borderRadius: '6px',
                                                border: '1px solid #ddd',
                                                backgroundColor: 'white',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                            }}
                                        >
                                            Rescan
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                    {libraryMessage && (
                        <p style={{ marginTop: '0.75rem', color: '#d14545', fontSize: '0.875rem' }}>{libraryMessage}</p>
                    )}
                </div>

                <div style={cardStyle}>
                    <h2 style={{ marginTop: 0 }}>Add Library</h2>
                    <form onSubmit={handleCreateLibrary} style={{ display: 'grid', gap: '0.75rem' }}>
                        <input
                            type="text"
                            value={libraryName}
                            onChange={(e) => setLibraryName(e.target.value)}
                            placeholder="Library name"
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                            required
                        />
                        <input
                            type="text"
                            value={libraryPath}
                            onChange={(e) => setLibraryPath(e.target.value)}
                            placeholder="Folder path"
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                            required
                        />
                        <textarea
                            value={libraryDescription}
                            onChange={(e) => setLibraryDescription(e.target.value)}
                            placeholder="Description (optional)"
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd', minHeight: '80px' }}
                        />
                        <label style={{ fontSize: '0.875rem', color: '#555', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="checkbox"
                                checked={libraryAutoScan}
                                onChange={(e) => setLibraryAutoScan(e.target.checked)}
                            />
                            Enable auto-scan
                        </label>
                        <button
                            type="submit"
                            style={{
                                padding: '0.6rem 1rem',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#0070f3',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Add Library
                        </button>
                    </form>
                </div>
            </section>

            <section style={{ marginBottom: '2.5rem' }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ margin: 0 }}>Approvals</h2>
                        <button
                            type="button"
                            onClick={fetchApprovals}
                            style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Refresh
                        </button>
                    </div>
                    {approvalsLoading ? (
                        <p style={{ color: '#666' }}>Loading approvals...</p>
                    ) : approvals.length === 0 ? (
                        <p style={{ color: '#666' }}>No pending approvals.</p>
                    ) : (
                        <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
                            {approvals.map((approval) => (
                                <div key={approval.id} style={{ padding: '0.75rem', border: '1px solid #eee', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <strong>{approval.type}</strong>
                                        <span style={{ fontSize: '0.75rem', color: '#666' }}>{approval.risk_level} risk</span>
                                    </div>
                                    <p style={{ margin: '0.5rem 0', fontSize: '0.875rem' }}>{approval.description}</p>
                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                        <div>Approval ID: {approval.id}</div>
                                        <div>Run: {approval.run_id}</div>
                                        <div>Task: {approval.task_id}</div>
                                    </div>
                                    {approval.preview?.files && approval.preview.files.length > 0 && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                                            <strong>Files</strong>: {approval.preview.files.join(', ')}
                                        </div>
                                    )}
                                    {approval.preview?.commands && approval.preview.commands.length > 0 && (
                                        <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#666' }}>
                                            <strong>Commands</strong>: {approval.preview.commands.join(', ')}
                                        </div>
                                    )}
                                    <textarea
                                        value={approvalNotes[approval.id] ?? ''}
                                        onChange={(e) =>
                                            setApprovalNotes((prev) => ({ ...prev, [approval.id]: e.target.value }))
                                        }
                                        placeholder="Optional notes"
                                        style={{
                                            width: '100%',
                                            marginTop: '0.5rem',
                                            padding: '0.5rem',
                                            borderRadius: '6px',
                                            border: '1px solid #ddd',
                                            minHeight: '60px',
                                        }}
                                    />
                                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleApprovalResponse(approval.id, true)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: '6px',
                                                border: 'none',
                                                backgroundColor: '#16a34a',
                                                color: 'white',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                            }}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleApprovalResponse(approval.id, false)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: '6px',
                                                border: '1px solid #ddd',
                                                backgroundColor: 'white',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                            }}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {approvalMessage && (
                        <p style={{ marginTop: '0.75rem', color: '#d14545', fontSize: '0.875rem' }}>{approvalMessage}</p>
                    )}
                </div>
            </section>
        </main>
    );
}
