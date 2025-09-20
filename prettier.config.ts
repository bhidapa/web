import type { Config } from "prettier";

const config: Config = {
  singleQuote: true,
  plugins: ["@prettier/plugin-php", "prettier-plugin-pkg"],
};

export default config;
