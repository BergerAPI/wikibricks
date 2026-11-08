import type {
  Collections,
  Entry,
  FindQuery,
  Reference,
  ReviewStatus,
  ScalarValue,
  TitledVersion,
  Values,
  Version,
} from "./types";

export type NewVersion = {
  entityId: number;
  versionNumber: number;
  authorId: number | null;
  /** The version this one is based on. Fields missing from `values`, lists included, are carried over from it. */
  previousVersionId: number | null;
  changeMessage: string;
  values: Values;
};

/**
 * Storage operations used inside transactions. The CMS builds its workflow on these,
 * so an adapter only has to store and load, never decide.
 */
export interface Store {
  /** The current version of an entry, or the given one */
  getEntry(entityId: number, versionId?: number): Promise<Entry | undefined>;
  /** Locks an entry against concurrent changes until the transaction ends */
  lockEntity(entityId: number): Promise<{ type: string; headVersionId: number | null } | undefined>;
  /** Waits for and holds a lock on any name until the transaction ends */
  lock(key: string): Promise<void>;
  /** The collection of an entry, if it exists */
  entityType(entityId: number): Promise<string | undefined>;
  /** Any entry of a type, also one still waiting for its first approval */
  firstEntityId(type: string): Promise<number | undefined>;
  /**
   * Whether another entry uses a value in a field. Counts the current version of entries,
   * and the first version of entries that are still waiting for approval.
   */
  isTaken(type: string, field: string, value: ScalarValue, exceptEntityId?: number): Promise<boolean>;
  insertEntity(type: string): Promise<number>;
  insertVersion(type: string, version: NewVersion): Promise<number>;
  nextVersionNumber(entityId: number): Promise<number>;
  /** Returns false when the version was not pending anymore */
  setReview(
    entityId: number,
    versionId: number,
    review: { status: ReviewStatus; reviewerId: number | null; comment: string },
  ): Promise<boolean>;
  setHead(entityId: number, versionId: number): Promise<void>;
  /** Deletes all reviewed versions of an entry except its current one */
  pruneVersions(entityId: number): Promise<void>;
  deleteEntity(entityId: number): Promise<void>;
}

export interface DatabaseAdapter extends Store {
  /** Brings the database up to date with the collections */
  init(): Promise<void>;
  transaction<T>(run: (store: Store) => Promise<T>): Promise<T>;

  /** Current versions of entries. Throws CmsError "invalid" for unknown keys. */
  find(query: FindQuery): Promise<{ total: number; items: Entry[] }>;
  history(entityId: number, limit: number): Promise<{ title: string | null; versions: Version[] } | undefined>;
  pending(limit: number): Promise<TitledVersion[]>;
  activity(authorId: number, limit: number): Promise<TitledVersion[]>;
  /** Entries whose current version points at an entry, through any of their relations */
  referencing(entityId: number, limit: number): Promise<Reference[]>;
  /** Whether any version still points at a row of a table outside the CMS */
  isReferenced(table: string, id: number): Promise<boolean>;
}

/** Adapters are created with the collections they store */
export type AdapterFactory = (collections: Collections<unknown>) => DatabaseAdapter;
