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
exports.handleSearchPage = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const layout_1 = require("../../layout");
const database_1 = require("../../database");
const utils_1 = require("../../utils");
const table_1 = require("../../components/table");
const translation_1 = require("../../translation");
const handleSearchPage = (c) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const user = c.get("user");
    // Fetch and parse query parameters
    let page = c.req.query("page");
    if (page && isNaN(Number(page)))
        return c.redirect("/entities/search");
    page = Number(page) || 0;
    // Default to "all" if no type is provided.
    const entityType = (_a = c.req.query("entity_type")) !== null && _a !== void 0 ? _a : "all";
    const nameSearch = (_b = c.req.query("name")) !== null && _b !== void 0 ? _b : "";
    const filters = [];
    if (entityType !== "all") {
        filters.push((0, database_1.sql) `e.type = ${entityType}`);
    }
    if (nameSearch && nameSearch.length > 0) {
        filters.push((0, database_1.sql) `e.name ILIKE ${`%${nameSearch}%`}`);
    }
    const whereClause = filters.length
        ? (0, database_1.sql) `WHERE ${filters.reduce((acc, cur, idx) => (idx === 0 ? cur : (0, database_1.sql) `${acc} AND ${cur}`), (0, database_1.sql) ``)}`
        : (0, database_1.sql) ``;
    const [totalCount] = yield (0, database_1.sql) `
        SELECT COUNT(*) AS count FROM entities e
            JOIN entity_versions v ON e.head_version_id = v.id
            ${whereClause}
    `;
    const results = yield (0, database_1.sql) `
        SELECT e.created_at, e.type, e.name, v.description, e.id FROM entities e
            JOIN entity_versions v ON e.head_version_id = v.id
            ${whereClause}
            LIMIT 10 OFFSET ${page * 10}
    `;
    return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { user: user, children: (0, jsx_runtime_1.jsxs)("main", { class: "min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { class: "flex justify-between items-center pb-2 mb-3 border-b", children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif", children: (0, translation_1.t)("entities.title") }), (0, jsx_runtime_1.jsxs)("div", { class: "space-x-2", children: [user.permission_level > utils_1.PermissionLevel.MODERATOR && ((0, jsx_runtime_1.jsx)("a", { href: "/changes", children: (0, translation_1.t)("entities.changeRequests") })), (0, jsx_runtime_1.jsx)("a", { href: "/entities/new", children: (0, translation_1.t)("action.addEntity") })] })] }), (0, jsx_runtime_1.jsxs)("form", { method: "get", action: "/entities/search", class: "mb-4 w-[50%] space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { class: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("label", { class: "sr-only", for: "name", children: "Name:" }), (0, jsx_runtime_1.jsx)("input", { type: "text", id: "name", name: "name", value: nameSearch, class: "border border-gray-300 p-1 w-full", placeholder: (0, translation_1.t)("entities.searchByName") }), (0, jsx_runtime_1.jsx)("button", { type: "submit", class: "border border-gray-300 bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200", children: (0, translation_1.t)("action.search") })] }), (0, jsx_runtime_1.jsxs)("details", { children: [(0, jsx_runtime_1.jsx)("summary", { class: "cursor-pointer font-semibold p-2 border bg-background", children: (0, translation_1.t)("entities.advancedSearch") }), (0, jsx_runtime_1.jsxs)("div", { class: "border border-t-0 p-2", children: [(0, jsx_runtime_1.jsx)("label", { class: "block text-sm text-gray-600 mb-1", children: (0, translation_1.t)("entities.entityType") }), (0, jsx_runtime_1.jsx)("select", { name: "entity_type", class: "border border-gray-300 w-full p-1", children: ["all", "set", "brand", "wiki"].map((option) => ((0, jsx_runtime_1.jsx)("option", { value: option, selected: entityType === option, children: option === "all"
                                                    ? (0, translation_1.t)("entityType.all")
                                                    : option === "set"
                                                        ? (0, translation_1.t)("entityType.set")
                                                        : option === "brand"
                                                            ? (0, translation_1.t)("entityType.brand")
                                                            : (0, translation_1.t)("entityType.wiki") }))) })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { class: "min-w-full overflow-x-auto", children: [(0, jsx_runtime_1.jsxs)(table_1.Table, { children: [(0, jsx_runtime_1.jsxs)(table_1.TableHead, { children: [(0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entities.type") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entities.name") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entities.date") })] }), (0, jsx_runtime_1.jsx)("tbody", { children: results.map((r) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("a", { href: `/entities/${r.id}`, children: r.type }) }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("a", { href: `/entities/${r.id}`, children: r.name }) }), (0, jsx_runtime_1.jsx)("td", { children: new Date(r.created_at).toLocaleDateString() })] }, r.id))) })] }), (0, jsx_runtime_1.jsxs)("div", { class: "mt-4 flex justify-center space-x-2", children: [page > 0 && ((0, jsx_runtime_1.jsx)("a", { href: `/entities/search?page=${page - 1}&entity_type=${encodeURIComponent(entityType)}&name=${encodeURIComponent(nameSearch)}`, children: (0, translation_1.t)("action.previous") })), results.length === 10 && page < totalCount.count / 10 && ((0, jsx_runtime_1.jsx)("a", { href: `/entities/search?page=${page + 1}&entity_type=${encodeURIComponent(entityType)}&name=${encodeURIComponent(nameSearch)}`, children: (0, translation_1.t)("action.next") }))] })] })] }) }));
});
exports.handleSearchPage = handleSearchPage;
