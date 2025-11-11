import { sql, type Image } from "../database";
import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";
import { randomUUID } from "crypto";

// Configuration constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads/images";
const MAX_UPLOADS_PER_USER_PER_HOUR = 20;

// Ensure upload directory exists
const ensureUploadDir = async () => {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
};

// Get image dimensions (simplified - in production you'd use a proper image library)
const getImageDimensions = async (
  buffer: Buffer,
  mimeType: string,
): Promise<{ width: number; height: number }> => {
  // For now, return default dimensions
  // In production, you'd use libraries like 'sharp' or 'image-size'
  return { width: 0, height: 0 };
};

// Check if user has exceeded upload rate limit
const checkRateLimit = async (userId: number): Promise<boolean> => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [result] = await sql<{ count: number }[]>`
    SELECT COUNT(*) as count
    FROM images
    WHERE uploaded_by = ${userId}
    AND created_at > ${oneHourAgo}
  `;

  return result.count < MAX_UPLOADS_PER_USER_PER_HOUR;
};

// Upload image parameters
export type UploadImageParams = {
  originalFilename: string;
  buffer: Buffer;
  mimetype: string;
  uploadedBy: number;
  altText?: string;
};

// Upload an image
export const uploadImage = async (
  params: UploadImageParams,
): Promise<Image> => {
  const { originalFilename, buffer, mimetype, uploadedBy, altText } = params;

  // Validation checks
  if (!buffer || buffer.length === 0) {
    throw new Error("No image data provided");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    throw new Error(
      `File type ${mimetype} not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
    );
  }

  // Check rate limit
  const withinRateLimit = await checkRateLimit(uploadedBy);
  if (!withinRateLimit) {
    throw new Error(
      `Upload rate limit exceeded. Maximum ${MAX_UPLOADS_PER_USER_PER_HOUR} uploads per hour.`,
    );
  }

  // Generate unique filename
  const fileExtension = extname(originalFilename) || ".jpg";
  const uniqueFilename = `${randomUUID()}${fileExtension}`;
  const filePath = join(UPLOAD_DIR, uniqueFilename);

  try {
    // Ensure upload directory exists
    await ensureUploadDir();

    // Get image dimensions
    const { width, height } = await getImageDimensions(buffer, mimetype);

    // Save file to disk
    await writeFile(filePath, buffer);

    // Save metadata to database
    const [image] = await sql<Image[]>`
      INSERT INTO images ${sql({
      filename: uniqueFilename,
      original_filename: originalFilename,
      file_path: filePath,
      file_size: buffer.length,
      mime_type: mimetype,
      width,
      height,
      uploaded_by: uploadedBy,
      storage_type: "local",
      alt_text: altText || null,
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
    return await readFile(image.file_path);
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

// Delete image (marks as deleted, doesn't actually delete file immediately)
export const deleteImage = async (
  id: number,
): Promise<boolean> => {
  if (!id)
    return false

  // Check if user owns the image or is admin/moderator
  const [image] = await sql<Image[]>`
    SELECT * FROM images WHERE id = ${id} LIMIT 1
  `;

  if (!image) {
    return false;
  }

  await sql`
    DELETE FROM images WHERE id = ${id}
  `;

  const path = join(UPLOAD_DIR, image.filename)
  if (image.storage_type === "local" && existsSync(path)) {
    await unlink(path)
    return true
  }

  return false;
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
