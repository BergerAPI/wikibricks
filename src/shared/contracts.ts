/**
 * Type-specific field values keyed by field name, as entered in the form.
 */
export type EntityFieldValues = Record<string, string>;

export type SelectOption = { value: string; label: string; group?: string };

export type SelectOptionsResponse = {
  options: SelectOption[];
  more: boolean;
};

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

export const MAX_MESSAGE_LENGTH = 2000;

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

/**
 * How dates are shown. The server writes them in UTC, the browser rewrites them
 * in the device's own time zone and format.
 */
export const dateFormats = {
  date: { dateStyle: "medium" },
  datetime: { dateStyle: "medium", timeStyle: "short" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateFormat = keyof typeof dateFormats;
