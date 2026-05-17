module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: "module"
  },
  plugins: ["@typescript-eslint", "react", "no-unsanitized"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "no-unsanitized/method": "error",
    "no-unsanitized/property": "error"
  },
  settings: {
    react: {
      version: "detect"
    }
  }
}
