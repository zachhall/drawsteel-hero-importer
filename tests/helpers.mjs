// Shared loaders for the compliance test suite.
//
// Every assertion in this suite maps to a published Obsidian requirement or
// guideline. Sources:
//   - Submission requirements: https://docs.obsidian.md/community-directory/submission-requirements-for-plugins
//   - Developer policies:      https://docs.obsidian.md/community-directory/developer-policies
//   - Submit your plugin:      https://docs.obsidian.md/plugins/releasing/submit-plugin
//   - Manifest schema:         https://docs.obsidian.md/Reference/Manifest
//   - Plugin guidelines:       https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
//   - OO self-critique:        https://docs.obsidian.md/oo/plugin

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function readRoot(name) {
	return readFileSync(join(ROOT, name), "utf8");
}

export function rootHas(name) {
	return existsSync(join(ROOT, name));
}

export const manifest = JSON.parse(readRoot("manifest.json"));

export const pkg = JSON.parse(readRoot("package.json"));

export const versions = rootHas("versions.json")
	? JSON.parse(readRoot("versions.json"))
	: null;

const IGNORED_DIRS = new Set(["node_modules", "tests", ".git", "dist", "build"]);

/** Recursively collect plugin TypeScript sources (root + subfolders like src/). */
function collectSources(dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!IGNORED_DIRS.has(entry.name)) out.push(...collectSources(join(dir, entry.name)));
			continue;
		}
		if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;
		const full = join(dir, entry.name);
		out.push({ name: relative(ROOT, full).replace(/\\/g, "/"), text: readFileSync(full, "utf8") });
	}
	return out;
}

export const sourceFiles = collectSources(ROOT);

export const allSource = sourceFiles.map((f) => f.text).join("\n");

/** Files tracked by git, or null when git is unavailable / not a repo. */
export function gitTrackedFiles() {
	try {
		return execSync("git ls-files", { cwd: ROOT, encoding: "utf8" })
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean);
	} catch {
		return null;
	}
}

/** Local git tags, or null when git is unavailable / not a repo. */
export function gitTags() {
	try {
		return execSync("git tag --list", { cwd: ROOT, encoding: "utf8" })
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean);
	} catch {
		return null;
	}
}

// Matches emoji / pictographic and other non-ASCII "special" characters.
export const NON_ASCII = /[^\x09\x0a\x0d\x20-\x7e]/;
export const SEMVER = /^\d+\.\d+\.\d+$/;
