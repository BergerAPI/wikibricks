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
exports.handleUserPage = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const info_box_1 = require("../../components/info-box");
const table_1 = require("../../components/table");
const database_1 = require("../../database");
const layout_1 = require("../../layout");
const translation_1 = require("../../translation");
const handleUserPage = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const currentUser = c.get("user");
    const userId = c.req.param("id");
    // Fetch user from database
    const [user] = yield (0, database_1.sql) `
        SELECT id, username, permission_level, created_at
        FROM users
        WHERE id = ${userId}
    `;
    if (!user)
        return c.notFound();
    const recentActivity = yield (0, database_1.sql) `
        SELECT
            e.name as entity_name,
            e.id as entity_id,
            v.created_at,
            v.version_number
        FROM entity_versions v
        JOIN entities e ON v.entity_id = e.id
        WHERE v.created_by = ${userId}
        ORDER BY v.created_at DESC
        LIMIT 10
    `;
    return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { user: currentUser, children: (0, jsx_runtime_1.jsxs)("main", { class: "overflow-auto", children: [(0, jsx_runtime_1.jsx)("div", { class: "flex justify-between items-center pb-2 mb-3 border-b", children: (0, jsx_runtime_1.jsxs)("h1", { class: "text-3xl font-serif", children: [(0, translation_1.t)("user.title"), user.username] }) }), (0, jsx_runtime_1.jsxs)("div", { class: "flex", children: [(0, jsx_runtime_1.jsxs)("section", { class: "flex-1", children: [(0, jsx_runtime_1.jsx)("h2", { class: "text-2xl font-serif mb-4", children: (0, translation_1.t)("user.recentActivity") }), recentActivity.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { class: "bg-background border p-2 rounded", children: (0, jsx_runtime_1.jsx)("div", { class: "text-sm text-gray-600", children: (0, translation_1.t)("user.noRecentActivity") }) })) : ((0, jsx_runtime_1.jsxs)(table_1.Table, { children: [(0, jsx_runtime_1.jsxs)(table_1.TableHead, { children: [(0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("user.entity") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("user.version") }), (0, jsx_runtime_1.jsx)("th", { children: (0, translation_1.t)("entities.date") })] }), (0, jsx_runtime_1.jsx)("tbody", { children: recentActivity.map((activity) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("a", { href: `/entities/${activity.entity_id}`, children: activity.entity_name }) }), (0, jsx_runtime_1.jsx)("td", { children: activity.version_number }), (0, jsx_runtime_1.jsx)("td", { children: activity.created_at.toLocaleDateString() })] }))) })] }))] }), (0, jsx_runtime_1.jsxs)(info_box_1.InfoBox, { title: user.username, children: [(0, jsx_runtime_1.jsx)(info_box_1.InfoBoxImage, { src: `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`, alt: `${(0, translation_1.t)("user.imageOf")} ${user.username}` }), (0, jsx_runtime_1.jsx)(info_box_1.InfoBoxRow, { label: (0, translation_1.t)("user.userId"), children: user.id }), (0, jsx_runtime_1.jsx)(info_box_1.InfoBoxRow, { label: (0, translation_1.t)("user.permissionLevel"), children: user.permission_level }), (0, jsx_runtime_1.jsx)(info_box_1.InfoBoxRow, { label: (0, translation_1.t)("user.memberSince"), children: user.created_at.toLocaleDateString() })] })] })] }) }));
});
exports.handleUserPage = handleUserPage;
