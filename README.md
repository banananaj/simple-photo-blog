# photo-blog

A minimal personal photo blog you can host on Vercel for free. One page of photographs in a new order on every visit, a place under each, a filter folded away for whoever looks for it, and an admin page to upload and tag from the browser. [gidong.pics](https://gidong.pics) runs on it.

- White page, serif type, a left sidebar with the site name and two links (Photo, About).
- Random order weighted by star rating; filters by season, tag and place as static pages (`/season/winter`, `/tag/snow`, `/place/Jeju`).
- Click a photograph for the full size; Back closes it. Download allowed.
- Admin (`/admin`): drop folders or files, converted in the browser (WebP preview + 3000px JPEG), tag them, upload straight to Vercel Blob. Hide, show, delete, retag later.
- No database. The catalogue is one JSON file on Blob; view counts (optional) go to a Redis store.

## Host it on Vercel

You need a GitHub account, a Vercel account (the free Hobby plan is enough for a personal site) and, if you want your own address, a domain.

1. **Get the code.** Fork this repository on GitHub (or use it as a template: *Use this template → Create a new repository*).

2. **Create the Vercel project.** On [vercel.com/new](https://vercel.com/new) import your repository. Framework is detected as Next.js; leave build settings as they are. Deploy once; the site comes up empty at `https://<project>.vercel.app`.

3. **Add a Blob store for the photographs.** In the project: *Storage → Create → Blob*. Name it, choose *Public* access, connect it to the project for all environments. Vercel adds `BLOB_READ_WRITE_TOKEN` to the project by itself.

4. **Set the environment variables.** *Settings → Environment Variables*, for Production, Preview and Development:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_NAME` | the name shown in the sidebar and titles, e.g. `jane` |
   | `NEXT_PUBLIC_SITE_URL` | your public address once you have one, e.g. `https://jane.pics` (leave empty until then) |
   | `ADMIN_USER` | a login for `/admin` |
   | `ADMIN_PASSWORD` | its password (long and random) |

   `NEXT_PUBLIC_SITE_DESCRIPTION` is optional. See [`.env.example`](./.env.example) for the full list.

5. **Redeploy** (*Deployments → ⋯ → Redeploy*) so the build picks the variables up. `NEXT_PUBLIC_*` values are baked in at build time.

6. **Upload photographs.** Open `https://<project>.vercel.app/admin/upload`, sign in with the admin login, drag a folder onto the page. Only files that carry a star rating (XnView MP, Lightroom, Bridge and Windows write it into the file) are taken from a folder, at or above the threshold you pick; files chosen one by one are taken as they are. Give each a place, tags and a season, press *Upload*. The site updates at once, no redeploy needed.

7. **Your own domain (optional).** *Settings → Domains → Add*, enter the domain, then at your registrar add the records Vercel shows: an `A` record for the apex (`76.76.21.21`) and a `CNAME` for `www` (`cname.vercel-dns.com`). Vercel issues the certificate once DNS propagates. Then set `NEXT_PUBLIC_SITE_URL` to `https://your-domain` and redeploy.

8. **View counts (optional).** *Storage → Create → Upstash Redis* (or any Redis with a REST API), connect it to the project. The dashboard at `/admin` starts counting full-size opens after the next deploy. Without it everything else works; the dashboard just says counting is off.

From then on every push to `main` deploys production; other branches get preview URLs.

### Costs and limits (Hobby plan)

Photographs are resized in the browser before upload, so the Vercel image optimizer (and its monthly quota) is never used. Blob has a free allowance for storage and transfer; a few hundred photographs with 1600px previews and 3000px full sizes stay well inside it. Hobby is for non-commercial use.

## Run locally

```bash
npm install
cp .env.example .env.local      # or: npx vercel link && npx vercel env pull .env.local
npm run dev                     # http://localhost:3000
npm run build && npm start      # production build
```

With `BLOB_READ_WRITE_TOKEN` in `.env.local` the local site reads and writes the same catalogue as production. Without it the site is empty (the seed file `src/content/photos.json` is empty in the template).

## Customise

- **Name, address, description:** the environment variables above (`src/lib/site.ts` reads them).
- **About page:** write `src/app/(site)/about/page.tsx`; it is deliberately empty.
- **Colours, type, spacing:** tokens at the top of `src/app/globals.css` (the page overrides) and `src/app/tokens.css` (the Atelier theme from the Hallmark design skill). The sidebar, stream, lightbox and filter styles follow in `globals.css`. Serif faces: Sentient (Fontshare) for Latin, Noto Serif KR (Google Fonts) for Hangul, linked in `src/app/layout.tsx`.
- **Filter dimensions:** season, tag and place, in `src/lib/photos.ts` and `src/components/filter.tsx`.
- **Admin look:** `src/app/admin/admin.css`; it is a tool and need not match the site.

## Command-line upload (optional)

The admin page is the usual way. The script does the same from a shell, which suits big batches or a cron job.

```bash
# Vercel Blob (token in .env.local)
node --env-file=.env.local scripts/photos.mjs add ~/export/*.jpg --place "Hallasan, Jeju" --blob

# S3 (PHOTOS_BUCKET, PHOTOS_BASE_URL and AWS credentials in the environment)
node scripts/photos.mjs add ~/export/*.jpg --place "Hallasan, Jeju" --s3

# local only, for development (writes to public/photos/, which is git-ignored)
node scripts/photos.mjs add ~/export/*.jpg --place "Hallasan, Jeju" --local
node --env-file=.env.local scripts/photos.mjs migrate --blob   # push local files to the store

node scripts/photos.mjs list
node scripts/photos.mjs remove <id>
```

Each file becomes a preview (WebP, 1600px long edge) and a full-size JPEG (3000px long edge; downloads use `?download=1` on Blob or `Content-Disposition` on S3). The season is read from the EXIF date unless `--season` is given; the rating from `xmp:Rating` (or the Windows rating) unless `--rating` is given; `--alt` sets the image description (defaults to the place).

## How it is built

- Next.js (App Router, TypeScript), no CSS framework. Visitor pages are prerendered; the catalogue is read with `use cache` and invalidated on every admin write.
- Photographs are plain `<img>` with width and height, never `next/image`.
- `/admin` and `/admin/api/*` sit behind HTTP basic auth in `src/proxy.ts`. With no `ADMIN_USER`/`ADMIN_PASSWORD` set the route answers 404.
- Design checks (optional): `node .claude/skills/hallmark/scripts/sloplint.mjs src/app src/components --genre editorial --scope app` and `npx impeccable detect src/`.

## License

No license file yet: add one (MIT is the usual choice for a template) before inviting others to use the code. The Hallmark and Impeccable skills under `.claude/` carry their own licenses.
