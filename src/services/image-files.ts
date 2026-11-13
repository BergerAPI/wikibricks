import { access, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { Image } from "../database";

export const imageWidths = { small: 480, large: 960 } as const;
type ImageWidth = (typeof imageWidths)[keyof typeof imageWidths];

const MAX_PIXELS = 25_000_000;
const MAX_EDGE = 2048;
const formats = new Map([["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]);

sharp.block({ operation: ["VipsForeignLoad"] });
sharp.unblock({
  operation: ["VipsForeignLoadJpegBuffer", "VipsForeignLoadPngBuffer", "VipsForeignLoadWebpBuffer"],
});

export const normalizeMimeType = (mime: string) => (mime === "image/jpg" ? "image/jpeg" : mime);
export const getImageUrl = (id: number, width?: ImageWidth) =>
  `/images/${id}/file${width === undefined ? "" : `?width=${width}`}`;

const webp = (buffer: Buffer, quality = 82) =>
  sharp(buffer, { failOn: "warning", limitInputPixels: MAX_PIXELS }).webp({ quality, effort: 3 });

export const optimizeImage = async (buffer: Buffer, mime: string) => {
  const image = webp(buffer, 78);
  try {
    const { format, pages = 1 } = await image.metadata();
    if (pages !== 1 || !format || formats.get(format) !== mime) return;

    return await image.autoOrient()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    // Corrupt and unsupported files fail either metadata inspection or decoding.
  }
};

const variantPath = (path: string, width: ImageWidth) => `${path}.${width}.webp`;
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (!missing(error)) throw error;
    return false;
  }
};

export const needsImageSizes = async (image: Image) => {
  for (const width of Object.values(imageWidths)) {
    if (width < image.width && !await exists(variantPath(image.file_path, width))) return true;
  }
  return false;
};

export const writeImageSizes = async (image: Image) => {
  if (image.storage_type !== "local" || !image.width ||
    ![...formats.values()].includes(normalizeMimeType(image.mime_type))) return;

  let source: Buffer | undefined;
  for (const width of Object.values(imageWidths)) {
    if (width >= image.width) continue;
    const path = variantPath(image.file_path, width);
    if (await exists(path)) continue;

    source ??= await readFile(image.file_path);
    const data = await webp(source).autoOrient().resize({ width, withoutEnlargement: true }).toBuffer();
    const temporary = `${path}.tmp`;
    try {
      await writeFile(temporary, data);
      await rename(temporary, path);
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }
  }
};

export const openImageFile = async (image: Image, width?: ImageWidth) => {
  if (image.storage_type !== "local") return;
  const useVariant = width !== undefined && (image.width ?? Infinity) > width;
  if (useVariant) {
    try {
      return { file: await open(variantPath(image.file_path, width)), mime: "image/webp", fallback: false };
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  try {
    return { file: await open(image.file_path), mime: normalizeMimeType(image.mime_type), fallback: useVariant };
  } catch (error) {
    if (!missing(error)) throw error;
  }
};

// Call only after deletion of the image row has committed.
export const removeImageFile = async (image: Image) => {
  if (image.storage_type !== "local") return;
  const variants = Object.values(imageWidths).map((width) => variantPath(image.file_path, width));
  for (const path of [image.file_path, ...variants, ...variants.map((path) => `${path}.tmp`)]) {
    await unlink(path).catch((error) => {
      if (!missing(error)) console.error("Failed to remove image file:", error);
    });
  }
};
