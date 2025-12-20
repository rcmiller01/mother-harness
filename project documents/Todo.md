# Mother-Harness Implementation Todo

> **Document Version**: 2.0  
> **Based on**: Mother_Harness_Complete_Project_v2_Part1.pdf & Part2.pdf  
> **Created**: December 2025

---

## Phase 1: Core Infrastructure Setup

### 1.1 Database & Storage Layer
- [ ] Set up Redis Stack with full suite (RedisJSON + RediSearch + Vector)
- [ ] Configure Redis Streams for activity logging
- [ ] Create base schema structure for runs, artifacts, agents
- [ ] Set up RedisJSON indexes for search and filtering
- [ ] Configure backup and persistence settings
- [ ] Configure Redis ACL users (orchestrator, n8n, docling, dashboard)

### 1.2 Core Data Models
- [ ] Implement ResultEnvelope schema and validation
- [ ] Implement Phase state machine types
- [ ] Implement TerminationRecord schema (v4)
- [ ] Implement RunState snapshot schema
- [ ] Implement base Artifact types and schemas
- [ ] Implement RetrievalReport schema
- [ ] Create schema validation utilities
- [ ] **NEW**: Implement Task schema with todo_list and execution_plan
- [ ] **NEW**: Implement Project schema with threads and memory tiers
- [ ] **NEW**: Implement ChatThread schema for non-project conversations
- [ ] **NEW**: Implement Approval schema with risk levels

### 1.3 Mother Orchestrator Foundation
- [ ] Create Mother orchestrator class structure
- [ ] Implement phase state machine logic
- [ ] Implement run lifecycle management (create, execute, terminate)
- [ ] Implement checkpoint/replay foundation
- [ ] Add activity stream logging
- [ ] Create run ID generation and tracking
- [ ] **NEW**: Implement sequential execution with dependency checking
- [ ] **NEW**: Progressive summarization on task completion

---

## Phase 2: Agent Contract System (ACI)

### 2.1 Role Registry
- [ ] Create RoleRegistry storage in RedisJSON
- [ ] Implement role registration and lookup
- [ ] Create role enable/disable functionality
- [ ] Implement role validation at dispatch time
- [ ] Create default role definitions for all 9+ agents

### 2.2 Agent Contract Enforcement
- [ ] Implement action allowlist validation
- [ ] Implement required artifact validation
- [ ] Implement phase exit criteria checking
- [ ] Create approval trigger detection
- [ ] Implement retry accounting per phase
- [ ] Create replay capture hooks

### 2.3 Individual Agent Implementations
- [ ] Mother (Orchestrator) - routing, quorums, arbitration
- [ ] Librarian - document ingestion, chunking, embedding
- [ ] Research - RAG retrieval, evidence synthesis, citations
- [ ] Coder - repo-bound code changes, patches, tests
- [ ] Critic - QA validation, grounding checks, security
- [ ] Analyst - data analysis, SQL, Python/R execution
- [ ] Vision - multimodal analysis, OCR, diagram parsing
- [ ] Update - software inventory, upgrade intelligence
- [ ] Toolsmith - deterministic tool wrapper creation
- [ ] **NEW**: Design - architecture, UI/UX design, Mermaid diagrams
- [ ] **NEW**: Skeptic - business validation, devil's advocate

---

## Phase 3: Capability-Based Routing & Model Selection

### 3.1 Model Profile Registry
- [ ] Create ModelProfile schema with capabilities
- [ ] Define capability types (tool_calling, vision, strict_json, etc.)
- [ ] Register local models (gpt-oss:20b Q4/Q5 quantized)
- [ ] Register cloud models with capability mappings
- [ ] Implement model reliability tracking (success rates)
- [ ] **NEW**: Define model quality tiers (tier1_fast through tier4_cloud)
- [ ] **NEW**: Multi-GPU sharded inference config

### 3.2 Routing Logic
- [ ] Implement RouteRequest → RouteDecision logic
- [ ] Create capability matching algorithm
- [ ] Implement local-first routing with cloud escalation
- [ ] Add parallel model execution for reliability
- [ ] Implement arbiter/tie-breaker model selection
- [ ] Create routing decision logging
- [ ] **NEW**: Implement complexity assessment algorithm
- [ ] **NEW**: Auto-upgrade on quality failure detection

