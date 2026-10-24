import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// Regras de dependência entre camadas (ver docs/web-architecture.md, seção 4).
const noReact = { regex: "^react(-dom|-router)?(/|$)", message: "Esta camada não pode depender do React." };
const noStorage = { regex: "(^|/)storage(/|$)", message: "Só hooks/ podem usar a camada storage/." };
const noServices = { regex: "(^|/)services(/|$)", message: "Esta camada não pode depender de services/." };
const noHooks = { regex: "(^|/)hooks(/|$)", message: "Esta camada não pode depender de hooks/." };

const browserStorageGlobals = [
  { name: "localStorage", message: "Acesse o armazenamento só pela camada storage/." },
  { name: "sessionStorage", message: "Acesse o armazenamento só pela camada storage/." }
];

export default [
  { ignores: ["dist", "dev-dist", "coverage"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-restricted-globals": ["error", ...browserStorageGlobals]
    }
  },
  {
    files: ["*.config.js"],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    files: ["src/domain/**/*.js", "src/utils/**/*.js"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [noReact, noStorage, noServices, noHooks] }]
    }
  },
  {
    files: ["src/services/**/*.js"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [noReact, noStorage, noHooks] }],
      // Serviços recebem `random` e `now` por parâmetro (docs/web-architecture.md, seção 6).
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Receba o gerador `random` por parâmetro (utils/random.js)." },
        { object: "Date", property: "now", message: "Receba `now` por parâmetro (utils/dates.js)." }
      ]
    }
  },
  {
    files: ["src/storage/**/*.js"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [noReact, noServices, noHooks] }],
      "no-restricted-globals": "off"
    }
  },
  {
    files: ["src/components/**/*.{js,jsx}", "src/pages/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [noStorage] }]
    }
  },
  {
    files: ["src/tests/**/*.js"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "no-restricted-globals": "off"
    }
  }
];
