// @mostajs/workspace — status (état des 3 envs)
// Author: Dr Hamid MADANI <drmdh@msn.com>

import { stat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ENVS, type Env } from './types.js'

export interface EnvStatus {
  env: Env
  dir: string
  exists: boolean
  hasPackageJson: boolean
  hasNodeModules: boolean
  hasNextBuild: boolean
  hasEnvFile: boolean
  mostaEnvDetected?: string  // valeur lue dans .env
  port?: number              // valeur PORT lue dans .env
  packageVersion?: string    // version lue dans package.json
}

export interface WorkspaceStatus {
  projectDir: string
  envs: Record<Env, EnvStatus>
  warnings: string[]
}

export async function getWorkspaceStatus(projectDir: string): Promise<WorkspaceStatus> {
  const warnings: string[] = []
  const envs = {} as Record<Env, EnvStatus>

  for (const env of ENVS) {
    envs[env] = await scanEnv(env, join(projectDir, env))
  }

  // Sanity warnings
  if (envs.dev.exists && envs.test.exists
      && envs.dev.packageVersion && envs.test.packageVersion
      && envs.dev.packageVersion !== envs.test.packageVersion) {
    warnings.push(`dev (${envs.dev.packageVersion}) et test (${envs.test.packageVersion}) ont des versions divergentes — promote dev→test recommandé`)
  }
  if (envs.test.exists && envs.prod.exists
      && envs.test.packageVersion && envs.prod.packageVersion
      && envs.test.packageVersion !== envs.prod.packageVersion) {
    warnings.push(`test (${envs.test.packageVersion}) et prod (${envs.prod.packageVersion}) ont des versions divergentes — promote test→prod possible si test validé`)
  }
  for (const env of ENVS) {
    if (envs[env].mostaEnvDetected && envs[env].mostaEnvDetected !== env) {
      warnings.push(`${env}/.env contient MOSTA_ENV=${envs[env].mostaEnvDetected} — devrait être ${env}`)
    }
  }

  return { projectDir, envs, warnings }
}

async function scanEnv(env: Env, dir: string): Promise<EnvStatus> {
  const status: EnvStatus = {
    env, dir,
    exists: false,
    hasPackageJson: false,
    hasNodeModules: false,
    hasNextBuild: false,
    hasEnvFile: false,
  }
  try { await stat(dir); status.exists = true } catch { return status }

  for (const [key, path] of [
    ['hasPackageJson', 'package.json'],
    ['hasNodeModules', 'node_modules'],
    ['hasNextBuild', '.next'],
    ['hasEnvFile', '.env'],
  ] as const) {
    try { await stat(join(dir, path)); (status as any)[key] = true } catch {}
  }

  if (status.hasPackageJson) {
    try {
      const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'))
      status.packageVersion = pkg.version
    } catch {}
  }
  if (status.hasEnvFile) {
    try {
      const envContent = await readFile(join(dir, '.env'), 'utf-8')
      const matchEnv = envContent.match(/^MOSTA_ENV=(\S*)$/m)
      const matchPort = envContent.match(/^PORT=(\d+)$/m)
      if (matchEnv) status.mostaEnvDetected = matchEnv[1]
      if (matchPort) status.port = Number(matchPort[1])
    } catch {}
  }
  return status
}
