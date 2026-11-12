import { cms, fieldsOf } from "../../collections";
import { EntityFieldInput } from "../../components/entity-field";
import { RichTextEditor } from "../../components/rich-text";
import { loadFieldOptions } from "../../fields";
import { Layout } from "../../layout";
import { ownsImage } from "../../services/image-storage";
import type { CreateEntityRequest, CreateEntityResponse } from "../../shared/contracts";
import { useTranslation } from "../../translation";
import { parseId, readJson, type DefaultContext } from "../../utils";
import { cmsErrorResponse } from "./errors";

export const handleNewEntityPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  if (!user) return c.redirect("/login?redirect=/entities/new");

  const options = await Promise.all(
    cms.types.map((type) => loadFieldOptions(type)),
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
          <div class="mb-3">
            <label for="entity_type" class="font-semibold">{t("entities.entityTypeLabel")}</label>
            <select class="mt-1 block w-full" name="entity_type" id="entity_type">
              {cms.types.map((type) => (
                <option value={type}>{t(`entityType.${type}`)}</option>
              ))}
            </select>
          </div>

          <label class="block mb-3">
            <span class="font-semibold">{t("entities.nameLabel")}</span>
            <input
              id="name"
              name="name"
              required
              minlength={3}
              maxlength={255}
              class="w-full"
            />
          </label>

          <div class="mb-3">
            <p class="font-semibold">{t("entities.descriptionLabel")}</p>
            <RichTextEditor id="description" name="description" value="" t={t} referenceUrl="/entities/options" />
          </div>

          <label class="block mb-3">
            <span class="font-semibold">{t("entities.imageLabel")}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              id="image_file"
              class="w-full"
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
                    <div class="mb-3">
                      <label for={`${type}-${key}`} class="font-semibold">
                        {t(field.meta.label)}
                        {field.meta.hint && ` (${t(field.meta.hint)})`}
                      </label>

                      <EntityFieldInput
                        t={t}
                        field={field}
                        options={options[index][key]}
                        id={`${type}-${key}`}
                        name={key}
                        required={field.required}
                        class="mt-1 block w-full"
                      />
                    </div>
                  ),
              )}
            </div>
          ))}

          <button id="submit_button" type="button" disabled>
            {t("action.submit")}
          </button>
        </div>
      </main>
    </Layout>,
  );
};

export const handleNewEntitySubmit = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);
  if (!user) return c.body("Unauthorized", 401);

  const { entity_type, image_id, fields = {}, ...body } = await readJson<CreateEntityRequest>(c);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (name.length < 3 || name.length > 255 || description.length < 3 || description.length > 20000)
    return c.body(t("error.nameAndDescription"), 400);

  if (!cms.isType(entity_type) || typeof fields !== "object" || Array.isArray(fields))
    return c.body("Bad Request", 400);

  const imageId = image_id == null ? null : parseId(image_id);
  if (imageId === undefined) return c.body("Invalid image ID", 400);

  // Only images the user uploaded can be used
  if (imageId !== null && !await ownsImage(imageId, user.id)) return c.body("Image is unavailable", 400);

  // New entities start out as a pending version that a moderator has to approve
  try {
    const { entityId, versionId } = await cms.create(entity_type, {
      values: { ...fields, name, description, image_id: imageId },
      authorId: user.id,
    });
    return c.json({ id: versionId, entity_id: entityId } satisfies CreateEntityResponse);
  } catch (error) {
    if ((error as { code?: string }).code === "23503" && imageId !== null && !await ownsImage(imageId, user.id))
      return c.body("Image is unavailable", 400);
    return cmsErrorResponse(c, error);
  }
};
