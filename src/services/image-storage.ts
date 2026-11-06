import { sql, type Image } from "../database";
import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { isAdmin } from "../utils";

export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;
const IMAGE_FORMATS = {
  jpeg: { mime: "image/jpeg", extension: ".jpg" },
  png: { mime: "image/png", extension: ".png" },
  webp: { mime: "image/webp", extension: ".webp" },
};
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads/images";
const MAX_UPLOADS_PER_USER_PER_HOUR = 20;
const MAX_ALT_TEXT_LENGTH = 500;

sharp.block({ operation: ["VipsForeignLoad"] });
sharp.unblock({
  operation: ["VipsForeignLoadJpegBuffer", "VipsForeignLoadPngBuffer", "VipsForeignLoadWebpBuffer"],
});

export class ImageUploadError extends Error {
  constructor(message: string, readonly status: 400 | 413 | 415 | 429) {
    super(message);
  }
}

// Ensure upload directory exists
const ensureUploadDir = async () => {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
};

const inspectImage = async (buffer: Buffer, mime: string) => {
  const image = sharp(buffer, {
    animated: true,
    failOn: "warning",
    limitInputPixels: MAX_IMAGE_PIXELS,
  });
  try {
    const { format, width, height, pageHeight, pages } = await image.metadata();
    if (
      (format === "jpeg" || format === "png" || format === "webp") &&
      IMAGE_FORMATS[format].mime === mime &&
      width && height &&
      width * (pageHeight ?? height) * (pages ?? 1) <= MAX_IMAGE_PIXELS
    ) {
      // Reading metadata alone does not decode the image pixels.
      await image.stats();
      return { width, height: pageHeight ?? height, extension: IMAGE_FORMATS[format].extension };
    }
  } catch {
    // The decoder also rejects corrupt or truncated input.
  }
  throw new ImageUploadError("Upload a valid JPEG, PNG, or WebP image up to 25 megapixels", 415);
};

// Check if user has exceeded upload rate limit
const checkRateLimit = async (userId: number): Promise<boolean> => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [result] = await sql<{ count: string }[]>`
    SELECT COUNT(*) as count
    FROM images
    WHERE uploaded_by = ${userId}
    AND created_at > ${oneHourAgo}
  `;

  return Number(result.count) < MAX_UPLOADS_PER_USER_PER_HOUR;
};

// Upload image parameters
export type UploadImageParams = {
  originalFilename: string;
  buffer: Buffer;
  mimetype: string;
  uploadedBy: number;
  altText?: string;
  permissionLevel?: number;
};

// Upload an image
export const uploadImage = async (
  params: UploadImageParams,
): Promise<Image> => {
  const {
    originalFilename,
    buffer,
    mimetype,
    uploadedBy,
    altText,
    permissionLevel,
  } = params;

  // Validation checks
  if (!buffer || buffer.length === 0) {
    throw new ImageUploadError("No image data provided", 400);
  }

  if (buffer.length > MAX_IMAGE_FILE_BYTES) {
    throw new ImageUploadError("File size exceeds the 10 MB limit", 413);
  }

  const mime = mimetype === "image/jpg" ? "image/jpeg" : mimetype;
  if (!Object.values(IMAGE_FORMATS).some((format) => format.mime === mime)) {
    throw new ImageUploadError("Only JPEG, PNG, and WebP files are supported", 415);
  }

  // Check rate limit (admins skip)
  if (!isAdmin({ permission_level: permissionLevel })) {
    const withinRateLimit = await checkRateLimit(uploadedBy);
    if (!withinRateLimit) {
      throw new ImageUploadError(
        `Upload rate limit exceeded. Maximum ${MAX_UPLOADS_PER_USER_PER_HOUR} uploads per hour.`,
        429,
      );
    }
  }

  const { width, height, extension } = await inspectImage(buffer, mime);
  const uniqueFilename = `${randomUUID()}${extension}`;
  const safeOriginal = originalFilename.slice(0, 255);
  const safeAlt =
    typeof altText === "string" && altText.length > 0
      ? altText.slice(0, MAX_ALT_TEXT_LENGTH)
      : null;
  const filePath = join(UPLOAD_DIR, uniqueFilename);

  try {
    // Ensure upload directory exists
    await ensureUploadDir();

    // Save file to disk
    await writeFile(filePath, buffer);

    // Save metadata to database
    const [image] = await sql<Image[]>`
      INSERT INTO images ${sql({
        filename: uniqueFilename,
        original_filename: safeOriginal,
        file_path: filePath,
        file_size: buffer.length,
        mime_type: mime,
        width,
        height,
        uploaded_by: uploadedBy,
        storage_type: "local",
        alt_text: safeAlt,
        s3_bucket: null,
        s3_key: null,
      })}
      RETURNING *
    `;

    return image;
  } catch (error) {
    // Clean up file if database insert fails
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }

    throw error;
  }
};

// Get image by ID
export const getImageById = async (id: number): Promise<Image | null> => {
  const [image] = await sql<Image[]>`
    SELECT * FROM images WHERE id = ${id} LIMIT 1
  `;

  return image || null;
};

// Read image file from storage
export const readImageFile = async (image: Image): Promise<Buffer> => {
  if (image.storage_type === "local") {
    try {
      return await readFile(image.file_path);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "ENOENT") {
        throw new Error("Image file not found");
      }
      throw err;
    }
  }

  // TODO: Implement S3 reading when needed
  throw new Error("S3 storage not yet implemented");
};

// Get images by entity
export const getImagesByEntity = async (entityId: number): Promise<Image[]> => {
  return await sql<Image[]>`
    SELECT * FROM images
    WHERE entity_id = ${entityId}
    ORDER BY created_at DESC
  `;
};

// Get images by version
export const getImagesByVersion = async (
  versionId: number,
): Promise<Image[]> => {
  return await sql<Image[]>`
    SELECT * FROM images
    WHERE version_id = ${versionId}
    ORDER BY created_at DESC
  `;
};

// Get images by user
export const getImagesByUser = async (
  userId: number,
  limit = 50,
  offset = 0,
): Promise<Image[]> => {
  return await sql<Image[]>`
    SELECT * FROM images
    WHERE uploaded_by = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
};

// Get public URL for image
export const getImageUrl = (image: Image): string => {
  return `/images/serve/${image.id}`;
};

// Remove the local file after its metadata deletion has committed.
export const removeImageFile = async (image: Image): Promise<void> => {
  if (image.storage_type !== "local" || !image.file_path) return;

  try {
    await unlink(image.file_path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to remove image file:", error);
    }
  }
};

export const deleteImage = async (id: number | string): Promise<boolean> => {
  if (!id) return false;

  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return false;

  const [image] = await sql<Image[]>`
    DELETE FROM images WHERE id = ${numericId} RETURNING *
  `;
  if (!image) return false;

  await removeImageFile(image);
  return true;
};

// Get upload statistics for admin
export const getUploadStats = async () => {
  const [stats] = await sql<
    {
      total_images: number;
      total_size: number;
      uploads_today: number;
    }[]
  >`
    SELECT
      COUNT(*) as total_images,
      SUM(file_size) as total_size,
      COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as uploads_today
    FROM images
  `;

  return stats;
};

export const imageStorage = {
  uploadImage,
  getImageById,
  readImageFile,
  getImagesByEntity,
  getImagesByVersion,
  getImagesByUser,
  getImageUrl,
  deleteImage,
  getUploadStats,
};
