import { cp, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDirectory = dirname(fileURLToPath(import.meta.url))
const pluginDirectory = resolve(packageDirectory, '..')
const repoRoot = resolve(pluginDirectory, '..', '..')
const source = join(repoRoot, 'docs')
const target = join(pluginDirectory, 'web')

await rm(target, { force: true, recursive: true })
await cp(source, target, { recursive: true })
