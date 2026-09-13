import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	{ ignores: ["main.js", "tests/**", "esbuild.config.mjs"] },
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.*"],
				},
			},
		},
		rules: {
			// eslint-plugin-depend's generic bundle-size advice, not an Obsidian
			// requirement. js-yaml is used deliberately for both parsing (counter
			// blocks) and dumping (frontmatter/codeblock YAML) -- swapping it for
			// the suggested alternative isn't worth the behavior risk here.
			// NOTE: Obsidian's own official plugin review runs its own canonical
			// eslint-plugin-obsidianmd pass, independent of this override -- this
			// warning will keep showing up in that review regardless. That's an
			// accepted, permanent trade-off, not something this override "fixes".
			"depend/ban-dependencies": "off",
			// "Draw Steel" / "Forge Steel" are external product names, and
			// "Hero"/"Note(s)" are this plugin's own domain terms (a "Hero
			// Note"), capitalized consistently everywhere else in the UI and
			// docs -- not sentence-case violations.
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					ignoreWords: ["Draw", "Steel", "Forge", "ForgeSteel", "Hero", "Note", "Notes"],
				},
			],
		},
	},
]);
