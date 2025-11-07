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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNewEntitySubmit = exports.handleNewEntityPage = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const _1 = require(".");
const database_1 = require("../../database");
const layout_1 = require("../../layout");
const handleNewEntityPage = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const user = c.get("user");
    if (user === undefined)
        return c.redirect("/login?redirect=/entities/new");
    return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { user: user, children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: "Add New Entity" }), (0, jsx_runtime_1.jsx)("div", { id: "error", class: "empty:hidden mb-3 p-3 border border-red-500 bg-red-100 text-red-700" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("label", { class: "block mb-3", children: [(0, jsx_runtime_1.jsx)("span", { class: "font-semibold", children: "Entity Type" }), (0, jsx_runtime_1.jsx)("select", { class: "mt-1 block w-full", field: "entity_type", name: "brand_id", value: "set", id: "entity_type", children: Object.keys(_1.INFO_FIELDS).map(id => {
                                        var _a;
                                        return (0, jsx_runtime_1.jsx)("option", { value: id, children: ((_a = id.at(0)) === null || _a === void 0 ? void 0 : _a.toUpperCase()) + id.slice(1, id.length).toLowerCase() });
                                    }) })] }), (0, jsx_runtime_1.jsxs)("label", { class: "block mb-3", children: [(0, jsx_runtime_1.jsx)("span", { class: "font-semibold", children: "Name" }), (0, jsx_runtime_1.jsx)("input", { id: "name", field: "name", value: "", class: "border p-2 rounded w-full" })] }), (0, jsx_runtime_1.jsxs)("label", { class: "block mb-3", children: [(0, jsx_runtime_1.jsx)("span", { class: "font-semibold", children: "Description" }), (0, jsx_runtime_1.jsx)("textarea", { field: "description", id: "description", value: "", class: "border p-2 rounded w-full" })] }), Object.keys(_1.INFO_FIELDS).map((id, index) => ((0, jsx_runtime_1.jsx)("div", { id: `tab-${id}`, class: `tab-content ${index === 0 ? "" : "hidden"}`, children: Object.entries(_1.INFO_FIELDS[id]).map(([key, def]) => {
                                let fieldLabel = "";
                                let inputType = "text";
                                if (typeof def === "string") {
                                    fieldLabel = def;
                                }
                                else {
                                    fieldLabel = def.text;
                                    inputType = def.type === "number" ? "number" : "text";
                                }
                                return ((0, jsx_runtime_1.jsxs)("label", { htmlFor: key, class: "block mb-3", children: [(0, jsx_runtime_1.jsx)("span", { class: "font-semibold", children: fieldLabel }), (0, jsx_runtime_1.jsx)("input", { id: key, field: key, type: inputType, value: "", class: "border p-2 rounded w-full" })] }));
                            }) }, id))), (0, jsx_runtime_1.jsx)("button", { id: "submit_button", children: "Submit" })] }), (0, jsx_runtime_1.jsx)("script", { dangerouslySetInnerHTML: {
                        __html: `
document.getElementById("submit_button").addEventListener("click", () => {
    const data = {};
    // Only include fields that are visible (i.e. not in a hidden tab)
    document.querySelectorAll("[field]").forEach(it => {
        // Check if the element is visible by verifying its offsetParent is not null
        if (it.offsetParent !== null) {
            const field = it.getAttribute('field');
            data[field] = it.value;
        }
    });

    fetch(\`/entities/new\`, {
        method: 'POST',
        redirect: "follow",
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(async response => {
        if (!response.ok) {
            const body = await response.text();
            let message = "An unexpected error occurred. Please try again, and contact support if the issue persists.";
            if(response.status === 400) {
                message = "Bad Request: " + body;
            } else if(response.status === 500) {
                message = "Server error: Our technical team has been notified. Please try again later.";
            }
            document.getElementById("error").innerHTML = message;
            return;
        }

        const body = await response.json();

        if (body.id && body.entity_id)
            window.location.href = "/entities/" + body.entity_id + "?version=" + body.id;
    }).catch(() => {
        document.getElementById("error").innerHTML = "Network error: Unable to connect to the server. Please check your connection and try again.";
    });
});

document.getElementById("entity_type").addEventListener("change", () => {
    const selected = document.getElementById("entity_type").value;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const content = document.getElementById("tab-" + selected);
    if(content) content.classList.remove('hidden');
});
                    `
                    } })] }) }));
});
exports.handleNewEntityPage = handleNewEntityPage;
const handleNewEntitySubmit = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const user = c.get("user");
    if (!user)
        return c.body("Unauthorized", 401);
    ;
    const _a = yield c.req.json(), { name, description, entity_type } = _a, data = __rest(_a, ["name", "description", "entity_type"]);
    if (!name || !description || !entity_type || name.length < 3 || description.length < 3) {
        return c.body("Name and description are required and need to be at least 3 characters long.", 400);
    }
    // Checking whether the necessary fields of the specific entity type have been supplied
    const typeInfo = _1.INFO_FIELDS[entity_type];
    if (!typeInfo)
        return c.body("Bad Request", 400);
    for (const [fieldKey] of Object.entries(typeInfo)) {
        if (data[fieldKey] !== undefined)
            continue;
        return c.body("Bad Request", 400);
    }
    // Every created set by a user will be handles by a change and needs to be accepted by a moderator
    const version = yield database_1.sql.begin((sql) => __awaiter(void 0, void 0, void 0, function* () {
        const [{ id, entity_id }] = yield sql `
            WITH new_entity AS (
                INSERT INTO entities (name, type)
                VALUES (${name.toString()}, ${entity_type})
                RETURNING id
            ), new_version AS (
                INSERT INTO entity_versions (
                    entity_id,
                    version_number,
                    created_by,
                    review_status,
                    description
                )
                SELECT
                    id,
                    1,
                    ${user.id.toString()},
                    'pending',
                    ${description.toString()}
                FROM new_entity
                RETURNING id, entity_id
            ) SELECT entity_id, id FROM new_version;
        `;
        // Handling creation of the specific entity tables
        if (entity_type === "set") {
            yield sql `
                INSERT INTO sets ${sql(Object.assign({ version_id: id }, data))}`;
        }
        else if (entity_type === "brand") {
            yield sql `
                INSERT INTO brands ${sql(Object.assign({ version_id: id }, data))}`;
        }
        else if (entity_type === "wiki") {
            // No additional table insertion is needed for wiki entities.
        }
        return { id, entity_id };
    }));
    return c.json(version);
});
exports.handleNewEntitySubmit = handleNewEntitySubmit;
