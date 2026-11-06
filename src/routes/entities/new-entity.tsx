import { getInfoFields } from ".";
import { categories, Category } from "../../categories";
import { sql } from "../../database";
import type { CreateEntityRequest, CreateEntityResponse } from "../../shared/contracts";
import { Layout } from "../../layout";
import { useTranslation } from "../../translation";
import type { DefaultContext } from "../../utils";
import { JSX } from "hono/jsx/jsx-runtime";

const buildOptions = (
  categories: Category[],
  depth: number = 0,
  path: string[] = [],
): JSX.Element[] => {
  return categories.flatMap((cat) => {
    const colors = [
      "bg-neutral-400",
      "bg-neutral-300",
      "bg-neutral-200",
      "bg-neutral-100",
    ];
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
      ? [option, ...buildOptions(cat.children!, depth + 1, [...path, cat.name])]
      : [option];
  });
};

export const handleNewEntityPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  if (!user) return c.redirect("/login?redirect=/entities/new");

  const infoFields = getInfoFields(t);

  const brands = await sql<{ id: string; name: string }[]>`
        SELECT e.created_at, e.type, e.name, e.id FROM entities e
        JOIN entity_versions v ON e.head_version_id = v.id
        WHERE e.type = 'brand'
        ORDER BY e.name ASC
        LIMIT 500
    `;

  return c.render(
    <Layout context={c} user={user} script="new-entity">
      <main data-create-url="/entities/new" data-upload-url="/images/upload">
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">
          {t("entities.addNew")}
        </h1>

        <div
          id="error"
          role="alert"
          class="empty:hidden mb-3 p-3 border border-red-500 bg-red-100 text-red-700"
        ></div>

        <div>
          <label class="block mb-3">
            <span class="font-semibold">{t("entities.entityTypeLabel")}</span>
            <select
              class="mt-1 block w-full"
              name="entity_type"
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
              name="name"
              value=""
              class="border p-2 rounded w-full"
            />
          </label>

          <label class="block mb-3">
            <span class="font-semibold">{t("entities.descriptionLabel")}</span>
            <textarea
              name="description"
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

                  if (key === "issued")
                    fieldLabel += " (YYYY oder DD.MM.YYYY oder MM.YYYY)";

                  // Special case for brands
                  if (key === "brand_id") {
                    return (
                      <label htmlFor={key} class="block mb-3">
                        <span class="font-semibold">{fieldLabel}</span>

                        <select
                          id={key}
                          name={key}
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
                    return (
                      <label htmlFor={key} class="block mb-3">
                        <span class="font-semibold">{fieldLabel}</span>

                        <select
                          id={key}
                          name={key}
                          class="border p-2 rounded w-full"
                        >
                          <option value="">{t("entities.selectTheme")}</option>
                          {buildOptions(categories)}
                        </select>
                      </label>
                    );
                  }

                  return (
                    <label htmlFor={key} class="block mb-3">
                      <span class="font-semibold">{fieldLabel}</span>

                      <input
                        id={key}
                        name={key}
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

          <button id="submit_button" type="button">{t("action.submit")}</button>
        </div>

      </main>
    </Layout>,
  );
};

export const handleNewEntitySubmit = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user) return c.body("Unauthorized", 401);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.body("Bad Request", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.body("Bad Request", 400);
  }
  const { name, description, entity_type, image_id, ...data } =
    body as Partial<Record<keyof CreateEntityRequest, unknown>>;

  if (
    typeof name !== "string" ||
    typeof description !== "string" ||
    name.trim().length < 3 ||
    name.trim().length > 255 ||
    description.trim().length < 3 ||
    description.length > 20000
  ) {
    return c.body(
      "Name and description are required and need to be at least 3 characters long.",
      400,
    );
  }

  // Checking whether the necessary fields of the specific entity type have been supplied
  if (entity_type !== "set" && entity_type !== "brand" && entity_type !== "wiki") {
    return c.body("Bad Request", 400);
  }
  const typeInfo = getInfoFields(useTranslation(c).t)[entity_type];
  const allowedByType = {
    set: ["pieces", "issued", "theme", "size", "brand_id", "manufacturer_id"],
    brand: ["country", "website"],
    wiki: [],
  } as const;
  const allowed = allowedByType[entity_type];
  const cleanData: Record<string, unknown> = {};
  for (const key of allowed) {
    if (data[key] !== undefined && String(data[key]).length > 0) {
      cleanData[key] = data[key];
    }
  }

  // pieces must be a non-negative integer when supplied
  if ("pieces" in cleanData) {
    const n = Number(cleanData.pieces);
    if (!Number.isInteger(n) || n < 0 || n > 1000000) {
      return c.body("Validation failed for pieces", 400);
    }
    cleanData.pieces = n;
  }
  if ("brand_id" in cleanData) {
    const n = Number(cleanData.brand_id);
    if (!Number.isInteger(n) || n <= 0) {
      return c.body("Validation failed for brand_id", 400);
    }
    cleanData.brand_id = n;
  }

  for (const [fieldKey] of Object.entries(typeInfo)) {
    const info = typeInfo[fieldKey as keyof typeof typeInfo]!;
    if (
      cleanData[fieldKey] !== undefined &&
      (typeof info !== "string" && info.validate
        ? info.validate(cleanData[fieldKey] as never)
        : true)
    )
      continue;

    return c.body("Validation failed for " + fieldKey, 400);
  }

  let cleanImageId: number | null = null;
  if (image_id != null && image_id !== "") {
    const id = typeof image_id === "string" && /^\d+$/.test(image_id)
      ? Number(image_id)
      : image_id;
    if (typeof id !== "number" || !Number.isInteger(id) || id < 1 || id > 2147483647) {
      return c.body("Invalid image ID", 400);
    }
    cleanImageId = id;
  }

  try {
    // Every created set by a user will be handles by a change and needs to be accepted by a moderator
    const version = await sql.begin(async (sql) => {
      if (cleanImageId !== null) {
        const [image] = await sql<{ id: number }[]>`
          SELECT id FROM images WHERE id = ${cleanImageId} AND uploaded_by = ${user.id}
          FOR KEY SHARE
        `;
        if (!image) return null;
      }

      const [{ id, entity_id }] = await sql<CreateEntityResponse[]>`
            WITH new_entity AS (
                INSERT INTO entities (name, type)
                VALUES (${name.trim()}, ${entity_type})
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
                    ${user.id},
                    'pending',
                    ${description.trim()},
                    ${cleanImageId}
                FROM new_entity
                RETURNING id, entity_id
            ) SELECT entity_id, id FROM new_version;
        `;

      // Handling creation of the specific entity tables
      if (entity_type === "set") {
        await sql`
                INSERT INTO sets ${sql({
                  version_id: id,
                  ...cleanData,
                })}`;
      } else if (entity_type === "brand") {
        await sql`
                INSERT INTO brands ${sql({
                  version_id: id,
                  ...cleanData,
                })}`;
      } else if (entity_type === "wiki") {
        // No additional table insertion is needed for wiki entities.
      }

      return { id, entity_id };
    });

    if (!version) return c.body("Image is unavailable", 400);
    return c.json(version);
  } catch (error) {
    console.error(error);
    return c.body("Something went wrong.", 500);
  }
};
