# Chatmarks Agent Team Hierarchy

This document defines the hierarchical organization and collaboration patterns for the specialized agent team responsible for developing and maintaining the Chatmarks Chrome extension.

## Organizational Structure

```
Chief Technical Architect
├── Project Task Orchestrator
│   ├── Task Context Analyzer
│   ├── Software Engineer Executor
│   │   ├── QA Validation Engineer
│   │   ├── Integration Testing Engineer
│   │   ├── Performance Optimization Specialist
│   │   └── Security Compliance Auditor
│   ├── Domain Architecture Specialist
│   └── Platform Experts
│       ├── ChatGPT Platform Expert
│       ├── Claude Platform Expert
│       └── Grok Platform Expert
```

## Agent Roles & Responsibilities

### Executive Level

**Chief Technical Architect** (`chief-technical-architect`)
- **Authority**: Ultimate technical decision-making authority
- **Responsibilities**: Strategic technical leadership, cross-system coordination, agent team management, technical quality assurance, risk management
- **Reports to**: User/Business Stakeholders
- **Delegates to**: All other agents based on technical requirements

### Management Level

**Project Task Orchestrator** (`project-task-orchestrator`)
- **Authority**: Task sequencing, agent assignment, resource allocation
- **Responsibilities**: TASKS.md execution, agent coordination, progress tracking, quality gate enforcement
- **Reports to**: Chief Technical Architect
- **Coordinates with**: All specialized agents

### Analysis & Planning Level

**Task Context Analyzer** (`task-context-analyzer`)
- **Authority**: Requirements analysis and technical planning
- **Responsibilities**: Comprehensive context analysis, requirement extraction, technical feasibility assessment, implementation planning
- **Reports to**: Project Task Orchestrator
- **Supports**: All implementation agents with detailed requirements

**Domain Architecture Specialist** (`domain-architecture-specialist`)
- **Authority**: System architecture design and component relationships
- **Responsibilities**: Architecture design, system integration patterns, technical strategy
- **Reports to**: Chief Technical Architect (for architecture decisions), Project Task Orchestrator (for task execution)
- **Supports**: Software Engineer Executor with architectural guidance

### Implementation Level

**Software Engineer Executor** (`software-engineer-executor`)
- **Authority**: Implementation decisions within assigned tasks
- **Responsibilities**: Complete software development lifecycle execution with TDD
- **Reports to**: Project Task Orchestrator
- **Collaborates with**: QA Validation Engineer, Platform Experts, Domain Architecture Specialist

**Platform Experts** (`chatgpt-platform-expert`, `claude-platform-expert`, `grok-platform-expert`)
- **Authority**: Platform-specific technical decisions and implementation
- **Responsibilities**: Platform-specific implementations, DOM structure analysis, API integration
- **Reports to**: Software Engineer Executor (for implementation), Project Task Orchestrator (for coordination)
- **Specializes in**: Individual AI platform technical details

### Quality Assurance Level

**QA Validation Engineer** (`qa-validation-engineer`)
- **Authority**: Quality gate approval/rejection
- **Responsibilities**: Pre-commit validation, comprehensive testing, quality reporting
- **Reports to**: Project Task Orchestrator
- **Collaborates with**: Software Engineer Executor (primary), Integration Testing Engineer

**Integration Testing Engineer** (`integration-testing-engineer`)
- **Authority**: Cross-system testing and validation
- **Responsibilities**: Integration testing, cross-platform compatibility, E2E workflows
- **Reports to**: QA Validation Engineer (for testing results), Project Task Orchestrator (for coordination)
- **Specializes in**: System integration validation

**Performance Optimization Specialist** (`performance-optimization-specialist`)
- **Authority**: Performance requirements and optimization decisions
- **Responsibilities**: Performance profiling, optimization, scalability validation
- **Reports to**: Chief Technical Architect (for performance standards), Project Task Orchestrator (for task execution)
- **Supports**: Software Engineer Executor with performance guidance

