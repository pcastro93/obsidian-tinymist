import { Compartment, type Extension } from '@codemirror/state'

import type { TFile } from 'obsidian'

import { dataLanguageFor } from './data-languages'
import { SourceEditorView } from './source-editor-view'

export const DATA_FILE_EDITOR_VIEW_TYPE = 'typst-data-file'

/**
 * The editor for a file a Typst document reads: a BibLaTeX `.bib` or
 * Hayagriva `.yml` bibliography, or the data behind `yaml()` and `toml()`,
 * `typst.toml` included.
 *
 * Tinymist compiles against the buffer and reports parse errors on it, which
 * the shared base already wires up, but it offers no completion or hover in
 * these files, so highlighting is all the language adds. There is also no
 * preview: none of them renders on its own.
 */
export class DataFileEditorView extends SourceEditorView {
	private readonly language = new Compartment()

	override getViewType(): string {
		return DATA_FILE_EDITOR_VIEW_TYPE
	}

	override getIcon(): string {
		return this.file?.extension.toLowerCase() === 'bib' ? 'book-marked' : 'file-code'
	}

	override getDisplayText(): string {
		return this.file?.basename ?? 'Data file'
	}

	/** Renaming `refs.bib` to `refs.yml` keeps this view, so the language follows the name. */
	override async onRename(file: TFile): Promise<void> {
		await super.onRename(file)
		this.editor?.dispatch({ effects: this.language.reconfigure(dataLanguageFor(file.extension)) })
	}

	protected override languageExtensions(): Extension[] {
		return [this.language.of(dataLanguageFor(this.file?.extension ?? ''))]
	}
}
