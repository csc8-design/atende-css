# AGENTS.md

- Features dependentes da Evolution API ficam atrás de `EVOLUTION_ENABLED` em `src/lib/features.ts` — o produto usa só a API oficial da Meta, mas o código é mantido para eventual reativação.
- Controle de acesso no front usa `isAdmin`/`isManager` do AuthContext (tabela user_roles) — nunca e-mails ou UUIDs fixos.
