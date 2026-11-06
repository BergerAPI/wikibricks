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
