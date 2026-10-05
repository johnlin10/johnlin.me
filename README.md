# johnlin.me

Personal website with a blog, short notes, a photography portfolio, a self-built CMS, and private tools (class schedule, tutoring scheduler, knowledge base, short links, QR codes).

- Site: <https://johnlin.me>
- Subdomains: `studio.johnlin.me` (CMS), `tools.johnlin.me` (private tools), `go.johnlin.me` (short links)
- Languages: Traditional Chinese (default, no URL prefix) / English (`/en/...`)
- Hosting: Vercel

---

## Contents

- [Tech stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Development](#development)
- [Project structure](#project-structure)
- [Further docs](#further-docs)
- [License](#license)

---

## Tech stack

| Area           | Uses                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router), React 19, TypeScript 5                                       |
| Styling        | Sass/SCSS Modules (three-layer token system), Tailwind CSS 4 (light use)              |
| Database, auth | Supabase: Postgres + Auth (Google OAuth) + Storage, `@supabase/ssr` cookie session    |
| Object storage | Cloudflare R2 (photo originals and derivatives, public domain `img.johnlin.me`)       |
| Editor         | Tiptap 3                                                                              |
| AI             | Vercel AI SDK + AI Gateway (CMS field assist)                                         |
| i18n           | next-intl 4 (`localePrefix: 'as-needed'`)                                             |
| Images         | sharp (server-side derivatives), exifr (EXIF parsing in the browser)                  |
| Other          | Motion (animation), KaTeX (math), next-themes (theme switching)                       |

---

## Features

### Public site

| Route                            | What it is                                                                                                                                  | Key implementation                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                              | Home. Hero, intro, featured work, latest posts, photography entry                                                                          | Cached page; the hero's code window reads its own component source at runtime with `fs.readFile`                                        |
| `/blog`                          | Post list                                                                                                                                   | `getPublishedPosts()`, 30 posts per page                                                                                                 |
| `/blog/[slug]`                   | Post page. Each language is written separately; a missing English version falls back to Chinese with a notice                              | Tiptap HTML injected directly; table of contents computed on save and highlighted with `IntersectionObserver`; KaTeX rendered on the client; view count via a Postgres RPC |
| `/notes` `/notes/[id]`           | Short-note feed. Plain text plus a few images, with no title, drafts, or categories                                                         | Data flow fully separate from posts; native `<img>` grid and a custom lightbox                                                           |
| `/photography`                   | Photography. Defaults to a draggable, zoomable photo wall, with a justified list as an alternative (preference kept in localStorage); SSR, no-JS, and crawlers get a simple list | Viewport virtualization + far-view LOD; `<img srcSet>` straight from R2's 8-step WebP ladder, bypassing Vercel image optimization |
| `/photography/[slug]`            | Single photo page. Capture time, camera and lens, location, HDR                                                                            | ISR + `generateStaticParams`; the LCP image loads with `fetchPriority="high"`, the original loads when focused                          |
| `/about`                         | Chaptered about page; switching chapters keeps the URL                                                                                     | `content/about/<slug>.<locale>.md` + react-markdown                                                                                      |
| `/lab/design`                    | Living design-system page that renders CSS variables as swatches, spacing, and type sizes, click to copy                                   | Reads computed values with `getComputedStyle`                                                                                            |
| `/tutoring/[token]`              | Read-only public tutoring board for classmates in the program. Week timeline, schedule overlay, this week's sessions, and the month's hours; pages one month back or forward only | No login; data from the SECURITY DEFINER function `get_tutoring_board`, 404 on a wrong token or closed link; `noindex`, no Referer, no site Header/Footer |
| `/kb/[token]/[code]`             | Knowledge-base share page. Shows the shared note or folder, plus notes reachable by following links through "knowledge folders"; hovering a link previews that note | Each note has a 6-character code, so URLs carry no Chinese; data from the SECURITY DEFINER functions `get_kb_share` and `get_kb_shared_note`, which return only paths inside the shared scope; OG images generated on demand by `/api/kb/og`; `noindex`, no Referer, no site Header/Footer |
| `/rss/blog.xml` `/rss/notes.xml` | Two separate RSS feeds                                                                                                                      | `force-dynamic`; Chinese only for now                                                                                                    |

Every public page is cached: data comes from the cookieless `createPublicClient()` and regenerates every 300 seconds, and any CMS write calls `/api/admin/{posts,notes,photos}/revalidate` to clear it at once. Pages cannot read cookies, headers, or query strings, so reader preferences (blog cards or list, the about chapter) are applied by an inline script before paint. After changing a public page, run `next build` and check that the route table has not turned it into ƒ (computed per request).

### CMS (`studio.johnlin.me`, admin only)

The CMS lives on its own subdomain and installs as a separate PWA (John Lin Studio). The code is in `app/[locale]/studio/`, reached through a Host-based proxy rewrite; `/studio` on the main site always returns 404. Language rules match the main site (Chinese without prefix, English at `/en`).

| Route                           | What it is                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                             | Dashboard: totals and views, top posts, camera / focal length / year breakdowns, recent activity, and items to fill in (missing English, stale drafts, photos without a caption or location) |
| `/posts`                        | Post CRUD. Tiptap editor; drafts autosave (1.2s debounce, 8s cap), published posts switch to manual updates; an untouched empty draft is deleted when you leave                   |
| `/photos`                       | Thumbnail wall grouped by year plus an inspector, with keyboard navigation and batch actions; fields autosave                                                                      |
| `/photos/upload`                | Upload preflight. EXIF is parsed and a slug generated in the browser before anything uploads; originals go straight to R2 by presigned PUT (avoiding the function's 4.5 MB body limit), then an ingest endpoint builds every size, the OG image, and the blur placeholder with sharp |
| `/notes`                        | Publish and delete notes                                                                                                                                                            |
| `/categories` `/tags` `/series` | Category, tag, and series management (series has no public page yet)                                                                                                                |
| `/login`                        | Google OAuth, the only sign-in method                                                                                                                                               |

The CMS uses its own component library (`Button`, `Input`, `Modal`, `ConfirmDialog`, `Toast`, `DataTable`, and others) with no external UI package; the tools subdomain shares the same components and shell. The top of the sidebar links back to the home page and to the other subdomain.

The login cookie (`sb-johnlin-auth`) is set on all of `.johnlin.me`, so one sign-in covers studio and tools, and signing out ends both. It is configured in `app/lib/supabase/authCookie.ts`. Locally, `*.localhost` cannot share a cookie domain, so each needs its own sign-in.

For local development, open `http://studio.localhost:3000` in Chrome (Safari does not always resolve `*.localhost`).

### Tools (`tools.johnlin.me`, admin only)

A private toolbox where editing and viewing happen on the same page, outside the CMS. It reuses the CMS shell, sidebar, and Google sign-in, and installs as a separate PWA (John Lin Tools). The code is in `app/[locale]/tools/`, with the same routing and guard as the CMS; `/tools` on the main site always returns 404.

| Route           | What it is                                                                                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | Overview: a timeline of today's (or the next class day's) classes and tutoring, semester progress with midterm and final countdowns, and a one-line live summary on each tool card                                              |
| `/schedule`     | Weekly class schedule, switchable by member and semester. Each person has a schedule, while courses and teachers are shared. Click an empty cell to add a slot, click a course to edit; overlapping periods on the same day are blocked; a whole schedule can be copied from someone else. Semesters have start and end dates and midterm and final weeks; courses have 15 preset colors and optional credits. National holidays import from Google's Taiwan holiday calendar, make-up days are entered by hand, and no classes appear on days off |
| `/tutoring`     | Tutoring scheduler. Month and week switching, a Monday–Friday timeline, click empty space to add a session (any start time, 1–8 hours in 0.5 steps); saving checks for weekends, conflicts with the participants' and teachers' classes, and duplicates. Overlay one person's schedule to find gaps; below are each person's hours for the month (the three programs under the 40-hour cap summed, certificate tutoring counted separately). The management area holds members, non-class busy times, and the public link |
| `/links`        | Short-link management. Without a slug, a 6-character one is generated (avoiding l, o, 0, 1) and copied after creation; lists total clicks and clicks in the last 7 days. Each row's menu opens the QR code editor directly      |
| `/links/[slug]` | Stats for one short link: total, 30-day, and 7-day clicks, a 90-day daily bar chart, and top referrer domains and countries                                                                                                     |
| `/qr`           | QR code generator with 8 formats: URL, text, Wi-Fi, contact, email, SMS, phone, location. Adjustable error correction, rounded dots and finder patterns, colors (transparent background allowed); downloads PNG or SVG. It saves the form fields, so a saved code can be reopened and edited |
| `/kb`           | Knowledge base. Pick a top-level Obsidian folder (only `學校/` for now) and upload it whole; only new and changed notes are sent. Mark knowledge folders and open a share link on any note or folder, which can be renamed or revoked. Uploading needs a computer, since iPhone Safari cannot pick folders |
| `/login`        | The same Google sign-in as the CMS                                                                                                                                                                                               |

The weekly grid is a standalone component, `app/components/schedule/ScheduleGrid`, ready for the main site to reuse when it shows a schedule. The tutoring timeline is `WeekTimeline`, and the whole timeline, overlay, and hours table set is `TutoringBoard`, shared by the edit page and the public page. Class periods map to the school's bell times through `app/lib/schedule/periods.ts` (periods 1–10, plus A at lunch and B between periods 8 and 9). Days off and make-up days are decided by `classDay()`, which the overview, the week board, and the scheduling checks all use. The program names have no official English, so the English UI keeps them in Chinese.

For local development, open `http://tools.localhost:3000`.

### Short links (`go.johnlin.me`)

`go.johnlin.me/<slug>` is handled directly in the proxy and never reaches the App Router. It calls `resolve_short_link` to look up the target and record a click, then 307-redirects on a hit (not 301, so a changed target takes effect immediately) or shows a plain 404 page on a miss; the root path redirects to the main site. Slugs are case-insensitive.

Link-preview crawlers and HEAD requests are redirected but not counted. A click records only the referrer domain and country (`x-vercel-ip-country`), never the full referrer, IP, or user agent. Each slug records at most 200 clicks per hour; beyond that it still redirects but stops recording.

For local development, open `http://go.localhost:3000/<slug>`.

### AI assist

`POST /api/admin/ai` supports only four tasks: slug suggestion, summary, cover image alt text (multimodal), and SEO keywords. Input is validated with a Zod discriminated union, and the model is called through AI Gateway. An empty field is filled directly; a field with content shows a suggestion card to confirm, so existing content is never overwritten.

---

## Architecture

### Request flow

```txt
Request
 └─ proxy.ts (Next 16's middleware)
     ├─ go.* subdomain: rpc('resolve_short_link') → 307 redirect or 404, never reaches the App Router
     ├─ main site: next-intl locale handling; /studio/* and /tools/* return 404; /tutoring/[token] and /kb/[token] render as normal pages
     └─ studio.* / tools.* subdomains: next-intl locale handling → rewrite to /[locale]/studio/* or /[locale]/tools/*
         └─ everything except /login → Supabase getUser() + rpc('is_admin'), redirect to /login on failure
 └─ app/[locale]/layout.tsx (fonts, i18n provider, theme, Header/Footer)
 └─ page.tsx
```

`/api/**` skips the proxy (explicitly excluded by its matcher), so every admin API calls `requireAdmin()` itself.

Every response carries `frame-ancestors 'none'`, `X-Frame-Options: DENY`, and `nosniff` (`next.config.ts`), so no other site can embed it in an iframe.

### Data access

- Three Supabase clients split the work: `client.ts` (browser), `server.ts` (with cookies, bound by RLS), `public.ts` (anonymous, usable inside `unstable_cache`). The first two and the proxy must pass `authCookieOptions(host)` for sign-in to carry across subdomains.
- **No service-role key.** Every write uses the anon key plus the caller's session, and Postgres RLS decides permissions.
- The schedule, short-link, tutoring, QR code, and knowledge-base tables are readable and writable by the admin only; visitors reach them only through SECURITY DEFINER functions. `resolve_short_link` resolves a known slug and cannot list links or clicks; `get_tutoring_board` returns data only when the token matches an open public link, and leaves out session notes; `get_kb_share` and `get_kb_shared_note` return only notes inside the shared scope, with paths counted from the share root so the vault's full paths stay hidden. Hourly pay and identity categories are not stored.
- Media split: post and note images live in Supabase Storage; photography lives in Cloudflare R2 under immutable UUID-prefixed object keys.

---

## Development

### Requirements

- Node.js 20+
- A Supabase project and a Cloudflare R2 bucket (local development connects to the remote services too)

### Getting started

```bash
npm install
npm run dev      # predev runs font subsetting first
```

### Commands

| Command                             | What it does                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                       | Dev server                                                                                                                                                                      |
| `npm run build`                     | Production build                                                                                                                                                                |
| `npm run start`                     | Serve the production build                                                                                                                                                      |
| `npm run lint` / `npm run lint:fix` | ESLint                                                                                                                                                                          |
| `npm run generate:fonts`            | Build the Chinese font subsets into `fonts/`; runs automatically before dev and build                                                                                           |
| `node scripts/generate-og.mjs`      | Regenerate the default OG image                                                                                                                                                 |
| `node --test <path>.test.mjs`       | Unit tests (schedule periods, short-link slugs, tutoring hours and semester logic, holiday parsing, overview, QR codes, knowledge base); takes a file path, not a folder, and needs Node 22.18+ to load `.ts` directly |

### Environment variables

Create `.env` at the project root:

| Variable                                    | Purpose                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                      | RSS and canonical URLs                                                        |
| `NEXT_PUBLIC_SUPABASE_URL`                  | Supabase project URL                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`             | Supabase anon key                                                             |
| `AI_GATEWAY_API_KEY`                        | AI Gateway key, read by the AI SDK by convention                              |
| `R2_BUCKET`                                 | R2 bucket name                                                                |
| `R2_S3_ENDPOINT`                            | R2's S3-compatible endpoint                                                   |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 credentials                                                                |
| `NEXT_PUBLIC_R2_PUBLIC_BASE`                | R2 public domain                                                              |
| `R2_KEY_PREFIX`                             | Optional. Namespaces object keys; a local setting also affects photos actually uploaded |

### Database

`supabase/migrations/` currently covers the photography, daily post views, schedule, holiday, short-link, tutoring, QR code, and knowledge-base tables; `supabase/tests/` holds rerunnable SQL checks that roll back when done. Older tables such as posts, and their RPC functions, are not yet under version control; see [`supabase/README.md`](supabase/README.md). Migrations are applied by running the SQL by hand; the Supabase CLI workflow is not set up.

---

## Project structure

```txt
.
├── app/
│   ├── [locale]/            public pages
│   │   ├── studio/          studio.johnlin.me
│   │   ├── tools/           tools.johnlin.me
│   │   └── tutoring/, kb/   token share pages
│   ├── api/
│   │   ├── admin/           ai, holidays, link-preview, photo ingest, {posts,notes,photos}/revalidate
│   │   ├── kb/og/           share-page OG images
│   │   └── views/           post view counter
│   ├── components/          grouped by area: home, blog, gallery, notes, schedule
│   │   └── admin/           UI kit shared by studio and tools
│   ├── lib/                 domain logic, one file or folder per area; tests sit beside it as *.test.mjs
│   │   ├── supabase/        every query, one file per table group; client factories; requireAdmin
│   │   ├── r2/              R2 client, object keys, presigned uploads
│   │   └── images/          sharp derivatives (server only)
│   ├── styles/              _tokens, _theme, _mixins, _breakpoints
│   └── rss/                 blog.xml, notes.xml
├── docs/                    plans and design-system docs
├── content/about/           about chapters as <slug>.<locale>.md
├── i18n/                    next-intl config
├── messages/                zh-tw.json, en.json
├── supabase/                migrations/ and rerunnable tests/
├── scripts/                 font subsetting (runs before dev and build), OG image
└── proxy.ts                 locale handling, subdomain routing and guard, go redirects
```

---

## Further docs

| Doc                                              | Covers                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [`docs/blueprint.md`](docs/blueprint.md)         | Route map, data layer, auth flow, known gaps and to-dos. Worth reading before changing code |
| [`docs/design-system.md`](docs/design-system.md) | Design principles and token rules; the live version is `/lab/design`                    |
| [`docs/tools-plan.md`](docs/tools-plan.md)       | Plans and decisions for the tools subdomain, schedule, holidays, short links, and QR codes |
| [`docs/tutoring-plan.md`](docs/tutoring-plan.md) | Tutoring scheduler and public board: plan, table design, and privacy considerations     |
| [`docs/kb-plan.md`](docs/kb-plan.md)             | Knowledge base upload, share scope, URL codes, and permission design                    |
| [`supabase/README.md`](supabase/README.md)       | Migration conventions and how to apply them                                             |

These docs drift as the code changes; update them after each larger change.

---

## License

The code is MIT licensed; see [LICENSE](LICENSE). The site's writing, photos, and design are not covered by the license.
