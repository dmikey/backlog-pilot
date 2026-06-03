# Backlog Pilot

Backlog Pilot is an AI-native backlog curator for collectors with large libraries across Steam, Nintendo Switch, GBA, PSP, and PSVita. This first scaffold focuses on the product's core question:

> What should I play tonight?

The app is intentionally recommendation-first rather than spreadsheet-first. Collection management exists to support curation, not replace it.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. (Optional) copy the example Prisma environment for local database work:

   ```bash
   cp .env.example .env
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Validation Commands

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Architecture Notes

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Reusable card-based UI shell inspired by calm, opinionated productivity tools

### Domain Foundation

The initial scaffold includes typed models and demo data for:

- Users
- Households
- Platforms
- Games
- Game metadata
- Library entries
- Recommendations
- Recommendation reasons
- Import sources
- Play statuses

All MVP-first platforms are seeded in demo mode:

- Steam
- Nintendo Switch
- GBA
- PSP
- PSVita

### Persistence

Prisma is included with a starter schema in `prisma/schema.prisma`.

- The scaffold uses a local SQLite-style `DATABASE_URL` in `.env.example` for friction-free development.
- The schema is intentionally structured to stay portable so the app can be promoted to PostgreSQL later without rewriting the application layer.
- The UI currently reads from deterministic demo data in `lib/demo-data.ts`, which keeps the first-run experience working before real importers or auth exist.

### AI Service Abstractions

The following deterministic placeholder services are defined in `lib/ai/agents.ts`:

- `BacklogCoachAgent`
- `PurchaseAdvisorAgent`
- `RecommendationExplainer`
- `CollectionCuratorAgent`

They return stable, hard-coded responses based on the demo catalog so future issues can wire in real LLM calls without redesigning the interface.

## App Routes

- `/` — landing / welcome
- `/onboarding` — first-run onboarding and import source selection
- `/dashboard` — recommendation-first home
- `/library` — collection browser placeholder
- `/queue` — active rotation / backlog queue placeholder
- `/recommendations` — AI recommendation surface
- `/settings` — household, persistence, and future integrations placeholder
