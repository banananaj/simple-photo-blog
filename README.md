# gidong.pics

A personal photo blog. One page of photographs in a new order on every visit, a place under each, a filter folded away for whoever looks for it. Product record: [PRODUCT.md](./PRODUCT.md).

## Stack

- Next.js (App Router, TypeScript), no CSS framework: `src/app/tokens.css` and `base.css` come from the Hallmark design skill (Atelier theme, lifted to near-white and set in Sentient).
- Photographs live outside the repository (S3 behind a public read URL). `src/content/photos.json` holds only metadata.
- Visitor pages are prerendered. Only `/admin` runs server code (a basic-auth gate in `src/proxy.ts`).

## Run

```bash
npm install
cp .env.example .env.local   # fill in what you need
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
```

## Add photographs

```bash
# S3 (PHOTOS_BUCKET, PHOTOS_BASE_URL and AWS credentials in the environment)
node scripts/photos.mjs add ~/export/*.jpg --place "Hallasan, Jeju"

# local only, for development (writes to public/photos/, which is git-ignored)
node scripts/photos.mjs add ~/export/*.jpg --place "Hallasan, Jeju" --local

node scripts/photos.mjs list
node scripts/photos.mjs remove <id>
```

Each file becomes a preview (WebP, 1600px long edge) for the stream and a full-size JPEG (3000px long edge, served with `Content-Disposition: attachment` for download). The season is read from the EXIF date unless `--season` is given; `--alt` sets the image description (defaults to the place). Commit the updated `photos.json` and push; Vercel redeploys.

## Design checks

```bash
node .claude/skills/hallmark/scripts/sloplint.mjs src/app src/components --genre editorial --scope app
# with a browser (CHROME_PATH=/path/to/chrome) and the dev server running:
node .claude/skills/hallmark/scripts/sloplint.mjs src/app src/components --genre editorial --scope app --render --url http://localhost:3000/
npx impeccable detect src/
```

## Deploy

Vercel project connected to this repository; production from `main`. Environment variables on Vercel: `ADMIN_USER`, `ADMIN_PASSWORD`. Domain: gidong.pics.
