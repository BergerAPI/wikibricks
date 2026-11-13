import type { Field } from "@wikibricks/cms";
import { cms, fieldsOf, type FieldUi, type WikiEntry } from "../../collections";
import { TypeBrick } from "../../components/bricks";
import { EntityFieldInput } from "../../components/entity-field";
import { ChangedValue, RichText, RichTextEditor } from "../../components/rich-text";
import { InfoBox, InfoBoxImage, InfoBoxRow, Notice, PageTitle } from "../../components/ui";
import { getUsernames } from "../../database";
import { displayField, loadFieldOptions, loadRelationNames, type FieldOptions } from "../../fields";
import { Layout } from "../../layout";
import { summarize } from "../../markdown";
import { getImageUrl, imageWidths } from "../../services/image-files";
import { MAX_MESSAGE_LENGTH } from "../../shared/contracts";
import { fill, useTranslation, type TranslationFunctions } from "../../translation";
import { entityPath, parseEntityId } from "../../urls";
import { isModerator, parseId, routeParam, type DefaultContext } from "../../utils";

// Entries linking here beyond these are on a page of their own
const REFERENCES_SHOWN = 20;

const EntityInfoBox = ({
  entry,
  fields,
  editable,
  options,
  relationNames,
  previous,
  previousRelationNames,
  t,
  url,
}: {
  entry: WikiEntry;
  fields: Record<string, Field<FieldUi>>;
  editable: boolean;
  options: Record<string, FieldOptions>;
  relationNames: Record<string, string>;
  previous?: WikiEntry;
  previousRelationNames: Record<string, string>;
  t: TranslationFunctions["t"];
  url: TranslationFunctions["url"];
}) => {
  const imageId = parseId(entry.values.image_id);
  const previousImageId = parseId(previous?.values.image_id);
  const imageSize = entry.status === "approved" ? imageWidths.small : undefined;
  return (
    <InfoBox title={entry.title ?? ""}>
      {previous && previousImageId !== imageId ? (
        <tr>
          <td colspan={2}>
            <div class="grid grid-cols-2 items-center gap-2 [&>del]:p-1 [&>ins]:p-1">
              <ChangedValue
                before={previousImageId ? <img src={getImageUrl(previousImageId, imageWidths.small)} alt={t("review.before")} loading="lazy" /> : null}
                after={imageId ? <img src={getImageUrl(imageId, imageSize)} alt={t("review.after")} loading="lazy" /> : null}
                beforeLabel={t("review.before")}
                afterLabel={t("review.after")}
              />
            </div>
          </td>
        </tr>
      ) : imageId && (
        <InfoBoxImage
          src={getImageUrl(imageId, imageSize)}
          srcset={imageSize ? `${getImageUrl(imageId, imageWidths.large)} 2x` : undefined}
          alt={t("entity.imageOf", { name: entry.title ?? "" })}
        />
      )}

      {Object.entries(fields).map(([name, field]) => {
        const label = field.meta.label;
        const value = entry.values[name] == null ? "" : String(entry.values[name]);
        const previousValue = String(previous?.values[name] ?? "");
        const changed = !!previous && previousValue !== value;
        if (!label || (!value && !editable && !changed)) return null;

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

        const show = (value: string, relationName?: string) => {
          if (!value) return null;
          const { text, href } = displayField(field, value, relationName);
          return href ? <a href={href.startsWith("/") ? url(href) : href}>{text}</a> : text;
        };
        const current = show(value, relationNames[name]);
        return (
          <InfoBoxRow label={t(label)}>
            {changed
              ? <ChangedValue before={show(previousValue, previousRelationNames[name])} after={current} beforeLabel={t("review.before")} afterLabel={t("review.after")} />
              : current}
          </InfoBoxRow>
        );
      })}
    </InfoBox>
  );
};

// The names of the entities a description links to, for the addresses of those links
const loadLinkedNames = async (description: string) => {
  const ids = [...new Set(Array.from(description.matchAll(/\]\(\/entities\/(\d+)\)/g), (match) => Number(match[1])))];
  const items = ids.length > 0 ? await cms.list({ where: { id: { in: ids } } }) : [];
  return new Map(items.map((item) => [item.entityId, item.title]));
};

