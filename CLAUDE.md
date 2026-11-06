# CLAUDE.md — gidong.pics

Personal photo blog for the owner (handle `gidong`, domain gidong.pics). Read `PRODUCT.md` first: it is the product record and carries the owner's binding words (white page, serif throughout, sidebar + random stream, hidden season/place filter, one-line place caption, lightbox with download, mobile first, as minimal as possible). Reply to the owner in Korean; code, UI copy and captions are English.

## Where things stand (handoff from the first session, 2026-11-06)

Done and verified:
- Next.js 16.4 (App Router, TS, no Tailwind) scaffold, `npm run build` passes, all visitor routes prerendered, `/admin` behind basic auth in `src/proxy.ts` (404 until `ADMIN_USER`/`ADMIN_PASSWORD` are set).
- Pages: `/` (random stream + lightbox), `/about` (empty on purpose, owner writes it), `/admin` (route only, features still to be specified by the owner).
- Hallmark build (app scope, theme Atelier, stamp in the first four lines of `src/app/globals.css`), `sloplint --render` clean (0 FAIL / 0 REFLEX / 0 WARN) at 320–1920. Log entry in `.hallmark/log.json`.
- `scripts/photos.mjs` resizes (WebP preview 1600px, JPEG full 3000px), uploads to Vercel Blob (`--blob`, default when `BLOB_READ_WRITE_TOKEN` is set; run with `node --env-file=.env.local`), S3 (`--s3`) or `--local`; `migrate --blob` pushes local files up. 13 openly licensed stand-in photographs are on Blob and credited; the owner's own photographs replace them.
- Impeccable installed (skill, 4 agents, design hook in `.claude/settings.local.json`); Hallmark skill in `.claude/skills/hallmark`.

Not done / open:
- Hallmark finish review (fresh-context subagent per `references/gates.md` § 6) was started and did not complete. Run it again before calling the visitor page shipped, then record `finish-review: …` in the stamp.
- No commit has been made yet; everything is staged. The owner decides when to commit/push. Never commit secrets (public repository).
- Owner still to provide: About text, admin feature list, real photographs; S3 only if/when Blob gets too costly.
- Deployment: Vercel project `simple-photo-blog` (team banananajs-projects) linked in `.vercel/`, GitHub repo banananaj/simple-photo-blog connected (push to main = production), domains gidong.pics + www (308 to apex) attached, DNS at hosting.kr already points to Vercel. Blob store `gidong-photos` (public) linked; sample photos live there. Vercel token file: `~/.vercel-token`; CLI at `~/.npm-global/bin/vercel`, always pass `--token $(cat ~/.vercel-token) --scope banananajs-projects`.

## Conventions

- Every colour and font goes through a token in `src/app/tokens.css` (Hallmark Floor). Spacing uses `--space-*`. No literal colours in component CSS.
- Photographs are plain `<img>` with width/height (no `next/image`): resizing happens at upload time to stay inside the Vercel Hobby image quota. `@next/next/no-img-element` is off on purpose.
- Random order: the browser draws one seed per page load (`useSyncExternalStore`, `src/components/stream.tsx`); the server renders stored order; `.js .stream:not([data-ready])` hides nothing from no-script readers.
- Filter state lives in the URL (`?season=&place=`), read client-side so the page stays static.
- Keep the visitor UI minimal: no icons, badges, buttons with fills, social widgets, footers. Functions (filter, download) exist but stay visually quiet and keyboard/screen-reader reachable.
- Do not invent captions, About text, admin features, metrics or testimonials.

## Commands

```bash
npm run dev -- -p 3100          # port 3000 is used by another app on this machine
npm run build
npm run lint && npx tsc --noEmit
node scripts/photos.mjs add <files> --place "<caption>" [--season s] [--local]
node .claude/skills/hallmark/scripts/sloplint.mjs src/app src/components --genre editorial --scope app
CHROME_PATH=$CHROME node .claude/skills/hallmark/scripts/sloplint.mjs src/app src/components --genre editorial --scope app --render --url http://localhost:3100/
node .hallmark/shot.mjs $CHROME /path/to/out   # desktop/mobile/lightbox screenshots
```

`$CHROME` = a Chrome for Testing binary. One was downloaded with `npx @puppeteer/browsers install chrome@stable --path <dir>` (system libs installed via dnf); if the scratch copy is gone, download it again. `puppeteer-core` is a devDependency.

## Files

- `src/app/layout.tsx` — shell: Sentient from Fontshare, `.js` flag script, `<Sidebar>` + `<main>`.
- `src/app/globals.css` — Hallmark stamp, imports `tokens.css` + `base.css`, all page styles (sidebar, stream, filter, lightbox, responsive at 80rem/60rem/40rem).
- `src/components/sidebar.tsx`, `filter.tsx` (client, `<details>`), `stream.tsx` (client, shuffle + masonry columns), `lightbox.tsx` (client, keys ←/→/Esc, swipe, download link).
- `src/lib/photos.ts` — types, filter, shuffle. `src/content/photos.json` — metadata only.
- `scripts/photos.mjs` — add/list/remove photographs.
- `.hallmark/` — Hallmark log, shots, helper scripts (git-ignored).
- `docs/reference/` — the owner's design reference screenshot (git-ignored, third-party).
