# johnlin.me

Personal site: blog, short notes, a photography portfolio, a self-built CMS, and private tools. One Next.js 16 project on Vercel serves four hosts. The UI is bilingual, with Traditional Chinese as the default.

The README has the full route tables, commands, and environment variables. Read the matching doc before touching these areas:

- Design tokens, colors, spacing, type scale → [docs/design-system.md](docs/design-system.md)
- Route map, data layer, auth flow, timezone decisions → [docs/blueprint.md](docs/blueprint.md)
- Tools subdomain, schedule, holidays, short links, QR codes → [docs/tools-plan.md](docs/tools-plan.md)
- Tutoring hours and its public board → [docs/tutoring-plan.md](docs/tutoring-plan.md)
- Knowledge base and its share links → [docs/kb-plan.md](docs/kb-plan.md)
- Tables and migrations → [supabase/README.md](supabase/README.md)

## Architecture

### Hosts

| Host | What it is | Code |
| --- | --- | --- |
| `johnlin.me` | Public site: home, blog, notes, photography, about, RSS, `/tutoring/[token]` and `/kb/[token]` share pages | `app/[locale]/*` |
| `studio.johnlin.me` | Admin CMS (posts, photos, notes, taxonomies, dashboard), installable PWA | `app/[locale]/studio/` |
| `tools.johnlin.me` | Private tools: schedule, tutoring, knowledge base, short links, QR codes | `app/[locale]/tools/` |
| `go.johnlin.me` | Short-link redirects, handled entirely in the proxy | `proxy.ts` |

### Request flow

```txt
Request
 └─ proxy.ts (Next 16's renamed middleware)
     ├─ go.*      → rpc('resolve_short_link') → 307 or 404; never reaches the App Router
     ├─ main site → next-intl locale handling; /studio/* and /tools/* return 404
     └─ studio.* / tools.* → next-intl → rewrite to /[locale]/studio/* or /[locale]/tools/*
                             └─ every path except /login: getUser() + rpc('is_admin'), else redirect to /login
 └─ app/[locale]/layout.tsx (fonts, i18n provider, theme, Header/Footer)
 └─ page.tsx
```

- `/api/**` skips the proxy (excluded by its matcher), so every admin route calls `requireAdmin()` (`app/lib/supabase/requireAdmin.ts`) itself.
- The rewrite target folder must share the subdomain's name: `studio.*` → `app/[locale]/studio/`.
- Pages see the rewritten path. Detect the current section with `useSelectedLayoutSegment(s)`; `usePathname` breaks hydration here.
- Host checks live in `app/lib/siteConfigs.ts`.

### Directory layout

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

### Data access

- Three Supabase clients in `app/lib/supabase/`: `client.ts` (browser), `server.ts` (cookie session, bound by RLS), `public.ts` (anonymous, safe inside `unstable_cache`).
- There is no service-role key. Every write runs as the caller with the anon key, and Postgres RLS decides.
- The login cookie `sb-johnlin-auth` is scoped to `.johnlin.me`, so one sign-in covers studio and tools. Pass `authCookieOptions(host)` (`app/lib/supabase/authCookie.ts`) to every new client.
- Tables for the private tools are admin-only. Visitors reach them only through SECURITY DEFINER functions (`resolve_short_link`, `get_tutoring_board`, `get_kb_share`, `get_kb_shared_note`) that return just the shared slice.

### Media

- Post and note images live in Supabase Storage.
- Photos live in Cloudflare R2 (`img.johnlin.me`). Uploads go browser → R2 by presigned PUT, then an ingest endpoint builds the derivative ladder, OG image, and blur placeholder with sharp.
- The photo wall reads the derivatives straight from R2 through `srcSet`, bypassing `next/image`.

### i18n

next-intl with `localePrefix: 'as-needed'`: Chinese URLs carry no prefix, English uses `/en`. Content is written separately per language and falls back to Chinese when the English version is missing.

### Naming

`admin` (`components/admin`, `/api/admin`, `is_admin`, `AdminShell`) means the management layer shared by studio and tools. It keeps that name even though the subdomain is `studio`.

## Production data

Local dev talks to the production Supabase and R2; there is no staging. Verify with reads only. Studio forms autosave, so typing into a field writes to the live database. Ask before any write.

## Public-page caching

Every public page is served from the Vercel cache, and a broken cache fails silently. When adding or changing a public page:

- Fetch with `createPublicClient()` and set `revalidate = 300`. Keep `cookies()`, `headers()`, and `searchParams` out of the page. Call `setRequestLocale` before using translations.
- Apply reader preferences with an inline script before paint, following `PostList.tsx` and `ChapterShell.tsx`.
- After an admin write, call `/api/admin/{posts,notes,photos}/revalidate`. Use `revalidateTag(tag, { expire: 0 })`.
- Run `npm run build` and check the route table: the page must stay ○ or ●, never ƒ.

## Supabase

- `is_admin()` keeps its anon execute grant: public-read RLS policies call it. The advisor warning about it is a false positive.
- New tables get RLS for `is_admin()` only; visitor reads go through a SECURITY DEFINER function with the existing revoke/grant pattern.
- Migrations are applied by hand as SQL; the Supabase CLI is not wired up.

## Known pitfalls

- MapLibre stays on v5: v6's worker fails to load once Next bundles it.
- The photo wall gets no `will-change: transform`. Headless traces show a big win, but on real GPUs the wall blurs when zoomed. Confirm any compositing change on a real device.
- Nothing inside the photo wall's scaled layer gets `backdrop-filter` or a `transform` / `opacity` animation. Safari (macOS, iPhone, iPad) then composites the whole wall and blurs text and photos when zoomed; animate `left` / `top` instead.
- `photoDerivatives.ts` imports sharp; keep it out of client code.

## Writing code

- Next.js here is version 16. APIs, conventions, and file layout may differ from what you remember (middleware is now `proxy.ts`). Read the matching guide in `node_modules/next/dist/docs/` before using a Next API, and heed deprecation notices.
- Add every UI string to both `messages/zh-tw.json` and `messages/en.json`.
- Comment only a non-obvious constraint, in one line. Document functions with full JSDoc (`@param`, `@returns`).
- Style with SCSS Modules and the existing tokens. Horizontally scrolling rows use the `edge-fade-mask` mixin.
- Tests: `node --test <file>.test.mjs`. Pass a file path, not a folder.
- Talk to the owner in Traditional Chinese. Code comments follow the surrounding code (mostly Chinese); commit messages are English.

## Hand-off

When a piece of work is finished and verified:

1. Write a commit message covering all uncommitted changes to `COMMIT_MESSAGE.md` at the root, in English bullets. First line `vX.Y.Z type: title`, then a one-sentence summary on the next line, then bullets grouped under headings (`Bug Fix:`, `UI Adjustments:` …), one unwrapped line per bullet.
2. Bump `version` in `package.json` to match. A real new feature bumps the minor; fixes, performance work, additions to a just-shipped feature, and tiny new things bump the patch. Check `git log --oneline` first and leave already-committed work out.
3. Leave `git add` and `git commit` to the owner.
