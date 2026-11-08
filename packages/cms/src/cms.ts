import type { AdapterFactory, NewVersion, Store } from "./adapter";
import { CmsError } from "./errors";
import type { Collections, Entry, FindQuery, Reference, ReviewStatus, Values } from "./types";
import { parseFields, sameValue } from "./values";

export type CmsOptions<C extends Collections<any>> = {
  db: AdapterFactory;
  collections: C;
  /**
   * Whether new versions wait for someone to approve them, which is the default.
   * Collections can override it. Without review, every change is published right away.
   */
  review?: boolean;
};

/**
 * Who makes a change. Optional everywhere, for content without accounts,
 * like a site whose content is only changed by its owner.
 */
type Actor = { authorId?: number | null };

export const createCMS = <C extends Collections<any>>({ db, collections, review = true }: CmsOptions<C>) => {
  type Type = keyof C & string;

  const adapter = db(collections);
  const types = Object.keys(collections) as Type[];

  for (const [type, collection] of Object.entries(collections)) {
    const title = collection.title ? collection.fields[collection.title] : undefined;
    if (collection.title && title?.type !== "text")
      throw new Error(`The title of ${type} has to be one of its text fields`);
  }

  const isType = (value: unknown): value is Type =>
    typeof value === "string" && Object.hasOwn(collections, value);

  const reviews = (type: string) => collections[type].review ?? review;

  // Locks every checked value, so two entries can't take the same one at the same time
  const checkUnique = async (store: Store, type: string, values: Values, entityId?: number) => {
    for (const [name, field] of Object.entries(collections[type].fields)) {
      const value = values[name];
      if (!field.unique || value === undefined || value === null || Array.isArray(value)) continue;

      await store.lock(`unique:${type}.${name}`);
      if (await store.isTaken(type, name, value, entityId)) throw new CmsError("taken", name);
    }
  };

  // Makes a version the current one, dropping older ones for collections without history
  const publish = async (store: Store, type: string, entityId: number, versionId: number) => {
    await store.setHead(entityId, versionId);
    if (collections[type].versions === false) await store.pruneVersions(entityId);
  };

  // Stores a version, and publishes it straight away for collections without review
  const addVersion = async (store: Store, type: string, version: NewVersion) => {
    const versionId = await store.insertVersion(type, version);

    if (!reviews(type)) {
      await store.setReview(version.entityId, versionId, { status: "approved", reviewerId: null, comment: "" });
      await publish(store, type, version.entityId, versionId);
    }
    return versionId;
  };

  const create = (type: Type, { values, authorId = null }: { values: Record<string, unknown> } & Actor) =>
    adapter.transaction(async (store) => {
      const parsed = await parseFields(collections[type].fields, values, "create", store);
      await checkUnique(store, type, parsed);

      if (collections[type].singleton) {
        await store.lock(`singleton:${type}`);
        if (await store.firstEntityId(type)) throw new CmsError("exists");
      }

      const entityId = await store.insertEntity(type);
      const versionId = await addVersion(store, type, {
        entityId,
        versionNumber: 1,
        authorId,
        previousVersionId: null,
        changeMessage: "",
        values: parsed,
      });
      return { entityId, versionId };
    });

  const propose = (
    entityId: number,
    {
      values,
      changeMessage = "",
      authorId = null,
      baseVersionId,
    }: { values: Record<string, unknown>; changeMessage?: string; baseVersionId?: number } & Actor,
  ) =>
    adapter.transaction(async (store) => {
      const lock = await store.lockEntity(entityId);
      if (!lock) throw new CmsError("not_found");
      if (baseVersionId !== undefined && baseVersionId !== lock.headVersionId) throw new CmsError("stale");

      const current = await store.getEntry(entityId);
      if (!current) throw new CmsError("not_found");

      const parsed = await parseFields(collections[current.type].fields, values, "edit", store);
      const changed = Object.fromEntries(
        Object.entries(parsed).filter(([name, value]) => !sameValue(value, current.values[name])),
      );
      if (Object.keys(changed).length === 0) throw new CmsError("unchanged");
      await checkUnique(store, current.type, changed, entityId);

      return addVersion(store, current.type, {
        entityId,
        versionNumber: await store.nextVersionNumber(entityId),
        authorId,
        previousVersionId: current.versionId,
        changeMessage,
        values: parsed,
      });
    });

  const find = async (query: FindQuery<Type> = {}) =>
    (await adapter.find(query)) as { total: number; items: Entry<Type>[] };

  return {
    collections,
    types,
    isType,

    /** Brings the database up to date. Call this once before serving requests. */
    init: () => adapter.init(),

    get: (entityId: number, versionId?: number) =>
      adapter.getEntry(entityId, versionId) as Promise<Entry<Type> | undefined>,

    /** Current versions of entries, filtered and sorted by their values */
    find,

    /** The current entry of a singleton collection */
    getSingle: async (type: Type) => (await find({ type, limit: 1 })).items[0],

    /** Creates the entry of a singleton collection, or changes it once it exists */
    saveSingle: async (
      type: Type,
      options: { values: Record<string, unknown>; changeMessage?: string } & Actor,
    ) => {
      const entityId = await adapter.firstEntityId(type);
      return entityId ? { entityId, versionId: await propose(entityId, options) } : create(type, options);
    },

    history: (entityId: number, limit = 100) => adapter.history(entityId, limit),
    /** Versions waiting for review, of all collections */
    pending: (limit = 100) => adapter.pending(limit),
    activity: (authorId: number, limit = 10) => adapter.activity(authorId, limit),
    /** Entries pointing at an entry, like the sets of a brand */
    referencing: (entityId: number, limit = 100) =>
      adapter.referencing(entityId, limit) as Promise<Reference<Type>[]>,
    isReferenced: (table: string, id: number) => adapter.isReferenced(table, id),

    /**
     * Creates an entry. Its first version waits for review, unless the collection has no review.
     */
    create,

    /**
     * Changes the current version of an entry. The change waits for review, unless the collection
     * has no review. With `baseVersionId`, fails with "stale" if the entry changed since that version.
     */
    propose,

    /**
     * Approves or rejects a pending version. Rejecting the first version of an entry
     * deletes the entry, which is returned as `deleted`.
     */
    review: (
      entityId: number,
      versionId: number,
      {
        status,
        comment = "",
        reviewerId = null,
      }: { status: Exclude<ReviewStatus, "pending">; comment?: string; reviewerId?: number | null },
    ) =>
      adapter.transaction(async (store): Promise<{ deleted?: Entry<Type> }> => {
        const lock = await store.lockEntity(entityId);
        if (!lock) throw new CmsError("not_found");

        const entry = (await store.getEntry(entityId, versionId)) as Entry<Type> | undefined;
        if (!entry) throw new CmsError("not_found");
        if (entry.status !== "pending") throw new CmsError("already_reviewed");

        if (status === "approved") {
          // Only a proposal based on the current version can replace it
          if (entry.previousVersionId !== lock.headVersionId) throw new CmsError("stale");
          // Another entry may have taken a unique value while this one was waiting
          await checkUnique(store, entry.type, entry.values, entityId);
        }

        if (!(await store.setReview(entityId, versionId, { status, reviewerId, comment })))
          throw new CmsError("already_reviewed");

        if (status === "approved") await publish(store, entry.type, entityId, versionId);

        if (status === "rejected" && lock.headVersionId === null) {
          await store.deleteEntity(entityId);
          return { deleted: entry };
        }
        if (status === "rejected" && collections[entry.type].versions === false)
          await store.pruneVersions(entityId);
        return {};
      }),
  };
};

export type Cms<C extends Collections<any>> = ReturnType<typeof createCMS<C>>;
