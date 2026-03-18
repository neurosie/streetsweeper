/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for CI and production builds.
 */
await import("./src/env.mjs");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },

  /**
   * Standalone output mode for production deployments
   * This creates a minimal server.js and copies only necessary files
   */
  output: "standalone",

  /**
   * Skip type checking and linting during production builds
   * Set SKIP_TYPE_CHECK=true to enable this optimization
   * Type checking should be done in CI before deployment
   */
  ...(process.env.SKIP_TYPE_CHECK === "true" && {
    typescript: {
      ignoreBuildErrors: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
  }),
};

export default config;
