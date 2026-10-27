# Flavio

AI-assisted CRM for Hungarian real estate agents. Next.js 16 + Supabase (Postgres, Auth, RLS).

Plan, architecture, schema and risks: [docs/PLAN.md](docs/PLAN.md).

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # DB tenant-isolation tests (in-memory Postgres, no Docker needed)
npm run typecheck
npm run lint
npm run build
```

## Database

Migrations are in `supabase/migrations`. Apply them to your hosted Supabase dev project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Copy `.env.example` to `.env.local` and fill in the values. Never commit secrets.
