# @open-cfmoto/docs

Docusaurus site for:

- Reverse engineering findings (`tools/apk-analysis/findings`)
- Project docs (`docs`)
- Package docs (`apps/docs/docs/packages`)

## Local dev

From repo root:

```bash
pnpm install
pnpm docs:dev
```

Direct package commands:

```bash
pnpm --filter @open-cfmoto/docs start
pnpm --filter @open-cfmoto/docs build
```

