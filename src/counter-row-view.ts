import { App, MarkdownPostProcessorContext, MarkdownRenderChild, TFile, setIcon } from "obsidian";
import { CounterRowData, CounterRowEntry, stringifyCounterRow } from "./counter-row-block";

/**
 * Renders a `~~~dshi-counter-row~~~` block's counters and wires up the same
 * click-to-edit / +/- interactivity draw-steel-elements' own `ds-counter`
 * provides — reproducing its exact DOM/class structure (confirmed by reading
 * `CounterView.build`/`makeValueEditable` in its compiled main.js) so its own
 * styles.css applies to each counter unmodified. Registered as a
 * `MarkdownRenderChild` (via `ctx.addChild()` in main.ts) rather than a plain
 * class, per Obsidian's documented pattern for a post-processed element that
 * needs its own DOM-event cleanup — every listener below goes through
 * `registerDomEvent` rather than raw `addEventListener` specifically because
 * this is a `MarkdownRenderChild`, not the `Plugin` itself: a new instance is
 * created and discarded on every scroll-driven re-render, so a leaked
 * listener here is a repeatable cost, not a one-time one.
 *
 * Write-back mirrors draw-steel-elements' own `CodeBlocks.updateMarkdownCodeBlock`
 * (splice the block's own lines via `MarkdownPostProcessorContext.getSectionInfo`),
 * but uses `Vault.process` instead of separate `read`+`modify` calls for
 * atomicity — the current Obsidian-recommended approach for this kind of
 * small in-place edit.
 */
export class CounterRowView extends MarkdownRenderChild {
	constructor(
		private readonly app: App,
		private readonly data: CounterRowData,
		private readonly ctx: MarkdownPostProcessorContext,
		el: HTMLElement
	) {
		super(el);
	}

	render(): void {
		this.containerEl.addClass("dshi-counter-row");
		this.data.counters.forEach((entry) => this.buildCounter(this.containerEl, entry));
	}

	private buildCounter(root: HTMLElement, entry: CounterRowEntry): void {
		const container = root.createDiv({ cls: "ds-counter-container ds-counter-flex" });
		const displayContainer = container.createDiv({ cls: "ds-counter-display-container" });
		let valueDisplay = displayContainer.createDiv({ cls: "ds-counter-value", text: entry.current_value.toString() });
		displayContainer.createDiv({ cls: "ds-counter-name", text: entry.name });

		const controls = container.createDiv({ cls: "ds-counter-controls" });
		const incrementButton = controls.createEl("button", { cls: "ds-counter-button" });
		setIcon(incrementButton, "chevron-up");
		const decrementButton = controls.createEl("button", { cls: "ds-counter-button" });
		setIcon(decrementButton, "chevron-down");

		const updateButtons = () => {
			if (entry.max_value !== undefined && entry.current_value >= entry.max_value) incrementButton.setAttribute("disabled", "true");
			else incrementButton.removeAttribute("disabled");
			if (entry.current_value <= entry.min_value) decrementButton.setAttribute("disabled", "true");
			else decrementButton.removeAttribute("disabled");
		};

		const commit = () => {
			updateButtons();
			void this.writeBack();
		};

		const startEditing = () => {
			const input = createEl("input", { type: "number", value: entry.current_value.toString(), cls: "ds-counter-input" });
			valueDisplay.replaceWith(input);
			input.focus();
			input.select();
			incrementButton.setAttribute("disabled", "true");
			decrementButton.setAttribute("disabled", "true");

			let finished = false;
			const finish = () => {
				if (finished) return;
				finished = true;

				let next = parseInt(input.value, 10);
				if (Number.isNaN(next)) {
					next = entry.current_value;
				} else {
					if (entry.max_value !== undefined) next = Math.min(next, entry.max_value);
					next = Math.max(next, entry.min_value);
				}
				entry.current_value = next;

				const newValueDisplay = createDiv({ cls: "ds-counter-value", text: next.toString() });
				this.registerDomEvent(newValueDisplay, "click", startEditing);
				input.replaceWith(newValueDisplay);
				valueDisplay = newValueDisplay;

				commit();
			};
			this.registerDomEvent(input, "blur", finish);
			this.registerDomEvent(input, "keydown", (e) => {
				if (e.key === "Enter") finish();
				else if (e.key === "Escape") {
					input.value = entry.current_value.toString();
					finish();
				}
			});
		};

		this.registerDomEvent(valueDisplay, "click", startEditing);
		this.registerDomEvent(incrementButton, "click", () => {
			if (entry.max_value !== undefined && entry.current_value >= entry.max_value) return;
			entry.current_value += 1;
			valueDisplay.textContent = entry.current_value.toString();
			commit();
		});
		this.registerDomEvent(decrementButton, "click", () => {
			if (entry.current_value <= entry.min_value) return;
			entry.current_value -= 1;
			valueDisplay.textContent = entry.current_value.toString();
			commit();
		});

		updateButtons();
	}

	/** `getSectionInfo` may return null (documented, expected) — skip the write rather than throw; the DOM already reflects the new value for this render pass. */
	private async writeBack(): Promise<void> {
		if (!this.ctx.sourcePath) return;
		const file = this.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
		if (!(file instanceof TFile)) return;

		const section = this.ctx.getSectionInfo(this.containerEl);
		if (!section) return;
		const { lineStart, lineEnd } = section;

		const newFence = `~~~dshi-counter-row\n${stringifyCounterRow(this.data)}\n~~~`;
		await this.app.vault.process(file, (content) => {
			const lines = content.split("\n");
			lines.splice(lineStart, lineEnd - lineStart + 1, newFence);
			return lines.join("\n");
		});
	}
}
