import { EntityFieldInput } from "../../components/entity-field";
import { sql } from "../../database";
import {
  entityDefinitions,
  entityTypes,
  isEntityType,
  loadFieldOptions,
  parseFields,
} from "../../entity-types";
import type { CreateEntityRequest, CreateEntityResponse } from "../../shared/contracts";
import { Layout } from "../../layout";
import { useTranslation } from "../../translation";
import { parseId, readJson, type DefaultContext } from "../../utils";

export const handleNewEntityPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  if (!user) return c.redirect("/login?redirect=/entities/new");

  const options = await Promise.all(
    entityTypes.map((type) => loadFieldOptions(entityDefinitions[type].fields)),
  );

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
              id="entity_type"
            >
              {entityTypes.map((type) => (
                <option value={type}>{t(`entityType.${type}`)}</option>
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
          {entityTypes.map((type, index) => (
            <div
              key={type}
              id={`tab-${type}`}
              class={`tab-content ${index === 0 ? "" : "hidden"}`}
            >
              {Object.entries(entityDefinitions[type].fields).map(
                ([key, field]) => (
                  <label htmlFor={`${type}-${key}`} class="block mb-3">
                    <span class="font-semibold">
                      {t(field.label)}
                      {field.hint && ` (${t(field.hint)})`}
                    </span>

                    <EntityFieldInput
                      t={t}
                      field={field}
                      options={options[index][key]}
                      id={`${type}-${key}`}
                      name={key}
                      class="border p-2 rounded w-full"
                    />
                  </label>
                ),
              )}
            </div>
          ))}

          <button id="submit_button" type="button">
            {t("action.submit")}
          </button>
        </div>
      </main>
    </Layout>,
  );
};

export const handleNewEntitySubmit = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user) return c.body("Unauthorized", 401);

  const { entity_type, image_id, fields, ...body } = await readJson<CreateEntityRequest>(c);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (name.length < 3 || name.length > 255 || description.length < 3 || description.length > 20000)
    return c.body("Name and description are required and need to be at least 3 characters long.", 400);

  if (!isEntityType(entity_type)) return c.body("Bad Request", 400);
  const definition = entityDefinitions[entity_type];

  const parsed = await parseFields(definition, fields, "create");
  if ("error" in parsed) return c.body(parsed.error, 400);

  const imageId = image_id == null ? null : parseId(image_id);
  if (imageId === undefined) return c.body("Invalid image ID", 400);

  // New entities start out as a pending version that a moderator has to approve
  return sql.begin(async (tx) => {
    if (imageId !== null) {
      const [image] = await tx`
        SELECT id FROM images WHERE id = ${imageId} AND uploaded_by = ${user.id} FOR KEY SHARE
      `;
      if (!image) return c.body("Image is unavailable", 400);
    }

    const [entity] = await tx<{ id: number }[]>`
      INSERT INTO entities (name, type) VALUES (${name}, ${entity_type})
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    `;
    if (!entity) return c.body("An entity with this name already exists", 409);

    const [version] = await tx<CreateEntityResponse[]>`
      INSERT INTO entity_versions ${tx({
        entity_id: entity.id,
        version_number: 1,
        created_by: user.id,
        review_status: "pending",
        description,
        image_id: imageId,
      })}
      RETURNING id, entity_id
    `;

    if (definition.table)
      await tx`INSERT INTO ${tx(definition.table)} ${tx({ version_id: version.id, ...parsed.values })}`;

    return c.json(version);
  });
};
