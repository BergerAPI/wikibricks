import { bodyLimit } from "hono/body-limit";
import { sql } from "../../database";
import { Layout } from "../../layout";
import {
  deleteImage,
  getImageById,
  getImageUrl,
  ImageUploadError,
  MAX_IMAGE_FILE_BYTES,
  normalizeMimeType,
  readImageFile,
  uploadImage,
} from "../../services/image-storage";
import type { UploadImageResponse } from "../../shared/contracts";
import { useTranslation } from "../../translation";
import { isModerator, parseId, routeParam, type DefaultContext } from "../../utils";

// Leaves some room for the rest of the multipart form
export const limitImageUpload = bodyLimit({
  maxSize: MAX_IMAGE_FILE_BYTES + 64 * 1024,
  onError: (c) => c.text("Upload body exceeds the size limit", 413),
});

const SERVABLE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export const handleImageUpload = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user) return c.text("Unauthorized", 401);

  let body;
  try {
    body = await c.req.parseBody();
  } catch (error) {
    // Lets the body limiter see stream size errors after the handler
    if (error instanceof Error) c.error = error;
    return c.text("Invalid upload form", 400);
  }

  const file = body.file ?? body.image;
  if (!(file instanceof File) || file.size === 0) return c.text("No image file provided", 400);
  if (file.size > MAX_IMAGE_FILE_BYTES) return c.text("File size exceeds the 10 MB limit", 413);

  try {
    const image = await uploadImage({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalFilename: file.name || "upload",
      mimeType: file.type,
      altText: typeof body.alt_text === "string" ? body.alt_text : undefined,
      uploader: user,
    });
    return c.json(image satisfies UploadImageResponse);
  } catch (error) {
    if (error instanceof ImageUploadError) return c.text(error.message, error.status);
    console.error("Image upload error:", error);
    return c.text("Upload failed", 500);
  }
};

export const handleImageServe = async (c: DefaultContext) => {
  const id = parseId(routeParam(c, "id"));
  const image = id && (await getImageById(id));
  if (!image) return c.text("Image not found", 404);

  let buffer: Buffer;
  try {
    buffer = await readImageFile(image);
  } catch {
    return c.text("Image file not found", 404);
  }

  const mime = normalizeMimeType(image.mime_type);

  return c.body(new Uint8Array(buffer), 200, {
    "Content-Type": SERVABLE_TYPES.has(mime) ? mime : "application/octet-stream",
    "Cache-Control": "public, max-age=31536000",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${image.filename.replace(/"/g, "")}"`,
  });
};

export const handleImageInfo = async (c: DefaultContext) => {
  const id = parseId(routeParam(c, "id"));
  const image = id && (await getImageById(id));
  if (!image) return c.json({ error: "Image not found" }, 404);

  return c.json({
    id: image.id,
    filename: image.filename,
    original_filename: image.original_filename,
    file_size: image.file_size,
    mime_type: image.mime_type,
    width: image.width,
    height: image.height,
    alt_text: image.alt_text,
    created_at: image.created_at,
    url: getImageUrl(image),
  });
};

const Detail = ({ label, children }: { label: string; children: unknown }) => (
  <div>
    <dt class="font-medium">{label}:</dt>
    <dd class="text-gray-600">{children}</dd>
  </div>
);

export const handleImagePage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, formatDateTime } = useTranslation(c);

  const id = parseId(routeParam(c, "id"));
  const image = id && (await getImageById(id));
  if (!image) return c.notFound();

  const [uploader] = await sql<{ username: string }[]>`
    SELECT username FROM users WHERE id = ${image.uploaded_by}
  `;
  const canDelete = !!user && (user.id === image.uploaded_by || isModerator(user));

  return c.render(
    <Layout context={c} user={user} script={canDelete ? "delete" : undefined}>
      <main>
        <div class="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 pb-2 mb-3 border-b">
          <h1 class="text-3xl font-serif">{image.original_filename}</h1>
          <div class="flex flex-wrap items-center gap-x-4">
            <a href={getImageUrl(image)} target="_blank" class="inline-flex min-h-11 items-center text-blue-600 hover:underline">
              {t("images.viewFull")}
            </a>
            {canDelete && (
              <button
                type="button"
                class="text-red-600 hover:underline"
                data-delete-url={`/images/${image.id}`}
                data-delete-confirm={t("images.confirmDelete")}
                data-delete-success={t("images.deleteSuccess")}
                data-delete-failed={t("images.deleteFailed")}
              >
                {t("images.delete")}
              </button>
            )}
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-6">
          <img
            src={getImageUrl(image)}
            alt={image.alt_text || image.original_filename}
            class="w-full rounded shadow-lg"
            loading="lazy"
          />

          <div>
            <h3 class="font-semibold text-lg mb-2">{t("images.details")}</h3>
            <dl class="space-y-2">
              <Detail label={t("images.filename")}>{image.filename}</Detail>
              <Detail label={t("images.originalName")}>{image.original_filename}</Detail>
              <Detail label={t("images.fileSize")}>
                {(image.file_size / 1024 / 1024).toFixed(2)} MB
              </Detail>
              <Detail label={t("images.dimensions")}>
                {image.width && image.height
                  ? `${image.width} × ${image.height}`
                  : t("images.unknown")}
              </Detail>
              <Detail label={t("images.uploadedBy")}>
                {uploader ? (
                  <a href={`/users/${image.uploaded_by}`} class="text-blue-600 hover:underline">
                    {uploader.username}
                  </a>
                ) : (
                  t("images.unknownUser")
                )}
              </Detail>
              <Detail label={t("images.uploadedAt")}>{formatDateTime(image.created_at)}</Detail>
              {image.alt_text && (
                <Detail label={t("images.altText")}>{image.alt_text}</Detail>
              )}
            </dl>
          </div>
        </div>
      </main>
    </Layout>,
  );
};

export const handleImageDelete = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user) return c.text("Unauthorized", 401);

  const id = parseId(routeParam(c, "id"));
  const image = id && (await getImageById(id));
  if (!image) return c.text("Image not found", 404);

  if (image.uploaded_by !== user.id && !isModerator(user))
    return c.text("Permission denied", 403);

  await deleteImage(image.id);
  return c.text("Image deleted successfully");
};