### 3.3 Quorum & Concurrency
- [ ] Implement quorum types (all/any/majority)
- [ ] Create concurrent agent dispatch mechanism
- [ ] Implement arbitration policies for agent disagreements
- [ ] Add timeout and barrier coordination
- [ ] Create quorum result aggregation

### 3.4 Model Auto-Selection with Audit Trail (NEW)
- [ ] Implement ModelSelector with decision tree
- [ ] Complexity scoring (query_length, has_code, requires_reasoning)
- [ ] Previous failure history checking
- [ ] User preference integration
- [ ] Budget check before cloud model selection
- [ ] Record decisions for audit in Redis

---

## Phase 4: RAG & Embedding System (emb:v1)

### 4.1 Document Ingestion (Librarian)
- [ ] Integrate Docling for PDF/EPUB/HTML extraction
- [ ] Implement hierarchy-based chunking (450 tokens, 80 overlap)
- [ ] Create embedding generation pipeline
- [ ] Store chunks in Redis with embed_space=emb:v1
- [ ] Build Redis vector search indexes
- [ ] Implement OCR fallback for image-only pages
- [ ] **NEW**: Hash-based image storage in /core4/libraries/images/
- [ ] **NEW**: Failed embedding recovery with zero-vector placeholder

### 4.2 Retrieval System
- [ ] Implement vector search queries
- [ ] Implement hybrid retrieval (vector + keyword)
- [ ] Create RetrievalReport artifact generation
- [ ] Implement retrieval quality gates (min score, min tokens)
- [ ] Add adjacent chunk fetching (section_path, page window)
- [ ] Implement query rewrite strategies

### 4.3 Citation System
- [ ] Create Citation schema with chunk/document references
- [ ] Implement citation extraction from agent responses
- [ ] Validate citations against retrieved chunks
- [ ] Enforce citation requirements in Critic agent
- [ ] Create citation display/rendering utilities

---

## Phase 5: Deterministic Tool System

### 5.1 Tool Registry
- [ ] Create DeterministicTool schema
- [ ] Implement ToolRegistry storage and versioning
- [ ] Register core tools (git_status, resize_image, run_tests, ocr_extract)
- [ ] Create tool allowlist/denylist enforcement
- [ ] Implement tool success rate tracking
- [ ] Add tool timeout and retry logic

### 5.2 Tool Routing
- [ ] Implement pattern matching for tool selection
- [ ] Create keyword-based tool routing
- [ ] Add tool-first execution (before LLM calls)
- [ ] Implement fallback to LLM when tools fail
- [ ] Create tool execution logging

### 5.3 Core Tool Implementations
- [ ] Git operations (status, diff, log)
- [ ] File operations (read, write, patch)
- [ ] Test runners (Jest, pytest, etc.)
- [ ] Image processing (resize, crop, OCR)
- [ ] Code validation (lint, typecheck)
- [ ] Database queries (read-only by default)

---

## Phase 6: Robustness Features (v4)

### 6.1 Explicit Termination Semantics
- [ ] Implement all TerminationReason codes
- [ ] Create TerminationRecord storage and indexing
- [ ] Ensure Mother writes termination on every run
- [ ] Add termination reason to final ResultEnvelope
- [ ] Create termination analytics dashboard
- [ ] Implement replay with termination context

### 6.2 Conflict Resolution
- [ ] Define all ConflictType scenarios
- [ ] Implement ConflictResolutionPolicy table
- [ ] Create conflict detection in review phase
- [ ] Implement resolution strategies (arbiter, escalate, prefer evidence)
- [ ] Store ConflictResolution artifacts
- [ ] Add conflict resolution to activity stream

### 6.3 Context Budget Management
- [ ] Implement ContextBudget per model
- [ ] Create context composition algorithm with priorities
- [ ] Implement ContextSummary artifact generation
- [ ] Add summarization methods (extractive/LLM)
- [ ] Enforce no-silent-truncation rule
- [ ] Track context usage and summarization events

### 6.4 Resource Budget Guards
- [ ] Create ResourceBudget schema (per-run, per-user, global)
- [ ] Implement budget tracking (BudgetCounter)
- [ ] Add budget checks before every action
- [ ] Create circuit breaker for global limits
- [ ] Implement warning thresholds (80% of limits)
- [ ] Add budget exhaustion termination
- [ ] Create budget usage dashboards

