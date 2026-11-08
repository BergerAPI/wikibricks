import type { Migration } from "@wikibricks/cms-postgres";
import initial from "./0001-initial";
import descriptionAndImageAsFields from "./0002-description-and-image-as-fields";
import nameAsField from "./0003-name-as-field";

/**
 * Schema changes, applied once each and in this order when the server starts,
 * before the CMS sets up its own tables.
 *
 * New entity types and new fields need no migration: their tables, columns and views
 * are created from src/collections.ts. Write one for anything that changes existing data,
 * like renaming or removing a field, changing a column type or moving rows to another type.
 *
 * To add one, create the next numbered file next to this one and list it below.
 * Never edit or reorder a migration once it has been deployed.
 * The views of all entity types are dropped while migrations run, so their columns can be
 * changed freely. A migration that removes a type has to drop that type's views itself.
 */
export const migrations: Record<string, Migration> = {
  "0001-initial": initial,
  "0002-description-and-image-as-fields": descriptionAndImageAsFields,
  "0003-name-as-field": nameAsField,
};
