# Pencari — Project Context for AI Assistants

## What This Project Does

**Pencari** ("searcher" in Indonesian) is a social media job-hunting bot. It periodically scours Twitter/X, Reddit, and other non-saturated platforms (not LinkedIn) for job postings matching a set of configurable keyword patterns. Relevant posts are filtered with an LLM, then pushed as alerts to a Discord/Telegram webhook.

The system is designed to be always-on, running as a containerised background worker service.

## Goal / Intent

The owner wants the bot to:
- Scrape platforms that are **less saturated than LinkedIn** — Twitter/X, Reddit, Hacker News (YC), and similar communities where real hiring signals appear organically.
- Run **periodically and automatically** on a cron schedule (default: every 6 hours).
- **Report back** via a webhook (Discord/Telegram) whenever a new, AI-confirmed job posting is found.

When adding new scrapers, prefer sources where hiring happens in the open: `r/forhire`, `r/remotejs`, HN "Who is Hiring" threads, Mastodon/Fediverse tech communities, etc. Avoid LinkedIn and major job boards — the whole point is to find signals where competition is low.

## Architecture

```
index.ts               ← entry point: wires everything up, starts BullMQ worker
src/
  config/              ← all config via env vars (see Config shape below)
  core/
    types.ts           ← Post, IScraper interfaces
    errors.ts          ← AuthenticationError, RateLimitError (typed, not strings)
    interfaces/        ← shared DB/cache interfaces
    factories/         ← DatabaseFactory, CacheFactory singletons
    providers/         ← concrete Postgres + Redis implementations
  scrapers/
    TwitterScraper.ts  ← Playwright-based; uses injected session cookies
    RedditScraper.ts   ← Playwright-based; scrapes old.reddit.com/r/startups/new/
  queue/
    queue.ts           ← BullMQ queue + Redis connection singleton
    scheduler.ts       ← registers the repeatable cron job
    worker.ts          ← job processor: fetch patterns → scrape → dedupe → LLM filter → alert
  services/
    FilterService.ts   ← regex pre-filter + LLM intent evaluation (OpenAI-compatible)
    NotifierService.ts ← sends Discord/Telegram webhook message
    SeederService.ts   ← seeds initial keyword patterns into the DB on first run
  repositories/
    PatternRepository.ts ← reads keyword patterns from Postgres
```

### Runtime Stack

| Component      | Technology                        |
|----------------|-----------------------------------|
| Runtime        | Bun (v1.3.14+)                    |
| Queue          | BullMQ + Redis (via ioredis)      |
| Browser        | Playwright + remote CDP endpoint  |
| Database       | PostgreSQL (via `postgres` driver)|
| LLM            | OpenAI-compatible HTTP API        |
| Notifications  | Discord/Telegram webhook          |
| Container      | Docker + `docker-compose.infra.yml` for local infra (Redis, Postgres, browser) |

## Key Data Flow

```
cron trigger (BullMQ repeatable job)
  → worker picks up job
  → PatternRepository.getSearchPatterns()   // keywords from Postgres
  → [TwitterScraper, RedditScraper, ...].scrape(context, patterns)
                                            // Playwright CDP browser, parallel
  → for each Post:
      Redis dedup check (processed_post:<id>, 7-day TTL)
      FilterService.passesRegex()           // fast keyword pre-filter
      FilterService.evaluateIntent()        // LLM: "is this a real job posting?"
      NotifierService.sendAlert()           // webhook → Discord/Telegram
      Redis.set(cacheKey, 'true', 7 days)
```

## Adding a New Scraper

1. Create `src/scrapers/YourPlatformScraper.ts` implementing `IScraper`:
   ```ts
   export class YourPlatformScraper implements IScraper {
     async scrape(context: BrowserContext, patterns: string[]): Promise<Post[]> { ... }
   }
   ```
2. Set `source` on each returned `Post` to a new literal — also add it to the `Post['source']` union in `src/core/types.ts`.
3. Register the scraper in `worker.ts`:
   ```ts
   const scrapers: IScraper[] = [new TwitterScraper(), new RedditScraper(), new YourPlatformScraper()];
   ```
4. If the platform needs auth (like Twitter cookies), add the relevant config key in `src/config/index.ts` and inject it in `worker.ts` before calling `scrape()`.

