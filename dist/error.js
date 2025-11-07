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
exports.handleNotFound = exports.handleError = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const layout_1 = require("./layout");
const translation_1 = require("./translation");
const ErrorPage = ({ context }) => {
    const statusCode = context.res.status || 500;
    const title = statusCode === 404
        ? (0, translation_1.t)("error.pageNotFound")
        : (0, translation_1.t)("error.somethingWentWrong");
    const message = statusCode === 404
        ? (0, translation_1.t)("error.pageNotFoundMessage")
        : (0, translation_1.t)("error.unexpectedErrorMessage");
    return ((0, jsx_runtime_1.jsx)(layout_1.Layout, { user: context.get("user"), children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsxs)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: ["Error:", title] }), (0, jsx_runtime_1.jsx)("p", { class: "pb-2", children: message }), (0, jsx_runtime_1.jsx)("a", { href: "/", children: (0, translation_1.t)("action.returnHome") })] }) }));
};
const handleError = (err, c) => {
    // TODO: Log error to a service like Sentry
    c.status(c.res.status);
    console.error(err);
    return c.html((0, jsx_runtime_1.jsx)(ErrorPage, { context: c }));
};
exports.handleError = handleError;
const handleNotFound = (c, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (c.res.status.toString().startsWith("2") ||
        c.res.status.toString().startsWith("3"))
        return yield next();
    c.status(c.res.status);
    return c.html((0, jsx_runtime_1.jsx)(ErrorPage, { context: c }));
});
exports.handleNotFound = handleNotFound;
