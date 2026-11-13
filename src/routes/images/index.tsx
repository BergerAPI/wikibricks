import { Readable } from "node:stream";
import type { Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cms } from "../../collections";
import { sql } from "../../database";
import { PageTitle } from "../../components/ui";
import { Layout } from "../../layout";
import { getImageUrl, imageWidths, openImageFile } from "../../services/image-files";
import {
  deleteImage,
  deleteUnusedImage,
  getVisibleImage,
  ImageUploadError,
  MAX_IMAGE_FILE_BYTES,
  uploadImage,
} from "../../services/image-storage";
import type { UploadImageResponse } from "../../shared/contracts";
import { useTranslation } from "../../translation";
import { isModerator, isRateLimited, parseId, routeParam, type DefaultContext } from "../../utils";

// Leaves some room for the rest of the multipart form
export const limitImageUpload = bodyLimit({
  maxSize: MAX_IMAGE_FILE_BYTES + 64 * 1024,
  onError: (c) => c.text("Upload body exceeds the size limit", 413),
});

const SERVABLE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const PRIVATE_CACHE = "private, no-store";
const activeUploads = new Set<number>();

export const guardImageUpload = async (c: DefaultContext, next: Next) => {
  const user = c.get("user");
  if (!user) return c.text("Unauthorized", 401);
  if (activeUploads.has(user.id) || activeUploads.size >= 4) {
    c.header("Retry-After", "5");
    return c.text("Uploads are busy. Try again in a moment.", 429);
  }
  if (isRateLimited(`image-upload:${user.id}`, 30, 60 * 60 * 1000))
    return c.text("Too many upload attempts. Try again later.", 429);

  activeUploads.add(user.id);
  try {
    await next();
  } finally {
    activeUploads.delete(user.id);
  }
};

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
    return c.json({ id: image.id } satisfies UploadImageResponse);
  } catch (error) {
    if (error instanceof ImageUploadError) return c.text(error.message, error.status);
    console.error("Image upload error:", error);
    return c.text("Upload failed", 500);
  }
};

export const handleImageServe = async (c: DefaultContext) => {
  c.header("Cache-Control", PRIVATE_CACHE);
  const id = parseId(routeParam(c, "id"));
  const image = id && (await getVisibleImage(id, c.get("user")));
  if (!image) return c.text("Image not found", 404);

  const requested = Number(c.req.query("width"));
  const width = requested === imageWidths.small || requested === imageWidths.large ? requested : undefined;
  const source = await openImageFile(image, image.published ? width : undefined);
  if (!source) return c.text("Image file not found", 404);

  const { file, mime, fallback } = source;
  let streaming = false;
  try {
    const stat = await file.stat();
    const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
    if (image.published) {
      c.header("Cache-Control", fallback ? "public, max-age=0, must-revalidate" : "public, max-age=3600");
      c.header("ETag", etag);
      const validators = c.req.header("If-None-Match")?.split(",").map((value) => value.trim());
      if (validators?.some((value) => value === "*" || value === etag)) return c.body(null, 304);
    }

    const filename = mime === "image/webp" ? image.filename.replace(/\.[^.]+$/, ".webp") : image.filename;
    c.header("Content-Type", SERVABLE_TYPES.has(mime) ? mime : "application/octet-stream");
    c.header("Content-Length", String(stat.size));
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Content-Disposition", `inline; filename="${filename.replace(/["\r\n]/g, "")}"`);
    if (c.req.method === "HEAD") return c.body(null);

    const response = c.body(Readable.toWeb(file.createReadStream()) as ReadableStream<Uint8Array>);
    streaming = true;
    return response;
  } finally {
    if (!streaming) await file.close();
  }
};

export const handleImageInfo = async (c: DefaultContext) => {
  c.header("Cache-Control", PRIVATE_CACHE);
  const id = parseId(routeParam(c, "id"));
  const image = id && (await getVisibleImage(id, c.get("user")));
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
    url: getImageUrl(image.id),
  });
};

const Detail = ({ label, children }: { label: string; children: unknown }) => (
  <div>
    <dt class="font-medium">{label}:</dt>
    <dd class="text-gray-600">{children}</dd>
  </div>
);

export const handleImagePage = async (c: DefaultContext) => {
  c.header("Cache-Control", PRIVATE_CACHE);
  const user = c.get("user");
  const { t, url, formatDateTime } = useTranslation(c);

  const id = parseId(routeParam(c, "id"));
  const image = id && (await getVisibleImage(id, user));
  if (!image) return c.notFound();

  const [uploader] = await sql<{ username: string }[]>`
    SELECT username FROM users WHERE id = ${image.uploaded_by}
  `;
  const canDelete = isModerator(user) || (!!user && user.id === image.uploaded_by && !await cms.isReferenced("images", image.id));

  return c.render(
    <Layout context={c} title={image.original_filename} page={canDelete ? "delete" : undefined} noindex>
      <main>
        <PageTitle
          actions={<>
            <a href={getImageUrl(image.id)} target="_blank">{t("images.viewFull")}</a>
            {canDelete && (
              <button
                type="button"
                class="button-link text-red-700"
                data-delete-url={`/images/${image.id}`}
                data-delete-confirm={t("images.confirmDelete")}
                data-delete-success={t("images.deleteSuccess")}
                data-delete-failed={t("images.deleteFailed")}
              >
                {t("images.delete")}
              </button>
            )}
          </>}
        >
          {image.original_filename}
        </PageTitle>

        <div class="grid md:grid-cols-2 gap-6">
          <img
            src={getImageUrl(image.id, image.published ? imageWidths.large : undefined)}
            alt={image.alt_text || image.original_filename}
            class="w-full rounded shadow-lg"
            loading="lazy"
          />

          <div>
            <h2 class="font-semibold text-lg mb-2">{t("images.details")}</h2>
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
                  <a href={url(`/users/${image.uploaded_by}`)}>
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
  const image = id && (await getVisibleImage(id, user));
  if (!image) return c.text("Image not found", 404);

  if (isModerator(user)) {
    await deleteImage(image.id, user.id);
  } else {
    if (image.uploaded_by !== user.id) return c.text("Permission denied", 403);
    if (!await deleteUnusedImage(image.id, user.id)) return c.text(useTranslation(c).t("images.inUse"), 409);
  }
  return c.text("Image deleted successfully");
};
