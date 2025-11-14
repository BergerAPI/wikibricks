import { ReactElement } from "hono/jsx";
import { getInfoFields, type EntityAttributes } from ".";
import { categories, Category } from "../../categories";
import { sql, type EntityType } from "../../database";
import { Layout } from "../../layout";
import { deleteImage } from "../../services/image-storage";
import { useTranslation } from "../../translation";
import type { DefaultContext } from "../../utils";
import { JSX } from "hono/jsx/jsx-runtime";

const buildOptions = (
  categories: Category[],
  depth: number = 0,
  path: string[] = []
): JSX.Element[] => {
  return categories.flatMap((cat) => {
    const colors = ["bg-neutral-400", "bg-neutral-300", "bg-neutral-200", "bg-neutral-100"]
    const hasChildren = cat.children && cat.children.length > 0;
    const fullPath = [...path, cat.name].join(" › ");

    const option = (
      <option
        key={cat.id}
        value={cat.id}
        disabled={hasChildren}
        data-depth={depth}
        data-full-path={fullPath}
        style={{
          fontWeight: hasChildren ? "bold" : "normal",
        }}
        class={hasChildren ? colors[depth] : ""}
      >
        {cat.name}
      </option>
    );

    // If parent, append children options recursively
    return hasChildren
      ? [
        option,
        ...buildOptions(cat.children!, depth + 1, [...path, cat.name]),
      ]
      : [option];
  });
};

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
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">{t("entities.addNew")}</h1>

        <div
          id="error"
          class="empty:hidden mb-3 p-3 border border-red-500 bg-red-100 text-red-700"
        ></div>

        <div>
          <label class="block mb-3">
            <span class="font-semibold">{t("entities.entityTypeLabel")}</span>
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
            <span class="font-semibold">{t("entities.nameLabel")}</span>
            <input
              id="name"
              field="name"
              value=""
              class="border p-2 rounded w-full"
            />
          </label>

          <label class="block mb-3">
            <span class="font-semibold">{t("entities.descriptionLabel")}</span>
            <textarea
              field="description"
              id="description"
              value=""
              class="border p-2 rounded w-full"
            />
          </label>

          <label class="block mb-3">
            <span class="font-semibold">{t("entities.imageLabel")}</span>
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
                          <option value="">{t("entities.selectBrand")}</option>
                          {brands.map((brand) => (
                            <option key={brand.id} value={brand.id}>
                              {brand.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }

                  if (key === "theme") {
                    return <label htmlFor={key} class="block mb-3">
                      <span class="font-semibold">{fieldLabel}</span>

                      <select
                        id={key}
                        field={key}
                        class="border p-2 rounded w-full"
                      >
                        <option value="">{t("entities.selectTheme")}</option>
                        {buildOptions(categories)}
                      </select>
                    </label>
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

          <button id="submit_button">{t("action.submit")}</button>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("image_file");
  const submitButton = document.getElementById("submit_button");
  const errorEl = document.getElementById("error");
  const entityTypeSelect = document.getElementById("entity_type");

  let imageId = "";
  let isSubmitting = false;

  const setError = (msg) => { if (errorEl) errorEl.innerHTML = msg; };

  async function uploadImage(file) {
    if (!file) throw new Error("No file selected.");
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/images/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error("Upload failed ("+res.status+")");

    const data = await res.json();
    if (!data.id) throw new Error("Invalid upload response.");
    imageId = data.id;
    return imageId;
  }

  function collectFields() {
    const result = {};
    document.querySelectorAll("[field]").forEach((el) => {
      if (el.offsetParent === null) return;
      const key = el.getAttribute("field");
      let value = el.type === "checkbox" ? el.checked : el.value;
      if (["brand_id", "pieces"].includes(key)) {
        const num = parseInt(value, 10);
        if (!isNaN(num)) value = num;
      }
      result[key] = value;
    });
    return result;
  }

  async function submitEntity(data) {
    const res = await fetch("/entities/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("There was an error ("+await res.text()+")");
    const json = await res.json();
    if (json.entity_id) {
      window.location.href = "/entities/"+json.entity_id+"?version="+json.id;
    } else {
      throw new Error("Unexpected response from server.");
    }
  }

  submitButton?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    isSubmitting = true;
    submitButton.disabled = true;
    setError("");

    try {
      const file = fileInput?.files?.[0];
      if (file && !imageId) await uploadImage(file);
      const fields = collectFields();
      await submitEntity({ ...fields, image_id: imageId });
    } catch (err) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      isSubmitting = false;
      submitButton.disabled = false;
    }
  });

  entityTypeSelect?.addEventListener("change", () => {
    document.querySelectorAll(".tab-content").forEach((el) => el.classList.add("hidden"));
    document.getElementById("tab-" + entityTypeSelect.value)?.classList.remove("hidden");
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

  const { name, description, entity_type, image_id, ...data } =
    await c.req.json();

  if (!user) {
    deleteImage(image_id)
    return c.body("Unauthorized", 401);
  }

  if (
    !name ||
    !description ||
    !entity_type ||
    name.length < 3 ||
    description.length < 3
  ) {
    deleteImage(image_id)

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

    deleteImage(image_id)

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