### 6.5 Artifact Lifecycle & GC
- [ ] Implement ArtifactRetention policies
- [ ] Create ArtifactMetadata with lifecycle fields
- [ ] Implement garbage collector service
- [ ] Add user controls (star, request deletion)
- [ ] Implement archival (compression to Redis/S3)
- [ ] Create GC scanning and reporting
- [ ] Schedule daily GC execution (cron at 2am)

### 6.6 Library Access Control
- [ ] Create LibraryAccessPolicy schema
- [ ] Implement agent-level access control
- [ ] Add cloud model restrictions per library
- [ ] Create rate limiting per library
- [ ] Implement PII redaction engine with patterns
- [ ] Create access audit trail
- [ ] Add approval gates for sensitive operations

### 6.7 Error Handling & Resiliency (NEW)
- [ ] Implement Docling job retries with exponential backoff (3 retries, 5s base)
- [ ] Move failed files to /libraries/_failed/ folder
- [ ] Orchestrator → n8n workflow failure handling with fallback
- [ ] Embedding generation failure recovery with fallback model
- [ ] Alert system for failures (warning at 2nd failure, error on final)

### 6.8 Concurrency Control & Rate Limiting (NEW)
- [ ] Task queue with priority scoring (high/normal/low)
- [ ] Per-user rate limiting (50 docling/hr, 100 agent/hr, 200 cloud/day)
- [ ] Library-level concurrency control (max 3 concurrent per library)
- [ ] Ollama server rate limiting (max 4 concurrent requests)
- [ ] Sliding window rate limit counters in Redis

---

## Phase 7: Update Agent Workflow

### 7.1 Software Inventory
- [ ] Create SoftwareInventoryItem schema
- [ ] Implement inventory discovery (containers, services, packages)
- [ ] Track current versions and deployment info
- [ ] Define update policies per item
- [ ] Store inventory in Redis

### 7.2 Evidence Ingestion
- [ ] Implement upstream version checking (GitHub, Docker Hub, etc.)
- [ ] Fetch release notes and changelogs
- [ ] Ingest evidence via Librarian (into emb:v1)
- [ ] Link evidence documents to inventory items
- [ ] Create UpdateEvidence schema

### 7.3 Impact Analysis
- [ ] Implement breaking change detection
- [ ] Generate migration steps from evidence
- [ ] Calculate risk scores
- [ ] Create rollback plans
- [ ] Generate UpdateRecommendation with citations

### 7.4 Scheduling & Approvals
- [ ] Create scheduled update checks (daily/weekly)
- [ ] Implement approval request generation
- [ ] Add maintenance window suggestions
- [ ] Create post-upgrade verification tasks
- [ ] Store recommendations and approval status

---

## Phase 8: Memory & Replay System

### 8.1 Tiered Memory Architecture
- [ ] Implement Tier 1: Active session (Redis, 10k tokens) - Last 10 messages verbatim
- [ ] Implement Tier 2: Session summaries (Redis, 50k tokens) - After task completion
- [ ] Implement Tier 3: Long-term memory (Vector DB, 768-dim) - Important findings embedded
- [ ] Create memory promotion/demotion logic
- [ ] Add context retrieval from all tiers
- [ ] **NEW**: Automatic trimming of Tier 1 to last 10 messages

### 8.2 Replay System
- [ ] Capture all tool calls with inputs/outputs
- [ ] Record model IDs and parameters
- [ ] Store retrieval hits (chunk IDs + scores)
- [ ] Capture artifact hashes
- [ ] Create replay bundle format
- [ ] Implement replay execution with comparison
- [ ] Add replay evaluation and delta reporting

---

## Phase 9: N8N Workflow Integration

### 9.1 Workflow Dispatch
- [ ] Create n8n webhook endpoints for agent execution
- [ ] Implement workflow job submission
- [ ] Add job status polling
- [ ] Create workflow result collection
- [ ] Handle workflow errors and retries
- [ ] **NEW**: N8nAdapter class for workflow triggering
- [ ] **NEW**: Direct agent fallback when n8n fails

### 9.2 Idempotent Execution
- [ ] Implement input hashing for deduplication
- [ ] Store outputs by run_id
- [ ] Create replay-safe workflow calls
- [ ] Add workflow execution logging

