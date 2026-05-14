#!/usr/bin/env node
// @mostajs/workspace — CLI entry point
// Author: Dr Hamid MADANI <drmdh@msn.com>
//
// Commandes :
//   mostajs-workspace init <project> [--mode=path|subdomain] [--domain=...] [--ports=...] [--dry-run] [--force]
//   mostajs-workspace promote <from>-><to> [<project-dir>] [--dry-run]
//   mostajs-workspace status [<project-dir>]
//   mostajs-workspace --help

import { scaffoldProject } from '../lib/scaffold.js'
import { promoteEnv } from '../lib/promote.js'
import { getWorkspaceStatus } from '../lib/status.js'
import { resolve } from 'node:path'
import type { Env } from '../lib/types.js'

const argv = process.argv.slice(2)
const cmd = argv[0] ?? '--help'

async function main(): Promise<number> {
  switch (cmd) {
    case 'init':         return cmdInit(argv.slice(1))
    case 'promote':      return cmdPromote(argv.slice(1))
    case 'status':       return cmdStatus(argv.slice(1))
    case '--help':
    case '-h':
    case 'help':         { printHelp(); return 0 }
    case '--version':
    case '-v':           { console.log('@mostajs/workspace 0.1.0'); return 0 }
    default:             { console.error(`Unknown command: ${cmd}`); printHelp(); return 1 }
  }
}

function printHelp(): void {
  console.log(`@mostajs/workspace — scaffold multi-env (dev/test/prod)

Commands:
  init <project> [<domain>] [options]     Scaffold un projet multi-env
  promote <from>-><to> [project-dir]      Promote env (dev->test ou test->prod)
  status [project-dir]                    Affiche l'état des 3 envs
  help                                    Affiche cette aide
  --version                               Affiche la version

Arguments 'init':
  <project>                  Nom du projet (a-z0-9-)
  <domain>                   Domaine apex (optionnel, default: amia.fr).
                             Peut aussi être passé via --domain=<domain>.

Options pour 'init':
  --mode=path|subdomain      Topologie URL (default: path)
                             - path:      <project>.<domain>/{dev,test,prod}
                             - subdomain: {dev,test}.<project>.<domain> + <project>.<domain>
  --webserver=apache2|nginx  Reverse proxy (default: apache2)
  --root=<path>              Workspace root (default: ~/dev/MostaGare-Install)
  --ports=3021,3022,3023     Ports custom (default: 3021/3022/3023)
  --dry-run                  Affiche le plan sans rien écrire
  --force                    Overwrite si le dossier projet existe

Exemples:
  mostajs-workspace init iquesta-light amia.fr
  mostajs-workspace init iquesta amia.fr --mode=path --webserver=apache2
  mostajs-workspace init mostablog example.com --mode=subdomain --webserver=nginx
  mostajs-workspace promote dev->test
  mostajs-workspace status
`)
}

async function cmdInit(args: string[]): Promise<number> {
  // Arguments positionnels : <project> [<domain>]. Options : --xxx.
  const positional = args.filter(a => !a.startsWith('--'))
  const project = positional[0]
  const positionalDomain = positional[1]
  if (!project) {
    console.error('init: nom de projet manquant. Usage: mostajs-workspace init <project> [<domain>]')
    return 1
  }
  const opts: any = { project }
  if (positionalDomain) opts.domain = positionalDomain
  for (const a of args) {
    if (a.startsWith('--mode=')) opts.mode = a.slice(7)
    else if (a.startsWith('--webserver=')) opts.webserver = a.slice(12)
    else if (a.startsWith('--domain=')) opts.domain = a.slice(9)
    else if (a.startsWith('--root=')) opts.workspaceRoot = a.slice(7)
    else if (a.startsWith('--ports=')) {
      const [d, t, p] = a.slice(8).split(',').map(Number)
      opts.ports = { dev: d, test: t, prod: p }
    }
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--force') opts.force = true
  }
  try {
    const r = await scaffoldProject(opts)
    console.log(`✓ scaffold ${project} (mode=${opts.mode ?? 'path'}, webserver=${r.webserver})`)
    console.log(`  projectDir : ${r.projectDir}`)
    console.log(`  envs       : dev=${r.envDirs.dev}`)
    console.log(`               test=${r.envDirs.test}`)
    console.log(`               prod=${r.envDirs.prod}`)
    console.log(`  vhost      : ${r.webserverConfPath}`)
    console.log(`  pm2        : ${r.pm2EcosystemPath}`)
    console.log(`  workflow   : ${r.workflowDocPath}`)
    console.log(`  files      : ${r.filesCreated.length} créés`)
    for (const w of r.warnings) console.log(`  ⚠ ${w}`)
    console.log(`\nProchaines étapes :`)
    console.log(`  cd ${r.envDirs.dev}`)
    console.log(`  npm install`)
    console.log(`  npm run dev`)
    console.log(`\nVoir ${r.workflowDocPath} pour le workflow de promotion.`)
    return 0
  } catch (e: any) {
    console.error(`✗ ${e.message}`)
    return 1
  }
}

