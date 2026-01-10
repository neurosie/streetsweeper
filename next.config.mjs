/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
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
   * Standalone output mode for Docker deployments
   * This creates a minimal server.js and copies only necessary files
   */
  output: "standalone",

  /**
   * Skip type checking and linting during production builds
   * These checks are resource-intensive and should be done during development/CI
   * This dramatically speeds up Docker builds on resource-constrained servers
   */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default config;
