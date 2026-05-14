// @mostajs/workspace — promote dev → test ou test → prod
// Author: Dr Hamid MADANI <drmdh@msn.com>
//
// Règle stricte (cf user 14/05/2026) : test/ et prod/ ne sont JAMAIS édités
// directement. Ils sont remplacés par un rsync depuis l'env immédiatement
// inférieur (dev→test ou test→prod) une fois ce dernier validé.
//
// Le rsync exclut : node_modules/, .next/, .env, data/, *.sqlite*, .git/, logs/.
// Le .env de la destination est PRÉSERVÉ (chaque env a ses propres secrets +
// MOSTA_ENV correct).

import { spawn } from 'node:child_process'
import { stat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ENVS, type Env } from './types.js'

export interface PromoteOptions {
  /** Dossier racine du projet (qui contient dev/, test/, prod/). */
  projectDir: string
  /** Env source. */
  from: Env
  /** Env destination. */
  to: Env
  /** Si true, n'exécute pas le rsync — affiche juste les arguments qui seraient passés. */
  dryRun?: boolean
  /** Skip la vérification "l'env source contient bien un .next build" (debug). */
  skipBuildCheck?: boolean
}

export interface PromoteResult {
  from: Env
  to: Env
  sourceDir: string
  targetDir: string
  rsyncArgs: string[]
  stdout: string
  stderr: string
  exitCode: number
  warnings: string[]
}

/** Mapping autorisé : dev→test ou test→prod. Refuse les autres. */
const VALID_TRANSITIONS: ReadonlyArray<[Env, Env]> = [
  ['dev', 'test'],
  ['test', 'prod'],
]

const RSYNC_EXCLUDES = [
  'node_modules/',
  '.next/',
  '.env',
  '.env.local',
  '.env.*.local',
  '.env.template',
  'data/',
  '*.sqlite',
  '*.sqlite-journal',
  '*.sqlite-shm',
  '*.sqlite-wal',
  '.git/',
  'logs/',
  '*.log',
  '.DS_Store',
]

export async function promoteEnv(opts: PromoteOptions): Promise<PromoteResult> {
  const { projectDir, from, to } = opts

  // 1. Validation transition
  const isValid = VALID_TRANSITIONS.some(([a, b]) => a === from && b === to)
  if (!isValid) {
    throw new Error(
      `[workspace] transition interdite ${from}→${to}. Autorisées : ${VALID_TRANSITIONS.map(([a, b]) => `${a}→${b}`).join(', ')}`,
    )
  }
  if (!ENVS.includes(from) || !ENVS.includes(to)) {
    throw new Error(`[workspace] env invalide`)
  }

  const sourceDir = join(projectDir, from)
  const targetDir = join(projectDir, to)

  // 2. Vérifie l'existence des dossiers
  try { await stat(sourceDir) }
  catch { throw new Error(`[workspace] source introuvable: ${sourceDir}`) }
  try { await stat(targetDir) }
  catch { throw new Error(`[workspace] target introuvable: ${targetDir}`) }

  const warnings: string[] = []

  // 3. Pre-check : l'env source doit avoir un package.json
  try { await stat(join(sourceDir, 'package.json')) }
  catch { throw new Error(`[workspace] ${sourceDir}/package.json absent — env source pas initialisée`) }

  // 4. Pre-check : avertit si .next manque sur source (build manquant)
  if (!opts.skipBuildCheck) {
    try { await stat(join(sourceDir, '.next')) }
    catch {
      warnings.push(`source ${sourceDir} n'a pas de .next/ build — recommandé : 'npm run build' AVANT promote`)
    }
  }

  // 5. Build rsync args
  // rsync -av --delete --exclude=... source/ target/
  // Le trailing slash sur source = "copier le contenu", pas le dossier lui-même.
  const rsyncArgs: string[] = [
    '-av',
    '--delete',
    ...RSYNC_EXCLUDES.flatMap(e => ['--exclude', e]),
    `${sourceDir}/`,
    `${targetDir}/`,
  ]

  if (opts.dryRun) {
    return {
      from, to, sourceDir, targetDir, rsyncArgs,
      stdout: '(dry-run: rsync non exécuté)',
      stderr: '',
      exitCode: 0,
      warnings,
    }
  }

  // 6. Execute rsync
  const { stdout, stderr, code } = await runCommand('rsync', rsyncArgs)
  if (code !== 0) {
    throw new Error(`[workspace] rsync exit=${code}\nstderr:\n${stderr}`)
  }

  // 7. Update .env de la destination : MOSTA_ENV + PORT + BASE_PATH + URLs
  await updateEnvFile(targetDir, to)

  return {
    from, to, sourceDir, targetDir, rsyncArgs,
    stdout, stderr, exitCode: code, warnings,
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', (d) => stdout += d.toString())
    child.stderr.on('data', (d) => stderr += d.toString())
    child.on('error', reject)
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }))
  })
}

/**
 * Le .env de la destination existait peut-être déjà (avec ses secrets propres).
 * S'il n'existe pas → on essaye de copier .env.template présent. Sinon noop.
 * Dans tous les cas, on patche `MOSTA_ENV` pour matcher la destination.
 */
async function updateEnvFile(targetDir: string, env: Env): Promise<void> {
  const { writeFile } = await import('node:fs/promises')
  const envPath = join(targetDir, '.env')
  let content: string
  let envExisted = true
  try {
    content = await readFile(envPath, 'utf-8')
  } catch {
    envExisted = false
    try {
      content = await readFile(join(targetDir, '.env.template'), 'utf-8')
    } catch {
      return // ni .env ni .env.template — setup custom, on laisse
    }
  }
  const patched = content.replace(/^MOSTA_ENV=.*/m, `MOSTA_ENV=${env}`)
  // Écrit le .env si :
  //   - le contenu a changé (patch MOSTA_ENV)
  //   - ou le .env n'existait pas (cas premier promote depuis template)
  if (patched !== content || !envExisted) {
    await writeFile(envPath, patched, { mode: 0o600 })
  }
}
