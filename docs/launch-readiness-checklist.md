# Launch Readiness Checklist

## Role Contracts & Agent Outputs
- [x] Keep existing role contracts and update agent outputs to match required outputs.
- [x] Critic outputs include `review_report` (approval + summary + positives + counts) and `issues_found` (issues array).
- [x] Skeptic outputs include `challenges` (map derived from concerns) while keeping `alternatives` as-is.
- [x] Ensure contract-required outputs are emitted by agents (critic: `review_report`, `issues_found`; skeptic: `challenges`, `alternatives`).

## Naming Clarity (Critic vs Skeptic)
- [x] Document the semantics: skeptic = critique/stress-test; critic = QA/review gate.
- [ ] Evaluate whether to rename agent type/file from `skeptic` → `critique` for long-term clarity.

## Capabilities Match Behavior
- [x] Remove `code_execution` from critic capabilities unless tool execution is wired.
- [x] Set `critic.requires_tool_calling` based on actual behavior.
- [ ] Audit remaining roles to ensure `capabilities` and `requires_tool_calling` match behavior.

## Output Schema Consistency (Chaining-Friendly)
- [ ] Standardize severity vocabulary across critic and skeptic outputs.
- [ ] Align on a shared category/area field name across review outputs.
- [ ] Align on a shared recommendation/mitigation field name across review outputs.
- [ ] Add a shared adapter/type to normalize critic and skeptic outputs for downstream chaining.

## Contract Alignment (Do Not Postpone)
- [x] Ensure agent contracts reflect actual output fields and delivered artifacts.
- [ ] Add validation tests that contracts reject missing required outputs.
