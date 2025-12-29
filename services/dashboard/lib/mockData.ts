/**
 * Mock Data for Mission Control Development
 */

import type { AgentType, Conversation, ChatMessage, AgentStatus, ApprovalDisplay, TaskDisplay, AgentEvent } from '../types/ui';

// Helper to create dates relative to now
const hoursAgo = (hours: number): string => {
    const date = new Date();
    date.setHours(date.getHours() - hours);
    return date.toISOString();
};

const daysAgo = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
};

// Mock Conversations
export const mockConversations: Conversation[] = [
    {
        id: 'conv-1',
        title: 'Implementing Authentication System',
        preview: 'Let me help you set up Google OAuth with local auth fallback...',
        createdAt: hoursAgo(2),
        updatedAt: hoursAgo(1),
        isPinned: true,
        messageCount: 24,
        agentsInvolved: ['orchestrator', 'coder', 'researcher'],
    },
    {
        id: 'conv-2',
        title: 'Database Schema Review',
        preview: 'The proposed schema looks good, but I have some suggestions...',
        createdAt: hoursAgo(5),
        updatedAt: hoursAgo(3),
        isPinned: false,
        messageCount: 12,
        agentsInvolved: ['orchestrator', 'analyst', 'critic'],
    },
    {
        id: 'conv-3',
        title: 'API Performance Optimization',
        preview: 'I\'ve identified several bottlenecks in your current implementation...',
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
        isPinned: false,
        messageCount: 18,
        agentsInvolved: ['orchestrator', 'coder', 'analyst'],
    },
    {
        id: 'conv-4',
        title: 'Security Audit Findings',
        preview: 'Based on my review, there are 3 high-priority issues...',
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
        isPinned: true,
        messageCount: 31,
        agentsInvolved: ['orchestrator', 'critic', 'coder'],
    },
    {
        id: 'conv-5',
        title: 'UI/UX Design Discussion',
        preview: 'Here are my recommendations for the dashboard layout...',
        createdAt: daysAgo(5),
        updatedAt: daysAgo(4),
        isPinned: false,
        messageCount: 8,
        agentsInvolved: ['orchestrator', 'design'],
    },
];

// Mock Messages
export const mockMessages: ChatMessage[] = [
    {
        id: 'msg-1',
        role: 'user',
        content: 'I need help implementing a complete authentication system with Google OAuth and local account creation.',
        timestamp: hoursAgo(2),
    },
    {
        id: 'msg-2',
        role: 'assistant',
        content: `I'll help you implement a complete authentication system. Let me break this down into manageable steps:

## Authentication Strategy

1. **Google OAuth Integration**
   - Configure Google Cloud Console credentials
   - Implement OAuth 2.0 flow with PKCE
   - Handle token refresh and session management

2. **Local Account System**
   - Email/password registration with validation
   - Secure password hashing (bcrypt)
   - Email verification workflow

3. **Session Management**
   - JWT tokens with refresh rotation
   - Redis-backed session storage
   - Secure cookie configuration

Would you like me to start with the Google OAuth implementation or the local account system first?`,
        timestamp: hoursAgo(2),
        agentType: 'orchestrator',
        agentName: 'Orchestrator',
        metadata: { tokensUsed: 320, durationMs: 1500 },
    },
    {
        id: 'msg-3',
        role: 'user',
        content: 'Let\'s start with Google OAuth. Can you show me the implementation?',
        timestamp: hoursAgo(1.5),
    },
    {
        id: 'msg-4',
        role: 'assistant',
        content: `I'll coordinate with the Coder agent to implement Google OAuth. Here's the plan:

\`\`\`typescript
// lib/auth/google.ts
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

export async function getGoogleAuthUrl(): Promise<string> {
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    prompt: 'consent',
  });
}

export async function verifyGoogleToken(code: string) {
  const { tokens } = await client.getToken(code);
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}
\`\`\`

The Researcher agent is checking the latest Google OAuth best practices...`,
        timestamp: hoursAgo(1.5),
        agentType: 'coder',
        agentName: 'Coder',
        metadata: { tokensUsed: 450, durationMs: 2100, model: 'devstral-2:123b' },
    },
    {
        id: 'msg-5',
        role: 'assistant',
        content: `**Research Update**: According to the latest Google Identity documentation (updated December 2024):

- ✅ The implementation above follows current best practices
- ⚠️ Consider adding state parameter for CSRF protection
- 💡 Google recommends using the newer Sign In With Google library for web apps

I recommend adding the state parameter for enhanced security. Should I update the implementation?`,
        timestamp: hoursAgo(1.4),
        agentType: 'researcher',
        agentName: 'Researcher',
        metadata: { tokensUsed: 180, durationMs: 800 },
    },
];

