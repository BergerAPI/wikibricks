import type { Field } from "@wikibricks/cms";
import { cms, fieldsOf, type FieldUi, type WikiEntry } from "../../collections";
import { EntityFieldInput } from "../../components/entity-field";
import { InfoBox, InfoBoxImage, InfoBoxRow } from "../../components/info-box";
import { RichText, RichTextEditor } from "../../components/rich-text";
import { sql, type Image } from "../../database";
import { displayField, loadFieldOptions, loadRelationNames, type FieldOptions } from "../../fields";
import { Layout } from "../../layout";
import { removeImageFile } from "../../services/image-storage";
import type { EditEntityRequest, ReviewVersionRequest } from "../../shared/contracts";
import { useTranslation, type TranslationFunctions } from "../../translation";
import { getUsernames } from "../../users";
import { isModerator, parseId, readJson, routeParam, type DefaultContext } from "../../utils";
import { cmsErrorResponse } from "./errors";
import { ReviewNotice, VersionChanges } from "./review";

// Change and review messages are one-line summaries
const MAX_MESSAGE_LENGTH = 2000;

const EntityInfoBox = ({
  entry,
  fields,
  editable,
  options,
  relationNames,
  t,
}: {
  entry: WikiEntry;
  fields: Record<string, Field<FieldUi>>;
  editable: boolean;
  options: Record<string, FieldOptions>;
  relationNames: Record<string, string>;
  t: TranslationFunctions["t"];
}) => (
  <InfoBox title={entry.title ?? ""}>
    {entry.values.image_id && (
      <InfoBoxImage
        src={`/images/serve/${entry.values.image_id}`}
        alt={t("entity.imageOf", { name: entry.title ?? "" })}
      />
    )}

    {Object.entries(fields).map(([name, field]) => {
      const label = field.meta.label;
      const value = entry.values[name] == null ? "" : String(entry.values[name]);
      if (!label || (!value && !editable)) return null;

      if (editable)
        return (
          <InfoBoxRow label={t(label)}>
            <EntityFieldInput
              t={t}
              field={field}
              value={value}
              options={options[name]}
              required={field.required}
              class="block w-full"
              aria-label={t(label)}
              data-edit-field={name}
            />
          </InfoBoxRow>
        );

      const { text, href } = displayField(field, value, relationNames[name]);
      return (
        <InfoBoxRow label={t(label)}>
          {href ? <a href={href}>{text}</a> : <span>{text}</span>}
        </InfoBoxRow>
      );
    })}
  </InfoBox>
);

