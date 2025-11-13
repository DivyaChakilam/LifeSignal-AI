const tsPlugin = require("@typescript-eslint/eslint-plugin");
const parser = require("@typescript-eslint/parser");

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    files: ["**/*.ts", "**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
