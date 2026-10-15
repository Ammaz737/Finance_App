# Documentation validation

Review date: 13 October 2026.

- Four self-contained seeded-role manuals are present, each with required training sections and four Mermaid workflow diagrams.
- Checked 370 local document/source/image links: all resolve.
- Checked 72 sidebar route declarations against page files: all resolve.
- Markdown code fences are balanced.
- Rechecked 1041 application/shared source hashes after documentation generation: unchanged during generation.
- Existing search and Inbox screenshots were visually inspected and labeled as historical Owner examples.
- Representative specialized button/field labels were cross-checked against TSX: bill intake/submission, payment release, reimbursement receipt upload, vendor verification, PO matching, people assignments, policy/workflow actions, QuickBooks mappings, and card test helpers.

These are documentation/static-source checks. No application tests, live sign-in, database writes, external provider transactions, or deployment validation were performed. Mermaid blocks are supplied as source; rendering depends on the Markdown viewer. The complete-role claim refers to repository-defined seeded roles, not unknown live custom roles.

## Consolidated task-wise guide

Added COMPLETE-TASK-WISE-TRAINING.md in Roman Urdu, with English UI labels. Validated 16 task sections, 4 Mermaid diagrams, 7 local links and 71 inline application route references. Checked policy threshold semantics directly against the policy engine: receipt/quote/high-value use inclusive thresholds; travel maximum uses a strict greater-than threshold; procurement vendor/memo/quote defaults return REVIEW rather than an automatic hard block. No application code or live application state was modified.
