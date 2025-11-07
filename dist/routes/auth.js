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
exports.handleLogoutSubmit = exports.handleLoginSubmit = exports.handleRegisterSubmit = exports.handleRegisterPage = exports.handleLoginPage = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const layout_1 = require("../layout");
const cookie_1 = require("hono/cookie");
const database_1 = require("../database");
const utils_1 = require("../utils");
const translation_1 = require("../translation");
const CredentialsForm = ({ error }) => {
    return ((0, jsx_runtime_1.jsxs)("form", { method: "post", class: "px-4 py-3 max-w-lg", children: [error && ((0, jsx_runtime_1.jsx)("div", { class: "mb-4 p-3 border border-red-400 bg-red-50 text-red-700", children: error })), (0, jsx_runtime_1.jsxs)("div", { class: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "username", class: "block mb-1 font-medium", children: (0, translation_1.t)("auth.username") }), (0, jsx_runtime_1.jsx)("input", { id: "username", name: "username", type: "text", class: "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500", required: true })] }), (0, jsx_runtime_1.jsxs)("div", { class: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "password", class: "block mb-1 font-medium", children: (0, translation_1.t)("auth.password") }), (0, jsx_runtime_1.jsx)("input", { id: "password", name: "password", type: "password", class: "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500", required: true })] }), (0, jsx_runtime_1.jsx)("button", { type: "submit", class: "px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none", children: (0, translation_1.t)("auth.loginButton") })] }));
};
const RegisterForm = ({ error }) => {
    return ((0, jsx_runtime_1.jsxs)("form", { method: "post", class: "px-4 py-3 max-w-lg", children: [error && ((0, jsx_runtime_1.jsx)("div", { class: "mb-4 p-3 border border-red-400 bg-red-50 text-red-700", children: error })), (0, jsx_runtime_1.jsxs)("div", { class: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "username", class: "block mb-1 font-medium", children: (0, translation_1.t)("auth.username") }), (0, jsx_runtime_1.jsx)("input", { id: "username", name: "username", type: "text", class: "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500", required: true, minlength: 3, maxlength: 255 }), (0, jsx_runtime_1.jsx)("p", { class: "text-sm text-gray-500 mt-1", children: (0, translation_1.t)("auth.usernameLength") })] }), (0, jsx_runtime_1.jsxs)("div", { class: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "password", class: "block mb-1 font-medium", children: (0, translation_1.t)("auth.password") }), (0, jsx_runtime_1.jsx)("input", { id: "password", name: "password", type: "password", class: "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500", required: true, minlength: 6 }), (0, jsx_runtime_1.jsx)("p", { class: "text-sm text-gray-500 mt-1", children: (0, translation_1.t)("auth.passwordLength") })] }), (0, jsx_runtime_1.jsxs)("div", { class: "mb-6", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "confirmPassword", class: "block mb-1 font-medium", children: (0, translation_1.t)("auth.confirmPassword") }), (0, jsx_runtime_1.jsx)("input", { id: "confirmPassword", name: "confirmPassword", type: "password", class: "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500", required: true, minlength: 6 })] }), (0, jsx_runtime_1.jsx)("button", { type: "submit", class: "px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none", children: (0, translation_1.t)("auth.createAccount") })] }));
};
const handleLoginPage = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const user = c.get("user");
    if (user)
        return c.redirect("/");
    return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { user: user, children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: (0, translation_1.t)("auth.login") }), (0, jsx_runtime_1.jsx)(CredentialsForm, {}), (0, jsx_runtime_1.jsx)("div", { class: "px-4 py-3 max-w-lg", children: (0, jsx_runtime_1.jsxs)("p", { class: "text-gray-600", children: [(0, translation_1.t)("auth.dontHaveAccount"), " ", (0, jsx_runtime_1.jsx)("a", { href: "/register", class: "text-blue-600 hover:text-blue-800 underline", children: (0, translation_1.t)("auth.createOneHere") })] }) })] }) }));
});
exports.handleLoginPage = handleLoginPage;
const handleRegisterPage = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const user = c.get("user");
    if (user)
        return c.redirect("/");
    return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { user: user, children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: (0, translation_1.t)("auth.register") }), (0, jsx_runtime_1.jsx)(RegisterForm, {}), (0, jsx_runtime_1.jsx)("div", { class: "px-4 py-3 max-w-lg", children: (0, jsx_runtime_1.jsxs)("p", { class: "text-gray-600", children: [(0, translation_1.t)("auth.alreadyHaveAccount"), " ", (0, jsx_runtime_1.jsx)("a", { href: "/login", class: "text-blue-600 hover:text-blue-800 underline", children: (0, translation_1.t)("auth.logInHere") })] }) })] }) }));
});
exports.handleRegisterPage = handleRegisterPage;
const handleRegisterSubmit = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password, confirmPassword } = yield c.req.parseBody();
    // Validation
    if (!username || !password || !confirmPassword) {
        return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: "Create Account" }), (0, jsx_runtime_1.jsx)(RegisterForm, { error: (0, translation_1.t)("error.allFieldsRequired") }), (0, jsx_runtime_1.jsx)("div", { class: "px-4 py-3 max-w-lg", children: (0, jsx_runtime_1.jsxs)("p", { class: "text-gray-600", children: [(0, translation_1.t)("auth.alreadyHaveAccount"), " ", (0, jsx_runtime_1.jsx)("a", { href: "/login", class: "text-blue-600 hover:text-blue-800 underline", children: (0, translation_1.t)("auth.logInHere") })] }) })] }) }));
    }
    const usernameStr = username.toString().trim();
    const passwordStr = password.toString();
    const confirmPasswordStr = confirmPassword.toString();
    // Check username length
    if (usernameStr.length < 3 || usernameStr.length > 255) {
        return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: "Create Account" }), (0, jsx_runtime_1.jsx)(RegisterForm, { error: (0, translation_1.t)("error.usernameLength") }), (0, jsx_runtime_1.jsx)("div", { class: "px-4 py-3 max-w-lg", children: (0, jsx_runtime_1.jsxs)("p", { class: "text-gray-600", children: [(0, translation_1.t)("auth.alreadyHaveAccount"), " ", (0, jsx_runtime_1.jsx)("a", { href: "/login", class: "text-blue-600 hover:text-blue-800 underline", children: (0, translation_1.t)("auth.logInHere") })] }) })] }) }));
    }
    // Check password length
    if (passwordStr.length < 6) {
        return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: "Create Account" }), (0, jsx_runtime_1.jsx)(RegisterForm, { error: (0, translation_1.t)("error.passwordLength") }), (0, jsx_runtime_1.jsx)("div", { class: "px-4 py-3 max-w-lg", children: (0, jsx_runtime_1.jsxs)("p", { class: "text-gray-600", children: [(0, translation_1.t)("auth.alreadyHaveAccount"), " ", (0, jsx_runtime_1.jsx)("a", { href: "/login", class: "text-blue-600 hover:text-blue-800 underline", children: (0, translation_1.t)("auth.logInHere") })] }) })] }) }));
    }
    // Check password confirmation
    if (passwordStr !== confirmPasswordStr) {
        return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: "Create Account" }), (0, jsx_runtime_1.jsx)(RegisterForm, { error: (0, translation_1.t)("error.passwordsDoNotMatch") }), (0, jsx_runtime_1.jsx)("div", { class: "px-4 py-3 max-w-lg", children: (0, jsx_runtime_1.jsxs)("p", { class: "text-gray-600", children: [(0, translation_1.t)("auth.alreadyHaveAccount"), " ", (0, jsx_runtime_1.jsx)("a", { href: "/login", class: "text-blue-600 hover:text-blue-800 underline", children: (0, translation_1.t)("auth.logInHere") })] }) })] }) }));
    }
    try {
        // Check if username already exists
        const [existingUser] = yield (0, database_1.sql) `
            SELECT id FROM users WHERE username = ${usernameStr} LIMIT 1
        `;
        if (existingUser) {
            return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: "Create Account" }), (0, jsx_runtime_1.jsx)(RegisterForm, { error: (0, translation_1.t)("error.usernameExists") }), (0, jsx_runtime_1.jsx)("div", { class: "px-4 py-3 max-w-lg", children: (0, jsx_runtime_1.jsxs)("p", { class: "text-gray-600", children: [(0, translation_1.t)("auth.alreadyHaveAccount"), " ", (0, jsx_runtime_1.jsx)("a", { href: "/login", class: "text-blue-600 hover:text-blue-800 underline", children: (0, translation_1.t)("auth.logInHere") })] }) })] }) }));
        }
        // Create new user
        const [newUser] = yield (0, database_1.sql) `
            INSERT INTO users (username, password, permission_level)
            VALUES (${usernameStr}, ${passwordStr}, ${utils_1.PermissionLevel.USER})
            RETURNING *
        `;
        // Sign the user in automatically
        const token = yield (0, utils_1.signUser)(newUser);
        (0, cookie_1.setCookie)(c, "auth", token, {
            httpOnly: true,
            sameSite: "Strict",
        });
        // Redirect to home page
        return c.redirect("/");
    }
    catch (error) {
        console.error("Registration error:", error);
        return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: "Create Account" }), (0, jsx_runtime_1.jsx)(RegisterForm, { error: (0, translation_1.t)("error.accountCreationError") }), (0, jsx_runtime_1.jsx)("div", { class: "px-4 py-3 max-w-lg", children: (0, jsx_runtime_1.jsxs)("p", { class: "text-gray-600", children: [(0, translation_1.t)("auth.alreadyHaveAccount"), " ", (0, jsx_runtime_1.jsx)("a", { href: "/login", class: "text-blue-600 hover:text-blue-800 underline", children: (0, translation_1.t)("auth.logInHere") })] }) })] }) }));
    }
});
exports.handleRegisterSubmit = handleRegisterSubmit;
const handleLoginSubmit = (c) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = yield c.req.parseBody();
    if (!username || !password) {
        return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: (0, translation_1.t)("auth.login") }), (0, jsx_runtime_1.jsx)(CredentialsForm, { error: (0, translation_1.t)("error.usernamePasswordRequired") })] }) }));
    }
    const [user] = yield (0, database_1.sql) `SELECT password, id FROM users WHERE username = ${username.toString()} LIMIT 1;`;
    if (!user || user.password !== password) {
        return c.render((0, jsx_runtime_1.jsx)(layout_1.Layout, { children: (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { class: "text-3xl font-serif pb-2 mb-3 border-b", children: (0, translation_1.t)("auth.login") }), (0, jsx_runtime_1.jsx)(CredentialsForm, { error: (0, translation_1.t)("error.invalidCredentials") })] }) }));
    }
    const token = yield (0, utils_1.signUser)(user);
    (0, cookie_1.setCookie)(c, "auth", token, {
        httpOnly: true,
        sameSite: "Strict",
    });
    // Checking if there is a specific route to redirect to
    const redirect = c.req.query("redirect");
    return c.redirect(redirect !== null && redirect !== void 0 ? redirect : "/");
});
exports.handleLoginSubmit = handleLoginSubmit;
const handleLogoutSubmit = (c) => __awaiter(void 0, void 0, void 0, function* () {
    (0, cookie_1.deleteCookie)(c, "auth");
    return c.redirect("/");
});
exports.handleLogoutSubmit = handleLogoutSubmit;
