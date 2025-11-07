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
exports.handleEntityVersionPatch = exports.handleEntityPageSubmit = exports.handleEntityPage = exports.INFO_FIELDS = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const info_box_1 = require("../../components/info-box");
const database_1 = require("../../database");
const layout_1 = require("../../layout");
const translation_1 = require("../../translation");
const utils_1 = require("../../utils");
/**
 * Defines the info fields for each entity type.
 */
exports.INFO_FIELDS = {
    set: {
        pieces: {
            text: (0, translation_1.t)("entity.pieces"),
            type: "number",
            value: (v, _) => v,
        },
        size: (0, translation_1.t)("entity.size"),
        theme: (0, translation_1.t)("entity.theme"),
        issued: (0, translation_1.t)("entity.issued"),
        brand_id: {
            text: (0, translation_1.t)("entity.brand"),
            type: "number",
            link: (value) => `/entities/${value}`,
            value: (value, obj) => obj.brand_name || value,
        },
    },
    brand: {
        country: (0, translation_1.t)("entity.country"),
        website: {
            text: (0, translation_1.t)("entity.website"),
            type: "string",
            link: (value) => {
                const full = value.startsWith("http") ? value : `https://${value}`;
                try {
                    new URL(full);
                    return full;
                }
                catch (_a) {
                    return "#";
                }
            },
            value: (value, _) => value,
        },
    },
    wiki: {},
};
// Consolidate SQL query definitions per entity type to reduce duplications.
const queryMapping = {
    set: {
        defaultQuery: (entityId) => (0, database_1.sql) `
            SELECT s.*, e.name as brand_name
            FROM set_view s
            LEFT JOIN entities e ON s.brand_id = e.id
            WHERE s.id = ${entityId}`,
        versionQuery: (entityId, version) => (0, database_1.sql) `
            SELECT s.*, e.name as brand_name
            FROM set_versions_view s
            LEFT JOIN entities e ON s.brand_id = e.id
            WHERE s.id = ${entityId} AND s.version_id = ${version}`,
    },
    brand: {
        defaultQuery: (entityId) => (0, database_1.sql) `
            SELECT * FROM brand_view WHERE id = ${entityId}`,
        versionQuery: (entityId, version) => (0, database_1.sql) `
            SELECT * FROM brand_versions_view WHERE id = ${entityId} AND version_id = ${version}`,
    },
    wiki: {
        defaultQuery: (entityId) => (0, database_1.sql) `
            SELECT * FROM wiki_view WHERE id = ${entityId}`,
        versionQuery: (entityId, version) => (0, database_1.sql) `
            SELECT * FROM wiki_versions_view WHERE id = ${entityId} AND version_id = ${version}`,
    },
};
/**
 * Get an entity by ID and optionally version.
 * @param entityId The entity ID to fetch
 * @param version The version number to fetch
 * @returns The entity or null if not found
 */
