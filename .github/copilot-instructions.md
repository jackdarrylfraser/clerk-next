# AI Readability & Schema Standards

1. **Optimize for Reading:** Prioritize clear, self-documenting code over clever one-liners or shorthand syntax.
2. **Naming:** Use full, intention-revealing names (`isUserActive`, `connectionTimeoutMs`); no arbitrary abbreviations.
3. **Small & Flat:** Keep functions under 30 lines. Flatten nested logic using early returns and guard clauses.
4. **Prioritize Zod Objects:** Model all domain boundaries, request payloads, and external configs using strict Zod schemas.
   - Infer types directly (`type User = z.infer<typeof UserSchema>`) rather than defining loose manual interfaces.
   - Validate and parse at the application boundaries before passing data downstream.
5. **Explain the "Why":** Comments must only clarify business logic, invariants, or edge cases—never restate what the code does.
6. **Immutable by Default:** Prefer `const` and immutable structures; explicitly declare return types and function arguments.
7. **Fail Fast:** Never swallow exceptions or bypass schema validation errors silently.
