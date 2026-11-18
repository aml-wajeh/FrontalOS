/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@frontalos/design-tokens"],
  // Produces .next/standalone (a self-contained server bundle + a pruned
  // node_modules) so the production Docker image doesn't need to ship the
  // full workspace node_modules or run `next start` against source files.
  // See apps/web/Dockerfile's "runner" stage.
  output: "standalone",
};

export default nextConfig;
