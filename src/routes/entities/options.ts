import { targetsOf } from "@wikibricks/cms";
import { cms, fieldsOf } from "../../collections";
import type { SelectOptionsResponse } from "../../shared/contracts";
import type { DefaultContext } from "../../utils";
import { useTranslation } from "../../translation";

async function listOptions(c: DefaultContext, targets?: string[]) {
  const { t } = useTranslation(c);
  const query = (c.req.query("q") ?? "").trim().slice(0, 255);
  const { items, total } = await cms.find({
    where: {
      ...(targets ? { type: { in: targets } } : {}),
      title: { contains: query },
    },
    sort: "title",
    limit: 20,
  });
  return c.json({
    options: items.map((entry) => ({
      value: String(entry.entityId),
      label: entry.title ?? String(entry.entityId),
      ...(!targets ? { group: t(`entityType.${entry.type}`) } : {}),
    })),
    more: total > items.length,
  } satisfies SelectOptionsResponse);
}

export const handleEntityOptions = (c: DefaultContext) => listOptions(c);

export const handleRelationOptions = async (c: DefaultContext) => {
  const type = c.req.param("type");
  const name = c.req.param("field");
  if (!cms.isType(type) || !name) return c.notFound();
  const field = fieldsOf(type)[name];
  if (field?.type !== "relation") return c.notFound();

  return listOptions(c, [...targetsOf(field)]);
};
