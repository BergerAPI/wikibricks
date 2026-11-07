import { EntityFieldInput } from "../../components/entity-field";
import { InfoBox, InfoBoxImage, InfoBoxRow } from "../../components/info-box";
import { sql, type EntityView, type Image, type Queryable } from "../../database";
import {
  displayField,
  entityDefinitions,
  loadFieldOptions,
  loadReferenceNames,
  parseFields,
  type EntityTypeDefinition,
  type FieldOption,
} from "../../entity-types";
import { Layout } from "../../layout";
import { removeImageFile } from "../../services/image-storage";
import {
  isEntityType,
  type EditEntityRequest,
  type ReviewVersionRequest,
} from "../../shared/contracts";
import { useTranslation, type TranslationFunctions } from "../../translation";
import { isModerator, parseId, readJson, routeParam, type DefaultContext } from "../../utils";

/**
 * Loads an entity in its current version, or in the given version if one is passed.
 */
const getEntity = async (entityId: number, versionId?: number, db: Queryable = sql) => {
  const [info] = await db<{ type: string }[]>`SELECT type FROM entities WHERE id = ${entityId}`;
  if (!info || !isEntityType(info.type)) return;

  // Every entity type has a view for its current version and one for all versions
  const [entity] = await (versionId === undefined
    ? db<EntityView[]>`SELECT * FROM ${db(`${info.type}_view`)} WHERE id = ${entityId}`
    : db<EntityView[]>`
        SELECT * FROM ${db(`${info.type}_versions_view`)}
        WHERE id = ${entityId} AND version_id = ${versionId}
      `);
  return entity;
};

const lockEntity = async (db: Queryable, entityId: number) => {
  const [entity] = await db<{ head_version_id: number | null }[]>`
    SELECT head_version_id FROM entities WHERE id = ${entityId} FOR NO KEY UPDATE
  `;
  return entity;
};

const EntityInfoBox = ({
  entity,
  definition,
  editable,
  options,
  references,
  t,
}: {
  entity: EntityView;
  definition: EntityTypeDefinition;
  editable: boolean;
  options: Record<string, FieldOption[]>;
  references: Record<string, string>;
  t: TranslationFunctions["t"];
}) => (
  <InfoBox title={entity.name}>
    <InfoBoxImage
      src={entity.image_id ? `/images/serve/${entity.image_id}` : "https://placehold.co/800x800"}
      alt={t("entity.imageOf", { name: entity.name })}
    />

    {Object.entries(definition.fields).map(([key, field]) => {
      const value = entity[key] == null ? "" : String(entity[key]);
      if (!value && !editable) return null;

      if (editable)
        return (
          <InfoBoxRow label={t(field.label)}>
            <EntityFieldInput
              t={t}
              field={field}
              value={value}
              options={options[key]}
              class="flex-1 border-none outline-none h-6"
              data-edit-field={key}
            />
          </InfoBoxRow>
        );

      const { text, href } = displayField(field, value, references[key]);
      return (
        <InfoBoxRow label={t(field.label)}>
          {href ? <a href={href}>{text}</a> : <span>{text}</span>}
        </InfoBoxRow>
      );
    })}
  </InfoBox>
);

