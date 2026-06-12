import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import react from "eslint-plugin-react";

export default [
  // ✅ Base recommended rules
  js.configs.recommended,

  // ============================================================
  // ✅ BACKEND (Node.js - CommonJS)
  // ============================================================
  {
    files: ["community-savings-app-backend/**/*.js"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",

      globals: {
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },

    plugins: {
      import: importPlugin
    },

    rules: {
      "no-unused-vars": ["warn"],
      "no-console": "off",

      // ✅ Import validation
      "import/no-unresolved": "error",
      "import/named": "error"
    }
  },

  // ============================================================
  // ✅ FRONTEND (React + Vite - ES Modules)
  // ============================================================
  {
    files: ["community-savings-app-frontend/src/**/*.{js,jsx,ts,tsx}"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly"
      }
    },

    plugins: {
      react,
      import: importPlugin
    },

    settings: {
      react: {
        version: "detect"
      }
    },

    rules: {
      ...react.configs.recommended.rules,

      // ✅ React 17+
      "react/react-in-jsx-scope": "off",

      // ✅ General
      "no-unused-vars": ["warn"],

      // ✅ Import validation
      "import/no-unresolved": "error",
      "import/named": "error"
    }
  },

  // ============================================================
  // ✅ TEST FILES (Jest / Vitest)
  // ============================================================
  {
    files: [
      "**/*.test.js",
      "**/*.spec.js",
      "**/tests/**/*.js"
    ],

    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        jest: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        afterAll: "readonly",
        afterEach: "readonly"
      }
    }
  },

  // ============================================================
  // ✅ IGNORE FILES
  // ============================================================
  {
    ignores: [
      "node_modules",
      "dist",
      "build",
      "coverage",
      "logs"
    ]
  }
];