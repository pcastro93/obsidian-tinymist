/** The file extension of a Typst document. */
export const TYPST_EXTENSION = 'typ'

/** A BibLaTeX bibliography, which Typst reads through `#bibliography`. */
export const BIBLATEX_EXTENSION = 'bib'

/** A Hayagriva bibliography, Typst's own YAML format. New files use the first. */
export const HAYAGRIVA_EXTENSIONS = ['yml', 'yaml'] as const

/**
 * Data a Typst document loads with `yaml()` or `toml()`, `typst.toml` included,
 * and YAML doubling as Hayagriva.
 *
 * Obsidian hides a file whose extension no view claims, so these are claimed
 * by default. It is one setting because claiming them claims every such file
 * in the vault, which a plugin that edits YAML or TOML may want instead.
 */
export const DATA_EXTENSIONS = [...HAYAGRIVA_EXTENSIONS, 'toml'] as const
