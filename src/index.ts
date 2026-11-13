import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono, type Next } from "hono";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { handleAsset, handlePublicFile } from "./assets";
import { cms } from "./collections";
import { handleError, handleNotFound } from "./error";
import { detectLanguage, handleLanguagePreference, redirectToLanguage } from "./language";
import {
  handleLoginPage,
  handleLoginSubmit,
  handleLogoutSubmit,
  handleRegisterPage,
  handleRegisterSubmit,
} from "./routes/auth";
import { handleAdminPage, handleAdminUsersPage, handleChangesPage } from "./routes/admin";
import { countNotifications, handleNotificationsPage } from "./routes/notifications";
import { handleEntityPage } from "./routes/entities";
import {
  handleEntityDelete,
  handleEntityPageSubmit,
  handleEntityVersionPatch,
} from "./routes/entities/write";
import { handleEntityHistoryPage } from "./routes/entities/history";
import { handleReferencesPage } from "./routes/entities/references";
import { handleNewEntityPage, handleNewEntitySubmit } from "./routes/entities/new-entity";
import { handleSearchPage } from "./routes/entities/search";
import { handleEntityOptions, handleRelationOptions } from "./routes/entities/options";
import {
  guardImageUpload,
  handleImageDelete,
  handleImageInfo,
  handleImagePage,
  handleImageServe,
  handleImageUpload,
  limitImageUpload,
} from "./routes/images";
import { handleImprintPage, handlePrivacyPage, handleTermsPage } from "./routes/legal";
import { handleRootPage } from "./routes/root";
import { handleRobots, handleSitemap } from "./routes/sitemap";
import { handleUserPage, handleUserRoleSubmit } from "./routes/users";
import { pruneAbandonedImages, repairPublishedImageSizes } from "./services/image-storage";
import { getAvailableLanguages } from "./translation";
import { attemptAuthentication, isAdmin, type DefaultContext, type Variables } from "./utils";

const app = new Hono<{ Variables: Variables }>();

app.use(secureHeaders());
app.get("/assets/:file", compress(), handleAsset);
app.get("*", handlePublicFile);

try {
  await cms.init();
} catch (err) {
  console.error("Failed to initialize database:", err);
  process.exit(1);
}

// These are the same in every language
app.post("/language", handleLanguagePreference);
app.get("/robots.txt", handleRobots);
app.get("/sitemap.xml", handleSitemap);
app.get("/images/:id/file", attemptAuthentication, handleImageServe);
app.get("/images/serve/:id", (c) => c.redirect(`/images/${c.req.param("id")}/file${new URL(c.req.url).search}`, 301));

// Everything else lives under its language, like /en/entities/search
const site = new Hono<{ Variables: Variables }>();

site.use(detectLanguage);
site.use(attemptAuthentication);
site.use(countNotifications);

site.get("/", handleRootPage);
site.get("/privacy", handlePrivacyPage);
site.get("/imprint", handleImprintPage);
site.get("/terms", handleTermsPage);

site.get("/login", handleLoginPage);
site.post("/login", handleLoginSubmit);
site.get("/register", handleRegisterPage);
site.post("/register", handleRegisterSubmit);
site.post("/logout", handleLogoutSubmit);

site.get("/entities/new", handleNewEntityPage);
site.post("/entities/new", handleNewEntitySubmit);
site.get("/entities/search", handleSearchPage);
site.get("/entities/options", handleEntityOptions);
site.get("/entities/options/:type/:field", handleRelationOptions);
site.get("/entities/:id", handleEntityPage);
site.post("/entities/:id", handleEntityPageSubmit);
site.delete("/entities/:id", handleEntityDelete);
site.get("/entities/:id/history", handleEntityHistoryPage);
site.get("/entities/:id/references", handleReferencesPage);
site.patch("/entities/:id/versions/:version", handleEntityVersionPatch);

// Based off, developed by, set id, Ergänzungssets, bricks

site.get("/notifications", handleNotificationsPage);
site.get("/changes", handleChangesPage);
const adminOnly = async (c: DefaultContext, next: Next) => (isAdmin(c.get("user")) ? next() : c.notFound());
site.get("/admin", adminOnly, handleAdminPage);
site.get("/admin/users", adminOnly, handleAdminUsersPage);
site.get("/users/:id", handleUserPage);
site.post("/users/:id/role", handleUserRoleSubmit);

site.post("/images/upload", guardImageUpload, limitImageUpload, handleImageUpload);
site.get("/images/:id", handleImagePage);
site.get("/images/:id/info", handleImageInfo);
site.delete("/images/:id", handleImageDelete);

app.route(`/:lang{(?:${getAvailableLanguages().join("|")})}`, site);
app.get("*", redirectToLanguage);

app.onError(handleError);
app.notFound(handleNotFound);

setInterval(() => {
  void pruneAbandonedImages().catch((error) => console.error("Image cleanup failed:", error));
}, 10 * 60 * 1000).unref();

let imageRepairCursor = 0;
const repairImages = async () => {
  try {
    imageRepairCursor = await repairPublishedImageSizes(imageRepairCursor);
  } catch (error) {
    console.error("Image size repair failed:", error);
  } finally {
    setTimeout(repairImages, imageRepairCursor === 0 ? 10 * 60 * 1000 : 60 * 1000).unref();
  }
};
setTimeout(repairImages, 60 * 1000).unref();

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port, hostname: process.env.BIND_HOST || undefined });
console.log(`Server is running on http://localhost:${port}`);