const getEntity = (entityId, version) => __awaiter(void 0, void 0, void 0, function* () {
    const [entityInfo] = yield (0, database_1.sql) `
      SELECT type FROM entities WHERE id = ${entityId}
    `;
    if (!entityInfo)
        return null;
    const mapping = queryMapping[entityInfo.type];
    if (!mapping)
        return null;
    return yield database_1.sql
        .begin((sql) => __awaiter(void 0, void 0, void 0, function* () {
        return version
            ? yield mapping.versionQuery(entityId, version)
            : yield mapping.defaultQuery(entityId);
    }))
        .then((result) => result[0]);
});
const EntityInfoBox = ({ entity, fields, editable, }) => {
    return ((0, jsx_runtime_1.jsxs)(info_box_1.InfoBox, { title: entity.name, children: [(0, jsx_runtime_1.jsx)(info_box_1.InfoBoxImage, { src: "https://placehold.co/800x800", alt: (0, translation_1.t)("entity.imageOf", { name: entity.name }) }), Object.entries(fields).map(([f, info]) => {
                const field = f;
                if (!entity[field] && !editable)
                    return null;
                return ((0, jsx_runtime_1.jsx)(info_box_1.InfoBoxRow, { label: typeof info === "string" ? info : info.text, children: (() => {
                        const value = entity[field];
                        if (editable)
                            return ((0, jsx_runtime_1.jsx)("input", { class: "flex-1 border-none outline-none h-6", field: field, type: typeof value === "number" ? "number" : "text", value: value instanceof Date ? value.toISOString() : value }));
                        if (typeof info === "string")
                            return (0, jsx_runtime_1.jsx)("span", { children: value });
                        if (info.link)
                            return ((0, jsx_runtime_1.jsx)("a", { href: info.link(value), children: info.value(value, entity) }));
                        return (0, jsx_runtime_1.jsx)("span", { children: info.value(value, entity) });
                    })() }));
            })] }));
};
const handleEntityPage = (c) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = c.get("user");
    const entityId = c.req.param("id");
    // Possible query parameters for versioned entities and edit mode
    const version = c.req.query("version");
    const edit = c.req.query("edit") !== undefined;
    const entity = yield getEntity(entityId, version ? parseInt(version) : undefined);
    if (!entity)
        return c.notFound();
    const isProposedVersion = entity.review_status === "pending";
    const isModerator = ((_a = user === null || user === void 0 ? void 0 : user.permission_level) !== null && _a !== void 0 ? _a : 0) > utils_1.PermissionLevel.MODERATOR;
    // Define info box fields based on entity type
    const infoFields = exports.INFO_FIELDS[entity.type];
    return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { user: user, children: (0, jsx_runtime_1.jsxs)("main", { class: "overflow-auto", children: [(0, jsx_runtime_1.jsxs)("div", { class: "flex justify-between items-center pb-2 mb-3 border-b", children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif", children: !version ? entity.name : `${entity.name}: Version ${version}` }), (0, jsx_runtime_1.jsxs)("div", { class: "space-x-2", children: [!isProposedVersion &&
                                    (edit ? ((0, jsx_runtime_1.jsx)("a", { href: `/entities/${entity.id}`, children: (0, translation_1.t)("entity.cancel") })) : ((0, jsx_runtime_1.jsx)("a", { href: `/entities/${entity.id}?edit`, children: (0, translation_1.t)("entity.editPage") }))), (0, jsx_runtime_1.jsx)("a", { href: `/entities/${entity.id}/history`, children: (0, translation_1.t)("entity.versionHistory") })] })] }), edit && !isProposedVersion && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { class: "mb-3 pb-2 border-b flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("label", { class: "flex items-center flex-1 space-x-1", children: [(0, jsx_runtime_1.jsx)("span", { children: (0, translation_1.t)("entity.changeMessage") }), (0, jsx_runtime_1.jsx)("input", { class: "flex-1", id: "change_message" })] }), (0, jsx_runtime_1.jsx)("button", { id: "save", children: (0, translation_1.t)("entity.save") })] }), (0, jsx_runtime_1.jsx)("script", { dangerouslySetInnerHTML: {
                                __html: `
// When the user clicks the save button
document.getElementById('save').addEventListener('click', async () => {
    const data = {}

    document.querySelectorAll("[field]").forEach(it => {
        const field = it.getAttribute('field');

        if (it.nodeName === 'INPUT')
            data[field] = it.value;
        else
            data[field] = it.innerText;
    });

    const changeMessage = document.getElementById('change_message').value;
    data.changeMessage = changeMessage;

    fetch(\`/entities/${entity.id}\`, {
        method: 'POST',
        redirect: "follow",
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(it => {
        window.location.href = "/entities/${entity.id}/history"
    });
});
`,
                            } })] })), isProposedVersion && isModerator && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { class: "mb-3 pb-2 border-b flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("label", { class: "flex items-center flex-1 space-x-1", children: [(0, jsx_runtime_1.jsx)("span", { children: (0, translation_1.t)("entity.reviewMessage") }), (0, jsx_runtime_1.jsx)("input", { class: "flex-1", id: "review_message" })] }), (0, jsx_runtime_1.jsx)("button", { title: (0, translation_1.t)("entity.approveTooltip"), id: "approve", children: (0, translation_1.t)("entity.approve") }), (0, jsx_runtime_1.jsx)("button", { title: (0, translation_1.t)("entity.rejectTooltip"), id: "reject", children: (0, translation_1.t)("entity.reject") })] }), (0, jsx_runtime_1.jsx)("script", { dangerouslySetInnerHTML: {
                                __html: `
const reviewVersion = (type) => {
    fetch("/entities/${entity.id}/${entity.version_id}", {
        method: 'PATCH',
        redirect: "follow",
        body: JSON.stringify({
            type,
            reviewMessage: document.getElementById('review_message').value
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(it => {
        window.location.href = "/entities/${entity.id}/history"
    });
};

// When the user approves a change
document.getElementById('approve').addEventListener('click', () => {
    reviewVersion("approved")
});

// When the user rejects a change
document.getElementById('reject').addEventListener('click', () => {
    reviewVersion("rejected")
});
                    `,
                            } })] })), Object.keys(infoFields).length > 0 && ((0, jsx_runtime_1.jsx)(EntityInfoBox, { editable: edit, entity: entity, fields: infoFields })), (0, jsx_runtime_1.jsx)("div", { dangerouslySetInnerHTML: {
                        __html: entity.description.replaceAll("\n", "<br />"),
                    }, contenteditable: edit, field: "description", class: "text-pretty [&>ul]:mt-2" })] }) }));
});
exports.handleEntityPage = handleEntityPage;
const handleEntityPageSubmit = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const user = c.get("user");
    const entityId = c.req.param("id");
    if (!user)
        return c.body("Unauthorized", 401);
    const entity = yield getEntity(entityId);
    if (!entity)
        return c.notFound();
    const _a = yield c.req.json(), { changeMessage } = _a, data = __rest(_a, ["changeMessage"]);
    if (!changeMessage || Object.keys(data).length === 0) {
        return c.body("Bad Request", 400);
    }
    // Update the entity with the new data
    const modifiedFields = Object.entries(data).filter(([key, value]) => {
        var _a;
        const original = entity[key];
        return value !== ((_a = original === null || original === void 0 ? void 0 : original.toString()) !== null && _a !== void 0 ? _a : "");
    });
    if (modifiedFields.length === 0)
        return c.body("Bad Request", 400);
    yield database_1.sql.begin((sql) => __awaiter(void 0, void 0, void 0, function* () {
        const [{ id: newVersionId }] = yield sql `
        INSERT INTO entity_versions ${sql({
            entity_id: entityId,
            version_number: entity.version_number + 1,
            created_by: user.id,
            change_message: changeMessage,
            description: data.description,
            review_status: "pending",
        })}
            RETURNING id;
        `;
        if (["set", "brand"].includes(entity.type))
            yield sql `
            INSERT INTO ${sql({
                set: "sets",
                brand: "brands",
            }[entity.type])} ${sql(Object.assign({ version_id: newVersionId }, Object.keys(data)
                .filter((k) => k !== "description")
                .filter((k) => data[k] !== undefined && data[k].toString().length > 0)
                .reduce((acc, key) => (Object.assign(Object.assign({}, acc), { [key]: data[key] })), {})))};
            `;
    }));
    return c.body("OK", 200);
});
exports.handleEntityPageSubmit = handleEntityPageSubmit;
const handleEntityVersionPatch = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const user = c.get("user");
    if (!user || user.permission_level < utils_1.PermissionLevel.MODERATOR)
        return c.body("Unauthorized", 401);
    const entityId = c.req.param("id");
    const versionId = c.req.param("version");
    if (!entityId || !versionId)
        return c.body("Bad Request", 400);
    const entity = yield getEntity(entityId, parseInt(versionId));
    if (!entity)
        return c.notFound();
    const { reviewMessage, type } = yield c.req.json();
    if (!reviewMessage || !type || !["approved", "rejected"].includes(type))
        return c.body("Bad Request", 400);
    // Noting that the version has been review with the provided status
    yield (0, database_1.sql) `
        UPDATE entity_versions SET review_status = ${type}, reviewed_at = NOW(), reviewed_by = ${user.id}, review_comment = ${reviewMessage} WHERE id = ${entity.version_id} AND entity_id = ${entity.id}
    `;
    if (type === "rejected")
        return c.body("OK", 200);
    // Setting the HEAD-id when approved
    yield (0, database_1.sql) `
        UPDATE entities SET head_version_id = ${entity.version_id} WHERE id = ${entity.id}
    `;
    return c.body("OK", 200);
});
exports.handleEntityVersionPatch = handleEntityVersionPatch;
