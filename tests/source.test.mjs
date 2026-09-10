// Static checks over the plugin's TypeScript sources for the "Plugin
// guidelines" and the "Obsidian October plugin self-critique checklist".
// Violations here are common review blockers even though the pages call them
// recommendations ("depending on their severity, we may still require you to
// address any violations").

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

// --- Commands --------------------------------------------------------

test("commands do not set a default hotkey", () => {
	// Plugin guidelines > Avoid setting a default hotkey for commands
	assert.ok(!/\bhotkeys\s*:/.test(allSource), "do not ship default hotkeys");
});

test("command IDs do not repeat the plugin ID", () => {
	// submission > Don't include the plugin ID in the command ID
	const ids = [...allSource.matchAll(/\bid\s*:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
	for (const id of ids) {
		assert.ok(id !== manifest.id, `command id "${id}" duplicates the plugin id`);
		assert.ok(
			!id.startsWith(manifest.id + "-"),
			`command id "${id}" is prefixed with the plugin id (Obsidian adds this)`,
		);
	}
});

// --- Styling --------------------------------------------------------

test("no styling assigned from JavaScript", () => {
	// Plugin guidelines > No hardcoded styling; OO self-critique > Compatibility
	assertNoMatch(/\.style\s*\.\s*[A-Za-z-]+\s*=/, "move styling to styles.css / CSS classes");
	assertNoMatch(/\.style\.cssText\s*=/, "move styling to styles.css / CSS classes");
	assertNoMatch(/setAttr\(\s*["']style["']/, "move styling to styles.css / CSS classes");
});

test("no hardcoded '.obsidian' config directory", () => {
	// OO self-critique > Compatibility: use Vault.configDir
	assertNoMatch(/["'`]\.obsidian(\/|["'`])/, "use this.app.vault.configDir");
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

test("mobile: no regex lookbehind (breaks iOS < 16.4)", (t) => {
	if (manifest.isDesktopOnly) return t.skip("isDesktopOnly = true");
	assertNoMatch(/\(\?<[=!]/, "avoid lookbehind assertions for mobile compatibility");
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

test("settings headings use setHeading(), not raw <h1>/<h2>", () => {
	// Plugin guidelines > Use setHeading instead of <h1>, <h2>
	if (!/PluginSettingTab\b/.test(allSource)) return; // no settings tab
	assertNoMatch(/createEl\(\s*["']h[12]["']/, "use new Setting(el).setName(...).setHeading()");
});
