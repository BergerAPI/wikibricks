import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { initDatabase } from "./database";
import { handleRootPage } from "./routes/root";
import { handleAsset } from "./assets";
import { attemptAuthentication, detectLanguage, type Variables } from "./utils";
import {
  handleLoginPage,
  handleLoginSubmit,
  handleRegisterPage,
  handleRegisterSubmit,
  handleLogoutSubmit,
} from "./routes/auth";
import { handleSetChangesPage } from "./routes/changes";
import {
  handleEntityPage,
  handleEntityPageSubmit,
  handleEntityVersionPatch,
} from "./routes/entities";
import { handleEntityHistoryPage } from "./routes/entities/history";
import { handleUserPage } from "./routes/users";
import { handleError, handleNotFound } from "./error";
import {
  handleNewEntityPage,
  handleNewEntitySubmit,
} from "./routes/entities/new-entity";
import { handleSearchPage } from "./routes/entities/search";
import {
  handleImageUpload,
  limitImageUpload,
  handleImageServe,
  handleImageInfo,
  handleImagePage,
  handleImageDelete,
} from "./routes/images";

(async () => {
  const app = new Hono<{ Variables: Variables }>();

  app.use(secureHeaders());
  app.get("/assets/:file", handleAsset);

  try {
    await initDatabase();
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }

  app.use(detectLanguage);
  app.use(attemptAuthentication);

  app.get("/", handleRootPage);

  // Auth routes
  app.get("/login", handleLoginPage);
  app.post("/login", handleLoginSubmit);
  app.get("/register", handleRegisterPage);
  app.post("/register", handleRegisterSubmit);
  app.post("/logout", handleLogoutSubmit);

  // Entity routes
  app.get("/entities/new", handleNewEntityPage);
  app.post("/entities/new", handleNewEntitySubmit);
  app.get("/entities/search", handleSearchPage);
  app.get("/entities/:id", handleEntityPage);
  app.post("/entities/:id", handleEntityPageSubmit);
  app.get("/entities/:id/history", handleEntityHistoryPage);
  app.patch("/entities/:id/:version", handleEntityVersionPatch);

  // Based off, developed by, set id, Ergänzungssets, bricks

  // Changes routes
  app.get("/changes", handleSetChangesPage);

  // User routes
  app.get("/users/:id", handleUserPage);

  // Image routes
  app.post("/images/upload", limitImageUpload, handleImageUpload);
  app.get("/images/serve/:id", handleImageServe);
  app.get("/images/:id", handleImagePage);
  app.get("/images/:id/info", handleImageInfo);
  app.delete("/images/:id", handleImageDelete);

  // Handling errors
  app.onError(handleError);
  app.notFound(handleNotFound);

  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  console.log(`Server is running on http://localhost:${port}`);

  serve({
    fetch: app.fetch,
    port,
  });
})().then(() => {
  /* Do nothing */
});
