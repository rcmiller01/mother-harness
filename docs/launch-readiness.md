# Launch Readiness Checklist

This checklist is the authoritative source for launch readiness status.

## Product Readiness
- [ ] Core orchestration flows complete (plan → execute → review → finalize)
- [ ] Primary agent roster wired and reachable (Orchestrator, Researcher, Coder, Analyst, Critic)
- [ ] Approval gating implemented for risky actions
- [ ] Artifact lifecycle retention policy defined
- [ ] Validation checklist items mapped to owners

## Infrastructure & Data
- [ ] Redis Stack configured with persistence, ACLs, and required indexes
- [ ] Docling ingestion service running and reachable
- [ ] n8n workflows deployed with retry + error reporting
- [ ] Backup/restore strategy documented and tested
- [ ] Environment configuration validated for core1/core2/core3/core4

## Security & Compliance
- [ ] Authn/authz (JWT + RBAC) enforced in API layer
- [ ] Secrets management confirmed (no secrets in repo)
- [ ] PII redaction rules validated on sample documents
- [ ] Security scan baseline completed
- [ ] Access audit logging enabled

## Observability & Operations
- [ ] Health checks available for all services
- [ ] Activity stream logging enabled
- [ ] Metrics dashboard configured (latency, failure rates, budgets)
- [ ] Alerting thresholds defined for errors and resource budgets
- [ ] On-call and escalation procedures documented

## Quality & Testing
- [ ] Unit test coverage for schemas and core state machine
- [ ] Integration tests for run lifecycle and retrieval pipeline
- [ ] Replay functionality validated on sample runs
- [ ] Load test completed for 10 concurrent runs
- [ ] Regression checklist executed on staging

## Documentation & Support
- [ ] Deployment guide up to date
- [ ] API reference published
- [ ] Troubleshooting runbook prepared
- [ ] User onboarding quickstart validated
- [ ] Launch checklist reviewed and signed off
