#!/usr/bin/env node
// Copy src/templates → dist/templates after tsc build
// Author: Dr Hamid MADANI <drmdh@msn.com>
//
// TSC ne copie pas les non-.ts. On copie le dossier templates/ post-build pour
// que `dist/` contienne tout ce que `files` de package.json doit ship.

import { cp } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..', 'src', 'templates')
const dst = join(__dirname, '..', 'dist', 'templates')

await cp(src, dst, { recursive: true, force: true })
console.log(`✓ templates copied to ${dst}`)
