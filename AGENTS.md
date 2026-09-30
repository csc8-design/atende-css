# AGENTS.md

- Features dependentes da Evolution API ficam atrás de `EVOLUTION_ENABLED` em `src/lib/features.ts` — o produto usa só a API oficial da Meta, mas o código é mantido para eventual reativação.
- Controle de acesso no front usa `isAdmin`/`isManager` do AuthContext (tabela user_roles) — nunca e-mails ou UUIDs fixos.
- A identidade visual usa tokens semânticos em `src/index.css`, fonte Arial e logo CSS em `public/css-logo.png` — o arquivo local garante compatibilidade com deploy FTP na Hostinger.
