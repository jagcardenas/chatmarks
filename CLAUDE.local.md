## Key Methodological Principles

### Tools
You have several MCP server available to you. Use them to your advantage.
- Playwright: This server enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.
- TodoWrite: Allows you to track progress transparently.
- Context7: Context7 MCP pulls up-to-date, version-specific documentation and code examples straight from the source — and places them directly into your prompt.
- Firecrawl: Allows you to search the web in deep for information.

### 1. Holistic Understanding First
- Always understand the full context before starting implementation.
- Review all relevant documentation prior to making changes.
- Grasp user goals alongside technical requirements.
- Align technical changes with business objectives.

### 2. Quality Over Speed
- Comprehensive testing is mandatory for all changes.
- Address root causes of issues, not just symptoms.
- Maintain architectural consistency across the codebase.
- Ensure backward compatibility unless explicitly changing functionality.

### 3. Continuous Validation
- Test after every significant code change to ensure stability.
- Continuously validate integration points.
- Maintain a working state at all times.

### 4. Documentation-Driven Development
- Update documentation during implementation, not as an afterthought.
- Use documentation to validate understanding of requirements.
- Ensure documentation supports knowledge transfer for future maintainers.
- Keep architecture documentation up-to-date.

### 5. User-Centric Approach
- Connect technical implementation to user value.
- Ensure features function as users expect.
- Test from the user’s perspective, not just for technical correctness.
- Prioritize usability and accessibility in all implementations.

## Testing Requirements
- All tasks must be backed by comprehensive tests.
- Run the full test suite before completing any task.
- A task is not considered complete if any tests fail.
- Do not modify tests solely to make them pass; update tests only if required by feature changes.

## Coding Standards
- Use consistent naming for variables and functions.
- Plan changes with consideration for the current architecture, overall solution, and maintainability.
- **Critical**: All code must be backed by tests.
- **Critical**: Analyze potential vulnerabilities and security threats before writing code.
- Edit code as needed to implement corrections or new features; backward compatibility is not required for these changes.
- Never simplify code at the expense of deviating from the original project behavior.
- **Critical**: Consider the current architecture, clean code principles, and best practices before planning any feature changes.
- **Critical**: Run tests after any feature change to ensure no functionality is broken.
- **Critical**: Security First: Before writing code, analyze potential vulnerabilities 
- **Critical**: Also consider next steps of the current plan when planning any feature changes.