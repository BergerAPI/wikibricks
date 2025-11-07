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
exports.handleRootPage = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const layout_1 = require("../layout");
const database_1 = require("../database");
const translation_1 = require("../translation");
const handleRootPage = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const user = c.get("user");
    const [sets, brands, wikis] = yield database_1.sql.begin((sql) => __awaiter(void 0, void 0, void 0, function* () {
        const sets = yield sql `SELECT * FROM set_view LIMIT 3;`;
        const brands = yield sql `SELECT * FROM brand_view LIMIT 3;`;
        const wikis = yield sql `SELECT * FROM wiki_view LIMIT 3;`;
        return [sets, brands, wikis];
    }));
    return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { user: user, children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: (0, translation_1.t)("site.tagline") }), (0, jsx_runtime_1.jsx)("p", { class: "font-bold", children: (0, translation_1.t)("home.welcome") }), (0, jsx_runtime_1.jsx)("p", { class: "text-pretty", children: (0, translation_1.t)("home.description") }), (0, jsx_runtime_1.jsxs)("ul", { class: "mt-2", children: [(0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("span", { class: "font-semibold", children: (0, translation_1.t)("home.browseSets") }), (0, translation_1.t)("home.browseSetsBrief")] }), (0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("span", { class: "font-semibold", children: (0, translation_1.t)("home.learnBrands") }), (0, translation_1.t)("home.learnBrandsBrief")] }), (0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("span", { class: "font-semibold", children: (0, translation_1.t)("home.exploreBricks") }), (0, translation_1.t)("home.exploreBricksBrief")] })] }), (0, jsx_runtime_1.jsxs)("section", { id: "sets", class: "mt-8", children: [(0, jsx_runtime_1.jsxs)("div", { class: "pb-2 mb-3 border-b flex items-center gap-4", children: [(0, jsx_runtime_1.jsx)("h2", { class: "text-2xl font-serif", children: (0, translation_1.t)("home.latestSets") }), (0, jsx_runtime_1.jsx)("a", { class: "text-sm", href: "/entities/search?entity_type=set", children: (0, translation_1.t)("action.seeAll") })] }), (0, jsx_runtime_1.jsx)("ul", { children: sets.map((it) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsx)("a", { href: `/entities/${it.id}`, children: it.name }) }))) })] }), (0, jsx_runtime_1.jsxs)("section", { id: "brands", class: "mt-8", children: [(0, jsx_runtime_1.jsxs)("div", { class: "pb-2 mb-3 border-b flex items-center gap-4", children: [(0, jsx_runtime_1.jsx)("h2", { class: "text-2xl font-serif", children: (0, translation_1.t)("home.brands") }), (0, jsx_runtime_1.jsx)("a", { class: "text-sm", href: "/entities/search?entity_type=brand", children: (0, translation_1.t)("action.seeAll") })] }), (0, jsx_runtime_1.jsx)("ul", { children: brands.map((it) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsx)("a", { href: `/entities/${it.id}`, children: it.name }) }))) })] })] }) }));
});
exports.handleRootPage = handleRootPage;
