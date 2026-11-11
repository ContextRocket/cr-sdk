import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { minimatch } from "minimatch";
import tar from "tar-stream";

interface SiteArchiveFile {
  path: string;
  sourcePath: string;
  size: number;
}
export interface PreparedSiteArchive {
  filePaths: readonly string[];
  tarball: Buffer;
  fileCount: number;
  byteCount: number;
}

const SKIPPED_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "__pycache__",
]);

function validateArchivePath(relativePath: string): void {
  if (
    !relativePath ||
    relativePath.startsWith("/") ||
    relativePath.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(relativePath) ||
    relativePath.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe path in site archive: ${relativePath || "<empty>"}`);
  }
}

function isExcluded(relativePath: string, patterns: readonly string[]): boolean {
  const basename = path.posix.basename(relativePath);
  return (
    basename === ".DS_Store" ||
    patterns.some(
      (pattern) =>
        minimatch(relativePath, pattern, { dot: true }) ||
        minimatch(basename, pattern, { dot: true }),
    )
  );
}

async function collectFiles(
  sourcePath: string,
  patterns: readonly string[],
): Promise<SiteArchiveFile[]> {
  const absolutePath = path.resolve(sourcePath);
  const sourceStat = await lstat(absolutePath);
  if (sourceStat.isSymbolicLink()) {
    throw new Error("The publish path cannot be a symbolic link.");
  }
  const sourceRealPath = await realpath(absolutePath);
  if (sourceStat.isFile()) {
    const name = path.basename(sourceRealPath);
    validateArchivePath(name);
    if (isExcluded(name, patterns)) return [];
    return [{ path: name, sourcePath: sourceRealPath, size: sourceStat.size }];
  }
  if (!sourceStat.isDirectory()) {
    throw new Error("The publish path must be a regular file or directory.");
  }

  const files: SiteArchiveFile[] = [];
  const walk = async (directory: string, relativeDirectory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (entry.isDirectory() && SKIPPED_DIRS.has(entry.name)) continue;
      const absoluteEntry = path.join(directory, entry.name);
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      validateArchivePath(relativePath);
      const stat = await lstat(absoluteEntry);
      if (stat.isSymbolicLink()) {
        throw new Error(`Site files cannot be symbolic links: ${relativePath}`);
      }
      if (stat.isDirectory()) {
        await walk(absoluteEntry, relativePath);
      } else if (stat.isFile() && !isExcluded(relativePath, patterns)) {
        files.push({ path: relativePath, sourcePath: absoluteEntry, size: stat.size });
      } else if (!stat.isFile()) {
        throw new Error(`Unsupported file type in site archive: ${relativePath}`);
      }
    }
  };

  await walk(sourceRealPath, "");
  files.sort((left, right) => left.path.localeCompare(right.path, "en"));
  return files;
}

async function createTarball(files: readonly SiteArchiveFile[]): Promise<Buffer> {
  const archive = tar.pack();
  // Node's gzip header uses an epoch timestamp by default for reproducible output.
  const gzip = createGzip({ level: 9 });
  const chunks: Buffer[] = [];
  const collect = (async () => {
    for await (const chunk of gzip) chunks.push(Buffer.from(chunk));
  })();
  void collect.catch(() => undefined);
  archive.pipe(gzip);

  try {
    for (const file of files) {
      let complete!: (error?: Error | null) => void;
      const entryComplete = new Promise<void>((resolve, reject) => {
        complete = (error) => (error ? reject(error) : resolve());
      });
      const entry = archive.entry(
        {
          name: file.path,
          size: file.size,
          mode: 0o644,
          mtime: new Date(0),
          uid: 0,
          gid: 0,
          uname: "",
          gname: "",
        },
        complete,
      );
      await Promise.all([
        pipeline(createReadStream(file.sourcePath), entry),
        entryComplete,
      ]);
    }
    archive.finalize();
    await collect;
  } catch (error) {
    archive.destroy(error instanceof Error ? error : new Error(String(error)));
    gzip.destroy(error instanceof Error ? error : new Error(String(error)));
    await collect.catch(() => undefined);
    throw error;
  }
  return Buffer.concat(chunks);
}

export async function prepareSiteArchive(
  sourcePath: string,
  options: { exclude?: readonly string[] } = {},
): Promise<PreparedSiteArchive> {
  const files = await collectFiles(sourcePath, options.exclude ?? []);
  if (files.length === 0) {
    throw new Error("No site files remain after applying the publish exclusions.");
  }
  const tarball = await createTarball(files);
  return {
    filePaths: files.map((file) => file.path),
    tarball,
    fileCount: files.length,
    byteCount: files.reduce((total, file) => total + file.size, 0),
  };
}
