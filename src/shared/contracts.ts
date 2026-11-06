export type EntityType = "set" | "brand" | "wiki";

export type CreateEntityRequest = {
  entity_type: EntityType;
  name: string;
  description: string;
  image_id?: number | null;
  pieces?: string | number;
  issued?: string;
  theme?: string;
  size?: string;
  brand_id?: string | number;
  manufacturer_id?: string;
  country?: string;
  website?: string;
};

export type CreateEntityResponse = {
  id: number;
  entity_id: number;
};

export type UploadImageResponse = { id: number };

export const entityEditFields = [
  "pieces", "issued", "theme", "size", "brand_id", "country", "website", "description",
] as const;

export type EntityEditField = (typeof entityEditFields)[number];

export type EditEntityRequest = Partial<Pick<CreateEntityRequest, EntityEditField>> & {
  baseVersionId?: number;
  changeMessage: string;
};

export type ReviewVersionRequest = {
  type: "approved" | "rejected";
  reviewMessage: string;
};