export const handleEntityPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const translation = useTranslation(c);
  const { t, url } = translation;

  const entityId = parseEntityId(routeParam(c, "id"));
  const versionParam = c.req.query("version");
  const versionId = versionParam === undefined ? undefined : parseId(versionParam);
  if (!entityId || (versionParam !== undefined && !versionId)) return c.notFound();

  const entry = await cms.get(entityId, { versionId });
  if (!entry) return c.notFound();

  // Like in the history, unreviewed and rejected versions are only for moderators and their author
  if (entry.status !== "approved" && !isModerator(user) && entry.authorId !== user?.id)
    return c.notFound();

  // The name in the address follows the current name, old addresses lead to the new one
  const entityUrl = url(entityPath(entry));
  if (!versionId && c.req.path !== entityUrl) return c.redirect(entityUrl + new URL(c.req.url).search, 301);

  const editUrl = `${entityUrl}?edit`;
  const loginUrl = `${url("/login")}?redirect=${encodeURIComponent(editUrl)}`;
  if (!user && c.req.query("edit") !== undefined) return c.redirect(loginUrl);

  const isProposal = entry.status === "pending";
  // Edits always start from the current version, otherwise saving fails with a conflict
  const canEdit = !!user && c.req.query("edit") !== undefined && !versionId;
  const canReview = isProposal && isModerator(user);
  const canDelete = isModerator(user) && !canEdit && !versionId;
  // Requests of the page scripts go by the ID alone
  const requestUrl = `/entities/${entry.entityId}`;

  const fields = fieldsOf(entry.type);
  const [options, relationNames, references, linkedNames] = await Promise.all([
    canEdit ? loadFieldOptions(entry.type, entry.values) : {},
    loadRelationNames(entry, fields),
    cms.referencing(entry.entityId, REFERENCES_SHOWN + 1),
    loadLinkedNames(entry.values.description),
  ]);
  // Links to entities are stored by ID and shown with the language and current name
  const link = (href: string) => {
    const id = parseEntityId(href.match(/^\/entities\/(\d+)$/)?.[1] ?? "");
    return url(id ? entityPath({ entityId: id, title: linkedNames.get(id) }) : href);
  };

  // A specific version is shown with its review and what it changed
  const previous = versionId && entry.previousVersionId
    ? await cms.get(entityId, { versionId: entry.previousVersionId })
    : undefined;
  const previousRelationNames = previous ? await loadRelationNames(previous, fields) : {};
  const imageChanged = previous && previous.values.image_id !== entry.values.image_id;
  const reviewer = versionId && entry.reviewerId
    ? (await getUsernames([entry.reviewerId])).get(entry.reviewerId)
    : undefined;
  // Only a proposal based on the current version can be approved
  const isStale = canReview && entry.previousVersionId !== ((await cms.get(entityId))?.versionId ?? null);

  return c.render(
    <Layout
      context={c}
      title={`${entry.title}`}
      description={summarize(entry.values.description)}
      noindex={entry.status !== "approved" || !!versionId || canEdit}
      page={canEdit ? "edit-entity" : canReview ? "review-entity" : canDelete ? "delete" : undefined}
    >
      <main
        class="flow-root"
        data-edit-url={canEdit ? requestUrl : undefined}
        data-base-version-id={canEdit ? entry.versionId : undefined}
        data-review-url={canReview ? `${requestUrl}/versions/${entry.versionId}` : undefined}
        data-reject-reason={canReview ? t("review.rejectReason") : undefined}
        data-history-url={canEdit ? `${entityPath(entry)}/history` : undefined}
      >
        <a
          href={url(`/entities/search?entity_type=${entry.type}`)}
          class="inline-flex min-h-11 items-center gap-1.5 text-sm"
        >
          <TypeBrick type={entry.type} class="h-3" />
          {t(`entityType.${entry.type}`)}
        </a>
        <PageTitle
          actions={<>
            {!isProposal && canEdit && <a href={entityUrl}>{t("entity.cancel")}</a>}
            {versionId && entry.status === "approved" && <a href={entityUrl}>{t("entity.currentVersion")}</a>}
            {!isProposal && !canEdit && <a href={user ? editUrl : loginUrl}>{t("entity.editPage")}</a>}
            <a href={`${entityUrl}/history`}>{t("entity.versionHistory")}</a>
            {canDelete && (
              <button
                type="button"
                class="button-link text-red-700"
                data-delete-url={requestUrl}
                data-delete-confirm={t("entity.confirmDelete")}
                data-delete-success={t("entity.deleteSuccess")}
                data-delete-failed={t("entity.deleteFailed")}
                data-delete-redirect="/entities/search"
              >
                {t("entity.delete")}
              </button>
            )}
          </>}
        >
            {previous && previous.title
              ? <ChangedValue before={previous.title} after={entry.title} beforeLabel={t("review.before")} afterLabel={t("review.after")} />
              : entry.title}
            {versionId && `: ${t("entity.history.version")} ${entry.versionNumber}`}
        </PageTitle>

        {(canEdit || canReview) && <Notice tone="error" id="error" role="alert" />}

        {canEdit && (
          <div class="mb-3 pb-2 border-b flex flex-wrap items-end gap-2">
            <label class="min-w-0 w-full sm:w-auto sm:flex-1 space-y-1">
              <span>{t("entity.changeMessage")}</span>
              <input class="block w-full" id="change_message" required maxlength={MAX_MESSAGE_LENGTH} />
            </label>
            <button id="save" type="button" class="button-primary" disabled>
              {t("entity.save")}
            </button>
          </div>
        )}

        {/* Where the version stands in review: still waiting, or who decided on it and why */}
        {versionId && (isProposal || reviewer) && (
          <Notice tone={({ pending: "warning", approved: "success", rejected: "error" } as const)[entry.status]}>
            <p class="font-semibold">
              {fill(t(`review.${entry.status}`), {
                reviewer: reviewer ?? "",
                date: entry.reviewedAt ? translation.formatDate(entry.reviewedAt) : "",
              })}
            </p>
            {entry.reviewComment && <p class="mt-1 whitespace-pre-wrap">{entry.reviewComment}</p>}
          </Notice>
        )}

        {canReview && isStale && <Notice tone="error">{t("review.stale")}</Notice>}

        {canReview && (
          <div class="mb-3 pb-2 border-b flex flex-wrap items-end gap-2">
            <label class="min-w-0 w-full sm:w-auto sm:flex-1 space-y-1">
              <span>{t("entity.reviewMessage")}</span>
              <input class="block w-full" id="review_message" maxlength={MAX_MESSAGE_LENGTH} />
            </label>
            <button title={t("entity.approveTooltip")} id="approve" type="button" class="button-primary" disabled={isStale} data-locked={isStale || undefined}>
              {t("entity.approve")}
            </button>
            <button title={t("entity.rejectTooltip")} id="reject" type="button" class="button-secondary">
              {t("entity.reject")}
            </button>
          </div>
        )}

        {versionId && isProposal && !entry.previousVersionId && (
          <p class="mb-3">{t("review.newEntity")}</p>
        )}
        {(entry.values.image_id || imageChanged || Object.values(fields).some((field) => field.meta.label)) && (
          <EntityInfoBox
            t={t}
            url={url}
            editable={canEdit}
            entry={entry}
            fields={fields}
            options={options}
            relationNames={relationNames}
            previous={previous}
            previousRelationNames={previousRelationNames}
          />
        )}

        {canEdit
          ? <RichTextEditor id="description" name="description" value={entry.values.description} t={t} referenceUrl="/entities/options" />
          : <RichText value={entry.values.description} link={link} previous={previous ? { value: previous.values.description, t } : undefined} />}

        {references.length > 0 && (
          <section class="clear-both pt-4">
            <h2 class="text-xl font-serif pb-1 mb-2 border-b">{t("entity.referencedBy")}</h2>
            <ul>
              {references.slice(0, REFERENCES_SHOWN).map((reference) => (
                <li>
                  {t(`entityType.${reference.type}`)}:{" "}
                  <a href={url(entityPath(reference))}>{reference.title}</a>
                </li>
              ))}
            </ul>
            {references.length > REFERENCES_SHOWN && (
              <a href={`${url(entityPath(entry))}/references`} class="inline-flex min-h-11 items-center">{t("action.seeAll")}</a>
            )}
          </section>
        )}
      </main>
    </Layout>,
  );
};
