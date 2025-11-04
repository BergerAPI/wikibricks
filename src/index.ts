import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { initDatabase } from "./database";
import { handleRootPage } from "./routes/root";
import { attemptAuthentication, type Variables } from "./utils";
import { handleLoginPage, handleLoginSubmit, handleRegisterPage, handleRegisterSubmit } from "./routes/auth";
import { handleSetChangesPage } from "./routes/changes";
import { handleEntityPage, handleEntityPageSubmit, handleEntityVersionPatch } from "./routes/entities";
import { handleEntityHistoryPage } from "./routes/entities/history";
import { handleUserPage } from "./routes/users";
import { handleError, handleNotFound } from "./error";
import { handleNewEntityPage, handleNewEntitySubmit } from "./routes/entities/new-entity";
import { handleSearchPage } from "./routes/entities/search";

(async () => {
    const app = new Hono<{ Variables: Variables }>();

    await initDatabase();

    app.use(attemptAuthentication);

    app.get("/", handleRootPage);

    // Auth routes
    app.get("/login", handleLoginPage);
    app.post("/login", handleLoginSubmit);
    app.get("/register", handleRegisterPage);
    app.post("/register", handleRegisterSubmit);

    // Entity routes
    app.get("/entities/new", handleNewEntityPage);
    app.post("/entities/new", handleNewEntitySubmit);
    app.get("/entities/search", handleSearchPage);
    app.get("/entities/:id", handleEntityPage);
    app.post("/entities/:id", handleEntityPageSubmit);
    app.get("/entities/:id/history", handleEntityHistoryPage);
    app.patch("/entities/:id/:version", handleEntityVersionPatch);

    // Changes routes
    app.get("/changes", handleSetChangesPage);

    // User routes
    app.get("/users/:id", handleUserPage);

    // Handling errors
    app.onError(handleError);
    app.use(handleNotFound);

    const port = 3000;

    console.log(`Server is running on http://localhost:${port}`);

    serve({
        fetch: app.fetch,
        port,
    });
})().then(() => {
    /* Do nothing */
});
