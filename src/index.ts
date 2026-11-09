import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { handleAsset, handlePublicFile } from "./assets";
import { cms } from "./collections";
import { handleError, handleNotFound } from "./error";
import { detectLanguage, handleLanguagePreference } from "./language";
import {
  handleLoginPage,
  handleLoginSubmit,
  handleLogoutSubmit,
  handleRegisterPage,
  handleRegisterSubmit,
} from "./routes/auth";
import { handleChangesPage } from "./routes/changes";
import {
  handleEntityDelete,
  handleEntityPage,
  handleEntityPageSubmit,
  handleEntityVersionPatch,
} from "./routes/entities";
import { handleEntityHistoryPage } from "./routes/entities/history";
import { handleNewEntityPage, handleNewEntitySubmit } from "./routes/entities/new-entity";
import { handleSearchPage } from "./routes/entities/search";
import { handleRelationOptions } from "./routes/entities/options";
import {
  handleImageDelete,
  handleImageInfo,
  handleImagePage,
  handleImageServe,
  handleImageUpload,
  limitImageUpload,
} from "./routes/images";
import { handleImprintPage, handlePrivacyPage, handleTermsPage } from "./routes/legal";
import { handleRootPage } from "./routes/root";
import { handleUserPage } from "./routes/users";
import { attemptAuthentication, type Variables } from "./utils";

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

app.use(detectLanguage);
app.post("/language", handleLanguagePreference);
app.use(attemptAuthentication);

app.get("/", handleRootPage);
app.get("/datenschutz", handlePrivacyPage);
app.get("/impressum", handleImprintPage);
app.get("/nutzungsbedingungen", handleTermsPage);

app.get("/login", handleLoginPage);
app.post("/login", handleLoginSubmit);
app.get("/register", handleRegisterPage);
app.post("/register", handleRegisterSubmit);
app.post("/logout", handleLogoutSubmit);

app.get("/entities/new", handleNewEntityPage);
app.post("/entities/new", handleNewEntitySubmit);
app.get("/entities/search", handleSearchPage);
app.get("/entities/options/:type/:field", handleRelationOptions);
app.get("/entities/:id", handleEntityPage);
app.post("/entities/:id", handleEntityPageSubmit);
app.delete("/entities/:id", handleEntityDelete);
app.get("/entities/:id/history", handleEntityHistoryPage);
app.patch("/entities/:id/:version", handleEntityVersionPatch);

// Based off, developed by, set id, Ergänzungssets, bricks

app.get("/changes", handleChangesPage);
app.get("/users/:id", handleUserPage);

app.post("/images/upload", limitImageUpload, handleImageUpload);
app.get("/images/serve/:id", handleImageServe);
app.get("/images/:id", handleImagePage);
app.get("/images/:id/info", handleImageInfo);
app.delete("/images/:id", handleImageDelete);

app.onError(handleError);
app.notFound(handleNotFound);

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`Server is running on http://localhost:${port}`);
