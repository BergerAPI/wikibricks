export type CmsErrorCode =
  /** The entry or version doesn't exist */
  | "not_found"
  /** A value or query key is missing or invalid, `field` says which */
  | "invalid"
  /** Another entry already has this value in a unique field, `field` says which */
  | "taken"
  /** The singleton collection already has its entry */
  | "exists"
  /** The entry changed since the version the request is based on */
  | "stale"
  /** An edit that doesn't change anything */
  | "unchanged"
  /** The version was reviewed already */
  | "already_reviewed";

export class CmsError extends Error {
  constructor(
    readonly code: CmsErrorCode,
    readonly field?: string,
  ) {
    super(field ? `${code}: ${field}` : code);
  }
}
