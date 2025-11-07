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
exports.handleEntityHistoryPage = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const table_1 = require("../../components/table");
const database_1 = require("../../database");
const layout_1 = require("../../layout");
const translation_1 = require("../../translation");
const handleEntityHistoryPage = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const user = c.get("user");
    const entityId = c.req.param("id");
    // Fetch entity versions with usernames
    const [[entityInfo], versions] = yield Promise.all([
        (0, database_1.sql) `
            SELECT name FROM entities WHERE id = ${entityId}
        `,
        (0, database_1.sql) `
            SELECT
                ev.*,
                u.username,
                u.id as user_id
            FROM entity_versions ev
            LEFT JOIN users u ON ev.created_by = u.id
            WHERE ev.entity_id = ${entityId}
            ORDER BY ev.version_number DESC
        `,
    ]);
    if (!entityInfo)
        return c.notFound();
    const proposedVersion = versions.filter((it) => it.review_status === "pending");
    return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { user: user, children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsxs)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: [(0, translation_1.t)("entity.history.title"), " ", entityInfo.name] }), proposedVersion.length > 0 && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("p", { class: "text-pretty", children: (0, translation_1.t)("entity.history.requestedChanges", { name: entityInfo.name }) }), (0, jsx_runtime_1.jsx)("div", { class: "pb-2", children: (0, jsx_runtime_1.jsxs)(table_1.Table, { children: [(0, jsx_runtime_1.jsxs)(table_1.TableHead, { children: [(0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entity.history.version") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entity.history.created") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entity.history.author") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entity.history.changeMessage") })] }), (0, jsx_runtime_1.jsx)("tbody", { children: proposedVersion.map((version) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("a", { href: `/entities/${entityId}?version=${version.id}`, class: "text-primary hover:underline", children: version.id }) }), (0, jsx_runtime_1.jsx)("td", { children: version.created_at.toLocaleDateString() }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("a", { href: `/users/${version.user_id}`, children: version.username }) }), (0, jsx_runtime_1.jsx)("td", { children: version.change_message })] }))) })] }) })] })), (0, jsx_runtime_1.jsx)("p", { class: "text-pretty", children: (0, translation_1.t)("entity.history.versionHistory", { name: entityInfo.name }) }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsxs)(table_1.Table, { children: [(0, jsx_runtime_1.jsxs)(table_1.TableHead, { children: [(0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entity.history.version") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entity.history.created") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entity.history.author") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entity.history.changeMessage") })] }), (0, jsx_runtime_1.jsx)("tbody", { children: versions
                                    .filter((it) => it.review_status === "approved")
                                    .map((version) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("a", { href: `/entities/${entityId}?version=${version.id}`, class: "text-primary hover:underline", children: version.id }) }), (0, jsx_runtime_1.jsx)("td", { children: version.created_at.toLocaleDateString() }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("a", { href: `/users/${version.user_id}`, children: version.username }) }), (0, jsx_runtime_1.jsx)("td", { children: version.change_message })] }))) })] }) })] }) }));
});
exports.handleEntityHistoryPage = handleEntityHistoryPage;
