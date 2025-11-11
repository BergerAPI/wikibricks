import { sql } from "../../database";
import { imageStorage } from "../../services/image-storage";
import { Layout } from "../../layout";
import { TranslationFunctions, useTranslation } from "../../translation";
import { PermissionLevel, type DefaultContext } from "../../utils";

const UPLOAD_SCRIPT = (t: TranslationFunctions["t"]) => `
document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');
    const submitButton = e.target.querySelector('button[type="submit"]');

    // Clear previous messages
    errorDiv.innerHTML = '';
    successDiv.innerHTML = '';

    // Disable submit button
    submitButton.disabled = true;
    submitButton.textContent = '${t("images.uploading")}';

    try {
        const formData = new FormData(e.target);
        const imageFile = formData.get('image');

        // Client-side validation
        if (!imageFile || imageFile.size === 0) {
            throw new Error('${t("images.noFileSelected")}');
        }

        if (imageFile.size > 10 * 1024 * 1024) {
            throw new Error('${t("images.fileTooLarge")}');
        }

        const response = await fetch('/images/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || '${t("images.uploadFailed")}');
        }

        const result = await response.json();
        successDiv.innerHTML = '${t("images.uploadSuccess")}' + result.id + '. <a href="/images/' + result.id + '" class="underline">${t("images.viewImage")}</a>';
        e.target.reset();

    } catch (error) {
        errorDiv.innerHTML = error.message;
    } finally {
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.textContent = '${t("images.uploadButton")}';
    }
});

// Preview selected image
document.querySelector('input[name="image"]').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Remove any existing preview
        const existingPreview = document.getElementById('image-preview');
        if (existingPreview) existingPreview.remove();

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.id = 'image-preview';
            preview.className = 'mt-2 p-2 border rounded';
            preview.innerHTML = \`
                <p class="text-sm text-gray-600 mb-2">${t("images.preview")}:</p>
                <img src="\${e.target.result}" alt="Preview" class="max-w-xs max-h-48 rounded shadow" />
                <p class="text-xs text-gray-500 mt-1">
                    \${file.name} (\${(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
            \`;
            e.target.closest('div').appendChild(preview);
        };
        reader.readAsDataURL(file);
    }
});
            `;

// Handle image upload submission
export const handleImageUpload = async (c: DefaultContext) => {
  const user = c.get("user");

  if (!user) {
    return c.text("Unauthorized", 401);
  }

  try {
    const formData = await c.req.formData();
    const body = await c.req.parseBody()
    const imageFile = body["file"] as File;
    const altText = formData.get("alt_text") as string;

    if (!imageFile || imageFile.size === 0) {
      return c.text("No image file provided", 400);
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());

    const image = await imageStorage.uploadImage({
      originalFilename: imageFile.name,
      buffer,
      mimetype: imageFile.type,
      uploadedBy: user.id,
      altText: altText || undefined,
    });

    return c.json(image);
  } catch (error) {
    console.error("Image upload error:", error);
    return c.text(
      error instanceof Error ? error.message : "Upload failed",
      400,
    );
  }
};

// Serve image files
export const handleImageServe = async (c: DefaultContext) => {
  const id = parseInt(c.req.param("id"));

  if (isNaN(id)) {
    return c.text("Invalid image ID", 400);
  }

  try {
    const image = await imageStorage.getImageById(id);

    if (!image) {
      return c.text("Image not found", 404);
    }

    const buffer = await imageStorage.readImageFile(image);

    if (!buffer) {
      return c.text("Image file not found", 404);
    }

    // Convert Buffer to Uint8Array for Response compatibility
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": image.mime_type,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Image serve error:", error);
    return c.text("Failed to serve image", 500);
  }
};

// Get image metadata (GET /images/:id)
export const handleImageInfo = async (c: DefaultContext) => {
  const id = parseInt(c.req.param("id"));

  if (isNaN(id)) {
    return c.json({ error: "Invalid image ID" }, 400);
  }

  try {
    const image = await imageStorage.getImageById(id);

    if (!image) {
      return c.json({ error: "Image not found" }, 404);
    }

    // Don't expose sensitive file paths
    const publicImage = {
      id: image.id,
      filename: image.filename,
      original_filename: image.original_filename,
      file_size: image.file_size,
      mime_type: image.mime_type,
      width: image.width,
      height: image.height,
      entity_id: image.entity_id,
      version_id: image.version_id,
      alt_text: image.alt_text,
      created_at: image.created_at,
      url: imageStorage.getImageUrl(image),
    };

    return c.json(publicImage);
  } catch (error) {
    console.error("Get image error:", error);
    return c.json({ error: "Failed to get image" }, 500);
  }
};

