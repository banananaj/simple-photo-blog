// Files from a drag-and-drop, with dropped folders walked recursively.
// Browsers expose a folder only through the non-standard but universal
// `webkitGetAsEntry()`; a plain `dataTransfer.files` lists a folder as one
// empty entry. Files that came out of a folder are kept apart from loose ones
// so the uploader can apply its folder rule (rated files only) to them.

/** A file with the folder it came from ("" for a loose file). */
export type Located = { file: File; dir: string };

export type Dropped = { loose: File[]; fromFolders: Located[] };

function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  // readEntries returns batches (Chrome: 100 at a time) until an empty one.
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const step = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all);
        else {
          all.push(...batch);
          step();
        }
      }, reject);
    step();
  });
}

function fileOf(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walk(entry: FileSystemEntry, out: Located[]): Promise<void> {
  if (entry.isFile) {
    const file = await fileOf(entry as FileSystemFileEntry);
    out.push({ file, dir: entry.fullPath.replace(/^\//, "").replace(/\/[^/]*$/, "") });
  } else if (entry.isDirectory) {
    const entries = await readAll((entry as FileSystemDirectoryEntry).createReader());
    for (const e of entries) await walk(e, out);
  }
}

export async function collectDropped(dt: DataTransfer): Promise<Dropped> {
  const loose: File[] = [];
  const fromFolders: Located[] = [];
  const items = [...dt.items];
  const entries = items.map((it) => (it.kind === "file" && "webkitGetAsEntry" in it ? it.webkitGetAsEntry() : null));
  if (entries.some((e) => e !== null)) {
    for (const [i, entry] of entries.entries()) {
      if (!entry) continue;
      if (entry.isDirectory) await walk(entry, fromFolders);
      else {
        const f = items[i].getAsFile();
        if (f) loose.push(f);
      }
    }
  } else {
    loose.push(...dt.files);
  }
  return { loose, fromFolders };
}

/** Files from a `webkitdirectory` input, with their folder taken from the relative path. */
export function locateInput(list: FileList): Located[] {
  return [...list].map((file) => ({ file, dir: file.webkitRelativePath.replace(/\/[^/]*$/, "") }));
}

/** True while the drag carries files, so the zone can light up only for them. */
export function dragHasFiles(dt: DataTransfer | null): boolean {
  return Boolean(dt && [...dt.types].includes("Files"));
}