### Scraper conventions
- Always open a new `page` from the passed `context`, and `await page.close()` in a `finally` block. Never close the `context` itself — the worker owns it.
- Use `page.$$eval` + a `RawXxxData` interface for DOM extraction; hydrate `Date` objects outside the `$$eval` callback (Playwright serialises return values via JSON).
- Throw `RateLimitError(retryAfterMs, message)` or `AuthenticationError(message)` from `src/core/errors.ts` — the worker handles these with correct BullMQ strategies.
- Add a random jitter delay (1–4 s) to avoid hammering platforms.

## Configuration (Environment Variables)

| Variable                 | Default                                       | Description                                      |
|--------------------------|-----------------------------------------------|--------------------------------------------------|
| `DB_URL`                 | `postgresql://user:password@localhost:5432/pencari` | Postgres connection string              |
| `DB_PROVIDER`            | `POSTGRES`                                    | DB provider (currently only Postgres)            |
| `SEED_PATTERNS`          | `false`                                       | Set `true` to (re-)seed keyword patterns from code |
| `REDIS_URL`              | `redis://localhost:6379`                      | Redis URL (used for queue + cache)               |
| `BROWSER_WS_ENDPOINT`    | `ws://localhost:3000`                         | CDP WebSocket endpoint for Playwright            |
| `SCRAPE_CRON_INTERVAL`   | `0 */6 * * *`                                 | Cron expression for scrape frequency             |
| `TWITTER_COOKIES_JSON`   | `[]`                                          | JSON array of Playwright cookie objects for Twitter auth |
| `HUMAN_JITTER_MIN_MS`    | `1500`                                        | Min delay between scroll actions (ms)            |
| `HUMAN_JITTER_MAX_MS`    | `4000`                                        | Max delay between scroll actions (ms)            |
| `LLM_ENDPOINT`           | `https://api.openai.com/v1/chat/completions`  | OpenAI-compatible chat completions endpoint      |
| `LLM_API_KEY`            | *(required in prod)*                          | LLM API key                                      |
| `LLM_MODEL`              | `gpt-4o-mini`                                 | Model name                                       |
| `WEBHOOK_URL`            | *(optional)*                                  | Discord or Telegram webhook URL for alerts       |

## Error Handling Policy

- **`RateLimitError`**: Worker moves the BullMQ job to a delayed state for `retryAfterMs`. Do not rethrow.
- **`AuthenticationError`**: Worker throws `UnrecoverableError` — BullMQ will not retry. Requires manual intervention (refresh cookies/tokens).
- **Generic errors**: Re-thrown → BullMQ standard exponential backoff.
- LLM failures default to `false` (skip the post) to avoid spam. If LLM is unconfigured, defaults to `true` (pass-through) to avoid missing leads.

## Development

```bash
bun install          # install dependencies
bun run index.ts     # run the worker
bun test             # run tests (uses Testcontainers for real Postgres + Redis)
bun lint             # ESLint
```

Local infra (Postgres, Redis, Playwright browser):
```bash
docker compose -f docker-compose.infra.yml up -d
```

## Platforms: Current & Planned

| Platform       | Status     | Notes                                          |
|----------------|------------|------------------------------------------------|
| Twitter/X      | ✅ Live     | Requires session cookies in `TWITTER_COOKIES_JSON` |
| Reddit         | ✅ Live     | `r/startups/new` — hardcoded subreddit, consider making configurable |
| Hacker News    | 🔲 Planned  | Monthly "Who is Hiring" thread via `news.ycombinator.com` or Algolia HN API |
| Mastodon       | 🔲 Planned  | Public timeline search — no auth needed        |
| Bluesky        | 🔲 Planned  | AT Protocol public API — no Playwright needed  |

## Things to Keep in Mind

- The `RedditScraper` currently hard-codes `r/startups/new`. It should respect `patterns` for subreddit selection or at minimum be made configurable via env/DB.
- The `Post['source']` union in `types.ts` must be extended whenever a new scraper is added.
- Twitter scraping is brittle by design (DOM selectors on `article[data-testid="tweet"]`). If it starts returning 0 posts consistently, check the selectors first.
- All scrapers share one Playwright browser context. Context state (cookies, local storage) bleeds between scrapers — be mindful when adding auth-heavy scrapers.
