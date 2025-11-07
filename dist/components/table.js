"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableHead = exports.Table = void 0;
const jsx_runtime_1 = require("hono/jsx/jsx-runtime");
const Table = ({ children }) => ((0, jsx_runtime_1.jsx)("table", { class: "table-auto w-full mt-4 border-collapse border overflow-x-scroll [&_td]:border [&_td]:p-1 [&_th]:border", children: children }));
exports.Table = Table;
const TableHead = ({ children }) => ((0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsx)("tr", { class: "bg-background", children: children }) }));
exports.TableHead = TableHead;
