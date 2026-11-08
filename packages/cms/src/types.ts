type MetaOption<M> = undefined extends M ? { meta?: M } : { meta: M };

/**
 * What a field stores and how its values are checked.
 * - text: a string, at most maxLength characters if given
 * - number: an integer
 * - boolean: true or false
 * - date: a day as "YYYY-MM-DD", or with `time` a moment as an ISO 8601 string
 * - select: one of the given options
 * - relation: the ID of an entry of one of the given collections, or with `many` a list of IDs
 * - external: the ID of a row in a table the CMS doesn't manage, like uploaded files
 * - array: a list of items that all have the same fields
 * - blocks: a list of items of different kinds, like the sections of a page
 */
export type FieldType<M = undefined> =
  | { type: "text"; maxLength?: number }
  | { type: "number" }
  | { type: "boolean" }
  | { type: "date"; time?: boolean }
  | { type: "select"; options: readonly string[] }
  | { type: "relation"; to: string | readonly string[]; many?: boolean }
  | { type: "external"; table: string }
  | { type: "array"; fields: Fields<M> }
  | { type: "blocks"; blocks: readonly Block<M>[] };

/**
 * A field of a collection or block. `meta` is ignored by the CMS and holds whatever the
 * app needs to present the field, like labels.
 */
export type Field<M = undefined> = FieldType<M> & {
  /** Has to be filled in when an entry is created and can't be cleared later */
  required?: boolean;
  /** No two entries of the collection may have the same value. Only for fields of collections. */
  unique?: boolean;
  /** An extra check on top of the type's own, given a single value as a string */
  validate?: (value: string) => boolean;
} & MetaOption<M>;

export type Fields<M = undefined> = Record<string, Field<M>>;

/**
 * A kind of item in a blocks field. Blocks can be used by several fields and collections.
 */
export type Block<M = undefined> = {
  /** Identifies the block in values, as their `block` property */
  slug: string;
  /** Name of the block's table or equivalent, defaults to "block_" and the slug */
  dbName?: string;
  fields: Fields<M>;
} & MetaOption<M>;

export type Collection<M = undefined> = {
  /** Name of the collection's table or equivalent, defaults to the collection name */
  dbName?: string;
  fields: Fields<M>;
  /** The text field that names an entry in listings, like in search results or the review queue */
  title?: string;
  /** Whether changes wait for approval. Defaults to the CMS's setting. */
  review?: boolean;
  /** Whether older versions are kept once a newer one is published, which is the default */
  versions?: boolean;
  /** A collection with exactly one entry, like site settings */
  singleton?: boolean;
};

export type Collections<M = undefined> = Record<string, Collection<M>>;

export type ScalarValue = string | number | boolean | null;

/** An item of an array field, or of a blocks field with its kind in `block` */
export type Item = { block?: string; [field: string]: FieldValue | undefined };

export type FieldValue = ScalarValue | number[] | Item[];
export type Values = Record<string, FieldValue>;

/** Whether a field holds a list of items instead of a single value */
export const isListField = <M>(field: Field<M>): field is Field<M> & { type: "array" | "blocks" } =>
  field.type === "array" || field.type === "blocks";

/** Whether a field relates to any number of entries */
export const isManyRelation = <M>(field: Field<M>): field is Field<M> & { type: "relation"; many: true } =>
  field.type === "relation" && !!field.many;

/** Whether a field holds one value, as opposed to a list of items or entries */
export const isSingleValue = <M>(field: Field<M>) => !isListField(field) && !isManyRelation(field);

/** The collections a relation may point to */
export const targetsOf = (field: { to: string | readonly string[] }): readonly string[] =>
  typeof field.to === "string" ? [field.to] : field.to;

/**
 * A condition on one value: a value to equal, or operators that all have to hold.
 * `contains` matches text case-insensitively.
 */
export type Condition =
  | ScalarValue
  | {
      eq?: ScalarValue;
      ne?: ScalarValue;
      in?: ScalarValue[];
      notIn?: ScalarValue[];
      contains?: string;
      gt?: string | number;
      gte?: string | number;
      lt?: string | number;
      lte?: string | number;
      exists?: boolean;
    };

/**
 * Conditions on the fields of a collection, which all have to hold. Besides fields, these
 * keys are known: id, type, title, createdAt (of the entry) and updatedAt (of its version).
 * On relations to many entries, a value or `in` matches entries relating to any of the given
 * IDs, and `exists` entries relating to any entry at all.
 */
export type Where = {
  and?: Where[];
  or?: Where[];
  [key: string]: Condition | Where[] | undefined;
};

export type FindQuery<T extends string = string> = {
  /** Without a type, finds entries of all collections, filtered only by the keys every entry has */
  type?: T;
  where?: Where;
  /** Keys to sort by, descending when prefixed with "-". Defaults to the newest entries first. */
  sort?: string | string[];
  limit?: number;
  offset?: number;
};

export type ReviewStatus = "pending" | "approved" | "rejected";

/**
 * One version of an entry. Every change creates a new version, which becomes the
 * current one once it has been approved.
 */
export type Version = {
  versionId: number;
  entityId: number;
  versionNumber: number;
  status: ReviewStatus;
  authorId: number | null;
  previousVersionId: number | null;
  changeMessage: string;
  reviewerId: number | null;
  reviewComment: string;
  reviewedAt: Date | null;
  createdAt: Date;
};

/** An entry in a given version, with the values of its collection's fields */
export type Entry<T extends string = string> = Version & {
  type: T;
  /** The value of the collection's title field */
  title: string | null;
  entityCreatedAt: Date;
  values: Values;
};

/** A version together with the type and title of its entry */
export type TitledVersion<T extends string = string> = Version & { type: T; title: string | null };

/** An entry pointing at another one, through one of its fields */
export type Reference<T extends string = string> = {
  entityId: number;
  type: T;
  title: string | null;
  /** The field holding the reference, like "brand" or "sections" for one inside a list */
  field: string;
};
