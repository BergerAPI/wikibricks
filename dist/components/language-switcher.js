"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageSwitcher = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const translation_1 = require("../translation");
const LanguageSwitcher = () => {
    const currentLang = (0, translation_1.getCurrentLanguage)();
    const availableLanguages = (0, translation_1.getAvailableLanguages)();
    return ((0, jsx_runtime_1.jsxs)("div", { class: "relative inline-block", children: [(0, jsx_runtime_1.jsx)("select", { id: "language-switcher", class: "bg-transparent border border-gray-300 rounded px-2 py-1 text-sm cursor-pointer hover:bg-gray-50", onchange: "handleLanguageChange(this.value)", children: availableLanguages.map((lang) => ((0, jsx_runtime_1.jsx)("option", { value: lang, selected: lang === currentLang, children: lang === "en"
                        ? "English"
                        : lang === "de"
                            ? "Deutsch"
                            : lang.toUpperCase() }))) }), (0, jsx_runtime_1.jsx)("script", { dangerouslySetInnerHTML: {
                    __html: `
            function handleLanguageChange(newLang) {
              const url = new URL(window.location);
              url.searchParams.set('lang', newLang);
              window.location.href = url.toString();
            }
          `,
                } })] }));
};
exports.LanguageSwitcher = LanguageSwitcher;
