# Backend modules

Every module has the same shape:

```text
api/            HTTP only
application/    use cases / orchestration
domain/         rules, state machine, repository ports
infrastructure/ Prisma, adapters
tests/
index.ts        public API — other modules import only from here
```

Do not reach into another module's internal folders or tables.
