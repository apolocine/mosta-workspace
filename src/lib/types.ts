// @mostajs/workspace — types
// Author: Dr Hamid MADANI <drmdh@msn.com>

export type Env = 'dev' | 'test' | 'prod'

export const ENVS: readonly Env[] = ['dev', 'test', 'prod'] as const

/** Ports par défaut alloués aux 3 envs. Override via --port-base ou env vars. */
export interface PortAllocation {
  dev: number
  test: number
  prod: number
}

export const DEFAULT_PORTS: PortAllocation = {
  dev: 3021,
  test: 3022,
  prod: 3023,
}

/** Modules mostajs pré-installés dans le starter kit (cf user 14/05/2026). */
export const DEFAULT_MOSTAJS_DEPS: Record<string, string> = {
  '@mostajs/config': '^1.0.0',
  '@mostajs/data-plug': '^1.2.5',
  '@mostajs/orm': '^2.0.0',
  '@mostajs/auth': '^3.3.0',
  '@mostajs/mailer': '^0.1.1',
  '@mostajs/rbac': '^2.5.0',
  '@mostajs/storage': '^0.1.1',
  '@mostajs/subscriptions-plan': '^0.3.6',
  '@mostajs/qrpanel': '^0.4.0',
  '@mostajs/pwa-scan': '^1.1.1',
  '@mostajs/payment': '^0.5.3',
  '@mostajs/pm2': '^1.0.0',
}
