
# Implementation Plan: AI Project Initialization Template Tool

**Branch**: `001-npm-ai-npx` | **Date**: 2025-09-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-npm-ai-npx/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
The AI Project Initialization Template Tool provides a comprehensive CLI solution for quickly creating standardized project structures using npm-based and git-based templates. The tool focuses on CLI-only functionality with support for multiple template types (React Next.js, Node.js API, Vue applications), interactive template selection, and configuration management. Key technical approaches include npm registry integration, git repository support, local caching for performance optimization, and standardized project configuration validation.

## Technical Context
**Language/Version**: Node.js 18+
**Primary Dependencies**: npm, commander.js, inquirer, chalk, ora, simple-git
**Storage**: File system (templates), npm cache, git repositories
**Testing**: Jest, npm pack/testing, filesystem testing
**Target Platform**: Cross-platform CLI tool (Windows, macOS, Linux)
**Project Type**: Single project CLI tool
**Performance Goals**: <200ms CLI response time, <1s template download and validation
**Constraints**: npm registry access, git repository access, file system permissions, network connectivity
**Scale/Scope**: Support 10+ template types, 1000+ concurrent users

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Code Quality Excellence
- [ ] Each file has single responsibility and clear purpose
- [ ] Code complexity is justified and documented
- [ ] Code follows established patterns and conventions
- [ ] Dependencies are minimal and well-managed

### Testing Standards (NON-NEGOTIABLE)
- [ ] TDD approach: Tests written before implementation
- [ ] All features start with failing tests
- [ ] Test coverage meets minimum thresholds
- [ ] Tests include unit, integration, and contract tests
- [ ] Test names clearly describe expected behavior

### User Experience Consistency
- [ ] UI components follow established design patterns
- [ ] Accessibility standards are met
- [ ] User flows are intuitive and predictable
- [ ] Interactions are consistent across features

### Performance Requirements
- [ ] Response times under 200ms benchmark
- [ ] Memory usage within defined limits
- [ ] Efficient resource utilization
- [ ] Performance testing integrated in pipeline

### Security and Compliance
- [ ] Security built into components (not afterthought)
- [ ] All inputs validated and outputs sanitized
- [ ] Sensitive data properly encrypted
- [ ] Compliance with relevant regulations

### Architecture and Design
- [ ] Systems designed for maintainability and scalability
- [ ] Components loosely coupled with clear interfaces
- [ ] Architecture patterns justified and documented

### Documentation Standards
- [ ] Code is self-documenting through clear naming
- [ ] Complex logic includes inline comments explaining "why"
- [ ] Documentation kept current with code changes

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── cli/
│   ├── commands/
│   ├── prompts/
│   └── index.js
├── core/
│   ├── template-manager.js
│   ├── config-validator.js
│   ├── cache-manager.js
│   └── git-manager.js
├── services/
│   ├── npm-service.js
│   ├── git-service.js
│   └── project-service.js
├── models/
│   ├── template.js
│   ├── project.js
│   └── config.js
└── utils/
    ├── logger.js
    ├── file-operations.js
    └── error-handler.js

tests/
├── unit/
├── integration/
└── contract/
```

**Structure Decision**: Single project structure with clear separation between CLI interface, core business logic, external services, data models, and utility functions. This structure supports the CLI-only focus with npm and git integration.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Focus on CLI-only components: npm integration, git support, caching, validation
- Each API endpoint → implementation and test tasks
- Each data entity → model and service tasks
- Each core feature → integration test tasks
- Performance and security requirements → dedicated test tasks

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Core services → CLI commands → Integration
- Mark [P] for parallel execution (independent files)

**Key Task Categories**:
1. **Setup**: Project structure, dependencies, configuration
2. **Core**: Template management (npm + git), CLI interface, caching system
3. **Tests**: Contract tests, integration tests, performance tests
4. **Integration**: Error handling, validation, file operations
5. **Polish**: Documentation, optimization, final testing

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
