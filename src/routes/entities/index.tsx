import { flattendLeafCategories } from "../../categories";
import { InfoBox, InfoBoxImage, InfoBoxRow } from "../../components/info-box";
import {
  sql,
  type BrandView,
  type EntityType,
  type EntityViewType,
  type Image,
  type SetView,
  type WikiView,
} from "../../database";
import { Layout } from "../../layout";
import { removeImageFile } from "../../services/image-storage";
import type {
  EditEntityRequest,
  EntityEditField,
  ReviewVersionRequest,
} from "../../shared/contracts";
import { TranslationFunctions, useTranslation } from "../../translation";
import { PermissionLevel, type DefaultContext } from "../../utils";

/**
 * Defines an attribute for a given property.
 * Can either be a string label or an object that defines text, link and value formatter.
 */
type AttributeDefinition<T, K extends keyof T> =
  | string
  | {
      text: string;
      type: "number" | "string";
      link?: (value: T[K]) => string;
      validate?: (value: T[K]) => boolean;
      value: (value: T[K], obj: T) => T[K];
    };

/**
 * Defines a mapping of entity attribute keys to attribute definitions.
 */
export type EntityAttributes<E extends EntityType, Extra = {}> = Partial<{
  [P in keyof (EntityViewType<E> & Extra)]: AttributeDefinition<
    EntityViewType<E> & Extra,
    P
  >;
}>;

/**
 * Defines the info field configuration for all entity types.
 */
type InfoFields<
  Extra extends { [key in EntityType]?: any } = {
    set: { brand_name?: string };
  },
> = {
  [K in EntityType]: EntityAttributes<K, K extends keyof Extra ? Extra[K] : {}>;
};

/**
 * Defines the info fields for each entity type.
 */
export const getInfoFields = (t: TranslationFunctions["t"]) =>
  ({
    set: {
      pieces: {
        text: t("entity.pieces"),
        type: "number",
        value: (v, _) => v,
      },
      size: t("entity.size"),
      theme: {
        text: t("entity.theme"),
        type: "string",
        validate: (value) =>
          flattendLeafCategories.find((it) => it.id === value) !== undefined,
        value: (value) =>
          flattendLeafCategories.find((it) => it.id === value)?.name ?? "Error",
      },
      issued: {
        text: t("entity.issued"),
        type: "string",
        value: (value) => value,
        validate: (value) => {
          if (typeof value !== "string") return false;
          try {
            // YYYY
            if (/^\d{4}$/.test(value)) return true;
            // DD.MM.YYYY
            if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return true;
            // MM.YYYY
            if (/^\d{2}\.\d{4}$/.test(value)) return true;
            return false;
          } catch {
            return false;
          }
        },
      },
      brand_id: {
        text: t("entity.brand"),
        type: "number",
        link: (value) => `/entities/${value}`,
        value: (value, obj) => obj.brand_name || value,
      },
    },
    brand: {
      country: t("entity.country"),
      website: {
        text: t("entity.website"),
        type: "string",
        link: (value) => {
          const full = value.startsWith("http") ? value : `https://${value}`;

          try {
            new URL(full);
            return full;
          } catch {
            return "#";
          }
        },
        value: (value, _) => value,
      },
    },
    wiki: {},
  }) as InfoFields;

// Consolidate SQL query definitions per entity type to reduce duplications.
const queryMapping = {
  set: {
    defaultQuery: (db: typeof sql, entityId: string) => db<
      (SetView & { brand_name: string })[]
    >`
            SELECT s.*, e.name as brand_name
            FROM set_view s
            LEFT JOIN entities e ON s.brand_id = e.id
            WHERE s.id = ${entityId}`,
    versionQuery: (db: typeof sql, entityId: string, version: number) => db<
      (SetView & { brand_name: string })[]
    >`
            SELECT s.*, e.name as brand_name
            FROM set_versions_view s
            LEFT JOIN entities e ON s.brand_id = e.id
            WHERE s.id = ${entityId} AND s.version_id = ${version}`,
  },
  brand: {
    defaultQuery: (db: typeof sql, entityId: string) => db<BrandView[]>`
            SELECT * FROM brand_view WHERE id = ${entityId}`,
    versionQuery: (db: typeof sql, entityId: string, version: number) => db<BrandView[]>`
            SELECT * FROM brand_versions_view WHERE id = ${entityId} AND version_id = ${version}`,
  },
  wiki: {
    defaultQuery: (db: typeof sql, entityId: string) => db<WikiView[]>`
            SELECT * FROM wiki_view WHERE id = ${entityId}`,
    versionQuery: (db: typeof sql, entityId: string, version: number) => db<WikiView[]>`
            SELECT * FROM wiki_versions_view WHERE id = ${entityId} AND version_id = ${version}`,
  },
};

