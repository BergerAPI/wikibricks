import "dotenv/config";
import { copyFile, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { assetDirectory, readAssetManifest } from "./asset-manifest";

async function publishAssets(store: string) {
  const manifest = readAssetManifest();
  const files = Object.values(manifest).flatMap(file => [file, file + ".gz"]);

  await mkdir(store, { recursive: true });
  const staging = await mkdtemp(join(store, ".publish-"));
  try {
    for (const file of files) {
      await copyFile(join(assetDirectory, file), join(staging, file));
    }
    for (const file of files) {
      await rename(join(staging, file), join(store, file));
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

const store = process.env.ASSET_STORE_DIR;
if (store) {
  publishAssets(store).catch((error: unknown) => {
    console.error("Failed to publish assets:", error);
    process.exitCode = 1;
  });
}