### 9.3 n8n Workflow Templates (NEW)
- [ ] Code Generation Workflow (Coder + Critic)
- [ ] Research Task Workflow
- [ ] Design Task Workflow
- [ ] Data Analysis Workflow
- [ ] Custom node: LoadProjectContext (Redis access)

---

## Phase 10: API & Integration Layer

### 10.1 Core APIs
- [ ] Create REST API for run submission
- [ ] Implement WebSocket for real-time status
- [ ] Add approval API endpoints
- [ ] Create artifact retrieval APIs
- [ ] Implement run history and search
- [ ] Add budget and analytics endpoints

### 10.2 Open-WebUI Integration
- [ ] Create Open-WebUI connector
- [ ] Implement chat interface integration
- [ ] Add artifact display in UI
- [ ] Create approval prompts
- [ ] Implement activity stream visualization

---

## Phase 11: Security & Compliance

### 11.1 Authentication & Authorization
- [ ] Implement user authentication (JWT tokens)
- [ ] Create role-based access control (RBAC)
- [ ] Add API key management (orchestrator + n8n, Ollama API)
- [ ] Implement session management

### 11.2 Security Scanning
- [ ] Implement secrets detection (no .env commits)
- [ ] Add dependency vulnerability scanning
- [ ] Create security audit logging
- [ ] Implement PII detection and redaction
- [ ] Add rate limiting and DDoS protection

### 11.3 Compliance
- [ ] Implement data retention policies
- [ ] Create audit trail exports
- [ ] Add GDPR compliance features (data deletion)
- [ ] Implement access log retention (7 years for financial)

### 11.4 File System Access Control (NEW)
- [ ] SMB/CIFS read-only default for all agents
- [ ] Write operations require approval
- [ ] Docling has write access to /core4/libraries/_images/

---

## Phase 12: Testing & Validation

### 12.1 Unit Tests
- [ ] Test all schema validations
- [ ] Test phase state machine transitions
- [ ] Test routing algorithm
- [ ] Test budget tracking and limits
- [ ] Test conflict resolution strategies
- [ ] Test GC lifecycle and retention

### 12.2 Integration Tests
- [ ] Test full run lifecycle (plan → execute → review → finalize)
- [ ] Test multi-agent coordination
- [ ] Test RAG retrieval and citation
- [ ] Test tool routing and execution
- [ ] Test approval workflows
- [ ] Test replay functionality
- [ ] **NEW**: Test orchestrator → n8n → agents → Redis flow
- [ ] **NEW**: Test n8n workflow failure graceful handling
- [ ] **NEW**: Test Docling PDF ingestion with image extraction
- [ ] **NEW**: Test embedding retry on failure

### 12.3 Golden Tasks (Evaluation)
- [ ] Create golden task suite per agent role
- [ ] Implement automated evaluation
- [ ] Track success rates and regressions
- [ ] Create performance benchmarks

### 12.4 CI/CD Pipeline (NEW)
- [ ] GitHub Actions for unit tests
- [ ] Integration tests with Redis Stack service
- [ ] E2E tests with docker-compose up/down

---

## Phase 13: Monitoring & Observability

### 13.1 Activity Stream
- [ ] Implement Redis Stream for all events
- [ ] Create event types taxonomy
- [ ] Add structured logging
- [ ] Implement stream consumption for dashboards

### 13.2 Metrics & Analytics
- [ ] Track run success/failure rates
- [ ] Monitor budget consumption
- [ ] Track model usage and costs (daily/monthly)
- [ ] Monitor tool success rates
- [ ] Create termination reason analytics
- [ ] Track conflict frequency and resolutions
- [ ] **NEW**: Track Docling processing times
- [ ] **NEW**: Track n8n workflow success rates
- [ ] **NEW**: Track Redis memory usage
- [ ] **NEW**: Track vector search latencies

### 13.3 Dashboards
- [ ] Create system health dashboard
- [ ] Add run history and search UI
- [ ] Create budget usage visualization
- [ ] Implement artifact explorer
- [ ] Add library access audit UI
- [ ] Create GC reports visualization

### 13.4 Cost Tracking & Budget Alerts (NEW)
- [ ] CostTracker with per-model pricing
- [ ] Daily/monthly spend tracking per user
- [ ] Budget alerts at 80% threshold ($8/$10 daily, $80/$100 monthly)
- [ ] Usage report generation

