// GET /api/health — __PROJECT__
// Author: Dr Hamid MADANI <drmdh@msn.com>

import { getEnv } from '@mostajs/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({
    ok: true,
    env: getEnv('MOSTA_ENV', 'dev'),
    timestamp: new Date().toISOString(),
  })
}
