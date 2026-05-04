---
name: documentation
description: Generate or update documentation for code, APIs, or components
allowed-tools: Read, Glob, Grep, Write
---

Generate comprehensive documentation:

1. Read the code to understand functionality
2. Identify public APIs, components, or functions needing docs
3. For each item document:
   - Purpose and description
   - Parameters/props with types
   - Return values
   - Usage examples
   - Edge cases and limitations

4. For Fiskix-specific modules:
   - Scoring rules (R1–R9): document detection logic and point ranges
   - Edge Functions: document Deno API contracts and environment requirements
   - REST API v1: document endpoints, auth, rate limits, and response shapes
   - PWA mobile routes: document offline behavior and sync strategy

5. Update CLAUDE.md if architecture changes
6. Follow existing documentation style in the project (Portuguese for user-facing, English for code)

Do not add JSDoc to code that doesn't need it — only document public APIs and complex logic.