/**
 * Get an entity by ID and optionally version.
 * @param entityId The entity ID to fetch
 * @param version The version number to fetch
 * @returns The entity or null if not found
 */
const getEntity = async (entityId: string, version?: number, db = sql) => {
  const [entityInfo] = await db<{ type: string }[]>`
      SELECT type FROM entities WHERE id = ${entityId}
    `;

  if (!entityInfo) return null;

  const mapping = queryMapping[entityInfo.type as EntityType];
  if (!mapping) return null;

  const [entity] = await (version === undefined
    ? mapping.defaultQuery(db, entityId)
    : mapping.versionQuery(db, entityId, version));
  return entity;
};

const EntityInfoBox = <T extends EntityType>({
  entity,
  fields,
  editable,
  t,
}: {
  entity: EntityViewType<T>;
  fields: EntityAttributes<T>;
  editable: boolean;
  t: TranslationFunctions["t"];
}) => {
  return (
    <InfoBox title={entity.name}>
      <InfoBoxImage
        src={
          entity.image_id !== null
            ? `/images/serve/${entity.image_id}`
            : "https://placehold.co/800x800"
        }
        alt={t("entity.imageOf", { name: entity.name })}
      />

      {Object.entries(fields).map(([f, info]) => {
        const field = f as keyof EntityViewType<typeof entity.type>;

        if (!entity[field] && !editable) return null;

        return (
          <InfoBoxRow label={typeof info === "string" ? info : info.text}>
            {(() => {
              const value = entity[field];

              if (editable)
                return (
                  <input
                    class="flex-1 border-none outline-none h-6"
                    data-edit-field={field}
                    type={typeof value === "number" ? "number" : "text"}
                    value={value instanceof Date ? value.toISOString() : value}
                  />
                );

              if (typeof info === "string") return <span>{value}</span>;

              if (info.link)
                return (
                  <a href={info.link(value)}>{info.value(value, entity)}</a>
                );

              return <span>{info.value(value, entity)}</span>;
            })()}
          </InfoBoxRow>
        );
      })}
    </InfoBox>
  );
};

export const handleEntityPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const entityId = c.req.param("id");
  const { t } = useTranslation(c);

  // Possible query parameters for versioned entities and edit mode
  const version = c.req.query("version");
  const edit = c.req.query("edit") !== undefined;

  let versionNum: number | undefined;
  if (version !== undefined) {
    versionNum = parseInt(version, 10);
    if (!Number.isInteger(versionNum)) return c.notFound();
  }

  const entity = await getEntity(entityId, versionNum);

  if (!entity) return c.notFound();

  const isProposedVersion = entity.review_status === "pending";
  const isModerator =
    (user?.permission_level ?? 0) >= PermissionLevel.MODERATOR;
  const canEdit = !!user && edit && !isProposedVersion;
  const canReview = isProposedVersion && isModerator;
  const entityUrl = `/entities/${entity.id}`;

  // Define info box fields based on entity type
  const infoFields = getInfoFields(t)[entity.type];

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
            {!version
              ? entity.name
              : `${entity.name}: Version ${entity.version_number}`}
          </h1>
          <div class="space-x-2">
            {!isProposedVersion &&
              (canEdit ? (
                <a href={`/entities/${entity.id}`}>{t("entity.cancel")}</a>
              ) : user ? (
                <a href={`/entities/${entity.id}?edit`}>
                  {t("entity.editPage")}
                </a>
              ) : null)}
            <a href={`/entities/${entity.id}/history`}>
              {t("entity.versionHistory")}
            </a>
          </div>
        </div>

        {canEdit && (
          <div class="mb-3 pb-2 border-b flex items-center gap-2">
            <label class="flex items-center flex-1 space-x-1">
              <span>{t("entity.changeMessage")}</span>
              <input class="flex-1" id="change_message" />
            </label>

            <button id="save" type="button">{t("entity.save")}</button>
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

        {Object.keys(infoFields).length > 0 && (
          <EntityInfoBox
            t={t}
            editable={canEdit}
            entity={entity}
            fields={infoFields as EntityAttributes<typeof entity.type>}
          />
        )}

        <div
          contenteditable={canEdit}
          data-edit-field={canEdit ? "description" : undefined}
          class="text-pretty [&>ul]:mt-2 whitespace-pre-wrap"
        >
          {entity.description}
        </div>
      </main>
    </Layout>,
  );
};

