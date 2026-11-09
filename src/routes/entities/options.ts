import { targetsOf } from "@wikibricks/cms";
import { cms, fieldsOf } from "../../collections";
import type { RelationOptionsResponse } from "../../shared/contracts";
import type { DefaultContext } from "../../utils";

export const handleRelationOptions = async (c: DefaultContext) => {
  const type = c.req.param("type");
  const name = c.req.param("field");
  if (!cms.isType(type) || !name) return c.notFound();
  const field = fieldsOf(type)[name];
  if (field?.type !== "relation") return c.notFound();

  const query = (c.req.query("q") ?? "").trim().slice(0, 255);
  const { items, total } = await cms.find({
    where: { type: { in: [...targetsOf(field)] }, title: { contains: query } },
    sort: "title",
    limit: 20,
  });
  return c.json({
    options: items.map((entry) => ({ value: String(entry.entityId), label: entry.title ?? String(entry.entityId) })),
    more: total > items.length,
  } satisfies RelationOptionsResponse);
};
