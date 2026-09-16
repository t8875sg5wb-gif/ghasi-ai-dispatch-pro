import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BINDENDE_MCP_SCOPES, type McpScope } from "./authz";

const toolsDir = fileURLToPath(new URL("./tools/", import.meta.url));
const mutation = /\.(insert|update|upsert|delete)\s*\(/;
const scopeCall = /autorisiere\(ctx,\s*"(ghasi:[^"]+)"\)/g;

describe("MCP-Schreibsicherheit", () => {
  it("jedes direkt mutierende Tool laeuft ueber einen fail-closed Scope", () => {
    const mutierendeTools: string[] = [];

    for (const name of readdirSync(toolsDir).filter((n) => n.endsWith(".ts"))) {
      const source = readFileSync(
        fileURLToPath(new URL(`./tools/${name}`, import.meta.url)),
        "utf8",
      );
      const mutationIndex = source.search(mutation);
      if (mutationIndex < 0) continue;
      mutierendeTools.push(name);

      const matches = [...source.matchAll(scopeCall)];
      expect(matches.length, `${name}: Autorisierung fehlt`).toBeGreaterThan(0);
      for (const match of matches) {
        expect(BINDENDE_MCP_SCOPES, `${name}: Scope ${match[1]} ist nicht fail-closed`).toContain(
          match[1] as McpScope,
        );
      }
      expect(source.indexOf("autorisiere("), `${name}: Gate muss vor Mutation stehen`).toBeLessThan(
        mutationIndex,
      );
    }

    expect(mutierendeTools.sort()).toEqual(
      ["create-invoice.ts", "create-order.ts", "update-order-status.ts"].sort(),
    );
  });
});
