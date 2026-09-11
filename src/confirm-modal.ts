import { App, Modal, Setting } from "obsidian";

/** A generic Yes/Cancel confirmation dialog — Obsidian has no built-in confirm() equivalent. */
export class ConfirmModal extends Modal {
	private readonly title: string;
	private readonly message: string;
	private readonly confirmText: string;
	private readonly onConfirm: () => void | Promise<void>;

	constructor(app: App, title: string, message: string, confirmText: string, onConfirm: () => void | Promise<void>) {
		super(app);
		this.title = title;
		this.message = message;
		this.confirmText = confirmText;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		new Setting(contentEl).setName(this.title).setHeading();
		contentEl.createEl("p", { text: this.message });

		new Setting(contentEl)
			.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText(this.confirmText)
					.setWarning()
					.onClick(() => {
						this.close();
						void this.onConfirm();
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
