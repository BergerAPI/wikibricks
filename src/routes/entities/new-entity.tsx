import { getInfoFields, type EntityAttributes } from ".";
import { sql, type EntityType } from "../../database";
import { Layout } from "../../layout";
import { useTranslation } from "../../translation";
import type { DefaultContext } from "../../utils";

export const handleNewEntityPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  if (user === undefined) return c.redirect("/login?redirect=/entities/new");

  const infoFields = getInfoFields(t);

  const brands = await sql<{ id: string; name: string }[]>`
        SELECT e.created_at, e.type, e.name, e.id FROM entities e
        JOIN entity_versions v ON e.head_version_id = v.id
        WHERE e.type = 'brand'
    `;

  return c.render(
    <Layout context={c} user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Add New Entity</h1>

        <div
          id="error"
          class="empty:hidden mb-3 p-3 border border-red-500 bg-red-100 text-red-700"
        ></div>

        <div>
          <label class="block mb-3">
            <span class="font-semibold">Entity Type</span>
            <select
              class="mt-1 block w-full"
              field="entity_type"
              name="brand_id"
              value="set"
              id="entity_type"
            >
              {Object.keys(infoFields).map((id) => (
                <option value={id}>
                  {id.at(0)?.toUpperCase() +
                    id.slice(1, id.length).toLowerCase()}
                </option>
              ))}
            </select>
          </label>

          <label class="block mb-3">
            <span class="font-semibold">Name</span>
            <input
              id="name"
              field="name"
              value=""
              class="border p-2 rounded w-full"
            />
          </label>

          <label class="block mb-3">
            <span class="font-semibold">Description</span>
            <textarea
              field="description"
              id="description"
              value=""
              class="border p-2 rounded w-full"
            />
          </label>

          <label class="block mb-3">
            <span class="font-semibold">Image</span>
            <input
              type="file"
              accept="image/*"
              id="image_file"
              class="border p-2 rounded w-full"
            />
            <input type="hidden" field="image_url" id="image_url" value="" />
            <div
              id="image_upload_progress"
              class="mt-2 text-sm text-gray-600 hidden"
            ></div>
          </label>

          <label class="block mb-3">
            <span class="font-semibold">Price</span>
            <input
              field="price"
              id="price"
              value=""
              class="border p-2 rounded w-full"
            />
          </label>

          {/* Tab contents */}
          {Object.keys(infoFields).map((id, index) => (
            <div
              key={id}
              id={`tab-${id}`}
              class={`tab-content ${index === 0 ? "" : "hidden"}`}
            >
              {Object.entries(infoFields[id as keyof typeof infoFields]).map(
                ([key, def]) => {
                  let fieldLabel = "";
                  let inputType: "text" | "number" = "text";

                  if (typeof def === "string") {
                    fieldLabel = def;
                  } else {
                    fieldLabel = def.text;
                    inputType = def.type === "number" ? "number" : "text";
                  }

                  // Special case for brands
                  if (key === "brand_id") {
                    return (
                      <label htmlFor={key} class="block mb-3">
                        <span class="font-semibold">{fieldLabel}</span>

                        <select
                          id={key}
                          field={key}
                          class="border p-2 rounded w-full"
                        >
                          <option value="">Select a brand</option>
                          {brands.map((brand) => (
                            <option key={brand.id} value={brand.id}>
                              {brand.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }

                  return (
                    <label htmlFor={key} class="block mb-3">
                      <span class="font-semibold">{fieldLabel}</span>

                      <input
                        id={key}
                        field={key}
                        type={inputType}
                        value={""}
                        class="border p-2 rounded w-full"
                      />
                    </label>
                  );
                },
              )}
            </div>
          ))}

          <span id="progress" class="hidden">
            Uploading...
          </span>
          <button id="submit_button">Submit</button>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener("DOMContentLoaded", () => {
                const fileInput = document.getElementById("image_file");
                const imageUrlInput = document.getElementById("image_url");
                const submitButton = document.getElementById("submit_button");
                const progressDiv = document.getElementById("progress");
                const errorDiv = document.getElementById("error");
                const entityTypeSelect = document.getElementById("entity_type");

                let uploadedImageUrl = "";
                let isSubmitting = false;

                // UI helpers
                function showProgress(text) {
                  if (!progressDiv) return;
                  progressDiv.classList.remove("hidden");
                  progressDiv.textContent = text;
                }

                function hideProgress(delay = 0) {
                  if (!progressDiv) return;
                  if (delay > 0) {
                    setTimeout(() => progressDiv.classList.add("hidden"), delay);
                  } else {
                    progressDiv.classList.add("hidden");
                  }
                }

                function setError(message) {
                  if (!errorDiv) return;
                  errorDiv.innerHTML = message;
                }

                // Upload the image using fetch and FormData.
                // Note: fetch does not provide reliable upload progress events across browsers;
                // we present an indeterminate "Uploading..." message instead.
                async function uploadImage(file) {
                  if (!file) throw new Error("No file provided for upload.");

                  showProgress("Uploading image...");
                  const formData = new FormData();
                  formData.append("file", file);

                  const resp = await fetch("/api/upload-image", {
                    method: "POST",
                    body: formData,
                  });

                  if (!resp.ok) {
                    const text = await resp.text().catch(() => "");
                    throw new Error(
                      "Image upload failed ("+resp.status+"):" + (text || resp.statusText)
                    );
                  }

                  const json = await resp.json().catch(() => ({}));
                  if (!json.url) throw new Error("Upload failed: no URL returned from server.");

                  // Small UI delay so users see "Image uploaded!"
                  showProgress("Image uploaded!");
                  hideProgress(800);
                  uploadedImageUrl = json.url;
                  if (imageUrlInput) imageUrlInput.value = uploadedImageUrl;
                  return uploadedImageUrl;
                }

                // Collect visible fields with attribute [field] and return an object.
                function collectVisibleFields() {
                  const data = {};
                  document.querySelectorAll("[field]").forEach((el) => {
                    // visible elements have offsetParent not null (simple visibility check)
                    if (el.offsetParent === null) return;

                    const field = el.getAttribute("field");
                    if (!field) return;

                    // Inputs:
                    let value;
                    const tag = el.tagName;
                    const type = el.type ? el.type.toLowerCase() : "";

                    if (tag === "SELECT") {
                      const selected = el.options[el.selectedIndex];
                      value = selected ? selected.value : "";
                    } else if (type === "checkbox") {
                      // for checkboxes keep boolean
                      value = el.checked;
                    } else {
                      value = el.value;
                    }

                    // Convert numeric fields
                    if (value !== "" && (field === "brand_id" || field === "pieces")) {
                      const parsed = parseInt(value, 10);
                      value = Number.isNaN(parsed) ? value : parsed;
                    }

                    data[field] = value;
                  });

                  // Ensure image_url (if set via upload or manual input) is included
                  if (imageUrlInput && imageUrlInput.value) {
                    data.image_url = imageUrlInput.value;
                  }

                  return data;
                }

                // Submit the entity JSON to the server.
                async function submitEntity(data) {
                  showProgress("Submitting...");
                  const resp = await fetch("/entities/new", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                    redirect: "follow",
                  });

                  if (!resp.ok) {
                    const body = await resp.text().catch(() => "");
                    if (resp.status === 400) {
                      throw new Error("Bad Request: " + (body || "Invalid request."));
                    } else if (resp.status === 500) {
                      throw new Error("Server error: Our technical team has been notified. Please try again later.");
                    } else {
                      throw new Error("An unexpected error occurred ("+resp.status+").");
                    }
                  }

                  const json = await resp.json().catch(() => ({}));
                  if (json.id && json.entity_id) {
                    // Redirect to the created entity
                    window.location.href = "/entities/"+json.entity_id;
                  } else {
                    throw new Error("Unexpected response from server when creating entity.");
                  }
                }

                // Main click handler for submit button
                submitButton?.addEventListener("click", async (ev) => {
                  ev.preventDefault();
                  if (isSubmitting) return; // prevent double submissions
                  isSubmitting = true;
                  submitButton.disabled = true;
                  setError(""); // clear previous errors

                  try {
                    const file = fileInput?.files && fileInput.files[0];

                    // If a file is selected and not yet uploaded, upload it first.
                    // If image URL already present (uploadedImageUrl or input), skip upload.
                    if (file && !uploadedImageUrl && !(imageUrlInput && imageUrlInput.value)) {
                      try {
                        await uploadImage(file);
                      } catch (uploadErr) {
                        setError(uploadErr.message || "Error uploading image. Please try again.");
                        return;
                      }
                    }

                    // Collect form fields and send entity create request
                    const data = collectVisibleFields();
                    await submitEntity(data);
                    // If submitEntity didn't redirect, we'll reach here — hide progress.
                    hideProgress();
                  } catch (err) {
                    // Network error or other error
                    setError(
                      err && err.message
                        ? err.message
                        : "Network error: Unable to connect to the server. Please check your connection and try again."
                    );
                    hideProgress();
                  } finally {
                    isSubmitting = false;
                    submitButton.disabled = false;
                  }
                });

                // Toggle tab content based on entity_type selection
                entityTypeSelect?.addEventListener("change", () => {
                  const selected = entityTypeSelect.value;
                  document.querySelectorAll(".tab-content").forEach((el) => el.classList.add("hidden"));
                  const content = document.getElementById("tab-" + selected);
                  if (content) content.classList.remove("hidden");
                });
              });
                    `,
          }}
        />
      </main>
    </Layout>,
  );
};

export const handleNewEntitySubmit = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  const infoFields = getInfoFields(t);

  if (!user) return c.body("Unauthorized", 401);

  const { name, description, entity_type, image_id, ...data } =
    await c.req.json();

  if (
    !name ||
    !description ||
    !entity_type ||
    name.length < 3 ||
    description.length < 3
  ) {
    return c.body(
      "Name and description are required and need to be at least 3 characters long.",
      400,
    );
  }

  // Checking whether the necessary fields of the specific entity type have been supplied
  const typeInfo = infoFields[entity_type as keyof typeof infoFields];

  if (!typeInfo) return c.body("Bad Request", 400);

  for (const [fieldKey] of Object.entries(typeInfo)) {
    if (data[fieldKey] !== undefined) continue;

    return c.body("Bad Request", 400);
  }

  // Every created set by a user will be handles by a change and needs to be accepted by a moderator
  const version = await sql.begin(async (sql) => {
    const [{ id, entity_id }] = await sql<{ id: number; entity_id: number }[]>`
            WITH new_entity AS (
                INSERT INTO entities (name, type)
                VALUES (${name.toString()}, ${entity_type})
                RETURNING id
            ), new_version AS (
                INSERT INTO entity_versions (
                    entity_id,
                    version_number,
                    created_by,
                    review_status,
                    description,
                    image_id
                )
                SELECT
                    id,
                    1,
                    ${user.id.toString()},
                    'pending',
                    ${description.toString()},
                    ${image_id || null}
                FROM new_entity
                RETURNING id, entity_id
            ) SELECT entity_id, id FROM new_version;
        `;

    // Handling creation of the specific entity tables
    if (entity_type === "set") {
      await sql`
                INSERT INTO sets ${sql({
                  version_id: id,
                  ...data,
                })}`;
    } else if (entity_type === "brand") {
      await sql`
                INSERT INTO brands ${sql({
                  version_id: id,
                  ...data,
                })}`;
    } else if (entity_type === "wiki") {
      // No additional table insertion is needed for wiki entities.
    }

    return { id, entity_id };
  });

  return c.json(version);
};
