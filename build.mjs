// Bundle the MCP server into a single self-contained ESM file so end-users
// can install with `npm i -g @juicedresume/mcp` (or `npx @juicedresume/mcp`)
// without also needing the unpublished @juiced/schema|scoring|libraries
// workspace packages.
//
// Only true runtime dependencies (declared in package.json -> dependencies and
// not part of @juiced/*) stay external; everything else is inlined.
//
// Builder: prefers native esbuild, but falls back to esbuild-wasm when the
// native service can't start (e.g. esbuild's native binary failed to install
// under a newer Node). The output bundle is equivalent either way.

import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Externalize npm-installable runtime deps. Workspace deps (@juiced/*) are
// intentionally NOT in this list so they get inlined.
const external = Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith("@juiced/"));

const options = {
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  external,
  // (shebang already lives in src/index.ts — esbuild preserves it.)
  logLevel: "info",
};

async function withNative() {
  const esbuild = await import("esbuild");
  await esbuild.build(options);
  return "native esbuild";
}

async function withWasm() {
  const esbuild = await import("esbuild-wasm");
  await esbuild.initialize({}); // loads esbuild.wasm bundled with the package
  await esbuild.build(options);
  return "esbuild-wasm";
}

let how;
try {
  how = await withNative();
} catch (e) {
  console.warn(`native esbuild unavailable (${e?.message || e}); falling back to esbuild-wasm…`);
  how = await withWasm();
}

console.log(`✓ bundled via ${how} with ${external.length} external deps: ${external.join(", ")}`);
