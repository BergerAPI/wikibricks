"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_server_1 = require("@hono/node-server");
const hono_1 = require("hono");
const database_1 = require("./database");
const root_1 = require("./routes/root");
const utils_1 = require("./utils");
const auth_1 = require("./routes/auth");
const changes_1 = require("./routes/changes");
const entities_1 = require("./routes/entities");
const history_1 = require("./routes/entities/history");
const users_1 = require("./routes/users");
const error_1 = require("./error");
const new_entity_1 = require("./routes/entities/new-entity");
const search_1 = require("./routes/entities/search");
(() => __awaiter(void 0, void 0, void 0, function* () {
    const app = new hono_1.Hono();
    yield (0, database_1.initDatabase)();
    app.use(utils_1.detectLanguage);
    app.use(utils_1.attemptAuthentication);
    app.get("/", root_1.handleRootPage);
    // Auth routes
    app.get("/login", auth_1.handleLoginPage);
    app.post("/login", auth_1.handleLoginSubmit);
    app.get("/register", auth_1.handleRegisterPage);
    app.post("/register", auth_1.handleRegisterSubmit);
    app.post("/logout", auth_1.handleLogoutSubmit);
    // Entity routes
    app.get("/entities/new", new_entity_1.handleNewEntityPage);
    app.post("/entities/new", new_entity_1.handleNewEntitySubmit);
    app.get("/entities/search", search_1.handleSearchPage);
    app.get("/entities/:id", entities_1.handleEntityPage);
    app.post("/entities/:id", entities_1.handleEntityPageSubmit);
    app.get("/entities/:id/history", history_1.handleEntityHistoryPage);
    app.patch("/entities/:id/:version", entities_1.handleEntityVersionPatch);
    // Based off, developed by, set id, Ergänzungssets, bricks
    // Changes routes
    app.get("/changes", changes_1.handleSetChangesPage);
    // User routes
    app.get("/users/:id", users_1.handleUserPage);
    // Handling errors
    app.onError(error_1.handleError);
    app.use(error_1.handleNotFound);
    const port = 3000;
    console.log(`Server is running on http://localhost:${port}`);
    (0, node_server_1.serve)({
        fetch: app.fetch,
        port,
    });
}))().then(() => {
    /* Do nothing */
});
