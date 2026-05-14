// @mostajs/workspace — barrel
// Author: Dr Hamid MADANI <drmdh@msn.com>

export { scaffoldProject } from './lib/scaffold.js'
export type { ScaffoldOptions, ScaffoldResult } from './lib/scaffold.js'
export { promoteEnv } from './lib/promote.js'
export type { PromoteOptions, PromoteResult } from './lib/promote.js'
export { getWorkspaceStatus } from './lib/status.js'
export type { WorkspaceStatus, EnvStatus } from './lib/status.js'

export const moduleInfo = {
  name: '@mostajs/workspace',
  version: '0.1.0',
}
