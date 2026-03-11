import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: [
      "migrate-db.js",
      "db-status.js",
      "db-check-owner.js",
      "eslint.config.js",
      "vite.config.js",
      "postcss.config.js",
      "tailwind.config.js",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["server/**/*.{js,jsx}"],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