export const handleEntityPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  const entityId = parseId(routeParam(c, "id"));
  const versionParam = c.req.query("version");
  const versionId = versionParam === undefined ? undefined : parseId(versionParam);
  if (!entityId || (versionParam !== undefined && !versionId)) return c.notFound();

  const entity = await getEntity(entityId, versionId);
  if (!entity) return c.notFound();

  const isProposal = entity.review_status === "pending";
  const canEdit = !!user && c.req.query("edit") !== undefined && !isProposal;
  const canReview = isProposal && isModerator(user);
  const entityUrl = `/entities/${entity.id}`;

  const definition = entityDefinitions[entity.type];
  const [options, references] = await Promise.all([
    canEdit ? loadFieldOptions(definition.fields) : {},
    loadReferenceNames(entity, definition.fields),
  ]);

  return c.render(
    <Layout
      context={c}
      user={user}
      script={canEdit ? "edit-entity" : canReview ? "review-entity" : undefined}
    >
      <main
        class="overflow-auto"
        data-edit-url={canEdit ? entityUrl : undefined}
        data-base-version-id={canEdit ? entity.version_id : undefined}
        data-review-url={canReview ? `${entityUrl}/${entity.version_id}` : undefined}
        data-history-url={canEdit || canReview ? `${entityUrl}/history` : undefined}
      >
        <div class="flex justify-between items-center pb-2 mb-3 border-b">
          <h1 class="text-3xl font-serif">
            {versionId ? `${entity.name}: Version ${entity.version_number}` : entity.name}
          </h1>
          <div class="space-x-2">
            {!isProposal && canEdit && <a href={entityUrl}>{t("entity.cancel")}</a>}
            {!isProposal && !canEdit && user && (
              <a href={`${entityUrl}?edit`}>{t("entity.editPage")}</a>
            )}
            <a href={`${entityUrl}/history`}>{t("entity.versionHistory")}</a>
          </div>
        </div>

        {canEdit && (
          <div class="mb-3 pb-2 border-b flex items-center gap-2">
            <label class="flex items-center flex-1 space-x-1">
              <span>{t("entity.changeMessage")}</span>
              <input class="flex-1" id="change_message" />
            </label>
            <button id="save" type="button">
              {t("entity.save")}
            </button>
          </div>
        )}

        {canReview && (
          <div class="mb-3 pb-2 border-b flex items-center gap-2">
            <label class="flex items-center flex-1 space-x-1">
              <span>{t("entity.reviewMessage")}</span>
              <input class="flex-1" id="review_message" />
            </label>
            <button title={t("entity.approveTooltip")} id="approve" type="button">
              {t("entity.approve")}
            </button>
            <button title={t("entity.rejectTooltip")} id="reject" type="button">
              {t("entity.reject")}
            </button>
          </div>
        )}

        {Object.keys(definition.fields).length > 0 && (
          <EntityInfoBox
            t={t}
            editable={canEdit}
            entity={entity}
            definition={definition}
            options={options}
            references={references}
          />
        )}

        <div
          contenteditable={canEdit}
          data-edit-description={canEdit ? "" : undefined}
          class="text-pretty [&>ul]:mt-2 whitespace-pre-wrap"
        >
          {entity.description}
        </div>
      </main>
    </Layout>,
  );
};

export const handleEntityPageSubmit = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user) return c.body("Unauthorized", 401);

  const entityId = parseId(routeParam(c, "id"));
  if (!entityId) return c.notFound();

  const { changeMessage, description, baseVersionId, fields } = await readJson<EditEntityRequest>(c);

  if (
    typeof changeMessage !== "string" ||
    !changeMessage.trim() ||
    (baseVersionId !== undefined && !parseId(baseVersionId)) ||
    (description !== undefined && typeof description !== "string")
  )
    return c.body("Bad Request", 400);

  return sql.begin(async (tx) => {
    const current = await lockEntity(tx, entityId);
    if (!current) return c.notFound();
    if (baseVersionId !== undefined && baseVersionId !== current.head_version_id)
      return c.body("The page has changed. Reload before submitting your edit.", 409);

    const entity = await getEntity(entityId, undefined, tx);
    if (!entity) return c.notFound();

    const definition = entityDefinitions[entity.type];
    const parsed = await parseFields(definition, fields, false, tx);
    if ("error" in parsed) return c.body(parsed.error, 400);

    const nextDescription = description ?? entity.description;
    const changed = Object.entries(parsed.values).some(
      ([key, value]) => String(value) !== String(entity[key] ?? ""),
    );
    if (!changed && nextDescription === entity.description) return c.body("Bad Request", 400);

    const [{ version_number }] = await tx<{ version_number: number }[]>`
      SELECT COALESCE(MAX(version_number), 0) + 1 AS version_number
      FROM entity_versions WHERE entity_id = ${entityId}
    `;
    // The image may have been deleted in the meantime, and the lock keeps it from going away now
    const [image] = entity.image_id
      ? await tx<{ id: number }[]>`SELECT id FROM images WHERE id = ${entity.image_id} FOR KEY SHARE`
      : [];

    const [{ id: newVersionId }] = await tx<{ id: number }[]>`
      INSERT INTO entity_versions ${tx({
        entity_id: entityId,
        version_number,
        created_by: user.id,
        previous_version: entity.version_id,
        change_message: changeMessage,
        description: nextDescription,
        image_id: image?.id ?? null,
        review_status: "pending",
      })}
      RETURNING id
    `;

    if (definition.table) {
      // Copy every column of the previous version, including ones without a field
      const [previous] = await tx<Record<string, unknown>[]>`
        SELECT * FROM ${tx(definition.table)} WHERE version_id = ${entity.version_id}
      `;
      const { version_id: _, created_at: __, ...columns } = previous ?? {};

      await tx`
        INSERT INTO ${tx(definition.table)}
        ${tx({ ...columns, ...parsed.values, version_id: newVersionId })}
      `;
    }

    return c.body("OK", 200);
  });
};

