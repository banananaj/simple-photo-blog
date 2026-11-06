# gidong.pics

A personal photo blog. One page of photographs in a new order on every visit, a place under each, a filter folded away for whoever looks for it. Product record: [PRODUCT.md](./PRODUCT.md).

## Stack

- Next.js (App Router, TypeScript), no CSS framework: `src/app/tokens.css` and `base.css` come from the Hallmark design skill (Atelier theme, lifted to near-white and set in Sentient).
- Photographs live outside the repository: Vercel Blob now (public store `gidong-photos`), S3 supported for later. `src/content/photos.json` holds only metadata.
- Visitor pages are prerendered. Only `/admin` runs server code (a basic-auth gate in `src/proxy.ts`).

## Run

```bash
npm install
cp .env.example .env.local   # fill in what you need
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
```

## Admin

`/admin` (basic auth, `ADMIN_USER` / `ADMIN_PASSWORD`): upload a folder (converted in the browser to a WebP preview and a 3000px JPEG, tagged in a confirm screen, then uploaded straight to Blob), manage photographs (tags, place, season, alt; hide/show; delete), and a dashboard (counts, tags, full-size opens when a Redis store is connected). `/grid-view` is an unlisted seamless wall of every visible photograph.

## Add photographs from the command line

```bash
# Vercel Blob (token from `vercel env pull .env.local`)
node --env-file=.env.local scripts/photos.mjs add ~/export/*.jpg --place "Hallasan, Jeju" --blob

# S3 (PHOTOS_BUCKET, PHOTOS_BASE_URL and AWS credentials in the environment)
node scripts/photos.mjs add ~/export/*.jpg --place "Hallasan, Jeju" --s3

# local only, for development (writes to public/photos/, which is git-ignored)
node scripts/photos.mjs add ~/export/*.jpg --place "Hallasan, Jeju" --local
node --env-file=.env.local scripts/photos.mjs migrate --blob   # push local files to the store

node scripts/photos.mjs list
node scripts/photos.mjs remove <id>
```

Each file becomes a preview (WebP, 1600px long edge) for the stream and a full-size JPEG (3000px long edge; downloads use `?download=1` on Blob or `Content-Disposition` on S3). The season is read from the EXIF date unless `--season` is given; `--alt` sets the image description (defaults to the place). Commit the updated `photos.json` and push; Vercel redeploys.

## Design checks

```bash
node .claude/skills/hallmark/scripts/sloplint.mjs src/app src/components --genre editorial --scope app
# with a browser (CHROME_PATH=/path/to/chrome) and the dev server running:
node .claude/skills/hallmark/scripts/sloplint.mjs src/app src/components --genre editorial --scope app --render --url http://localhost:3000/
npx impeccable detect src/
```

## Deploy

Vercel project `simple-photo-blog` is connected to this repository; every push to `main` deploys production. Domains: gidong.pics (www redirects to it). Blob store `gidong-photos` is linked to the project (`BLOB_READ_WRITE_TOKEN`). Set `ADMIN_USER` / `ADMIN_PASSWORD` on Vercel to open `/admin`.