**Security Compliance Auditor** (`security-compliance-auditor`)
- **Authority**: Security and compliance approval/rejection
- **Responsibilities**: Security analysis, vulnerability assessment, compliance validation
- **Reports to**: Chief Technical Architect (for security decisions), Project Task Orchestrator (for task execution)
- **Validates**: All security-sensitive implementations

## Collaboration Patterns

### Task Execution Workflow

1. **Initiation**: Chief Technical Architect or Project Task Orchestrator identifies work need
2. **Analysis**: Task Context Analyzer provides comprehensive requirements analysis
3. **Planning**: Domain Architecture Specialist provides technical design (if needed)
4. **Implementation**: Software Engineer Executor implements with Platform Expert support
5. **Testing**: QA Validation Engineer validates with Integration Testing Engineer support
6. **Specialized Validation**: Performance/Security specialists validate as needed
7. **Approval**: Project Task Orchestrator validates completion, Chief Technical Architect approves major changes

### Cross-Agent Communication

**Escalation Path**:
- Implementation issues: Software Engineer Executor → Project Task Orchestrator → Chief Technical Architect
- Quality issues: QA Validation Engineer → Project Task Orchestrator → Chief Technical Architect
- Architecture conflicts: Domain Architecture Specialist → Chief Technical Architect
- Performance/Security issues: Specialists → Chief Technical Architect

**Collaboration Patterns**:
- **Sequential**: Analysis → Architecture → Implementation → Testing → Validation
- **Parallel**: Platform Experts work concurrently on different platforms
- **Consultative**: Specialists provide guidance to Software Engineer Executor during implementation

## Decision Authority Matrix

| Decision Type | Primary Authority | Consultation Required |
|---------------|-------------------|----------------------|
| Strategic Technical Direction | Chief Technical Architect | Business Stakeholders |
| Task Prioritization | Project Task Orchestrator | Chief Technical Architect |
| Architecture Design | Domain Architecture Specialist | Chief Technical Architect |
| Implementation Approach | Software Engineer Executor | Domain Architecture Specialist, Platform Experts |
| Quality Standards | QA Validation Engineer | Project Task Orchestrator |
| Performance Requirements | Performance Optimization Specialist | Chief Technical Architect |
| Security Requirements | Security Compliance Auditor | Chief Technical Architect |
| Platform-Specific Decisions | Platform Experts | Software Engineer Executor |

## Communication Protocols

### Reporting Structure
- **Daily Progress**: All agents → Project Task Orchestrator
- **Quality Issues**: QA/Testing agents → immediate escalation to Project Task Orchestrator
- **Architecture Decisions**: Domain Architecture Specialist → Chief Technical Architect
- **Blockers**: Any agent → Project Task Orchestrator → Chief Technical Architect if unresolved

### Documentation Standards
- All agents maintain detailed work logs using TodoWrite
- Architecture decisions documented by Domain Architecture Specialist
- Quality gates documented by QA Validation Engineer
- Platform-specific knowledge maintained by Platform Experts

### Conflict Resolution
1. **Peer Level**: Direct collaboration and negotiation
2. **Management Level**: Project Task Orchestrator mediation
3. **Executive Level**: Chief Technical Architect final decision
4. **Business Level**: Escalation to user/stakeholders for business decisions

## Success Metrics

### Individual Agent Performance
- Task completion within quality standards and timelines
- Effective collaboration with peer agents
- Appropriate escalation of issues and decisions
- Knowledge sharing and documentation quality

### Team Performance
- Systematic progression through TASKS.md roadmap
- Quality gate compliance (100% test passing, no critical security issues)
- Performance target achievement (all metrics within specifications)
- Minimal technical debt accumulation

### Project Success
- All 40 tasks completed within quality standards
- Chrome extension meets all functional and non-functional requirements
- Successful Chrome Web Store submission and approval
- User acceptance and adoption targets met

This hierarchical structure ensures clear accountability, efficient collaboration, and systematic delivery of the Chatmarks extension while maintaining enterprise-grade quality standards.