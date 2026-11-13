import { cms } from "../../collections";
import { PageTitle, Pager, Row, RowList } from "../../components/ui";
import { Layout } from "../../layout";
import { useTranslation } from "../../translation";
import { entityPath, parseEntityId, pageLink, readPage } from "../../urls";
import { routeParam, type DefaultContext } from "../../utils";

const PAGE_SIZE = 50;

/**
 * All entries that link to an entry, for when there are more than its page shows.
 */
export const handleReferencesPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, url } = useTranslation(c);

  const entityId = parseEntityId(routeParam(c, "id"));
  const entry = entityId && (await cms.get(entityId));
  if (!entityId || !entry || entry.status !== "approved") return c.notFound();

  const entityUrl = url(entityPath(entry));
  if (c.req.path !== `${entityUrl}/references`) return c.redirect(`${entityUrl}/references${new URL(c.req.url).search}`, 301);

  const page = readPage(c, PAGE_SIZE);
  const references = await cms.referencing(entityId, PAGE_SIZE + 1, { offset: page * PAGE_SIZE });
  if (page > 0 && references.length === 0) return c.redirect(`${entityUrl}/references`);

  return c.render(
    <Layout context={c} title={`${t("entity.referencedBy")}: ${entry.title}`} noindex>
      <main>
        <PageTitle>{t("entity.referencedBy")}: <a href={entityUrl}>{entry.title}</a></PageTitle>
        <RowList>
          {references.slice(0, PAGE_SIZE).map((reference) => (
            <Row details={t(`entityType.${reference.type}`)}>
              <a href={url(entityPath(reference))}>{reference.title}</a>
            </Row>
          ))}
        </RowList>
        <Pager
          page={page}
          more={references.length > PAGE_SIZE}
          pageUrl={(page) => pageLink(`${entityUrl}/references`, {}, page)}
          t={t}
        />
      </main>
    </Layout>,
  );
};
