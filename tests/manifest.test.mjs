// manifest.json — hard requirements from the Manifest schema and the
// "Submission requirements for plugins" page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { manifest, versions, NON_ASCII, SEMVER } from "./helpers.mjs";

test("required manifest fields are present", () => {
	// https://docs.obsidian.md/Reference/Manifest
	for (const field of [
		"id",
		"name",
		"version",
		"minAppVersion",
		"description",
		"author",
		"isDesktopOnly",
	]) {
		assert.ok(field in manifest, `manifest.json is missing "${field}"`);
	}
});

test("id: lowercase letters and hyphens only, no 'obsidian', not ending in 'plugin'", () => {
	// Manifest schema + submit-plugin: "The id must be unique ... and can't contain obsidian."
	assert.match(manifest.id, /^[a-z-]+$/);
	assert.ok(!manifest.id.includes("obsidian"), "id must not contain 'obsidian'");
	assert.ok(!manifest.id.endsWith("plugin"), "id must not end with 'plugin'");
});

test("name: Basic Latin, no 'Obsidian'/'Plugin', no emoji or disallowed punctuation", () => {
	// https://docs.obsidian.md/Reference/Manifest#name
	assert.ok(!NON_ASCII.test(manifest.name), "name must use Basic Latin characters only");
	assert.match(manifest.name, /^[A-Za-z0-9 ()+-]+$/, "only hyphen, plus, parentheses allowed as punctuation");
	assert.ok(!/obsi|sidian/i.test(manifest.name), "name must not reference 'Obsidian'");
	assert.ok(!/\bplugin\b/i.test(manifest.name), "plugin names may not contain the word 'Plugin'");
});

test("version: Semantic Versioning in x.y.z form", () => {
	// submit-plugin Step 2: "Versions supported only in the format x.y.z."
	assert.match(manifest.version, SEMVER);
});

test("minAppVersion: set to a concrete x.y.z version", () => {
	// "Set an appropriate minAppVersion"
	assert.ok(manifest.minAppVersion, "minAppVersion must be set");
	assert.match(manifest.minAppVersion, SEMVER);
});

test("isDesktopOnly is a boolean", () => {
	assert.equal(typeof manifest.isDesktopOnly, "boolean");
});

test("author is a non-empty string", () => {
	assert.equal(typeof manifest.author, "string");
	assert.ok(manifest.author.trim().length > 0);
});

test("description: <= 250 chars, ends with a period, no emoji/special chars", () => {
	// "Keep plugin descriptions short and simple"
	const d = manifest.description;
	assert.ok(d.length <= 250, `description is ${d.length} chars (max 250)`);
	assert.ok(d.endsWith("."), "description must end with a period");
	assert.ok(!NON_ASCII.test(d), "description must avoid emoji and special characters");
});

test("description: does not start with 'This is a plugin'", () => {
	assert.ok(
		!manifest.description.toLowerCase().startsWith("this is a plugin"),
		"start with an action statement instead",
	);
});

test("authorUrl, if present, is an http(s) URL", () => {
	if (!("authorUrl" in manifest)) return;
	assert.match(manifest.authorUrl, /^https?:\/\/\S+$/);
});

test("fundingUrl, if present, is a URL or an object of URLs", () => {
	// "Only use fundingUrl to link to services for financial support"
	if (!("fundingUrl" in manifest)) return;
	const f = manifest.fundingUrl;
	if (typeof f === "string") {
		assert.match(f, /^https?:\/\/\S+$/);
	} else {
		assert.equal(typeof f, "object");
		for (const [label, url] of Object.entries(f)) {
			assert.ok(label.length > 0);
			assert.match(url, /^https?:\/\/\S+$/);
		}
	}
});

test("versions.json, if present, is consistent with the manifest", () => {
	if (!versions) return;
	for (const [pluginVer, appVer] of Object.entries(versions)) {
		assert.match(pluginVer, SEMVER, `versions.json key "${pluginVer}" is not x.y.z`);
		assert.match(appVer, SEMVER, `versions.json value "${appVer}" is not x.y.z`);
	}
	assert.ok(
		manifest.version in versions,
		`versions.json has no entry for the current version ${manifest.version}`,
	);
	assert.equal(
		versions[manifest.version],
		manifest.minAppVersion,
		"versions.json entry for the current version must equal manifest.minAppVersion",
	);
});
