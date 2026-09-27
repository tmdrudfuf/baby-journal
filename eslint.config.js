// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // React Compiler turns `x!.prop` inside a component into a render-time read, which crashes
    // when x is null (seen in QuickLog). Narrow explicitly instead.
    files: ['src/**/*.tsx'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'error' },
  },
  {
    ignores: ["dist/*", "supabase/functions/*/index.ts", "supabase/functions/_shared/anthropic.ts"], // Deno code: checked by `deno check` in CI
  }
]);
