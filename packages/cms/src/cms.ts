import type { ActivityOptions, AdapterFactory, HistoryOptions, NewVersion, Store } from "./adapter";
import { CmsError } from "./errors";
import { relationIds, withRelated } from "./populate";
import type {
  CheckCollection,
  Collections,
  CreateValues,
  EditValues,
  EntriesOf,
  Entry,
  EntrySummary,
  FindQuery,
  Reference,
  ReviewStatus,
  TitledVersion,
  Values,
} from "./types";
import { parseFields, sameValue } from "./values";

export type CmsOptions<C extends Collections<any>> = {
  db: AdapterFactory;
  // Checked like defineCollection, so unknown options in collections written here are errors too
  collections: C & { [K in keyof C]: CheckCollection<C[K]> };
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

export const createCMS = <const C extends Collections<any>>({ db, collections, review = true }: CmsOptions<C>) => {
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

  const create = <T extends Type>(
    type: T,
    { values, authorId = null }: { values: CreateValues<C, T> } & Actor,
  ) =>
    adapter.transaction(async (store) => {
      const parsed = await parseFields(collections[type].fields, values as Record<string, unknown>, "create", store);
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

  const propose = <T extends Type = Type>(
    entityId: number,
    {
      values,
      type,
      changeMessage = "",
      authorId = null,
      baseVersionId,
    }: {
      values: EditValues<C, T>;
      /** The entry's collection, which types the values and is checked */
      type?: T;
      changeMessage?: string;
      baseVersionId?: number;
    } & Actor,
  ) =>
    adapter.transaction(async (store) => {
      const lock = await store.lockEntity(entityId);
      if (!lock || (type !== undefined && lock.type !== type)) throw new CmsError("not_found");
      if (baseVersionId !== undefined && baseVersionId !== lock.headVersionId) throw new CmsError("stale");

      const current = await store.getEntry(entityId);
      if (!current) throw new CmsError("not_found");

      const parsed = await parseFields(collections[current.type].fields, values as Record<string, unknown>, "edit", store);
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

  // Replaces the IDs in relations with the entries they point to
  const populate = async (entries: Entry[]) => {
    const ids = new Set<number>();
    for (const entry of entries) relationIds(collections[entry.type].fields, entry.values, ids);
    if (ids.size === 0) return entries;

    const { items } = await adapter.find({ where: { id: { in: [...ids] } } });
    const related = new Map(items.map((item) => [item.entityId, item]));
    return entries.map((entry) => ({
      ...entry,
      values: withRelated(collections[entry.type].fields, entry.values, related),
    }));
  };

  const find = async <T extends Type = Type, P extends boolean = false>(
    query: FindQuery<T> & { populate?: P } = {},
  ) => {
    const { total, items } = await adapter.find(query);
    return {
      total,
      items: (query.populate ? await populate(items) : items) as EntriesOf<C, T, P>[],
    };
  };

  return {
    collections,
    types,
    isType,

    /** Brings the database up to date. Call this once before serving requests. */
    init: () => adapter.init(),

    /**
     * The current version of an entry, or the given one. With a type, only finds entries of
     * that collection, and their values are typed accordingly.
     */
    get: async <T extends Type = Type, P extends boolean = false>(
      entityId: number,
      { versionId, type, populate: withEntries }: { versionId?: number; type?: T; populate?: P } = {},
    ) => {
      const entry = await adapter.getEntry(entityId, versionId);
      if (!entry || (type !== undefined && entry.type !== type)) return;
      return (withEntries ? (await populate([entry]))[0] : entry) as EntriesOf<C, T, P>;
    },

    /** Current versions of entries, filtered and sorted by their values */
    find,

    /** Lists titles and IDs with the same filters as find. */
    list: <T extends Type = Type>(query: Omit<FindQuery<T>, "populate"> = {}) =>
      adapter.list(query) as Promise<EntrySummary<T>[]>,

    /** The current entry of a singleton collection */
    getSingle: async <T extends Type, P extends boolean = false>(type: T, options: { populate?: P } = {}) =>
      (await find<T, P>({ type, limit: 1, ...options })).items[0] as EntriesOf<C, T, P> | undefined,

    /** Creates the entry of a singleton collection, or changes it once it exists */
    saveSingle: async <T extends Type>(
      type: T,
      options: { values: CreateValues<C, T>; changeMessage?: string } & Actor,
    ) => {
      const entityId = await adapter.firstEntityId(type);
      if (!entityId) return create(type, options);
      return { entityId, versionId: await propose<T>(entityId, { ...options, type }) };
    },

    history: (entityId: number, limit = 100, options?: HistoryOptions) => adapter.history(entityId, limit, options),
    /** Versions waiting for review, of all collections */
    pending: (limit = 100, options?: { offset?: number; oldestFirst?: boolean }) =>
      adapter.pending(limit, options) as Promise<TitledVersion<Type>[]>,
    countPending: () => adapter.countPending(),
    /** The latest versions someone wrote, whatever their review status */
    activity: (authorId: number, limit = 10, options?: ActivityOptions) =>
      adapter.activity(authorId, limit, options) as Promise<TitledVersion<Type>[]>,
    /** Entries pointing at an entry, like the sets of a brand */
    referencing: (entityId: number, limit = 100, options?: { offset?: number }) =>
      adapter.referencing(entityId, limit, options) as Promise<Reference<Type>[]>,
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
     * Approves or rejects a pending version and returns the proposal that was reviewed.
     * Rejecting the first version of an entry deletes it and sets `deleted`.
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
      adapter.transaction(async (store): Promise<{ entry: EntriesOf<C, Type>; deleted?: EntriesOf<C, Type> }> => {
        const lock = await store.lockEntity(entityId);
        if (!lock) throw new CmsError("not_found");

        const entry = (await store.getEntry(entityId, versionId)) as EntriesOf<C, Type> | undefined;
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
          return { entry, deleted: entry };
        }
        if (status === "rejected" && collections[entry.type].versions === false)
          await store.pruneVersions(entityId);
        return { entry };
      }),

    /**
     * Deletes an entry with all its versions. Returns its current version, or its latest one
     * if it was never approved, so the app can clean up after it.
     */
    delete: (entityId: number) =>
      adapter.transaction(async (store) => {
        const lock = await store.lockEntity(entityId);
        if (!lock) throw new CmsError("not_found");

        const entry = await store.getEntry(entityId, lock.headVersionId ?? lock.latestVersionId);
        await store.deleteEntity(entityId);
        return entry as EntriesOf<C, Type>;
      }),
  };
};

export type Cms<C extends Collections<any>> = ReturnType<typeof createCMS<C>>;
