// Repository layout, licensing, and release requirements from
// "Submit your plugin" and the "Developer policies" page.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
	manifest,
	allSource,
	readRoot,
	rootHas,
	gitTrackedFiles,
	gitTags,
} from "./helpers.mjs";

test("README.md exists at the repo root", () => {
	// submit-plugin "Before you begin"
	assert.ok(rootHas("README.md"));
	assert.ok(readRoot("README.md").trim().length > 0, "README.md must not be empty");
});

test("a LICENSE file exists and names a license", () => {
	// Developer policies > Copyright and licensing
	const candidate = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license"].find(rootHas);
	assert.ok(candidate, "repo must include a LICENSE file");
	const text = readRoot(candidate);
	assert.match(
		text,
		/\b(MIT|Apache|GNU|GPL|LGPL|AGPL|BSD|ISC|Mozilla Public License|MPL|Unlicense|CC0)\b/i,
		"LICENSE file must clearly indicate the license",
	);
});

test("network use, if any, is disclosed in the README", () => {
	// Developer policies > Disclosures: "Network use. Clearly explain which
	// remote services are used and why they're needed."
	const usesNetwork = /\b(requestUrl|fetch\s*\(|XMLHttpRequest|new WebSocket|axios)\b/.test(
		allSource,
	);
	if (!usesNetwork) return; // fully local plugin — nothing to disclose
	const readme = readRoot("README.md").toLowerCase();
	assert.ok(
		/network|internet|remote|server|sync|api|download/.test(readme),
		"source makes network calls but the README does not disclose remote service use",
	);
});

test("manifest.json at repo root matches the committed default branch", () => {
	// submit-plugin Step 3: "The directory processes the manifest.json at the
	// HEAD of your repository's default branch."
	const tracked = gitTrackedFiles();
	if (!tracked) return; // not a git checkout
	assert.ok(tracked.includes("manifest.json"), "manifest.json must be committed");
});

test("main.js is NOT committed to the repo (release-only artifact)", () => {
	// OO self-critique: "Don't include main.js in your repo. Only include it in your releases."
	const tracked = gitTrackedFiles();
	if (!tracked) return;
	assert.ok(!tracked.includes("main.js"), "main.js must be gitignored, not committed");
});

test("a dependency lock file is committed", () => {
	// OO self-critique > Security
	const tracked = gitTrackedFiles();
	if (!tracked) return;
	const locks = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];
	assert.ok(
		locks.some((l) => tracked.includes(l)),
		`commit a lock file (${locks.join(", ")})`,
	);
});

test("a git tag matches the manifest version (GitHub release requirement)", () => {
	// submit-plugin Step 2: "The 'Tag version' of the release must match the
	// version in your manifest.json."
	const tags = gitTags();
	if (!tags || tags.length === 0) return;
	assert.ok(
		tags.includes(manifest.version),
		`no tag "${manifest.version}" found; a release tag must match manifest.version`,
	);
});