async function cmdPromote(args: string[]): Promise<number> {
  const transition = args.find(a => /->/.test(a))
  if (!transition) {
    console.error('promote: transition manquante. Usage: mostajs-workspace promote dev->test')
    return 1
  }
  const [from, to] = transition.split('->') as [Env, Env]
  const projectDir = resolve(args.find(a => !a.startsWith('--') && !a.includes('->')) ?? process.cwd())
  const dryRun = args.includes('--dry-run')

  try {
    const r = await promoteEnv({ projectDir, from, to, dryRun })
    console.log(`✓ promote ${from} → ${to}`)
    console.log(`  source : ${r.sourceDir}`)
    console.log(`  target : ${r.targetDir}`)
    if (dryRun) {
      console.log(`  rsync (dry-run) : rsync ${r.rsyncArgs.join(' ')}`)
    } else {
      const lines = r.stdout.trim().split('\n')
      console.log(`  rsync : ${lines.length} lignes`)
      if (lines.length < 20) {
        for (const l of lines) console.log(`    ${l}`)
      } else {
        for (const l of lines.slice(0, 5)) console.log(`    ${l}`)
        console.log(`    ... (${lines.length - 10} lignes omises) ...`)
        for (const l of lines.slice(-5)) console.log(`    ${l}`)
      }
    }
    for (const w of r.warnings) console.log(`  ⚠ ${w}`)
    console.log(`\nProchaines étapes :`)
    console.log(`  cd ${r.targetDir}`)
    console.log(`  npm install                # si dépendances ont changé`)
    console.log(`  npm run build              # rebuild prod`)
    console.log(`  pm2 restart <project>-${to}`)
    return 0
  } catch (e: any) {
    console.error(`✗ ${e.message}`)
    return 1
  }
}

async function cmdStatus(args: string[]): Promise<number> {
  const projectDir = resolve(args.find(a => !a.startsWith('--')) ?? process.cwd())
  try {
    const s = await getWorkspaceStatus(projectDir)
    console.log(`Workspace status — ${s.projectDir}\n`)
    const fmt = (b: boolean) => b ? '✓' : '✗'
    console.log('Env  | exists | pkg | nodemod | .next | .env | MOSTA_ENV | port | version')
    console.log('-----+--------+-----+---------+-------+------+-----------+------+--------')
    for (const env of ['dev', 'test', 'prod'] as const) {
      const e = s.envs[env]
      console.log(
        `${env.padEnd(4)} |   ${fmt(e.exists)}    |  ${fmt(e.hasPackageJson)}  |    ${fmt(e.hasNodeModules)}    |   ${fmt(e.hasNextBuild)}   |  ${fmt(e.hasEnvFile)}   | ${(e.mostaEnvDetected ?? '-').padEnd(9)} | ${(e.port?.toString() ?? '-').padEnd(4)} | ${e.packageVersion ?? '-'}`,
      )
    }
    if (s.warnings.length > 0) {
      console.log('\n⚠ Warnings :')
      for (const w of s.warnings) console.log(`  - ${w}`)
    }
    return 0
  } catch (e: any) {
    console.error(`✗ ${e.message}`)
    return 1
  }
}

main().then(code => process.exit(code)).catch(e => {
  console.error(e)
  process.exit(1)
})
