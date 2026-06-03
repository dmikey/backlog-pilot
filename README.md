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

The canonical metadata scaffold includes typed models and demo data for:

- Users
- Households
- Platforms
- Canonical games
- Platform entries
- Game metadata
- Franchises
- Series
- Genres
- Tags
- Library entries (household/user ownership context)
- Recommendations
- Recommendation reasons
- Import sources
- Play statuses

#### Canonical model design

- `Game` is platform-agnostic and stores canonical identity (`canonicalTitle`, `normalizedTitle`, aliases, edition metadata, franchise/series links, media, genres, tags, release info).
- `PlatformEntry` stores platform-specific ownership records (`platform`, `platformGameId`, `ownershipType`, `acquiredDate`, `playtimeHours`, `completionStatus`) without duplicating the core `Game`.
- `GameMetadata` stores duplicate detection keys (alias + edition match fields) and enrichment data (external IDs, completion time, review score, popularity, genre/franchise weighting).

```mermaid
flowchart TD
  Franchise --> Series
  Franchise --> Game
  Series --> Game
  Game --> GameMetadata
  Game --> PlatformEntry
  Game --> Genre
  Game --> Tag
  Game --> CoverArt["Cover Art"]
  Game --> Screenshots
  PlatformEntry --> Platform
  LibraryEntry --> PlatformEntry
  LibraryEntry --> User
  LibraryEntry --> Household
```

#### Required seed examples

`lib/demo-data.ts` includes canonical + platform entry examples for:

- Persona 4 Golden
- Yakuza 0
- Monster Hunter Rise
- Pokemon Emerald
- Final Fantasy Tactics: The War of the Lions

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

### User Library Service

`lib/library/service.ts` provides the user library system of record with repository abstractions and API routes under `app/api/library`.

- Supports Steam, Nintendo Switch, GBA, PSP, and PSVita ownership records
- Stores canonical game references plus ownership/status/rating/notes/playtime metadata
- Integrates canonical game + metadata validation via the existing domain model (`lib/demo-data.ts` getters)

Endpoints:

- `GET /api/library?userId=:userId`
- `GET /api/library/games?userId=:userId[&status=:status][&platform=:platform][&q=:search]`
- `POST /api/library/games`
- `PATCH /api/library/games/:id?userId=:userId`
- `DELETE /api/library/games/:id?userId=:userId`
- `GET /api/library/stats?userId=:userId`

### Steam Authentication and Account Linking

Steam account linking is implemented with OpenID-based identity verification and account management services under `lib/steam`.

- `SteamAuthProvider` creates OpenID login redirects and validates callback responses.
- `SteamIdentityService` fetches and normalizes Steam profile data (`steamId`, display name, avatar URL, profile URL).
- `SteamAccountService` links, reconnects, unlinks, and reports connected account status.

Routes:

- `GET /auth/steam?userId=:userId` — begin Steam OpenID flow
- `GET /auth/steam/callback` — validate OpenID callback and link account
- `GET /accounts/steam?userId=:userId` — connected account status
- `DELETE /accounts/steam?userId=:userId[&steamId=:steamId]` — unlink account

Security protections in the auth flow include:

- CSRF/state validation with one-time state records
- Session cookie validation (`steam_link_session`)
- OpenID response verification (`check_authentication`)
- Replay protection using tracked OpenID response nonces

UI support:

- `/settings` now includes a **Connected accounts** section with Steam status, avatar, profile link, and disconnect action.

### Recommendation Scoring Engine

`lib/recommendations/scoring.ts` contains a deterministic, configurable recommendation scoring engine. It is independent of LLM services and produces explainable outputs with:

- `score` (0-100)
- `confidence` (0-100)
- ranked `reasons`
- per-factor `factors` breakdown

Current weighted factors:

- completion probability
- backlog age
- genre diversity
- platform preference
- session fit
- ownership duplication
- active rotation fit

Factor weights are configuration-driven via `RecommendationScoringEngine` constructor options, and `lib/recommendations/scoring.test.ts` covers deterministic behavior, explainability, weight overrides, and supported platform scoring.

### Metadata Enrichment Pipeline (IGDB)

`lib/metadata` adds an IGDB-first canonical enrichment pipeline with provider abstractions and refresh workflows:

- `IGDBProvider` defines the real IGDB API integration surface (`searchByTitle`, `searchByAlias`, `searchByExternalIds`, `getGameDetails`, `getFranchise`, `getPlatformMappings`).
- `InMemoryIGDBProvider` provides deterministic fixture data for tests and local development.
- `MetadataEnrichmentService` implements `enrichGame`, `bulkEnrich`, `refreshGame`, and `refreshAll`.
- `MetadataRefreshService` provides a dedicated refresh workflow wrapper for scheduled/manual refresh jobs.
- Deterministic matching priority is implemented as:
  1. exact title
  2. alias
  3. franchise + title similarity
  4. release date validation

The normalization pipeline enriches canonical `Game` + `GameMetadata` records with:

- aliases and alias match keys
- franchise and series links
- genres, themes/keywords (as tags)
- release date
- developers and publishers
- cover art and screenshot URLs (reference-only; no asset downloads)
- supported platform mappings (Steam, Nintendo Switch, GBA, PSP, PSVita)

Caching behavior:

- Avoids repeated provider calls within a configurable TTL.
- Tracks refresh timestamps in cache records.
- Supports forced refresh (`forceRefresh: true`) for workflow reruns.

## App Routes

- `/` — landing / welcome
- `/onboarding` — first-run onboarding and import source selection
- `/dashboard` — recommendation-first home
- `/library` — collection browser placeholder
- `/queue` — active rotation / backlog queue placeholder
- `/recommendations` — AI recommendation surface
- `/settings` — household, persistence, and future integrations placeholder
