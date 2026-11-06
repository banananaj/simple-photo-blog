#!/usr/bin/env node
/**
 * photos.mjs — add photographs to the blog.
 *
 *   node scripts/photos.mjs add <file...> --place "Jeju" [--season winter] [--alt "..."] [--credit "..."] [--local]
 *   node scripts/photos.mjs list
 *   node scripts/photos.mjs remove <id>
 *
 * For each file: reads EXIF (date), writes a preview (WebP, 1600px on the long edge) and a
 * full-size copy (JPEG, 3000px on the long edge, downloadable), uploads both to S3 (or, with
 * --local, into public/photos/) and appends the record to src/content/photos.json.
 *
 * Env (S3 mode): PHOTOS_BUCKET, PHOTOS_BASE_URL (public base, e.g. https://cdn.gidong.pics),
 * AWS_REGION and AWS credentials from the usual chain.
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
  const opts = { local: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--local") opts.local = true;
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
    else files.push(a);
  }
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
  if (opts.local) {
    const dest = path.join(ROOT, "public/photos", key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, body);
    return `/photos/${key}`;
  }
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.PHOTOS_BUCKET;
  const base = process.env.PHOTOS_BASE_URL;
  if (!bucket || !base) throw new Error("PHOTOS_BUCKET and PHOTOS_BASE_URL must be set (or pass --local)");
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
    const exif = await exifr.parse(buf, ["DateTimeOriginal"]).catch(() => null);
    const taken = exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : null;
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
    });
    console.log(`added ${id}  ${opts.place}  ${preview.width}x${preview.height} / ${full.width}x${full.height}`);
  }
  await saveData(data);
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
  else if (cmd === "list") await list();
  else if (cmd === "remove") await remove(files[0]);
  else {
    console.error("usage: photos.mjs add <file...> --place <caption> [--season <s>] [--alt <t>] [--credit <html>] [--local] | list | remove <id>");
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