export const handleEntityVersionPatch = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user || !isModerator(user)) return c.body("Unauthorized", 401);

  const entityId = parseId(routeParam(c, "id"));
  const versionId = parseId(routeParam(c, "version"));
  if (!entityId || !versionId) return c.body("Bad Request", 400);

  const { reviewMessage, type } = await readJson<ReviewVersionRequest>(c);

  if (
    typeof reviewMessage !== "string" ||
    !reviewMessage.trim() ||
    reviewMessage.length > 2000 ||
    (type !== "approved" && type !== "rejected")
  )
    return c.body("Bad Request", 400);

  const alreadyReviewed = () =>
    c.body("This version has already been reviewed. Reload to see the result.", 409);

  let removedImage: Image | undefined;

  const response = await sql.begin(async (tx) => {
    const current = await lockEntity(tx, entityId);
    if (!current) return c.notFound();

    const entity = await getEntity(entityId, versionId, tx);
    if (!entity) return c.notFound();
    if (entity.review_status !== "pending") return alreadyReviewed();

    if (type === "approved" && (entity.previous_version ?? null) !== current.head_version_id)
      return c.body(
        "This proposal cannot be applied to the current version. Resubmit the edit from the current version.",
        409,
      );

    const [reviewed] = await tx<{ id: number }[]>`
      UPDATE entity_versions
      SET review_status = ${type}, reviewed_at = NOW(), reviewed_by = ${user.id},
          review_comment = ${reviewMessage}
      WHERE id = ${entity.version_id} AND entity_id = ${entityId} AND review_status = 'pending'
      RETURNING id
    `;
    if (!reviewed) return alreadyReviewed();

    if (type === "approved")
      await tx`UPDATE entities SET head_version_id = ${reviewed.id} WHERE id = ${entityId}`;

    // Rejecting the first version of an entity removes the entity, and its image if nothing else uses it
    if (type === "rejected" && current.head_version_id === null) {
      const [image] =
        entity.image_id && entity.created_by
          ? await tx<{ id: number }[]>`
              SELECT id FROM images
              WHERE id = ${entity.image_id} AND uploaded_by = ${entity.created_by}
              FOR UPDATE
            `
          : [];

      await tx`DELETE FROM entities WHERE id = ${entityId}`;

      if (image)
        [removedImage] = await tx<Image[]>`
          DELETE FROM images
          WHERE id = ${image.id}
            AND NOT EXISTS (SELECT 1 FROM entity_versions WHERE image_id = ${image.id})
          RETURNING *
        `;
    }

    return c.body("OK", 200);
  });

  // The file can only go once the transaction has been committed
  if (removedImage) await removeImageFile(removedImage);
  return response;
};