// Display image page (GET /images/:id)
export const handleImagePage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);
  const id = parseInt(c.req.param("id"));

  if (isNaN(id)) {
    return c.text("Invalid image ID", 400);
  }

  try {
    const image = await imageStorage.getImageById(id);

    if (!image) {
      return c.notFound();
    }

    // Get uploader info
    const [uploader] = await sql<{ username: string }[]>`
      SELECT username FROM users WHERE id = ${image.uploaded_by}
    `;

    const canDelete =
      user &&
      (user.id === image.uploaded_by ||
        user.permission_level >= PermissionLevel.MODERATOR);

    return c.render(
      <Layout context={c} user={user}>
        <main class="overflow-auto">
          <div class="flex justify-between items-center pb-2 mb-3 border-b">
            <h1 class="text-3xl font-serif">{image.original_filename}</h1>
            <div class="space-x-2">
              <a
                href={imageStorage.getImageUrl(image)}
                target="_blank"
                class="text-blue-600 hover:underline"
              >
                {t("images.viewFull")}
              </a>
              {canDelete && (
                <button id="delete-btn" class="text-red-600 hover:underline">
                  {t("images.delete")}
                </button>
              )}
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <div>
              <img
                src={imageStorage.getImageUrl(image)}
                alt={image.alt_text || image.original_filename}
                class="w-full rounded shadow-lg"
                loading="lazy"
              />
            </div>

            <div class="space-y-4">
              <div>
                <h3 class="font-semibold text-lg mb-2">
                  {t("images.details")}
                </h3>
                <dl class="space-y-2">
                  <div>
                    <dt class="font-medium">{t("images.filename")}:</dt>
                    <dd class="text-gray-600">{image.filename}</dd>
                  </div>
                  <div>
                    <dt class="font-medium">{t("images.originalName")}:</dt>
                    <dd class="text-gray-600">{image.original_filename}</dd>
                  </div>
                  <div>
                    <dt class="font-medium">{t("images.fileSize")}:</dt>
                    <dd class="text-gray-600">
                      {(image.file_size / 1024 / 1024).toFixed(2)} MB
                    </dd>
                  </div>
                  <div>
                    <dt class="font-medium">{t("images.dimensions")}:</dt>
                    <dd class="text-gray-600">
                      {image.width && image.height
                        ? `${image.width} × ${image.height}`
                        : t("images.unknown")}
                    </dd>
                  </div>
                  <div>
                    <dt class="font-medium">{t("images.uploadedBy")}:</dt>
                    <dd class="text-gray-600">
                      {uploader ? (
                        <a
                          href={`/users/${image.uploaded_by}`}
                          class="text-blue-600 hover:underline"
                        >
                          {uploader.username}
                        </a>
                      ) : (
                        t("images.unknownUser")
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt class="font-medium">{t("images.uploadedAt")}:</dt>
                    <dd class="text-gray-600">
                      {new Date(image.created_at).toLocaleString()}
                    </dd>
                  </div>
                  {image.alt_text && (
                    <div>
                      <dt class="font-medium">{t("images.altText")}:</dt>
                      <dd class="text-gray-600">{image.alt_text}</dd>
                    </div>
                  )}
                  {image.entity_id && (
                    <div>
                      <dt class="font-medium">{t("images.linkedEntity")}:</dt>
                      <dd class="text-gray-600">
                        <a
                          href={`/entities/${image.entity_id}`}
                          class="text-blue-600 hover:underline"
                        >
                          Entity #{image.entity_id}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>

          {canDelete && (
            <script
              dangerouslySetInnerHTML={{
                __html: `
document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!confirm('${t("images.confirmDelete")}')) return;

    try {
        const response = await fetch('/images/${image.id}', {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('${t("images.deleteSuccess")}');
            window.location.href = '/images/my';
        } else {
            throw new Error(await response.text());
        }
    } catch (error) {
        alert('${t("images.deleteFailed")}: ' + error.message);
    }
});
                `,
              }}
            />
          )}
        </main>
      </Layout>,
    );
  } catch (error) {
    console.error("Image page error:", error);
    return c.text("Failed to load image", 500);
  }
};

// Delete image (DELETE /images/:id)
export const handleImageDelete = async (c: DefaultContext) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"));

  if (!user) {
    return c.text("Unauthorized", 401);
  }

  if (isNaN(id)) {
    return c.text("Invalid image ID", 400);
  }

  try {
    const image = await imageStorage.getImageById(id);

    if (!image) {
      return c.text("Image not found", 404);
    }

    // Check permissions
    if (
      image.uploaded_by !== user.id &&
      user.permission_level < PermissionLevel.MODERATOR
    ) {
      return c.text("Permission denied", 403);
    }

    await imageStorage.deleteImage(id, user.id);

    return c.text("Image deleted successfully", 200);
  } catch (error) {
    console.error("Image delete error:", error);
    return c.text(
      error instanceof Error ? error.message : "Failed to delete image",
      500,
    );
  }
};
