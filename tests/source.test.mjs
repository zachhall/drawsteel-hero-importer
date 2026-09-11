// Static checks over the plugin's TypeScript sources for the "Plugin
// guidelines" and the "Obsidian October plugin self-critique checklist".
// Violations here are common review blockers even though the pages call them
// recommendations ("depending on their severity, we may still require you to
// address any violations").
//
// This repo also runs `eslint-plugin-obsidianmd` (`npm run lint`), which
// AST-checks a lot of the same ground more precisely. Six checks that were
// here were removed as of 2026-09 once confirmed fully subsumed and improved
// on: no-manual-html-headings, no-default-hotkey, no-plugin-id-in-command-id,
// no-static-styles-assignment, hardcoded-config-path, and the regex-lookbehind
// check. Anything still here either has no ESLint equivalent (verified, not
// assumed) or is broader/stricter than its closest ESLint rule -- e.g.
// manifest.test.mjs's semver/URL-format/non-empty checks, this file's
// Electron-specific and isDesktopOnly-aware Node-module check, and its
// onunload check (also flags bare `.detach()`, not just
// `detachLeavesOfType()`). Don't remove more without the same rule-by-rule
// verification.

import { test } from "node:test";
import assert from "node:assert/strict";
import { manifest, sourceFiles, allSource } from "./helpers.mjs";

/** Assert no source file matches `re`; report the offending file + line. */
function assertNoMatch(re, message) {
	const hits = [];
	for (const { name, text } of sourceFiles) {
		text.split("\n").forEach((line, i) => {
			if (re.test(line)) hits.push(`${name}:${i + 1}  ${line.trim()}`);
			re.lastIndex = 0;
		});
	}
	assert.equal(hits.length, 0, `${message}\n${hits.join("\n")}`);
}

// --- Security -------------------------------------------------------------

test("no innerHTML / outerHTML / insertAdjacentHTML", () => {
	// Plugin guidelines > Security
	assertNoMatch(/\b(innerHTML|outerHTML|insertAdjacentHTML)\b/, "use createEl()/createDiv()/createSpan() instead");
});

test("no client-side telemetry / analytics libraries", () => {
	// Developer policies > Not allowed: "Include client-side telemetry."
	assertNoMatch(
		/\b(posthog|mixpanel|amplitude|segment\.io|google-analytics|gtag|sentry)\b/i,
		"client-side telemetry is not allowed",
	);
});

