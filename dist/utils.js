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
exports.detectLanguage = exports.attemptAuthentication = exports.signUser = exports.PermissionLevel = void 0;
const database_1 = require("./database");
const jwt_1 = require("hono/jwt");
const cookie_1 = require("hono/cookie");
const translation_1 = require("./translation");
const SECRET = "your-secret-here";
// Permission levels for all users
var PermissionLevel;
(function (PermissionLevel) {
    PermissionLevel[PermissionLevel["USER"] = 0] = "USER";
    PermissionLevel[PermissionLevel["MODERATOR"] = 5] = "MODERATOR";
    PermissionLevel[PermissionLevel["ADMIN"] = 9] = "ADMIN";
})(PermissionLevel || (exports.PermissionLevel = PermissionLevel = {}));
// Function to sign a user jwt (JSON Web Token)
const signUser = (user) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, jwt_1.sign)({ id: user.id }, SECRET);
});
exports.signUser = signUser;
// Middleware to verify authentication
const attemptAuthentication = (c, next) => __awaiter(void 0, void 0, void 0, function* () {
    const token = (0, cookie_1.getCookie)(c, "auth");
    if (!token) {
        return yield next();
    }
    try {
        const payload = yield (0, jwt_1.verify)(token, SECRET);
        const [user] = yield (0, database_1.sql) `SELECT * FROM users WHERE id = ${payload.id} LIMIT 1`;
        if (!user) {
            return yield next();
        }
        c.set("user", user);
        yield next();
    }
    catch (_a) {
        return yield next();
    }
});
exports.attemptAuthentication = attemptAuthentication;
// Middleware to detect and set language
const detectLanguage = (c, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Check for language preference in query parameter
    let language = c.req.query("lang");
    // If not in query, check Accept-Language header
    if (!language) {
        const acceptLanguage = c.req.header("Accept-Language");
        if (acceptLanguage) {
            // Simple language detection from Accept-Language header
            const languages = acceptLanguage
                .split(",")
                .map((lang) => lang.trim().split(";")[0].split("-")[0]);
            language = languages.find((lang) => (0, translation_1.isLanguageSupported)(lang)) || "en";
        }
    }
    // Default to English if not supported
    if (!language || !(0, translation_1.isLanguageSupported)(language)) {
        language = "en";
    }
    // Set global language context
    (0, translation_1.setLanguage)(language);
    c.set("language", language);
    yield next();
});
exports.detectLanguage = detectLanguage;
