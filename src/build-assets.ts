import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { gzipSync } from "node:zlib";
import type { Metafile } from "esbuild";
import {
  assetDirectory,
  clientOutputsPath,
  isAssetSource,
  manifestPath,
  publicDirectory,
  type AssetManifest,
} from "./asset-manifest";

async function buildAssets() {
  await mkdir(assetDirectory, { recursive: true });
  const outputs: Metafile = JSON.parse(await readFile(clientOutputsPath, "utf8"));
  const scripts = Object.entries(outputs.outputs)
    .filter(([file, output]) => file.endsWith(".js") && output.entryPoint)
    .map(([file]) => basename(file));
  const manifest: AssetManifest = {};

  for (const source of ["styles.css", ...scripts]) {
    if (!isAssetSource(source)) throw new Error(`Invalid asset filename: ${source}`);
    const contents = await readFile(join(publicDirectory, source));
    const hash = createHash("sha256").update(contents).digest("hex").slice(0, 16);
    const extension = extname(source);
    const file = `${basename(source, extension)}.${hash}${extension}`;
    await writeFile(join(assetDirectory, file), contents);
    await writeFile(join(assetDirectory, file + ".gz"), gzipSync(contents));
    manifest[source] = file;
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

buildAssets().catch((error: unknown) => {
  console.error("Failed to build assets:", error);
  process.exitCode = 1;
});