// Mock Agent Statuses
export const mockAgents: AgentStatus[] = [
    {
        type: 'orchestrator',
        name: 'Orchestrator',
        status: 'active',
        currentTask: 'Coordinating authentication implementation',
        tokensUsed: 12500,
        lastActive: hoursAgo(0.1),
    },
    {
        type: 'coder',
        name: 'Coder',
        status: 'active',
        currentTask: 'Implementing OAuth flow',
        tokensUsed: 8200,
        lastActive: hoursAgo(0.2),
    },
    {
        type: 'researcher',
        name: 'Researcher',
        status: 'idle',
        tokensUsed: 3400,
        lastActive: hoursAgo(0.5),
    },
    {
        type: 'critic',
        name: 'Critic',
        status: 'idle',
        tokensUsed: 1200,
        lastActive: hoursAgo(2),
    },
    {
        type: 'analyst',
        name: 'Analyst',
        status: 'idle',
        tokensUsed: 800,
        lastActive: hoursAgo(4),
    },
    {
        type: 'design',
        name: 'Designer',
        status: 'idle',
        tokensUsed: 0,
        lastActive: daysAgo(1),
    },
];

// Mock Approvals
export const mockApprovals: ApprovalDisplay[] = [
    {
        id: 'approval-1',
        agentType: 'coder',
        agentName: 'Coder',
        description: 'Create new authentication files and update existing auth module',
        riskLevel: 'medium',
        type: 'file_write',
        preview: {
            files: [
                'lib/auth/google.ts',
                'lib/auth/local.ts',
                'lib/auth/session.ts',
            ],
        },
        createdAt: hoursAgo(0.5),
        status: 'pending',
    },
    {
        id: 'approval-2',
        agentType: 'coder',
        agentName: 'Coder',
        description: 'Run database migration for users table',
        riskLevel: 'high',
        type: 'code_execution',
        preview: {
            commands: ['pnpm prisma migrate deploy'],
        },
        createdAt: hoursAgo(1),
        status: 'pending',
    },
];

// Mock Tasks
export const mockTasks: TaskDisplay[] = [
    {
        id: 'task-1',
        description: 'Implement Google OAuth integration',
        status: 'in_progress',
        agentType: 'coder',
        progress: 60,
        createdAt: hoursAgo(1),
    },
    {
        id: 'task-2',
        description: 'Research OAuth best practices',
        status: 'completed',
        agentType: 'researcher',
        progress: 100,
        createdAt: hoursAgo(1.5),
    },
    {
        id: 'task-3',
        description: 'Create local auth module',
        status: 'pending',
        agentType: 'coder',
        createdAt: hoursAgo(0.5),
    },
    {
        id: 'task-4',
        description: 'Security review of auth implementation',
        status: 'pending',
        agentType: 'critic',
        createdAt: hoursAgo(0.3),
    },
];

// Agent color mapping
export const agentColors: Record<AgentType, string> = {
    orchestrator: 'var(--agent-orchestrator)',
    coder: 'var(--agent-coder)',
    researcher: 'var(--agent-researcher)',
    analyst: 'var(--agent-analyst)',
    critic: 'var(--agent-critic)',
    design: 'var(--agent-design)',
    skeptic: 'var(--agent-skeptic)',
    rag: 'var(--agent-rag)',
    librarian: 'var(--agent-librarian)',
    vision: 'var(--agent-vision)',
    update: 'var(--agent-update)',
    toolsmith: 'var(--agent-toolsmith)',
};

// Agent icons (using Lucide icon names)
export const agentIcons: Record<AgentType, string> = {
    orchestrator: 'Brain',
    coder: 'Code',
    researcher: 'Search',
    analyst: 'BarChart3',
    critic: 'Shield',
    design: 'Palette',
    skeptic: 'HelpCircle',
    rag: 'Database',
    librarian: 'BookOpen',
    vision: 'Eye',
    update: 'RefreshCw',
    toolsmith: 'Wrench',
};

// Mock event stream generator
export function createMockEventStream(onEvent: (event: AgentEvent) => void): () => void {
    const events: Array<Omit<AgentEvent, 'id' | 'timestamp'>> = [
        { type: 'started', agentType: 'coder', message: 'Starting OAuth implementation...' },
        { type: 'progress', agentType: 'coder', message: 'Created google.ts with OAuth client setup' },
        { type: 'started', agentType: 'researcher', message: 'Researching security best practices...' },
        { type: 'completed', agentType: 'researcher', message: 'Found 3 relevant security recommendations' },
        { type: 'progress', agentType: 'coder', message: 'Adding CSRF protection with state parameter' },
        { type: 'approval_needed', agentType: 'coder', message: 'File write approval needed for auth modules' },
    ];

    let index = 0;
    const interval = setInterval(() => {
        if (index < events.length) {
            const event = events[index];
            onEvent({
                ...event,
                id: `event-${Date.now()}`,
                timestamp: new Date().toISOString(),
            } as AgentEvent);
            index++;
        } else {
            index = 0; // Loop events for demo
        }
    }, 3000);

    return () => clearInterval(interval);
}
