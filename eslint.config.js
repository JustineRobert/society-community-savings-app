// eslint.config.js
import js from "@eslint/js";
import react from "eslint-plugin-react";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    env: {
      browser: true,
      es2021: true,
    },
    plugins: {
      react,
    },
    rules: {
      // Add custom rules here if needed
    },
  },
];
