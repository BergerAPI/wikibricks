import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { sql, type Image, type User } from "../database";
import { isAdmin } from "../utils";

export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;
const MAX_UPLOADS_PER_HOUR = 20;
const MAX_ALT_TEXT_LENGTH = 500;
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads/images";

const IMAGE_FORMATS = {
  jpeg: { mime: "image/jpeg", extension: ".jpg" },
  png: { mime: "image/png", extension: ".png" },
  webp: { mime: "image/webp", extension: ".webp" },
};

// Only let sharp decode the formats we accept
sharp.block({ operation: ["VipsForeignLoad"] });
sharp.unblock({
  operation: ["VipsForeignLoadJpegBuffer", "VipsForeignLoadPngBuffer", "VipsForeignLoadWebpBuffer"],
});

export class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 | 429,
  ) {
    super(message);
  }
}

export const normalizeMimeType = (mime: string) => (mime === "image/jpg" ? "image/jpeg" : mime);

// Decodes the whole image, which rejects corrupt or truncated files
const inspectImage = async (buffer: Buffer, mime: string) => {
  const image = sharp(buffer, { animated: true, failOn: "warning", limitInputPixels: MAX_IMAGE_PIXELS });

  try {
    const { format, width, height, pageHeight = height, pages = 1 } = await image.metadata();

    if (
      (format === "jpeg" || format === "png" || format === "webp") &&
      IMAGE_FORMATS[format].mime === mime &&
      width * pageHeight * pages <= MAX_IMAGE_PIXELS
    ) {
      await image.stats();
      return { width, height: pageHeight, extension: IMAGE_FORMATS[format].extension };
    }
  } catch {}

  throw new ImageUploadError("Upload a valid JPEG, PNG, or WebP image up to 25 megapixels", 415);
};

const countRecentUploads = async (userId: number) => {
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count FROM images
    WHERE uploaded_by = ${userId} AND created_at > NOW() - INTERVAL '1 hour'
  `;
  return Number(count);
};

export const uploadImage = async ({
  buffer,
  originalFilename,
  mimeType,
  altText,
  uploader,
}: {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  altText?: string;
  uploader: User;
}) => {
  const mime = normalizeMimeType(mimeType);
  if (!Object.values(IMAGE_FORMATS).some((format) => format.mime === mime))
    throw new ImageUploadError("Only JPEG, PNG, and WebP files are supported", 415);

  if (!isAdmin(uploader) && (await countRecentUploads(uploader.id)) >= MAX_UPLOADS_PER_HOUR)
    throw new ImageUploadError(
      `Upload rate limit exceeded. Maximum ${MAX_UPLOADS_PER_HOUR} uploads per hour.`,
      429,
    );

  const { width, height, extension } = await inspectImage(buffer, mime);
  const filename = `${randomUUID()}${extension}`;
  const filePath = join(UPLOAD_DIR, filename);

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(filePath, buffer);

  try {
    const [image] = await sql<Image[]>`
      INSERT INTO images ${sql({
        filename,
        original_filename: originalFilename.slice(0, 255),
        file_path: filePath,
        file_size: buffer.length,
        mime_type: mime,
        width,
        height,
        uploaded_by: uploader.id,
        storage_type: "local",
        alt_text: altText?.slice(0, MAX_ALT_TEXT_LENGTH) || null,
      })}
      RETURNING *
    `;
    return image;
  } catch (error) {
    await unlink(filePath).catch(() => {});
    throw error;
  }
};

export const getImageById = async (id: number) => {
  const [image] = await sql<Image[]>`SELECT * FROM images WHERE id = ${id}`;
  return image;
};

export const getImageUrl = (image: Image) => `/images/serve/${image.id}`;

export const readImageFile = (image: Image) => {
  if (image.storage_type !== "local") throw new Error("S3 storage is not implemented yet");
  return readFile(image.file_path);
};

// Call this only after the deletion of the image row has been committed
export const removeImageFile = async (image: Image) => {
  if (image.storage_type !== "local") return;

  try {
    await unlink(image.file_path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      console.error("Failed to remove image file:", error);
  }
};

export const deleteImage = async (id: number) => {
  const [image] = await sql<Image[]>`DELETE FROM images WHERE id = ${id} RETURNING *`;
  if (image) await removeImageFile(image);
};
