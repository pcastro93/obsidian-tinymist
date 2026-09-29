#!/usr/bin/env node
/**
 * Checks that every installed CodeMirror package works with the CodeMirror
 * Obsidian ships.
 *
 * Obsidian supplies `@codemirror/state` and `@codemirror/view` at runtime, and
 * the bundle imports them as externals, so the plugin always runs against the
 * versions pinned by `obsidian`'s peer dependencies. The pnpm overrides keep
 * the dev tree on those versions too, but an override is silent: a Dependabot
 * bump to a package that needs a newer `state` or `view` would still install,
 * and tests would run a combination no user has. This fails it instead.
 *
 * Only `@codemirror/*` packages are checked. `codemirror-lang-typst` declares
 * ranges above Obsidian's, yet runs against Obsidian's copies like everything
 * else; its own tests are not ours to rerun.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PINNED = ['@codemirror/state', '@codemirror/view']

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

/** Finds `name` the way Node would from inside `fromDir`. */
function packageDir(name, fromDir) {
	for (let dir = fromDir; ; dir = dirname(dir)) {
		const candidate = join(dir, 'node_modules', name)
		if (existsSync(join(candidate, 'package.json'))) {
			return realpathSync(candidate)
		}
		if (dirname(dir) === dir) {
			throw new Error(`${name} is not installed (looked from ${fromDir})`)
		}
	}
}

const EXACT = /^\d+\.\d+\.\d+$/
const parse = (version) => version.split('.').map(Number)

/** Enough of semver for CodeMirror's ranges: exact versions and `^x.y.z`. */
function satisfies(version, range) {
	if (EXACT.test(range)) {
		return version === range
	}
	if (!range.startsWith('^') || !EXACT.test(range.slice(1))) {
		throw new Error(`Unsupported range "${range}"; extend satisfies() in ${import.meta.filename}`)
	}
	const [major, minor, patch] = parse(version)
	const [rMajor, rMinor, rPatch] = parse(range.slice(1))
	if (major !== rMajor) {
		return false
	}
	return minor > rMinor || (minor === rMinor && patch >= rPatch)
}

const root = process.cwd()
const rootPkg = readJson(join(root, 'package.json'))
const obsidianPeers = readJson(join(packageDir('obsidian', root), 'package.json')).peerDependencies ?? {}

const problems = []
for (const name of PINNED) {
	const shipped = obsidianPeers[name]
	const declared = rootPkg.devDependencies?.[name]
	if (!shipped) {
		problems.push(`obsidian no longer declares a peer dependency on ${name}; update this check`)
	} else if (declared !== shipped) {
		problems.push(`package.json has ${name} ${declared}, but Obsidian ships ${shipped}`)
	}
}

// Walk every @codemirror package reachable from package.json.
const seen = new Map()
const queue = Object.keys({ ...rootPkg.dependencies, ...rootPkg.devDependencies }).map((name) => [name, root])
while (queue.length > 0) {
	const [name, fromDir] = queue.pop()
	const dir = packageDir(name, fromDir)
	if (seen.has(dir)) {
		continue
	}
	const pkg = readJson(join(dir, 'package.json'))
	seen.set(dir, pkg)
	for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) {
		if (dep.startsWith('@codemirror/')) {
			queue.push([dep, dir])
		}
	}
}

for (const pkg of seen.values()) {
	if (!pkg.name.startsWith('@codemirror/')) {
		continue
	}
	const ranges = { ...pkg.peerDependencies, ...pkg.dependencies }
	for (const name of PINNED) {
		const range = ranges[name]
		const shipped = obsidianPeers[name]
		if (range && shipped && !satisfies(shipped, range)) {
			problems.push(`${pkg.name}@${pkg.version} needs ${name} ${range}, but Obsidian ships ${shipped}`)
		}
	}
}

if (problems.length > 0) {
	console.error('CodeMirror does not match what Obsidian ships:')
	for (const problem of problems) {
		console.error(`  - ${problem}`)
	}
	console.error("Keep these packages on versions that accept Obsidian's, or upgrade `obsidian` first.")
	process.exit(1)
}

const checked = [...seen.values()].filter((pkg) => pkg.name.startsWith('@codemirror/')).length
console.log(
	`codemirror ok: ${checked} package(s) accept state ${obsidianPeers['@codemirror/state']} and view ${obsidianPeers['@codemirror/view']}`
)
