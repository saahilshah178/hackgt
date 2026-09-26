import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Next 16 auto-generates AGENTS.md/CLAUDE.md on dev/build by default; instructions.md rule 5
   * ("Never create CLAUDE.md or AGENTS.md") forbids that, so it's disabled here. */
  agentRules: false,
};

export default nextConfig;