export const handleEntityPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const translation = useTranslation(c);
  const { t } = translation;

  const entityId = parseId(routeParam(c, "id"));
  const versionParam = c.req.query("version");
  const versionId = versionParam === undefined ? undefined : parseId(versionParam);
  if (!entityId || (versionParam !== undefined && !versionId)) return c.notFound();

  const entry = await cms.get(entityId, { versionId });
  if (!entry) return c.notFound();

  // Like in the history, unreviewed and rejected versions are only for moderators and their author
  if (entry.status !== "approved" && !isModerator(user) && entry.authorId !== user?.id)
    return c.notFound();

  const isProposal = entry.status === "pending";
  // Edits always start from the current version, otherwise saving fails with a conflict
  const canEdit = !!user && c.req.query("edit") !== undefined && !versionId;
  const canReview = isProposal && isModerator(user);
  const canDelete = isModerator(user) && !canEdit && !versionId;
  const entityUrl = `/entities/${entry.entityId}`;

  const fields = fieldsOf(entry.type);
  const [options, relationNames, references] = await Promise.all([
    canEdit ? loadFieldOptions(entry.type, entry.values) : {},
    loadRelationNames(entry, fields),
    cms.referencing(entry.entityId),
  ]);

  // A specific version is shown with its review and what it changed
  const previous = versionId && entry.previousVersionId
    ? await cms.get(entityId, { versionId: entry.previousVersionId })
    : undefined;
  const previousRelationNames = previous ? await loadRelationNames(previous, fields) : {};
  const reviewer = versionId && entry.reviewerId
    ? (await getUsernames([entry.reviewerId])).get(entry.reviewerId)
    : undefined;
  // Only a proposal based on the current version can be approved
  const isStale = canReview && entry.previousVersionId !== ((await cms.get(entityId))?.versionId ?? null);

  return c.render(
    <Layout
      context={c}
      user={user}
      script={canEdit ? "edit-entity" : canReview ? "review-entity" : canDelete ? "delete" : undefined}
    >
      <main
        class="flow-root"
        data-edit-url={canEdit ? entityUrl : undefined}
        data-base-version-id={canEdit ? entry.versionId : undefined}
        data-review-url={canReview ? `${entityUrl}/${entry.versionId}` : undefined}
        data-reject-reason={canReview ? t("review.rejectReason") : undefined}
        data-history-url={canEdit ? `${entityUrl}/history` : undefined}
      >
        <div class="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 pb-2 mb-3 border-b">
          <h1 class="text-3xl font-serif">
            {versionId ? `${entry.title}: ${t("entity.history.version")} ${entry.versionNumber}` : entry.title}
          </h1>
          <div class="flex flex-wrap items-center gap-x-4 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
            {!isProposal && canEdit && <a href={entityUrl}>{t("entity.cancel")}</a>}
            {!isProposal && !canEdit && user && (
              <a href={`${entityUrl}?edit`}>{t("entity.editPage")}</a>
            )}
            <a href={`${entityUrl}/history`}>{t("entity.versionHistory")}</a>
            {canDelete && (
              <button
                type="button"
                class="border-0 px-0 text-red-600 hover:underline"
                data-delete-url={entityUrl}
                data-delete-confirm={t("entity.confirmDelete")}
                data-delete-success={t("entity.deleteSuccess")}
                data-delete-failed={t("entity.deleteFailed")}
                data-delete-redirect="/entities/search"
              >
                {t("entity.delete")}
              </button>
            )}
          </div>
        </div>

        {canEdit && (
          <div class="mb-3 pb-2 border-b flex flex-wrap items-end gap-2">
            <label class="min-w-0 w-full sm:w-auto sm:flex-1 space-y-1">
              <span>{t("entity.changeMessage")}</span>
              <input class="block w-full" id="change_message" required maxlength={MAX_MESSAGE_LENGTH} />
            </label>
            <button id="save" type="button" disabled>
              {t("entity.save")}
            </button>
          </div>
        )}

        {versionId && <ReviewNotice entry={entry} reviewer={reviewer} translation={translation} />}

        {canReview && isStale && (
          <p class="mb-3 border border-red-400 bg-red-50 p-3">{t("review.stale")}</p>
        )}

        {canReview && (
          <div class="mb-3 pb-2 border-b flex flex-wrap items-end gap-2">
            <label class="min-w-0 w-full sm:w-auto sm:flex-1 space-y-1">
              <span>{t("entity.reviewMessage")}</span>
              <input class="block w-full" id="review_message" maxlength={MAX_MESSAGE_LENGTH} />
            </label>
            <button title={t("entity.approveTooltip")} id="approve" type="button" disabled={isStale}>
              {t("entity.approve")}
            </button>
            <button title={t("entity.rejectTooltip")} id="reject" type="button">
              {t("entity.reject")}
            </button>
          </div>
        )}

        {versionId && isProposal && !entry.previousVersionId && (
          <p class="mb-3">{t("review.newEntity")}</p>
        )}
        {previous && (
          <VersionChanges
            entry={entry}
            previous={previous}
            fields={fields}
            relationNames={relationNames}
            previousRelationNames={previousRelationNames}
            t={t}
          />
        )}

        {Object.values(fields).some((field) => field.meta.label) && (
          <EntityInfoBox
            t={t}
            editable={canEdit}
            entry={entry}
            fields={fields}
            options={options}
            relationNames={relationNames}
          />
        )}

        {canEdit
          ? <RichTextEditor id="description" name="description" value={entry.values.description} t={t} referenceUrl="/entities/options" />
          : <RichText value={entry.values.description} />}

        {references.length > 0 && (
          <section class="clear-both pt-4">
            <h2 class="text-xl font-serif pb-1 mb-2 border-b">{t("entity.referencedBy")}</h2>
            <ul>
              {references.map((reference) => (
                <li>
                  {t(`entityType.${reference.type}`)}:{" "}
                  <a href={`/entities/${reference.entityId}`}>{reference.title}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </Layout>,
  );
};

export const handleEntityPageSubmit = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user) return c.body("Unauthorized", 401);

  const entityId = parseId(routeParam(c, "id"));
  if (!entityId) return c.notFound();

  const { changeMessage, description, baseVersionId, fields = {} } = await readJson<EditEntityRequest>(c);

  if (
    typeof changeMessage !== "string" ||
    !changeMessage.trim() ||
    changeMessage.length > MAX_MESSAGE_LENGTH ||
    (baseVersionId !== undefined && !parseId(baseVersionId)) ||
    (description !== undefined && typeof description !== "string") ||
    typeof fields !== "object" ||
    Array.isArray(fields)
  )
    return c.body("Bad Request", 400);

  try {
    await cms.propose(entityId, {
      values: description === undefined ? fields : { ...fields, description },
      changeMessage,
      authorId: user.id,
      baseVersionId: baseVersionId === undefined ? undefined : parseId(baseVersionId),
    });
    return c.body("OK", 200);
  } catch (error) {
    return cmsErrorResponse(c, error);
  }
};

// The image of a deleted or rejected entry goes too, unless another entry uses it
const deleteUnusedImage = async (entry: WikiEntry) => {
  const imageId = parseId(entry.values.image_id);
  if (!imageId || !entry.authorId || (await cms.isReferenced("images", imageId))) return;

  const [image] = await sql<Image[]>`
    DELETE FROM images WHERE id = ${imageId} AND uploaded_by = ${entry.authorId} RETURNING *
  `;
  if (image) await removeImageFile(image);
};

export const handleEntityDelete = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user || !isModerator(user)) return c.body("Unauthorized", 401);

  const entityId = parseId(routeParam(c, "id"));
  if (!entityId) return c.notFound();

  try {
    await deleteUnusedImage(await cms.delete(entityId));
    return c.body("OK", 200);
  } catch (error) {
    return cmsErrorResponse(c, error);
  }
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
    reviewMessage.length > MAX_MESSAGE_LENGTH ||
    (type !== "approved" && type !== "rejected")
  )
    return c.body("Bad Request", 400);

  // The author of a rejected change should learn what to do differently
  if (type === "rejected" && !reviewMessage.trim())
    return c.body(useTranslation(c).t("review.rejectReason"), 400);

  try {
    const { deleted } = await cms.review(entityId, versionId, {
      status: type,
      comment: reviewMessage,
      reviewerId: user.id,
    });
    if (deleted) await deleteUnusedImage(deleted);
    return c.body("OK", 200);
  } catch (error) {
    return cmsErrorResponse(c, error, { stale: "error.staleProposal" });
  }
};
