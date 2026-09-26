import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["node_modules", "seed", "e2e", ".next"],
    env: { LLM_MODE: "mock", STORAGE_DRIVER: "local", AUDIO_MODE: "off" },
  },
});
