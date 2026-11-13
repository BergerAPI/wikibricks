import { cms } from "../../collections";
import { ownsImage } from "../../services/image-storage";
import { MAX_MESSAGE_LENGTH } from "../../shared/contracts";
import { useTranslation } from "../../translation";
import { is, isModerator, parseId, readJson, routeParam, type DefaultContext } from "../../utils";
import { deleteEntity, reviewVersion } from "../../services/entity-moderation";
import { cmsErrorResponse } from "./errors";

const editRequest = {
  changeMessage: is.text({ max: MAX_MESSAGE_LENGTH, required: true }),
  description: is.optional(is.text()),
  baseVersionId: is.optional(is.id),
  fields: is.optional(is.fields),
};

const reviewRequest = {
  type: is.oneOf("approved", "rejected"),
  reviewMessage: is.text({ max: MAX_MESSAGE_LENGTH }),
};

export const handleEntityPageSubmit = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user) return c.body("Unauthorized", 401);

  const entityId = parseId(routeParam(c, "id"));
  if (!entityId) return c.notFound();

  const request = await readJson(c, editRequest);
  if (!request) return c.text("Bad Request", 400);
  const { changeMessage, description, baseVersionId, fields = {} } = request;

  const imageId = fields.image_id ? parseId(fields.image_id) : undefined;
  if (fields.image_id && (!imageId || !await ownsImage(imageId, user.id))) return c.body("Image is unavailable", 400);

  try {
    await cms.propose(entityId, {
      values: description === undefined ? fields : { ...fields, description },
      changeMessage,
      authorId: user.id,
      baseVersionId,
    });
    return c.body("OK", 200);
  } catch (error) {
    if ((error as { code?: string }).code === "23503" && imageId && !await ownsImage(imageId, user.id))
      return c.body("Image is unavailable", 400);
    return cmsErrorResponse(c, error);
  }
};

export const handleEntityDelete = async (c: DefaultContext) => {
  const user = c.get("user");
  if (!user || !isModerator(user)) return c.body("Unauthorized", 401);

  const entityId = parseId(routeParam(c, "id"));
  if (!entityId) return c.notFound();

  try {
    await deleteEntity(entityId, user.id);
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

  const request = await readJson(c, reviewRequest);
  if (!request) return c.text("Bad Request", 400);
  const { reviewMessage, type } = request;

  // The author of a rejected change should learn what to do differently
  if (type === "rejected" && !reviewMessage.trim())
    return c.body(useTranslation(c).t("review.rejectReason"), 400);

  try {
    await reviewVersion(entityId, versionId, {
      status: type,
      comment: reviewMessage,
      reviewerId: user.id,
    });
    return c.body("OK", 200);
  } catch (error) {
    return cmsErrorResponse(c, error, { messages: { stale: "error.staleProposal" } });
  }
};
