import { parseId } from "@wikibricks/cms";
import { createWikiCMS, type WikiEntry } from "../collections";
import { recordAudit, sql } from "../database";
import { entityPath } from "../urls";
import { deleteUnusedImage, preparePublishedImage } from "./image-storage";

const deleteEntryImage = async (entry: WikiEntry) => {
  const imageId = parseId(entry.values.image_id);
  if (imageId && entry.authorId) await deleteUnusedImage(imageId, entry.authorId);
};

export const deleteEntity = async (entityId: number, actorId: number) => {
  const deleted = await sql.begin(async (tx) => {
    const entry = await createWikiCMS(tx).delete(entityId);
    await recordAudit(tx, {
      actorId, action: "entity_deleted", subject: entry.title ?? `#${entityId}`, details: entry.type,
    });
    return entry;
  });
  await deleteEntryImage(deleted).catch((error) => console.error("Could not clean up the deleted entry's image:", error));
};

export const reviewVersion = async (
  entityId: number,
  versionId: number,
  { reviewerId, status, comment }: { reviewerId: number; status: "approved" | "rejected"; comment: string },
) => {
  const { deleted, imageId } = await sql.begin(async (tx) => {
    const cms = createWikiCMS(tx);
    const { entry, deleted } = await cms.review(entityId, versionId, { status, comment, reviewerId });
    await recordAudit(tx, {
      actorId: reviewerId,
      userId: entry.authorId,
      action: status === "approved" ? "version_approved" : "version_rejected",
      subject: entry.title ?? `#${entityId}`,
      path: !deleted ? `${entityPath(entry)}?version=${versionId}` : undefined,
      details: comment.trim(),
    });
    return { deleted, imageId: status === "approved" ? parseId(entry.values.image_id) : undefined };
  });

  if (deleted)
    await deleteEntryImage(deleted).catch((error) => console.error("Could not clean up the rejected entry's image:", error));
  if (imageId)
    await preparePublishedImage(imageId).catch((error) => console.error("Could not prepare sizes for approved image:", error));
};
