/**
 * Type-specific field values keyed by field name, as entered in the form.
 */
export type EntityFieldValues = Record<string, string>;

export type CreateEntityRequest = {
  // One of the entity types defined on the server
  entity_type: string;
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
