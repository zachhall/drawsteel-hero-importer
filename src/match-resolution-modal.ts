import { App, Modal, Setting, TFile } from "obsidian";

/** Result of resolving one ambiguous/missing DS Compendium match — either a chosen file, or an explicit "skip" (render as plain text, no link). Awaited by the caller; never both undefined and unresolved. */
export type MatchResolution = { file: TFile } | { skip: true };

/**
 * Shown once per PDF-sourced field the compendium resolver couldn't
 * confidently match on its own — either because the name matched more than
 * one note, or matched none at all. Per the user's explicit decision, PDF
 * import never silently guesses or leaves a bare unresolved placeholder;
 * this modal is the only way those cases get settled. Follows
 * confirm-modal.ts's structural pattern (Modal subclass, Setting-based UI,
 * constructor takes prompt data + a callback).
 */
export class MatchResolutionModal extends Modal {
	private readonly fieldLabel: string;
	private readonly rawValue: string;
	private readonly candidates: TFile[];
	private readonly onResolve: (result: MatchResolution | undefined) => void;
	private resolved = false;

	constructor(app: App, fieldLabel: string, rawValue: string, candidates: TFile[], onResolve: (result: MatchResolution | undefined) => void) {
		super(app);
		this.fieldLabel = fieldLabel;
		this.rawValue = rawValue;
		this.candidates = candidates;
		this.onResolve = onResolve;
	}

	onOpen(): void {
		const { contentEl } = this;

		const heading = this.candidates.length
			? `${this.fieldLabel}: multiple matches for "${this.rawValue}"`
			: `${this.fieldLabel}: no compendium match for "${this.rawValue}"`;
		new Setting(contentEl).setName(heading).setHeading();

		if (this.candidates.length) {
			contentEl.createEl("p", { text: "Choose which note this refers to:" });
			this.candidates.forEach((file) => {
				new Setting(contentEl).setName(file.basename).addButton((button) =>
					button
						.setButtonText("Use this")
						.setCta()
						.onClick(() => this.finish({ file }))
				);
			});
		} else {
			contentEl.createEl("p", {
				text: `No note in the DS Compendium matched "${this.rawValue}". You can skip this field — it'll ` +
					"render as plain text with no link — or cancel the whole import.",
			});
		}

		new Setting(contentEl)
			.addButton((button) => button.setButtonText("Cancel entire import").onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText("Skip — leave unlinked")
					.setWarning()
					.onClick(() => this.finish({ skip: true }))
			);
	}

	private finish(result: MatchResolution): void {
		this.resolved = true;
		this.close();
		this.onResolve(result);
	}

	onClose(): void {
		this.contentEl.empty();
		// Closing without picking an option (the "Cancel entire import" button, or
		// the dialog's own X/Escape) means the caller's await never resolves on
		// its own — surface that as undefined so the whole import can abort cleanly.
		if (!this.resolved) this.onResolve(undefined);
	}
}

/** Promise wrapper around MatchResolutionModal so callers can `await` a resolution inline in the PDF import pipeline (see pdf-compendium-resolver.ts). */
export function promptForMatchResolution(app: App, fieldLabel: string, rawValue: string, candidates: TFile[]): Promise<MatchResolution | undefined> {
	return new Promise((resolve) => {
		new MatchResolutionModal(app, fieldLabel, rawValue, candidates, resolve).open();
	});
}
