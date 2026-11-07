/**
 * All entity types. Adding a type here requires a matching definition in src/entity-types.ts.
 */
export const entityTypes = ["set", "brand", "wiki"] as const;

export type EntityType = (typeof entityTypes)[number];

export const isEntityType = (value: unknown): value is EntityType =>
  entityTypes.includes(value as EntityType);

/**
 * Type-specific field values keyed by field name, as entered in the form.
 */
export type EntityFieldValues = Record<string, string>;

export type CreateEntityRequest = {
  entity_type: EntityType;
  name: string;
  description: string;
  image_id?: number | null;
  fields: EntityFieldValues;
};

export type CreateEntityResponse = {
  id: number;
  entity_id: number;
};

export type UploadImageResponse = { id: number };

export type EditEntityRequest = {
  description?: string;
  fields?: EntityFieldValues;
  baseVersionId?: number;
  changeMessage: string;
};

export type ReviewVersionRequest = {
  type: "approved" | "rejected";
  reviewMessage: string;
};