---

## Phase 14: Documentation & Deployment

### 14.1 Documentation
- [ ] Write architecture overview (architecture.md)
- [ ] Document all agent ACIs (agent-guide.md)
- [ ] Create API documentation (api.md)
- [ ] Write deployment guide (deployment.md)
- [ ] Create user guides
- [ ] Document troubleshooting procedures

### 14.2 Deployment
- [ ] Create Docker containers for all services
- [ ] Write docker-compose configuration
- [ ] Create Kubernetes manifests (optional)
- [ ] Set up CI/CD pipelines
- [ ] Configure monitoring and alerting
- [ ] Create backup and disaster recovery procedures
- [ ] **NEW**: 4-node homelab deployment scripts

### 14.3 Environment Configuration
- [ ] Development environment setup
- [ ] Staging environment setup
- [ ] Production environment setup
- [ ] Configuration management (env vars, secrets)

### 14.4 Repository Structure (NEW)
```
mother-harness/
├── .env.example
├── docker-compose.yml
├── docker-compose.dev.yml
├── README.md
├── services/
│   ├── orchestrator/
│   ├── docling/
│   ├── agents/ (researcher, coder, design, analyst, critic, skeptic, rag)
│   ├── shared/
│   └── dashboard/
├── n8n-workflows/
├── scripts/
└── docs/
```

---

## Phase 15: User Experience Features (NEW - from PDFs)

### 15.1 Personal Knowledge Management (PKM)
- [ ] PersonalNote schema with embeddings
- [ ] Smart connections (related_chats, related_documents)
- [ ] Auto-generated links with similarity scores
- [ ] In-Chat Quick Capture (Save Insight, Log Decision buttons)
- [ ] Knowledge Graph View (D3.js force-directed)
- [ ] Automatic link suggestions with vector search

### 15.2 Decision Journal
- [ ] Decision schema with alternatives and trade-offs
- [ ] Decision Capture Workflow (detect keywords, extract details)
- [ ] Skeptic agent for alternatives analysis
- [ ] Periodic Review System (3-month review scheduling)
- [ ] Decision Dashboard with success rate metrics
- [ ] Outcome tracking (success/neutral/regret)

### 15.3 Template Library & Marketplace
- [ ] Template schema with versioning and changelog
- [ ] Built-in templates:
  - [ ] Deep Research Report
  - [ ] Full Feature Implementation
  - [ ] Business Idea Validation
  - [ ] Data Processing Pipeline (n8n)
- [ ] Template Marketplace UI with stats
- [ ] One-Click Project Creation from templates
- [ ] Template versioning (auto increment major/minor)
- [ ] Template usage tracking

### 15.4 Scheduled & Recurring Tasks
- [ ] ScheduledTask schema with cron support
- [ ] Scheduler Service with CronJob management
- [ ] Output destinations (Discord, email, library, dashboard, Notion, webhook)
- [ ] Notification settings (always, completion, changes_only, failure)
- [ ] Results storage with retention policies
- [ ] Scheduled Task UI with toggle/edit/run now/history
- [ ] Example tasks: Weekly AI News Digest, Daily Stock Analysis, Monthly Code Health

### 15.5 Context Switching & Focus Modes
- [ ] WorkspaceContext with active projects (max 3 pinned)
- [ ] FocusMode types: deep_work, research, planning, review, casual
- [ ] Mode-specific preferences:
  - [ ] Notifications (all/critical_only/off)
  - [ ] Auto-approve settings
  - [ ] Preferred models per mode
  - [ ] Sidebar collapsed state
- [ ] Focus Mode Selector in top bar
- [ ] Project Quick Switch dropdown
- [ ] Session tracking (time_in_focus, switches_today)

### 15.6 Library Management UI
- [ ] Libraries Tab in dashboard sidebar
- [ ] LibraryCard with stats (doc count, last scanned, size)
- [ ] Add Library Modal (name, path, auto-scan, schedule)
- [ ] Ingestion progress bar
- [ ] Actions: Upload, Rescan, Search, Settings, Delete
- [ ] RAG Query Results with Source Citations
- [ ] Image references display

### 15.7 Quality Monitoring & Auto-Upgrade
- [ ] QualityMonitor for response evaluation
- [ ] Completeness/coherence/correctness scoring
- [ ] Auto-upgrade to cloud model when quality < 6.0
- [ ] Quality issue recording for audit

