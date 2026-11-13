import { cms, fieldsOf } from "../../collections";
import { EntityFieldInput } from "../../components/entity-field";
import { Notice, PageTitle } from "../../components/ui";
import { RichTextEditor } from "../../components/rich-text";
import { Select } from "../../components/select";
import { loadFieldOptions } from "../../fields";
import { Layout } from "../../layout";
import { ownsImage } from "../../services/image-storage";
import type { CreateEntityResponse } from "../../shared/contracts";
import { useTranslation } from "../../translation";
import { is, readJson, type DefaultContext } from "../../utils";
import { cmsErrorResponse } from "./errors";

export const handleNewEntityPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, url } = useTranslation(c);

  const { pathname, search } = new URL(c.req.url);
  if (!user) return c.redirect(`${url("/login")}?redirect=${encodeURIComponent(pathname + search)}`);

  // Listings of one type link here with that type
  const requested = c.req.query("type") ?? "";
  const selected = cms.isType(requested) ? requested : cms.types[0];

  const options = await Promise.all(
    cms.types.map((type) => loadFieldOptions(type)),
  );

  return c.render(
    <Layout context={c} title={t("entities.addNew")} page="new-entity" noindex>
      <main data-create-url="/entities/new" data-upload-url="/images/upload">
        <PageTitle>{t("entities.addNew")}</PageTitle>
        <Notice tone="error" id="error" role="alert" />

        <div>
          <div class="mb-3">
            <label for="entity_type" class="font-semibold">{t("entities.entityTypeLabel")}</label>
            <Select t={t} class="mt-1 block w-full" name="entity_type" id="entity_type">
              {cms.types.map((type) => (
                <option value={type} selected={type === selected}>{t(`entityType.${type}`)}</option>
              ))}
            </Select>
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
              class={`tab-content ${type === selected ? "" : "hidden"}`}
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

          <button id="submit_button" type="button" class="button-primary" disabled>
            {t("action.submit")}
          </button>
        </div>
      </main>
    </Layout>,
  );
};

const createRequest = {
  entity_type: is.oneOf(...cms.types),
  name: is.text(),
  description: is.text(),
  image_id: is.nullable(is.id),
  fields: is.optional(is.fields),
};

export const handleNewEntitySubmit = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user) return c.body("Unauthorized", 401);

  const request = await readJson(c, createRequest);
  if (!request) return c.text("Bad Request", 400);
  const { entity_type, image_id: imageId, fields, name, description } = request;

  // Only images the user uploaded can be used
  if (imageId !== null && !await ownsImage(imageId, user.id)) return c.body("Image is unavailable", 400);

  // New entities start out as a pending version that a moderator has to approve
  try {
    const { entityId, versionId } = await cms.create(entity_type, {
      values: { ...fields, name: name.trim(), description: description.trim(), image_id: imageId },
      authorId: user.id,
    });
    return c.json({ id: versionId, entity_id: entityId } satisfies CreateEntityResponse);
  } catch (error) {
    if ((error as { code?: string }).code === "23503" && imageId !== null && !await ownsImage(imageId, user.id))
      return c.body("Image is unavailable", 400);
    return cmsErrorResponse(c, error, {
      invalidFields: { name: "error.nameAndDescription", description: "error.nameAndDescription" },
    });
  }
};
