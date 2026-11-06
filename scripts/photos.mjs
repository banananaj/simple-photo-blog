#!/usr/bin/env node
/**
 * photos.mjs — add photographs to the blog.
 *
 *   node scripts/photos.mjs add <file...> --place "Jeju" [--season winter] [--alt "..."] [--credit "..."] [--blob|--s3|--local]
 *   node scripts/photos.mjs migrate --blob|--s3      # push files registered with --local to the store
 *   node scripts/photos.mjs list
 *   node scripts/photos.mjs remove <id>
 *
 * For each file: reads EXIF (date), writes a preview (WebP, 1600px on the long edge) and a
 * full-size copy (JPEG, 3000px on the long edge, downloadable), uploads both and appends the
 * record to src/content/photos.json.
 *
 * Storage (pick one; default --blob when BLOB_READ_WRITE_TOKEN is set, else --s3):
 *   --blob   Vercel Blob (public store). Env: BLOB_READ_WRITE_TOKEN (vercel env pull .env.local;
 *            run with `node --env-file=.env.local scripts/photos.mjs …`).
 *   --s3     Amazon S3. Env: PHOTOS_BUCKET, PHOTOS_BASE_URL (public read base), AWS_REGION + credentials.
 *   --local  public/photos/ (development only, git-ignored).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import exifr from "exifr";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const DATA = path.join(ROOT, "src/content/photos.json");
const PREVIEW_EDGE = 1600;
const FULL_EDGE = 3000;

function parseArgs(argv) {
  const files = [];
  const opts = { target: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--local" || a === "--blob" || a === "--s3") opts.target = a.slice(2);
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
    else files.push(a);
  }
  if (!opts.target) opts.target = process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "s3";
  return { files, opts };
}

async function loadData() {
  try {
    return JSON.parse(await readFile(DATA, "utf8"));
  } catch {
    return { photos: [] };
  }
}

async function saveData(data) {
  await writeFile(DATA, JSON.stringify(data, null, 2) + "\n");
}

function seasonOf(date) {
  if (!date) return "";
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

async function resize(buf, edge, format) {
  const img = sharp(buf, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const landscape = w >= h;
  const pipeline = img.resize({
    ...(landscape ? { width: Math.min(edge, w) } : { height: Math.min(edge, h) }),
    withoutEnlargement: true,
  });
  const out =
    format === "webp"
      ? await pipeline.webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
      : await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height };
}

async function store(key, body, contentType, opts, extra = {}) {
  if (opts.target === "local") {
    const dest = path.join(ROOT, "public/photos", key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, body);
    return `/photos/${key}`;
  }
  if (opts.target === "blob") {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN must be set (vercel env pull .env.local, then node --env-file=.env.local …)");
    const { put } = await import("@vercel/blob");
    // Public blob URLs accept ?download=1 to force an attachment, so no Content-Disposition is needed here.
    const res = await put(key, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31536000,
    });
    return res.url;
  }
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.PHOTOS_BUCKET;
  const base = process.env.PHOTOS_BASE_URL;
  if (!bucket || !base) throw new Error("PHOTOS_BUCKET and PHOTOS_BASE_URL must be set (or pass --blob / --local)");
  const s3 = new S3Client({});
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      ...extra,
    }),
  );
  return `${base.replace(/\/$/, "")}/${key}`;
}

async function add(files, opts) {
  if (!files.length) throw new Error("no files given");
  if (!opts.place) throw new Error("--place is required (the caption)");
  const data = await loadData();
  for (const file of files) {
    const buf = await readFile(file);
    const exif = await exifr.parse(buf, { tiff: true, exif: true, xmp: true, mergeOutput: true }).catch(() => null);
    const taken = exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : null;
    const xmpRating = Number(exif?.Rating ?? exif?.xmp?.Rating);
    const rating = opts.rating ? Number(opts.rating) : xmpRating >= 1 && xmpRating <= 5 ? Math.round(xmpRating) : 1;
    const hash = createHash("sha1").update(buf).digest("hex").slice(0, 8);
    const stamp = (taken ?? new Date()).toISOString().slice(0, 10).replaceAll("-", "");
    const id = `${stamp}-${hash}`;
    if (data.photos.some((p) => p.id === id)) {
      console.log(`skip ${file}: already added as ${id}`);
      continue;
    }
    const preview = await resize(buf, PREVIEW_EDGE, "webp");
    const full = await resize(buf, FULL_EDGE, "jpeg");
    const previewSrc = await store(`${id}/preview.webp`, preview.data, "image/webp", opts);
    const fullSrc = await store(`${id}/full.jpg`, full.data, "image/jpeg", opts, {
      ContentDisposition: `attachment; filename="gidong-${id}.jpg"`,
    });
    data.photos.push({
      id,
      preview: { src: previewSrc, width: preview.width, height: preview.height },
      full: { src: fullSrc, width: full.width, height: full.height },
      place: opts.place,
      season: opts.season || seasonOf(taken),
      taken: taken ? taken.toISOString().slice(0, 10) : "",
      alt: opts.alt || opts.place,
      credit: opts.credit || "",
      tags: opts.tags ? opts.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      rating,
      hidden: false,
    });
    console.log(`added ${id}  ${opts.place}  ${preview.width}x${preview.height} / ${full.width}x${full.height}`);
  }
  await saveData(data);
}

async function migrate(opts) {
  if (opts.target === "local") throw new Error("migrate needs --blob or --s3");
  const data = await loadData();
  let n = 0;
  for (const p of data.photos) {
    for (const kind of ["preview", "full"]) {
      const src = p[kind].src;
      if (!src.startsWith("/photos/")) continue;
      const file = path.join(ROOT, "public", src);
      const key = src.slice("/photos/".length);
      const type = kind === "preview" ? "image/webp" : "image/jpeg";
      const extra = kind === "full" ? { ContentDisposition: `attachment; filename="gidong-${p.id}.jpg"` } : {};
      p[kind].src = await store(key, await readFile(file), type, opts, extra);
      n++;
    }
    console.log(`${p.id}  ${p.preview.src}`);
  }
  await saveData(data);
  console.log(`${n} files moved to ${opts.target}`);
}

async function list() {
  const data = await loadData();
  for (const p of data.photos) console.log(`${p.id}  ${p.season.padEnd(6)}  ${p.place}`);
  console.log(`${data.photos.length} photographs`);
}

async function remove(id) {
  const data = await loadData();
  const before = data.photos.length;
  data.photos = data.photos.filter((p) => p.id !== id);
  await saveData(data);
  console.log(before === data.photos.length ? `no photo ${id}` : `removed ${id} (files on storage are kept)`);
}

const [cmd, ...rest] = process.argv.slice(2);
const { files, opts } = parseArgs(rest);
try {
  if (cmd === "add") await add(files, opts);
  else if (cmd === "migrate") await migrate(opts);
  else if (cmd === "list") await list();
  else if (cmd === "remove") await remove(files[0]);
  else {
    console.error("usage: photos.mjs add <file...> --place <caption> [--season <s>] [--rating 1-5] [--alt <t>] [--credit <html>] [--blob|--s3|--local] | migrate --blob|--s3 | list | remove <id>");
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
