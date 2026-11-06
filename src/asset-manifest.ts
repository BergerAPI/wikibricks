import { readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

export const publicDirectory = join(__dirname, "../dist/public");
export const assetDirectory = join(__dirname, "../dist/assets");
export const manifestPath = join(assetDirectory, "manifest.json");
export const clientOutputsPath = join(__dirname, "../dist/client-outputs.json");

export type AssetManifest = Record<string, string>;

export const isAssetSource = (file: string) =>
  /^[\w-]+(?:\.[\w-]+)*\.(?:css|js)$/.test(file);
export const isFingerprintedAsset = (file: string) =>
  /^[\w-]+(?:\.[\w-]+)*\.[a-f0-9]{16}\.(?:css|js)$/.test(file);

export function readAssetManifest(): AssetManifest {
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !Object.prototype.hasOwnProperty.call(manifest, "styles.css")
  ) {
    throw new Error("Invalid asset manifest");
  }
  for (const [source, file] of Object.entries(manifest)) {
    const extension = extname(source);
    if (
      !isAssetSource(source) ||
      typeof file !== "string" ||
      !isFingerprintedAsset(file) ||
      !file.startsWith(basename(source, extension) + ".") ||
      !file.endsWith(extension)
    ) {
      throw new Error(`Invalid asset manifest entry for ${source}`);
    }
  }
  return manifest as AssetManifest;
}
