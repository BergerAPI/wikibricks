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
exports.handleSetChangesPage = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const table_1 = require("../components/table");
const database_1 = require("../database");
const layout_1 = require("../layout");
const utils_1 = require("../utils");
const translation_1 = require("../translation");
const ChangeTable = ({ changes }) => ((0, jsx_runtime_1.jsxs)(table_1.Table, { children: [(0, jsx_runtime_1.jsxs)(table_1.TableHead, { children: [(0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("changes.set") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("changes.changedBy") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("changes.message") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entities.date") })] }), (0, jsx_runtime_1.jsx)("tbody", { children: changes.map((change) => {
                return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("a", { href: `/entities/${change.entity_id}?version=${change.id}`, children: change.entity_title }) }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("a", { href: `/users/${change.user_id}`, children: change.username }) }), (0, jsx_runtime_1.jsx)("td", { children: change.change_message || (0, jsx_runtime_1.jsx)("em", { children: (0, translation_1.t)("error.noMessage") }) }), (0, jsx_runtime_1.jsx)("td", { children: new Date(change.created_at).toLocaleString() })] }));
            }) })] }));
const handleSetChangesPage = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const user = c.get("user");
    if (!user || user.permission_level < utils_1.PermissionLevel.MODERATOR) {
        return c.redirect("/");
    }
    const changes = yield (0, database_1.sql) `
        SELECT
          ev.*,
          u.username,
          e.name as entity_title,
          u.id as user_id
        FROM entity_versions ev
        JOIN entities e ON ev.entity_id = e.id
        LEFT JOIN users u ON ev.created_by = u.id
        WHERE ev.review_status = 'pending'
        ORDER BY ev.version_number DESC
    `;
    return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { user: user, children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: (0, translation_1.t)("changes.title") }), (0, jsx_runtime_1.jsx)("div", { class: "min-w-full overflow-x-auto", children: (0, jsx_runtime_1.jsx)(ChangeTable, { changes: changes }) })] }) }));
});
exports.handleSetChangesPage = handleSetChangesPage;
