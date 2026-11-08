import { cms, fieldsOf } from "../../collections";
import { EntityFieldInput } from "../../components/entity-field";
import { sql } from "../../database";
import { loadFieldOptions } from "../../fields";
import { Layout } from "../../layout";
import type { CreateEntityRequest, CreateEntityResponse } from "../../shared/contracts";
import { useTranslation } from "../../translation";
import { parseId, readJson, type DefaultContext } from "../../utils";
import { cmsErrorResponse } from "./errors";

export const handleNewEntityPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  if (!user) return c.redirect("/login?redirect=/entities/new");

  const options = await Promise.all(
    cms.types.map((type) => loadFieldOptions(fieldsOf(type))),
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
              {cms.types.map((type) => (
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
          {cms.types.map((type, index) => (
            <div
              key={type}
              id={`tab-${type}`}
              class={`tab-content ${index === 0 ? "" : "hidden"}`}
            >
              {/* Fields without a label, like the description, have their own inputs above */}
              {Object.entries(fieldsOf(type)).map(
                ([key, field]) =>
                  field.meta.label && (
                    <label htmlFor={`${type}-${key}`} class="block mb-3">
                      <span class="font-semibold">
                        {t(field.meta.label)}
                        {field.meta.hint && ` (${t(field.meta.hint)})`}
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

  const { entity_type, image_id, fields = {}, ...body } = await readJson<CreateEntityRequest>(c);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (name.length < 3 || name.length > 255 || description.length < 3 || description.length > 20000)
    return c.body("Name and description are required and need to be at least 3 characters long.", 400);

  if (!cms.isType(entity_type) || typeof fields !== "object" || Array.isArray(fields))
    return c.body("Bad Request", 400);

  const imageId = image_id == null ? null : parseId(image_id);
  if (imageId === undefined) return c.body("Invalid image ID", 400);

  // Only images the user uploaded can be used
  if (imageId !== null) {
    const [image] = await sql`SELECT id FROM images WHERE id = ${imageId} AND uploaded_by = ${user.id}`;
    if (!image) return c.body("Image is unavailable", 400);
  }

  // New entities start out as a pending version that a moderator has to approve
  try {
    const { entityId, versionId } = await cms.create(entity_type, {
      values: { ...fields, name, description, image_id: imageId },
      authorId: user.id,
    });
    return c.json({ id: versionId, entity_id: entityId } satisfies CreateEntityResponse);
  } catch (error) {
    return cmsErrorResponse(c, error);
  }
};
