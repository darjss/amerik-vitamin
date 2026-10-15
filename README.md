# amerik-vitamin

The rewrite of vit-store: storefronts, mom's mobile dashboard, Messenger, supply, and the reels engine for Amerik huns baraa.

Start here:

1. [docs/MANIFESTO.md](docs/MANIFESTO.md): why this exists.
2. [docs/private/OPERATING_CONTEXT.md](docs/private/OPERATING_CONTEXT.md) (private, see below): what's true right now.
3. [AGENTS.md](AGENTS.md): how agents work here, and every other doc.

## Private docs

Business numbers, supplier correspondence and the legacy findings, which hold real customer data, live in the private `darjss/amerik-vitamin-private`. With access, clone it into the gitignored `docs/private`:

```bash
git clone git@github.com:darjss/amerik-vitamin-private.git docs/private
```

## Development

You need Node 22.18 or newer, pnpm 12 and Docker.

```bash
vp install
cp .env.example .env     # set DATABASE_URL, e.g. postgres://postgres:<password>@127.0.0.1:5432/amerik
vp run dev               # Postgres in Docker, API on :8788, web on :3001
vp run migrate           # after each schema change, against DATABASE_URL
```

`vp run dev` runs `alchemy dev` for the stage `dev_<user>`. Check it with `curl localhost:8788/health`, which returns `{"ok":true}`. The home page at http://localhost:3001 shows the result of the `health` rpc.

Before committing:

```bash
vp check
vp run build
```

To change the schema, edit `packages/db/src/schema.ts`, then run `vp exec drizzle-kit generate` in `packages/db`.

## Deployment

From the main checkout only: `vp run build`, read `vp run plan`, then `vp run deploy`. Production needs `CLOUDFLARE_*` and `PLANETSCALE_*` in `.env`. The deploy runs the migrations against PlanetScale before it updates the Workers.
