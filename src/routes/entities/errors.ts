import { CmsError, type CmsErrorCode } from "@wikibricks/cms";
import type { DefaultContext } from "../../utils";

const responses: Record<CmsErrorCode, [status: 400 | 404 | 409, message: string]> = {
  not_found: [404, "Not Found"],
  invalid: [400, "Invalid value"],
  taken: [409, "This value is already used by another entity"],
  exists: [409, "This entity already exists"],
  stale: [409, "The page has changed. Reload before submitting your edit."],
  unchanged: [400, "Nothing was changed"],
  already_reviewed: [409, "This version has already been reviewed. Reload to see the result."],
};

/**
 * Answers a request that failed with a CMS error. Anything else is rethrown.
 */
export const cmsErrorResponse = (
  c: DefaultContext,
  error: unknown,
  messages: Partial<Record<CmsErrorCode, string>> = {},
) => {
  if (!(error instanceof CmsError)) throw error;

  const [status, message] = responses[error.code];
  if (error.code === "invalid") return c.body(`Validation failed for ${error.field}`, status);
  if (error.code === "taken" && error.field === "name")
    return c.body("An entity with this name already exists", status);
  return c.body(messages[error.code] ?? message, status);
};
