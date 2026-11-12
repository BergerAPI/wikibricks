import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type postgres from "postgres";
import { cms } from "../collections";
import { sql, type Image, type User } from "../database";
import { isAdmin, isModerator } from "../utils";
import { normalizeMimeType, optimizeImage, removeImageFile, writeImageSizes } from "./image-files";

export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOADS_PER_HOUR = 20;
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads/images";

export class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 | 429,
  ) {
    super(message);
  }
}

const imageReferenced = (db: postgres.ISql, condition = db`TRUE`) => {
  const sources = cms.types.map((type) => db`
    SELECT 1 FROM ${db(`${type}_versions_view`)} v WHERE v.image_id = i.id AND ${condition}
  `);
  return db`EXISTS (${sources.reduce((all, source) => db`${all} UNION ALL ${source}`)})`;
};

const assertUploadQuota = async (db: postgres.ISql, uploader: User) => {
  if (isAdmin(uploader)) return;
  const [{ count }] = await db<{ count: string }[]>`
    SELECT COUNT(*) AS count FROM images
    WHERE uploaded_by = ${uploader.id} AND created_at > NOW() - INTERVAL '1 hour'
  `;
  if (Number(count) >= MAX_UPLOADS_PER_HOUR)
    throw new ImageUploadError(`You can upload up to ${MAX_UPLOADS_PER_HOUR} images per hour.`, 429);
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
  await assertUploadQuota(sql, uploader);
  const result = await optimizeImage(buffer, normalizeMimeType(mimeType));
  if (!result)
    throw new ImageUploadError("Upload a still JPEG, PNG, or WebP image up to 25 megapixels.", 415);

  const { data, info } = result;
  const filename = `${randomUUID()}.webp`;
  const filePath = join(UPLOAD_DIR, filename);
  await mkdir(UPLOAD_DIR, { recursive: true });

  try {
    await writeFile(filePath, data);
    return await sql.begin(async (tx) => {
      if (!isAdmin(uploader)) {
        // The second check closes the race when multiple processes handle uploads.
        await tx`SELECT pg_advisory_xact_lock(74240, ${uploader.id})`;
        await assertUploadQuota(tx, uploader);
      }
      const [image] = await tx<{ id: number }[]>`
        INSERT INTO images ${tx({
          filename,
          original_filename: originalFilename.slice(0, 255),
          file_path: filePath,
          file_size: info.size,
          mime_type: "image/webp",
          width: info.width,
          height: info.height,
          uploaded_by: uploader.id,
          storage_type: "local",
          alt_text: altText?.slice(0, 500) || null,
        })}
        RETURNING id
      `;
      return image;
    });
  } catch (error) {
    await unlink(filePath).catch(() => {});
    throw error;
  }
};

export const ownsImage = async (id: number, userId: number) => {
  const [image] = await sql`SELECT 1 FROM images WHERE id = ${id} AND uploaded_by = ${userId}`;
  return !!image;
};

const publicImage = (db: postgres.ISql) => imageReferenced(db, db`v.review_status = 'approved'`);

export const getVisibleImage = async (id: number, user?: User | null) => {
  const isAuthor = user ? imageReferenced(sql, sql`v.created_by = ${user.id}`) : sql`FALSE`;
  const [image] = await sql<(Image & { published: boolean; can_preview: boolean })[]>`
    SELECT i.*, ${publicImage(sql)} AS published,
      ${isModerator(user)} OR i.uploaded_by = ${user?.id ?? null} OR ${isAuthor} AS can_preview
    FROM images i WHERE i.id = ${id}
  `;
  if (image?.published || image?.can_preview) return image;
};

export const preparePublishedImage = (id: number) => sql.begin(async (tx) => {
  // Serializes approval jobs for a shared image and keeps deletion from racing file writes.
  const [image] = await tx<Image[]>`
    SELECT i.* FROM images i WHERE i.id = ${id} AND ${publicImage(tx)} FOR NO KEY UPDATE
  `;
  if (image) await writeImageSizes(image);
});

export const deleteImage = async (id: number) => {
  const [image] = await sql<Image[]>`DELETE FROM images WHERE id = ${id} RETURNING *`;
  if (image) await removeImageFile(image);
};

export const deleteUnusedImage = async (id: number, uploaderId: number) => {
  const image = await sql.begin(async (tx) => {
    await tx`SELECT id FROM images WHERE id = ${id} FOR UPDATE`;
    const [removed] = await tx<Image[]>`
      DELETE FROM images i WHERE i.id = ${id} AND i.uploaded_by = ${uploaderId}
      AND NOT ${imageReferenced(tx)} RETURNING i.*
    `;
    return removed;
  });
  if (image) await removeImageFile(image);
  return !!image;
};

export const pruneAbandonedImages = async () => {
  const images = await sql.begin(async (tx) => {
    const candidates = await tx<{ id: number }[]>`
      SELECT i.id FROM images i
      WHERE i.created_at < NOW() - INTERVAL '24 hours' AND NOT ${imageReferenced(tx)}
      ORDER BY i.id LIMIT 100 FOR UPDATE SKIP LOCKED
    `;
    if (candidates.length === 0) return [];
    // Recheck with a fresh snapshot after the row locks are held.
    return tx<Image[]>`
      DELETE FROM images i WHERE i.id IN ${tx(candidates.map(({ id }) => id))}
      AND NOT ${imageReferenced(tx)} RETURNING i.*
    `;
  });
  for (const image of images) await removeImageFile(image);
  return images.length;
};