---

## Phase 16: Hardware Deployment (4-Node Homelab)

### 16.1 Core1 (24 CPUs, 188GB RAM) - Primary Compute
- [ ] Mother Orchestrator (Node.js)
- [ ] Redis Stack (full suite)
- [ ] Docling Service (async ingestion)
- [ ] Dashboard (Next.js)
- [ ] n8n (workflow engine)
- [ ] Agent Workers (Researcher, Coder, Design, Analyst, Critic, Skeptic, RAG)

### 16.2 Core2 - Ollama Host
- [ ] Ollama server (local models)
- [ ] gpt-oss:20b (Q4/Q5 quantized) as default
- [ ] Optional: gpt-oss:20b-fp8 (dual-GPU with tensor parallelism)

### 16.3 Core3 (CPUs, 78.5GB RAM) - Overflow Compute
- [ ] Additional agent worker replicas
- [ ] Monitoring stack (Prometheus/Grafana)

### 16.4 Core4 (Windows Server) - Storage
- [ ] File storage (document libraries)
- [ ] Media server
- [ ] Network shares (SMB/CIFS)
- [ ] Library structure: /coding, /personal, /docs, /stocks, /media, /financials, /custom

---

## Phase 17: Validation Checklist (Pre-Production)

### Critical Requirements
- [ ] Every run terminates with explicit TerminationReason
- [ ] Conflict resolution tested with real disagreements
- [ ] Context never silently truncated (ContextSummary present)
- [ ] Tool registry routes deterministic tasks before LLM
- [ ] Resource budgets enforced on all runs
- [ ] Garbage collector running daily, Redis not bloating
- [ ] Library access policies prevent unauthorized access
- [ ] Redaction engine tested on PII-containing docs
- [ ] All 7 v4 robustness features have integration tests
- [ ] Activity stream logs all policy events
- [ ] Termination analytics dashboard operational

### Performance Targets
- [ ] P95 latency < 5s for simple queries
- [ ] RAG retrieval < 500ms
- [ ] Support 10 concurrent runs
- [ ] Context budget tracking overhead < 100ms
- [ ] Tool execution < 5s for most tools

### Reliability Targets
- [ ] 99% of runs complete or fail with clear reason
- [ ] No infinite loops (all bounded by timeouts/retries)
- [ ] All state changes logged to activity stream
- [ ] Replay succeeds for 95%+ of runs

---

## Estimated Timeline

| Phase | Description | Duration |
|-------|-------------|----------|
| 1-2 | Core Infrastructure + Agents | 2-3 weeks |
| 3-4 | Routing + RAG | 2-3 weeks |
| 5 | Tool System | 1-2 weeks |
| 6 | v4 Robustness + Error Handling | 2-3 weeks |
| 7 | Update Agent | 1-2 weeks |
| 8-9 | Memory + N8N | 1-2 weeks |
| 10-11 | API + Security | 2-3 weeks |
| 12-13 | Testing + Monitoring | 2 weeks |
| 14 | Docs + Deployment | 1-2 weeks |
| 15 | UX Features (PKM, Templates, etc.) | 2-3 weeks |
| 16 | Homelab Deployment | 1 week |
| 17 | Validation | 1 week |

**Total Estimated Time**: 18-26 weeks (4-6 months)

---

## Key Technical Decisions to Confirm

1. **Redis Configuration**: Redis Stack (RedisJSON + RediSearch + Vector)
2. **Embedding Model**: gpt-oss:20b embeddings (768-dim vectors)
3. **Docling Setup**: Self-hosted async service on core1
4. **N8N Deployment**: Self-hosted n8n on core1
5. **Local Models**: Ollama on core2 with gpt-oss:20b (Q4/Q5)
6. **Cloud Models**: Ollama Cloud + devstral-2:123b, deepseek-v3.1:671b, qwen3-next:80b
7. **Open-WebUI**: Integration with Orchestrator API

---

## Support Resources

- **Redis Stack Docs**: https://redis.io/docs/stack/
- **Docling Docs**: https://docling.ai/docs
- **n8n Docs**: https://docs.n8n.io
- **Ollama Cloud**: https://ollama.com/cloud
- **Ollama Models**: https://ollama.com/search?c=cloud
