import { flattendLeafCategories } from "../../categories";
import { InfoBox, InfoBoxImage, InfoBoxRow } from "../../components/info-box";
import {
  sql,
  type BrandView,
  type EntityType,
  type EntityViewType,
  type SetView,
  type WikiView,
} from "../../database";
import { Layout } from "../../layout";
import { deleteImage } from "../../services/image-storage";
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
    defaultQuery: (entityId: string) => sql<
      (SetView & { brand_name: string })[]
    >`
            SELECT s.*, e.name as brand_name
            FROM set_view s
            LEFT JOIN entities e ON s.brand_id = e.id
            WHERE s.id = ${entityId}`,
    versionQuery: (entityId: string, version: number) => sql<
      (SetView & { brand_name: string })[]
    >`
            SELECT s.*, e.name as brand_name
            FROM set_versions_view s
            LEFT JOIN entities e ON s.brand_id = e.id
            WHERE s.id = ${entityId} AND s.version_id = ${version}`,
  },
  brand: {
    defaultQuery: (entityId: string) => sql<BrandView[]>`
            SELECT * FROM brand_view WHERE id = ${entityId}`,
    versionQuery: (entityId: string, version: number) => sql<BrandView[]>`
            SELECT * FROM brand_versions_view WHERE id = ${entityId} AND version_id = ${version}`,
  },
  wiki: {
    defaultQuery: (entityId: string) => sql<WikiView[]>`
            SELECT * FROM wiki_view WHERE id = ${entityId}`,
    versionQuery: (entityId: string, version: number) => sql<WikiView[]>`
            SELECT * FROM wiki_versions_view WHERE id = ${entityId} AND version_id = ${version}`,
  },
};

/**
 * Get an entity by ID and optionally version.
 * @param entityId The entity ID to fetch
 * @param version The version number to fetch
 * @returns The entity or null if not found
 */
const getEntity = async (entityId: string, version?: number) => {
  const [entityInfo] = await sql<{ type: string }[]>`
      SELECT type FROM entities WHERE id = ${entityId}
    `;

  if (!entityInfo) return null;

  const mapping = queryMapping[entityInfo.type as EntityType];
  if (!mapping) return null;

  return await sql
    .begin(async (_) => {
      return version
        ? await mapping.versionQuery(entityId, version)
        : await mapping.defaultQuery(entityId);
    })
    .then((result) => result[0]);
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
                    field={field}
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

  // Define info box fields based on entity type
  const infoFields = getInfoFields(t)[entity.type];

  return c.render(
    <Layout context={c} user={user}>
      <main class="overflow-auto">
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
          <>
            <div class="mb-3 pb-2 border-b flex items-center gap-2">
              <label class="flex items-center flex-1 space-x-1">
                <span>{t("entity.changeMessage")}</span>
                <input class="flex-1" id="change_message" />
              </label>

              <button id="save">{t("entity.save")}</button>
            </div>

            <script
              dangerouslySetInnerHTML={{
                __html: `
// When the user clicks the save button
document.getElementById('save').addEventListener('click', async () => {
    const data = {}

    document.querySelectorAll("[field]").forEach(it => {
        const field = it.getAttribute('field');

        if (it.nodeName === 'INPUT')
            data[field] = it.value;
        else
            data[field] = it.innerText;
    });

    const changeMessage = document.getElementById('change_message').value;
    data.changeMessage = changeMessage;

    fetch(\`/entities/${entity.id}\`, {
        method: 'POST',
        redirect: "follow",
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(it => {
        window.location.href = "/entities/${entity.id}/history"
    });
});
`,
              }}
            />
          </>
        )}

        {isProposedVersion && isModerator && (
          <>
            <div class="mb-3 pb-2 border-b flex items-center gap-2">
              <label class="flex items-center flex-1 space-x-1">
                <span>{t("entity.reviewMessage")}</span>
                <input class="flex-1" id="review_message" />
              </label>

              <button title={t("entity.approveTooltip")} id="approve">
                {t("entity.approve")}
              </button>
              <button title={t("entity.rejectTooltip")} id="reject">
                {t("entity.reject")}
              </button>
            </div>

            <script
              dangerouslySetInnerHTML={{
                __html: `
const reviewVersion = (type) => {
    const reviewMessage = document.getElementById('review_message').value;

    fetch("/entities/${entity.id}/${entity.version_id}", {
        method: 'PATCH',
        redirect: "follow",
        body: JSON.stringify({
            type,
            reviewMessage: reviewMessage.length > 0 ? reviewMessage : "No Change Message"
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(it => {
      if (type === "approved") {
        window.location.href = "/entities/${entity.id}/history"
      } else {
        window.location.href = "/changes"
      }
    });
};

// When the user approves a change
document.getElementById('approve').addEventListener('click', () => {
    reviewVersion("approved")
});

// When the user rejects a change
document.getElementById('reject').addEventListener('click', () => {
    reviewVersion("rejected")
});
                    `,
              }}
            />
          </>
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
          field="description"
          class="text-pretty [&>ul]:mt-2 whitespace-pre-wrap"
        >
          {entity.description}
        </div>
      </main>
    </Layout>,
  );
};

const ALLOWED_EDIT_FIELDS: Record<string, string[]> = {
  set: ["pieces", "issued", "theme", "size", "brand_id", "description"],
  brand: ["country", "website", "description"],
  wiki: ["description"],
};

