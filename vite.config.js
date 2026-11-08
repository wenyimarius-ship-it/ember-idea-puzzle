import { defineConfig } from "vite";
import project from "./config/posthog-preview.json" with { type: "json" };
const environment =
  process.env.VERCEL_ENV ||
  (process.env.PUZZLE_ANALYTICS_LOCAL_TEST === "1" ? "preview" : null);
// Local/default builds remain off; deployment traffic is classified separately.
const config = ["preview", "production"].includes(environment)
  ? { ...project, environment }
  : null;
export default defineConfig({
  define: { __POSTHOG_CONFIG__: JSON.stringify(config) },
});
