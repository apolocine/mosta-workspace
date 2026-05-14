// ORM singleton — __PROJECT__
// Author: Dr Hamid MADANI <drmdh@msn.com>
//
// Pattern @mostajs/orm v2+ : registerSchemas() avant getDialect(), registry process-global.
// L'appel `bootstrap()` est idempotent et résout MOSTA_ENV via @mostajs/config.

import { getDialect as ormGetDialect, BaseRepository } from '@mostajs/orm'
import { bootstrap } from './bootstrap.js'

let _dialect: any = null

export async function getDialect() {
  if (_dialect) return _dialect
  await bootstrap()
  _dialect = await ormGetDialect()
  return _dialect
}

/** Helper pour obtenir un repo par schema (lazy). */
export async function getRepo<T = any>(schema: any): Promise<BaseRepository<T>> {
  const dialect = await getDialect()
  return new BaseRepository<T>(schema, dialect)
}