export const handleEntityPageSubmit = async (c: DefaultContext) => {
  const user = c.get("user");
  const entityId = c.req.param("id");

  if (!user) return c.body("Unauthorized", 401);

  const entity = await getEntity(entityId);

  if (!entity) return c.notFound();

  let parsed: unknown;
  try {
    parsed = await c.req.json();
  } catch {
    return c.body("Bad Request", 400);
  }
  const { changeMessage, ...data } = (parsed ?? {}) as Record<string, unknown>;

  if (
    typeof changeMessage !== "string" ||
    changeMessage.trim().length === 0 ||
    changeMessage.length > 2000
  ) {
    return c.body("Bad Request", 400);
  }

  const allowed = ALLOWED_EDIT_FIELDS[entity.type] ?? ["description"];
  const filtered: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = (data as Record<string, unknown>)[key];
    if (value !== undefined && String(value).length > 0) {
      filtered[key] = value;
    }
  }

  if (typeof filtered.description !== "string") {
    filtered.description = entity.description;
  }
  if (String(filtered.description).length > 20000) {
    return c.body("Bad Request", 400);
  }

  // Reuse view validation for editable fields (without translation dependency)
  const noT = ((key: string) => key) as Parameters<typeof getInfoFields>[0];
  const infoFields = getInfoFields(noT)[entity.type as keyof ReturnType<typeof getInfoFields>] as Record<
    string,
    string | { validate?: (v: never) => boolean }
  >;
  for (const [key, value] of Object.entries(filtered)) {
    if (key === "description") continue;
    const def = infoFields[key];
    if (!def) return c.body("Bad Request", 400);
    if (
      typeof def !== "string" &&
      typeof def.validate === "function" &&
      !def.validate(value as never)
    ) {
      return c.body("Bad Request", 400);
    }
  }

  // Update the entity with the new data
  const modifiedFields = Object.entries(filtered).filter(([key, value]) => {
    const original = entity[key as keyof typeof entity];
    return String(value) !== (original?.toString() ?? "");
  });

  if (modifiedFields.length === 0) return c.body("Bad Request", 400);

  const nextVersionNumber = Number(entity.version_number) + 1;
  if (!Number.isInteger(nextVersionNumber)) return c.body("Bad Request", 400);

  try {
    await sql.begin(async (tx) => {
      const [{ id: newVersionId }] = await tx<{ id: number }[]>`
        INSERT INTO entity_versions ${tx({
          entity_id: entityId,
          version_number: nextVersionNumber,
          created_by: user.id,
          change_message: changeMessage,
          description: String(filtered.description),
          review_status: "pending",
        })}
            RETURNING id;
        `;

      const extra = Object.fromEntries(
        Object.entries(filtered).filter(([k]) => k !== "description"),
      );
      if (entity.type === "set") {
        await tx`
            INSERT INTO sets ${tx({
              version_id: newVersionId,
              ...extra,
            })}`;
      } else if (entity.type === "brand") {
        await tx`
            INSERT INTO brands ${tx({
              version_id: newVersionId,
              ...extra,
            })}`;
      }
    });
  } catch (err) {
    console.error("Entity update error:", err);
    return c.body("Something went wrong", 500);
  }

  return c.body("OK", 200);
};

export const handleEntityVersionPatch = async (c: DefaultContext) => {
  const user = c.get("user");

  if (!user || user.permission_level < PermissionLevel.MODERATOR)
    return c.body("Unauthorized", 401);

  const entityId = c.req.param("id");
  const versionId = c.req.param("version");

  if (!entityId || !versionId) return c.body("Bad Request", 400);

  const versionNum = parseInt(versionId, 10);
  if (!Number.isInteger(versionNum)) return c.body("Bad Request", 400);

  const entity = await getEntity(entityId, versionNum);

  if (!entity) return c.notFound();

  if (entity.review_status !== "pending") return c.body("Bad Request", 400);

  let parsed: unknown;
  try {
    parsed = await c.req.json();
  } catch {
    return c.body("Bad Request", 400);
  }
  const { reviewMessage, type } = (parsed ?? {}) as Record<string, unknown>;

  if (
    typeof reviewMessage !== "string" ||
    reviewMessage.length === 0 ||
    reviewMessage.length > 2000 ||
    !["approved", "rejected"].includes(String(type))
  )
    return c.body("Bad Request", 400);

  try {
    await sql.begin(async (tx) => {
      // Noting that the version has been review with the provided status
      await tx`
        UPDATE entity_versions SET review_status = ${String(type)}, reviewed_at = NOW(), reviewed_by = ${user.id}, review_comment = ${reviewMessage} WHERE id = ${entity.version_id} AND entity_id = ${entity.id} AND review_status = 'pending'
    `;

      if (type === "rejected") {
        // Deleting the entire entity if the first version was rejected
        // First, attempt to delete the entity if head_version_id is null
        const result = await tx`
        DELETE FROM entities WHERE id = ${entity.id} AND head_version_id IS NULL;
    `;

        // If the entity was deleted and it had an image, delete the image as well
        if (result.count > 0 && entity.image_id) {
          await deleteImage(entity.image_id);
        }
        return;
      }

      // Setting the HEAD-id when approved
      await tx`
        UPDATE entities SET head_version_id = ${entity.version_id} WHERE id = ${entity.id}
    `;
    });
  } catch (err) {
    console.error("Review update error:", err);
    return c.body("Something went wrong", 500);
  }

  return c.body("OK", 200);
};
