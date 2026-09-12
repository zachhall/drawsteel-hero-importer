// node --experimental-strip-types can import a standalone .ts file directly,
// but Node's ESM resolver (unlike esbuild's bundler resolution, used by the
// real build) requires relative specifiers to include an extension — so a
// .ts module with its own local imports (e.g. pdf-field-map.ts importing
// "./pdf-hero-types") can't be imported directly. Bundling it through esbuild
// first (matching esbuild.config.mjs's own resolution) sidesteps that
// without changing any src import specifier.
import esbuild from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function importTs(entryPath) {
	const result = await esbuild.build({
		entryPoints: [entryPath],
		bundle: true,
		format: "esm",
		platform: "node",
		external: ["obsidian", "pdf-lib"],
		write: false,
	});
	const dir = mkdtempSync(join(tmpdir(), "dshi-test-"));
	const outfile = join(dir, "bundle.mjs");
	writeFileSync(outfile, result.outputFiles[0].text);
	return import(pathToFileURL(outfile).href);
}
