import { type StreamParser, StringStream } from '@codemirror/language'

import { describe, expect, it } from 'vitest'

import { bibtex, dataLanguageFor } from '../../src/editor/data-languages'

/** Runs a stream parser the way CodeMirror does, one line at a time. */
function tokens<State>(parser: StreamParser<State>, text: string): [string, string | null][] {
	const state = parser.startState!(2)
	const out: [string, string | null][] = []
	for (const line of text.split('\n')) {
		const stream = new StringStream(line, 4, 2)
		while (!stream.eol()) {
			const style = parser.token(stream, state)
			const current = stream.current()
			if (current.trim() !== '') {
				out.push([current, style])
			}
			stream.start = stream.pos
		}
	}
	return out
}

/** The style of every token whose text is exactly `text`. */
function styleOf(parsed: [string, string | null][], text: string): (string | null)[] {
	return parsed.filter(([t]) => t === text).map(([, style]) => style)
}

describe('BibTeX highlighting', () => {
	const entry = [
		'@article{knuth1984,',
		'  title = {Literate {P}rogramming},',
		'  year = 1984,',
		'  author = "Donald " # knuth,',
		'}'
	].join('\n')

	it('marks the entry type, citation key, and field names', () => {
		const parsed = tokens(bibtex, entry)
		expect(styleOf(parsed, '@article')).toEqual(['keyword'])
		expect(styleOf(parsed, 'knuth1984')).toEqual(['labelName'])
		expect(styleOf(parsed, 'title')).toEqual(['propertyName'])
		expect(styleOf(parsed, 'year')).toEqual(['propertyName'])
	})

	it('reads nested braces as one value', () => {
		expect(styleOf(tokens(bibtex, entry), '{Literate {P}rogramming}')).toEqual(['string'])
	})

	it('tells numbers, quoted strings, and macros apart', () => {
		const parsed = tokens(bibtex, entry)
		expect(styleOf(parsed, '1984')).toEqual(['number'])
		expect(styleOf(parsed, '"Donald "')).toEqual(['string'])
		expect(styleOf(parsed, '#')).toEqual(['operator'])
		expect(styleOf(parsed, 'knuth')).toEqual(['variableName'])
	})

	it('carries a braced value across lines', () => {
		const parsed = tokens(bibtex, '@book{k,\n  note = {first line\n  second line},\n  year = 2000\n}')
		expect(styleOf(parsed, '{first line')).toEqual(['string'])
		expect(styleOf(parsed, '  second line}')).toEqual(['string'])
		expect(styleOf(parsed, 'year')).toEqual(['propertyName'])
	})

	it('keeps a quote inside braces from ending a quoted value', () => {
		const parsed = tokens(bibtex, '@misc{k, title = "a {"} b", year = 1}')
		expect(styleOf(parsed, '"a {"} b"')).toEqual(['string'])
		expect(styleOf(parsed, 'year')).toEqual(['propertyName'])
	})

	it('treats text between entries, and @comment, as comments', () => {
		const parsed = tokens(bibtex, '% mail me@example.org\nloose text\n@comment{ignored {nested} }\n@book{k, year = 1}')
		expect(styleOf(parsed, '% mail me@example.org')).toEqual(['comment'])
		expect(styleOf(parsed, 'loose text')).toEqual(['comment'])
		expect(styleOf(parsed, 'ignored {nested} }')).toEqual(['comment'])
		expect(styleOf(parsed, 'k')).toEqual(['labelName'])
	})

	it('gives @string a field, not a citation key', () => {
		const parsed = tokens(bibtex, '@string{jan = "January"}')
		expect(styleOf(parsed, 'jan')).toEqual(['propertyName'])
	})

	it('accepts parentheses around an entry', () => {
		const parsed = tokens(bibtex, '@book(k, year = 1)\n@misc{m}')
		expect(styleOf(parsed, 'k')).toEqual(['labelName'])
		expect(styleOf(parsed, 'm')).toEqual(['labelName'])
	})
})

describe('choosing a language', () => {
	it('highlights every extension the data editor opens', () => {
		for (const extension of ['bib', 'yml', 'yaml', 'toml', 'BIB']) {
			expect(dataLanguageFor(extension), extension).not.toEqual([])
		}
	})

	it('leaves an unknown extension plain', () => {
		expect(dataLanguageFor('txt')).toEqual([])
		expect(dataLanguageFor('')).toEqual([])
	})
})
