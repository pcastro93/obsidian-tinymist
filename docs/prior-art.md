# Prior art: other Tinymist-backed Obsidian plugins

Reviews of other implementations of the same idea, and what — if anything —
is worth taking from them. **No code has been copied from any of them.**

This is analysis, not a plan. Anything here that should actually happen has
to earn a place on [the roadmap](../ROADMAP.md) on its own merits; an idea
being good elsewhere is not the same as it being right here.

For the wider survey of Typst plugins in the community registry, including
the WASM-backed ones that make the opposite architectural trade, see
[the Phase 0 research](architecture/research.md#3-existing-obsidian-typst-plugins).

---

## `qiulinfan/obsidian-tinymist`

Reviewed on 2026-09-22 at commit `d959296`, the eleventh and most recent
commit, dated 2026-09-15. Apache-2.0. Manifest id `obsidian-tinymist`, name
"Tinymist Typst" — distinct from this plugin's `tinymist`, so the two can
coexist in the registry, though not in one vault
([R3](risks.md#r3-only-one-plugin-can-own-typ)).

### What it is

Roughly 2,700 lines across fourteen source files, against this plugin's
6,100 plus its test suite. The architectural bet is the same one, almost
word for word: a thin Obsidian frontend, the preview driven through
`tinymist.doStartPreview` inside the LSP session rather than a separate
process, and an explicit refusal to reimplement the compiler, the language
service, or the preview pipeline.

It is built for one person's real workload — a multi-file Chinese
mathematics vault — and that focus is visible in both directions. There is
no export of any kind, no project-root strategy (the vault is always the
root), one global preview task, a hand-written ~150-line regex tokenizer
where this plugin uses a real Lezer grammar, and a single test file run
under `node:test` with CI that only executes `npm run build`. In exchange it
has three things this plugin does not, of which one is genuinely interesting.

### The preview-entry template

This is the part worth taking seriously, because it attacks the largest open
item on this plugin's roadmap — [multi-file
projects](../ROADMAP.md#multi-file-projects) — from a direction that had not
been considered.

The problem is familiar: open `chapter-3.typ` and Tinymist compiles that file
alone, so the preview shows an unstyled fragment. The roadmap's answer is
`tinymist.pinMain`. Theirs is different. A project drops a
`.tinymist-preview.typ` file anywhere at or above the chapter's directory.
The plugin walks up to the nearest one, compiles **that** as the preview
entry, and passes the real file in as a Typst input:

```typst
#import "template.typ": chapter-layout
#show: chapter-layout
#include sys.inputs.at("preview-source")
```

The input is a vault-relative Typst path, not an OS path. Because Tinymist
`#include`s the original source rather than a copy, unsaved edits still
render and source positions are preserved, so click-to-source keeps landing
in the right file. No buffer is rewritten. Ordinary compilation and export
are untouched, since the indirection exists only for the preview session.

The implementation is `src/preview/previewEntry.ts`, twenty-nine lines, and
`tests/previewEntry.test.ts` covers the cases that matter: non-ASCII and
spaced filenames, a source outside the vault, a template above the vault
root, and the template previewing itself.

**Why this is not the same feature as `pinMain`, and why both are wanted.**
Pinning a main document answers "compile the whole book". This answers "show
me the chapter I am editing, with the book's styling applied". Those are
different needs on different days, and the roadmap's multi-file section
currently contemplates only the first. A reader who pins `main.typ` to fix
their diagnostics has also given up ever seeing a single chapter again.

Two problems stand between this and adopting it:

- **The input is server-global.** They apply it by mutating `typstExtraArgs`
  and firing `workspace/didChangeConfiguration` (`src/lsp/client.ts`, in
  `setPreviewSource`). One input key means one preview, which is fine for
  their single-task model and incompatible with this plugin's design, where
  `PreviewController` runs one task per document simultaneously. Whether the
  input can instead ride on the individual preview task needs establishing
  before any of this is designed.
- **It is a dotfile inside the user's vault.** Obsidian hides dotfiles, so
  the file cannot be seen in the file explorer, opened, or discovered by
  someone wondering why their preview changed. That is an acceptable shape
  for a personal tool and a poor one for a plugin in the community store. A
  visible filename, or a key in `typst.toml`, would carry the same mechanism
  without the invisibility.

There is a second, unrelated finding in the same code: their use of
`workspace/didChangeConfiguration` demonstrates that at least `typstExtraArgs`
applies live, without restarting the server. That is a partial answer to
[R10](risks.md#r10-settings-changes-require-a-restart), which currently
records the question as unmeasured.

### Smaller things

**`--invert-colors` accepts an object, not only a string.** This is not from
their code — they pass only the string form — but was found while checking
their preview arguments against `tinymist preview --help` on 0.15.8:

```shell
--invert-colors='{"rest": "always", "image": "never"}'
```

The accepted element kinds are `image` and `rest`. This plugin's dark preview
currently inverts photographs and figures along with the page, which is
wrong in the ordinary case; `InvertColorsStrategy` in
`src/typst/tinymist/config.ts` could carry the object form. Small change,
real improvement to something already shipped.

**`--page-title`.** One argument, and the preview is titled after the
document instead of "Typst Preview".

**Their `applyWorkspaceEdit` is a usable sketch.** It groups an LSP
`WorkspaceEdit` by file, applies edits to open views through CodeMirror and
to closed files through the adapter, and reports a count. A version here
would want the Vault API rather than `adapter.write`, so the file index and
Obsidian's own undo stay coherent, but the shape is right — and it is the
piece that makes [rename](../ROADMAP.md#go-to-definition-references-and-rename)
tractable rather than frightening.

### What the comparison exposed here

`CLIENT_CAPABILITIES` in `src/typst/tinymist/client.ts` advertises
`definitionProvider`, `referencesProvider`, `documentSymbolProvider`, and
`codeActionProvider`. Nothing in `src/` consumes any of them. That was
already known and is recorded on the roadmap under _Considering_.

What was not known: `README.md` claims, in the "What you get" table, that the
editor offers "go-to-definition, symbols, folding". Folding is real and comes
from the Lezer grammar. Go-to-definition and document symbols are not
implemented anywhere in the source. The line needs correcting whether or not
the features get built.

Their go-to-definition is about forty lines — `textDocument/definition`, F12
and Cmd/Ctrl-click bound in the editor keymap, and an open-and-place-cursor
helper this plugin already has in `revealPosition`. It is the cheapest item
on the _Considering_ list, and it is already promised to users.

### What not to take

**Semantic tokens.** Their own implementation is the argument against
adopting them, and confirms the reasoning already recorded under [Not
planned](../ROADMAP.md#semantic-tokens): a 300 ms debounce, a generation
counter to discard responses made stale by a newer edit, and a
`semanticActiveField` so the baseline tokenizer knows to yield partway
through a session. They need all of it because their fallback is a regex
tokenizer that cannot highlight Typst correctly. This plugin's fallback is a
real grammar that also supplies folding, indentation, and syntax linting.
The decision stands.

**The YOLO bridge.** An experimental, default-off setting that drives another
plugin's AI tab completion inside `.typ` files. It reaches into
`app.plugins.plugins.yolo` and calls `getTabCompletionController()` — another
plugin's private internals, which Obsidian's review guidelines would flag and
which breaks whenever that plugin ships a change. Their own documentation
says as much. Worth noting only as evidence that people want AI completion in
Typst files; not as an approach.

**`--partial-rendering=true` for the reason they give.** Their preview manager
passes it with a comment that clickable pages require it, because "canvas
pages are not clickable". Tinymist 0.15.8's own help documents the flag purely
as "only render visible part of the document… still being experimental", with
nothing about hit-testing, and click-to-source works here through
`customizedShowDocument` without it. The flag is worth passing — for payload
size on long documents — but not for that reason.

**Everything else.** Their LSP client, editor view, settings, and status bar
are all thinner than what exists here. Their binary detection is worth one
specific note: it hardcodes Homebrew, cargo, and WinGet paths and then falls
back to probing a login shell, where this plugin runs `tinymist probe` and
lets the result settle the question. Running the program is the stronger
check, because it confirms the executable really is Tinymist.

---

## Sources

- <https://github.com/qiulinfan/obsidian-tinymist> at `d959296`
- `tinymist preview --help`, Tinymist 0.15.8, Homebrew bottle,
  `aarch64-apple-darwin`