const ALLOWED_EDIT_FIELDS = {
  set: ["pieces", "issued", "theme", "size", "brand_id"],
  brand: ["country", "website"],
  wiki: [],
} satisfies Record<EntityType, EntityEditField[]>;

const lockEntity = async (db: typeof sql, entityId: string) => {
  const [entity] = await db<{ head_version_id: number | null }[]>`
    SELECT head_version_id FROM entities WHERE id = ${entityId} FOR NO KEY UPDATE
  `;
  return entity;
};

export const handleEntityPageSubmit = async (c: DefaultContext) => {
  const user = c.get("user");
  const entityId = c.req.param("id");

  if (!user) return c.body("Unauthorized", 401);

  let parsed: unknown;
  try {
    parsed = await c.req.json();
  } catch {
    return c.body("Bad Request", 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return c.body("Bad Request", 400);
  }
  const { changeMessage, description, baseVersionId, ...data } =
    parsed as Partial<Record<keyof EditEntityRequest, unknown>>;
  if (
    typeof changeMessage !== "string" ||
    changeMessage.trim().length === 0 ||
    changeMessage.length > 2000 ||
    (baseVersionId !== undefined &&
      (typeof baseVersionId !== "number" || !Number.isInteger(baseVersionId) ||
        baseVersionId < 1 || baseVersionId > 2147483647)) ||
    (description !== undefined &&
      (typeof description !== "string" || description.length > 20000))
  ) {
    return c.body("Bad Request", 400);
  }

  try {
    return await sql.begin(async (tx) => {
      const current = await lockEntity(tx, entityId);
      if (!current) return c.notFound();
      if (baseVersionId !== undefined && baseVersionId !== current.head_version_id) {
        return c.body("The page has changed. Reload before submitting your edit.", 409);
      }
      const entity = await getEntity(entityId, undefined, tx);
      if (!entity) return c.notFound();

      const extra: Record<string, string | number> = {};
      const infoFields = getInfoFields(useTranslation(c).t)[entity.type] as Record<
        string,
        string | { validate?: (value: never) => boolean }
      >;
      for (const key of ALLOWED_EDIT_FIELDS[entity.type]) {
        const value = data[key];
        if (value === undefined || value === "") continue;
        if (key === "pieces" || key === "brand_id") {
          const numeric = typeof value === "string" && /^\d+$/.test(value)
            ? Number(value)
            : value;
          const min = key === "pieces" ? 0 : 1;
          const max = key === "pieces" ? 1000000 : 2147483647;
          if (typeof numeric !== "number" || !Number.isInteger(numeric) || numeric < min || numeric > max) {
            return c.body("Bad Request", 400);
          }
          extra[key] = numeric;
          continue;
        }

        const field = infoFields[key];
        const maxLength = entity.type === "brand" ? 255 : 64;
        if (
          typeof value !== "string" ||
          value.length > maxLength ||
          (typeof field !== "string" && field.validate && !field.validate(value as never))
        ) {
          return c.body("Bad Request", 400);
        }
        extra[key] = value;
      }

      const nextDescription = description ?? entity.description;
      const modified = Object.entries(extra).some(([key, value]) => {
        const original = entity[key as keyof typeof entity];
        return String(value) !== (original?.toString() ?? "");
      });
      if (!modified && nextDescription === entity.description) {
        return c.body("Bad Request", 400);
      }

      const [{ version_number }] = await tx<{ version_number: number }[]>`
        SELECT COALESCE(MAX(version_number), 0) + 1 AS version_number
        FROM entity_versions WHERE entity_id = ${entityId}
      `;
      const [image] = entity.image_id
        ? await tx<{ id: number }[]>`
            SELECT id FROM images WHERE id = ${entity.image_id} FOR KEY SHARE
          `
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

      if (entity.type === "set") {
        await tx`
          INSERT INTO sets ${tx({
            version_id: newVersionId,
            pieces: entity.pieces,
            issued: entity.issued,
            theme: entity.theme,
            size: entity.size,
            brand_id: entity.brand_id,
            manufacturer_id: entity.manufacturer_id,
            ...extra,
          })}
        `;
      } else if (entity.type === "brand") {
        await tx`
          INSERT INTO brands ${tx({
            version_id: newVersionId,
            country: entity.country,
            website: entity.website,
            ...extra,
          })}
        `;
      }
      return c.body("OK", 200);
    });
  } catch (err) {
    console.error("Entity update error:", err);
    return c.body("Something went wrong", 500);
  }
};

export const handleEntityVersionPatch = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user || user.permission_level < PermissionLevel.MODERATOR) {
    return c.body("Unauthorized", 401);
  }

  const entityId = c.req.param("id");
  const versionId = c.req.param("version");
  const version = Number(versionId);
  if (!entityId || !/^\d+$/.test(versionId) || version < 1 || version > 2147483647) {
    return c.body("Bad Request", 400);
  }

  let parsed: unknown;
  try {
    parsed = await c.req.json();
  } catch {
    return c.body("Bad Request", 400);
  }
  const { reviewMessage, type } =
    (parsed ?? {}) as Partial<Record<keyof ReviewVersionRequest, unknown>>;
  if (
    typeof reviewMessage !== "string" ||
    reviewMessage.trim().length === 0 ||
    reviewMessage.length > 2000 ||
    (type !== "approved" && type !== "rejected")
  ) {
    return c.body("Bad Request", 400);
  }

  try {
    const result = await sql.begin(async (tx): Promise<{
      status: 200 | 404 | 409;
      removedImage?: Image;
      message?: string;
    }> => {
      const current = await lockEntity(tx, entityId);
      if (!current) return { status: 404 };

      const entity = await getEntity(entityId, version, tx);
      if (!entity) return { status: 404 };
      if (entity.review_status !== "pending") return { status: 409 };

      if (
        type === "approved" &&
        (entity.previous_version ?? null) !== current.head_version_id
      ) {
        return {
          status: 409,
          message: "This proposal cannot be applied to the current version. Resubmit the edit from the current version.",
        };
      }

      const rejectInitial = type === "rejected" && current.head_version_id === null;
      let image: { id: number } | undefined;
      if (rejectInitial && entity.image_id && entity.created_by) {
        // Lock the image before deleting the entity. Attachments also lock this row.
        [image] = await tx<{ id: number }[]>`
          SELECT id FROM images
          WHERE id = ${entity.image_id} AND uploaded_by = ${entity.created_by}
          FOR UPDATE
        `;
      }

      const [reviewed] = await tx<{ id: number }[]>`
        UPDATE entity_versions
        SET review_status = ${type}, reviewed_at = NOW(), reviewed_by = ${user.id},
            review_comment = ${reviewMessage}
        WHERE id = ${entity.version_id} AND entity_id = ${entityId} AND review_status = 'pending'
        RETURNING id
      `;
      if (!reviewed) return { status: 409 };

      if (type === "approved") {
        await tx`UPDATE entities SET head_version_id = ${reviewed.id} WHERE id = ${entityId}`;
      }
      if (!rejectInitial) return { status: 200 };

      await tx`DELETE FROM entities WHERE id = ${entityId}`;
      if (!image) return { status: 200 };

      const [removedImage] = await tx<Image[]>`
        DELETE FROM images
        WHERE id = ${image.id}
          AND NOT EXISTS (SELECT 1 FROM entity_versions WHERE image_id = ${image.id})
        RETURNING *
      `;
      return { status: 200, removedImage };
    });

    if (result.status === 404) return c.notFound();
    if (result.status === 409) {
      return c.body(result.message ?? "This version has already been reviewed. Reload to see the result.", 409);
    }
    if (result.removedImage) await removeImageFile(result.removedImage);
    return c.body("OK", 200);
  } catch (err) {
    console.error("Review update error:", err);
    return c.body("Something went wrong", 500);
  }
};
