import { CmsError, type CmsErrorCode } from "@wikibricks/cms";
import { cms, fieldsOf } from "../../collections";
import { useTranslation, type Translations } from "../../translation";
import type { DefaultContext } from "../../utils";

type MessageKey = keyof Translations;

const responses: Record<CmsErrorCode, [status: 400 | 404 | 409, message: MessageKey]> = {
  not_found: [404, "error.pageNotFound"],
  invalid: [400, "error.invalidValue"],
  taken: [409, "error.valueTaken"],
  exists: [409, "error.entityExists"],
  stale: [409, "error.stale"],
  unchanged: [400, "error.unchanged"],
  already_reviewed: [409, "error.alreadyReviewed"],
};

// CMS errors only name the field, so its label is looked up in the collections.
const fieldLabel = (name: string) =>
  cms.types.map((type) => fieldsOf(type)[name]?.meta.label).find(Boolean);

/**
 * Answers a request that failed with a CMS error in the user's language. Anything else is rethrown.
 */
export const cmsErrorResponse = (
  c: DefaultContext,
  error: unknown,
  { messages = {}, invalidFields = {} }: {
    messages?: Partial<Record<CmsErrorCode, MessageKey>>;
    invalidFields?: Partial<Record<string, MessageKey>>;
  } = {},
) => {
  if (!(error instanceof CmsError)) throw error;

  const { t } = useTranslation(c);
  const [status, message] = responses[error.code];
  if (error.code === "taken" && error.field === "name") return c.body(t("error.nameTaken"), status);

  const fieldMessage = error.code === "invalid" && error.field && invalidFields[error.field];
  const label = error.field && fieldLabel(error.field);
  return c.body(t(fieldMessage || messages[error.code] || message, { field: label ? t(label) : (error.field ?? "") }), status);
};
