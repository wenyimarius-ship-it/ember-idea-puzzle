import { defineConfig } from "vite";
import preview from "./config/posthog-preview.json" with { type: "json" };
// Public write-only collection token. Never enable or include it in Production.
const enabled =
  process.env.VERCEL_ENV === "preview" ||
  (process.env.VERCEL_ENV !== "production" &&
    process.env.PUZZLE_ANALYTICS_LOCAL_TEST === "1");
export default defineConfig({
  define: { __POSTHOG_PREVIEW__: JSON.stringify(enabled ? preview : null) },
});