test("no remote code loading (eval / new Function / remote import)", () => {
	// Developer policies > Not allowed: obfuscation / self-updating.
	assertNoMatch(/\beval\s*\(|new Function\s*\(|import\s*\(\s*["']https?:/, "no remote code execution");
});

// --- TypeScript / coding style ------------------------------------------

test("no 'var' declarations", () => {
	// Plugin guidelines > TypeScript: "Prefer const and let over var"
	assertNoMatch(/\bvar\s+[A-Za-z_$]/, "use const or let");
});

test("no 'as any' casts", () => {
	// OO self-critique > Coding style
	assertNoMatch(/\bas\s+any\b/, "use proper typing instead of 'as any'");
});

test("no use of the global 'app' instance", () => {
	// Plugin guidelines > Avoid using global app instance
	assertNoMatch(/\bwindow\.app\b/, "use this.app");
	assertNoMatch(/(^|[^.\w])app\s*\.\s*(workspace|vault|metadataCache|fileManager|keymap)\b/, "use this.app");
});

test("no leftover sample / placeholder identifiers", () => {
	// Plugin guidelines > Rename placeholder class names; submission > Remove all sample code
	assertNoMatch(/\bMyPlugin(Settings)?\b|\bSampleSettingTab\b|\bSamplePluginSettingTab\b/, "rename sample identifiers");
});

// --- Logging -----------------------------------------------------------

test("no stray console.log (console.error/warn are fine)", () => {
	// OO self-critique > User interface: remove production console.log
	assertNoMatch(/console\s*\.\s*log\s*\(/, "remove debug logging");
});

// --- Resource management -----------------------------------------------

test("onunload (if present) does not detach leaves", () => {
	// Plugin guidelines > Don't detach leaves in onunload
	const m = allSource.match(/onunload\s*\([^)]*\)\s*\{([\s\S]*?)\n\t\}/);
	if (!m) return;
	assert.ok(!/detach(LeavesOfType)?\s*\(/.test(m[1]), "do not detach leaves in onunload");
});

// --- API usage ------------------------------------------------------

test("plugin data goes through loadData() / saveData()", () => {
	// OO self-critique > API usage
	if (!/\b(loadData|saveData)\s*\(/.test(allSource)) return; // no persisted data
	assert.ok(/\bloadData\s*\(/.test(allSource) && /\bsaveData\s*\(/.test(allSource));
	assertNoMatch(/\bwriteFileSync\b|\bfs\.promises\.writeFile\b/, "persist via saveData(), not the filesystem");
});

test("no Vault.modify / vault.delete / raw frontmatter writes", () => {
	// Plugin guidelines > Vault; OO self-critique > API usage
	assertNoMatch(/vault\s*\.\s*modify\s*\(/, "use Editor API or Vault.process");
	assertNoMatch(/vault\s*\.\s*delete\s*\(/, "use FileManager.trashFile");
});

test("user-supplied paths are run through normalizePath()", () => {
	// Plugin guidelines > Use normalizePath()
	const usesPaths = /\bgetAbstractFileByPath\b|\bcreate\s*\(|\badapter\s*\.\s*(read|write)\b/.test(allSource);
	if (!usesPaths) return;
	assert.ok(/\bnormalizePath\s*\(/.test(allSource), "wrap constructed / user paths in normalizePath()");
});

// --- Mobile (only when isDesktopOnly is false) -------------------------

test("mobile: no top-level Node.js / Electron imports", (t) => {
	if (manifest.isDesktopOnly) return t.skip("isDesktopOnly = true");
	assertNoMatch(
		/^\s*import\s+[^;]*\bfrom\s+["'](fs|path|os|crypto|electron|child_process|http|https|net|stream|util)["']/,
		"gate Node APIs behind Platform.isDesktopApp and require() them at runtime",
	);
	assertNoMatch(/\brequire\s*\(\s*["'](fs|path|os|electron|child_process)["']\s*\)/, "no static Node require() on mobile");
});

test("mobile: use Obsidian's Platform, not process.platform", (t) => {
	if (manifest.isDesktopOnly) return t.skip("isDesktopOnly = true");
	assertNoMatch(/\bprocess\s*\.\s*platform\b/, "use the Platform API from 'obsidian'");
});

test("mobile: use requestUrl, not fetch / axios", (t) => {
	if (manifest.isDesktopOnly) return t.skip("isDesktopOnly = true");
	assertNoMatch(/(^|[^.\w])fetch\s*\(|\baxios\b/, "use requestUrl() from 'obsidian'");
});

test("mobile: FileSystemAdapter only behind an instanceof check", (t) => {
	if (manifest.isDesktopOnly) return t.skip("isDesktopOnly = true");
	if (!/\bFileSystemAdapter\b/.test(allSource)) return;
	assert.ok(
		/instanceof\s+FileSystemAdapter/.test(allSource),
		"guard every FileSystemAdapter use with instanceof (mobile uses CapacitorAdapter)",
	);
});

// --- Misc guideline checks ------------------------------------------

test("moment is imported from 'obsidian' when used", () => {
	// OO self-critique > Performance
	if (!/\bmoment\b/.test(allSource)) return;
	assert.ok(
		/import\s*\{[^}]*\bmoment\b[^}]*\}\s*from\s*["']obsidian["']/.test(allSource),
		"import { moment } from 'obsidian' to avoid bundling a second copy",
	);
});
