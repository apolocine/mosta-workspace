// Bootstrap chaîné des modules @mostajs — __PROJECT__
// Author: Dr Hamid MADANI <drmdh@msn.com>
//
// Idempotent : seul le premier appel exécute la chaîne, les suivants
// retournent immédiatement. Appelé depuis lib/db.ts lazy au premier hit.

import { getEnv } from '@mostajs/config'

let _initialized = false
let _bootstrapPromise: Promise<void> | null = null

export async function bootstrap(): Promise<void> {
  if (_initialized) return
  if (_bootstrapPromise) return _bootstrapPromise
  _bootstrapPromise = doBootstrap()
  await _bootstrapPromise
  _initialized = true
}

async function doBootstrap(): Promise<void> {
  const env = getEnv('MOSTA_ENV', 'dev')
  console.log(`[bootstrap] __PROJECT__ — env=${env}`)

  // ─── 1. ORM — register schemas + dialect ──────────────────────────
  const { registerSchemas } = await import('@mostajs/orm')
  const schemas = await import('@/schemas')
  registerSchemas(Object.values(schemas).filter((s: any) => s?.name && s?.fields))

  // ─── 2. data-plug — résoud le dialect selon MOSTA_DATA ────────────
  // (déjà actif via @mostajs/data-plug.getDialect() qui lit MOSTA_DATA)

  // ─── 3. Auth — si module présent ──────────────────────────────────
  // try {
  //   const auth = await import('@mostajs/auth')
  //   // auth.configure({ ... })
  // } catch {}

  // ─── 4. Mailer ────────────────────────────────────────────────────
  // try {
  //   const { configureMailer } = await import('@mostajs/mailer')
  //   configureMailer({
  //     driver: env === 'prod' ? 'smtp' : 'console',
  //     smtp: { host: getEnv('SMTP_HOST'), port: Number(getEnv('SMTP_PORT', 587)) },
  //   })
  // } catch {}

  // ─── 5. RBAC ──────────────────────────────────────────────────────
  // ─── 6. Storage ───────────────────────────────────────────────────
  // ─── 7. Subscriptions plan ────────────────────────────────────────
  // ─── 8. QRPanel ───────────────────────────────────────────────────
  // ─── 9. PWA-scan ──────────────────────────────────────────────────
  // ─── 10. Payment ──────────────────────────────────────────────────
  // ─── 11. pm2 (helpers process si nécessaires) ─────────────────────

  console.log(`[bootstrap] __PROJECT__ — OK (env=${env})`)
}
