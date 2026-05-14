// @mostajs/workspace — scaffold lib (création structure dev/test/prod)
// Author: Dr Hamid MADANI <drmdh@msn.com>
//
// Crée la structure workspace pour un projet mostajs :
//
//   <root>/<project>/
//     dev/      ← MODIFIABLE — code en cours de développement
//     test/     ← IMMUABLE — remplacé par dev validée (rsync)
//     prod/     ← IMMUABLE — remplacé par test validée (rsync)
//     apache2/<project>.conf      ← 1 seul vhost avec 3 ProxyPass paths
//     ecosystem.config.cjs        ← 3 entrées pm2 (ports 3021/3022/3023)
//     WORKFLOW.md                 ← doc workflow promotion
//
// Chaque env aura un `.env` distinct avec MOSTA_ENV=<env> et BASE_PATH=/<env>.
// La logique multi-env est résolue par @mostajs/config cascade.

import { mkdir, writeFile, readFile, readdir, stat, cp } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENVS, DEFAULT_PORTS, DEFAULT_MOSTAJS_DEPS, type Env, type PortAllocation } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export type UrlMode = 'path' | 'subdomain'
export type Webserver = 'apache2' | 'nginx'

export interface ScaffoldOptions {
  /** Nom du projet, ex: 'iquesta'. Utilisé pour le folder + slug vhost + pm2 names. */
  project: string
  /**
   * Topologie URL (default 'path') :
   *   - 'path'      → `<project>.<domain>/{dev,test,prod}` (1 vhost, basePath Next.js)
   *   - 'subdomain' → `{dev,test}.<project>.<domain>` + `<project>.<domain>` pour prod (3 vhosts, pas de basePath)
   */
  mode?: UrlMode
  /** Reverse proxy (default 'apache2'). Génère la config adaptée. */
  webserver?: Webserver
  /** Domaine apex (default 'amia.fr'). */
  domain?: string
  /** Workspace root (default `${HOME}/dev/MostaGare-Install`). */
  workspaceRoot?: string
  /** Ports custom (default 3021/3022/3023). */
  ports?: Partial<PortAllocation>
  /** Modules mostajs à pré-installer (default = DEFAULT_MOSTAJS_DEPS). */
  deps?: Record<string, string>
  /** Si true, n'écrit rien — retourne juste le plan. */
  dryRun?: boolean
  /** Overwrite si dossier existe (default false → erreur). */
  force?: boolean
}

/** Calcule l'URL d'un env selon le mode. */
export function envUrl(env: Env, project: string, domain: string, mode: UrlMode): string {
  if (mode === 'subdomain') {
    return env === 'prod'
      ? `https://${project}.${domain}`
      : `https://${env}.${project}.${domain}`
  }
  return `https://${project}.${domain}/${env}`
}

/** Calcule le basePath Next.js d'un env selon le mode. */
export function envBasePath(env: Env, mode: UrlMode): string {
  return mode === 'subdomain' ? '' : `/${env}`
}

export interface ScaffoldResult {
  projectDir: string
  envDirs: Record<Env, string>
  /** Path du vhost généré (Apache2 ou Nginx selon `webserver`). */
  webserverConfPath: string
  /** Alias legacy = webserverConfPath (rétrocompat tests 0.1.0). */
  apacheConfPath: string
  webserver: Webserver
  pm2EcosystemPath: string
  workflowDocPath: string
  filesCreated: string[]
  warnings: string[]
}

/**
 * Crée la structure workspace complète.
 *
 * Étapes :
 *   1. Validation (project name, root accessible)
 *   2. Création <project>/<env>/ pour chaque env
 *   3. Copie du template app dans dev/ uniquement (test+prod restent vides)
 *   4. Génération .env par env (MOSTA_ENV, BASE_PATH, PORT)
 *   5. Génération vhost Apache2 (1 fichier, 3 ProxyPass)
 *   6. Génération ecosystem.config.cjs pm2 (3 entrées)
 *   7. Génération WORKFLOW.md
 */
export async function scaffoldProject(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  const project = opts.project.trim().toLowerCase()
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(project)) {
    throw new Error(`[workspace] nom de projet invalide: "${project}". Doit matcher [a-z][a-z0-9-]{1,30}`)
  }

  const mode: UrlMode = opts.mode ?? 'path'
  const webserver: Webserver = opts.webserver ?? 'apache2'
  const domain = opts.domain ?? 'amia.fr'
  const workspaceRoot = opts.workspaceRoot ?? process.env.MOSTAJS_WORKSPACE_ROOT
    ?? join(process.env.HOME ?? '/tmp', 'dev/MostaGare-Install')
  const ports: PortAllocation = { ...DEFAULT_PORTS, ...opts.ports }
  const deps = opts.deps ?? DEFAULT_MOSTAJS_DEPS

  const projectDir = resolve(workspaceRoot, project)
  const envDirs: Record<Env, string> = {
    dev: join(projectDir, 'dev'),
    test: join(projectDir, 'test'),
    prod: join(projectDir, 'prod'),
  }

  const warnings: string[] = []
  const filesCreated: string[] = []

  // Validation : projectDir n'existe pas (sauf si --force)
  if (!opts.force) {
    try {
      await stat(projectDir)
      throw new Error(`[workspace] ${projectDir} existe déjà. Utilisez --force pour overwrite.`)
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
  }

  const webserverDir = webserver === 'nginx' ? 'nginx' : 'apache2'
  const webserverExt = webserver === 'nginx' ? '.conf' : '.conf'
  const webserverFilename = mode === 'subdomain'
    ? `${project}.${domain}-multienv${webserverExt}`
    : `${project}.${domain}${webserverExt}`
  const webserverConfPath = join(projectDir, webserverDir, webserverFilename)

  if (opts.dryRun) {
    return {
      projectDir,
      envDirs,
      webserverConfPath,
      apacheConfPath: webserverConfPath,
      webserver,
      pm2EcosystemPath: join(projectDir, 'ecosystem.config.cjs'),
      workflowDocPath: join(projectDir, 'WORKFLOW.md'),
      filesCreated: ['(dry-run: aucun fichier créé)'],
      warnings,
    }
  }

  // 1. Créer la structure de base
  await mkdir(projectDir, { recursive: true })
  await mkdir(join(projectDir, webserverDir), { recursive: true })
  for (const env of ENVS) {
    await mkdir(envDirs[env], { recursive: true })
  }

  // 2. Copier le template app dans dev/ uniquement
  const templatesRoot = resolveTemplatesRoot()
  const appTemplateDir = join(templatesRoot, 'app')
  await copyTemplate(appTemplateDir, envDirs.dev, { project, domain, deps })
  filesCreated.push(`${envDirs.dev}/* (template app)`)

  // 3. Générer .env pour chaque env
  for (const env of ENVS) {
    const envFile = join(envDirs[env], '.env')
    const content = renderEnvFile({ env, project, domain, port: ports[env], mode })
    if (env === 'dev') {
      await writeFile(envFile, content, { mode: 0o600 })
      filesCreated.push(envFile)
    } else {
      const tmplFile = join(envDirs[env], '.env.template')
      await writeFile(tmplFile, content, { mode: 0o644 })
      filesCreated.push(tmplFile)
    }
  }

  // 4. Vhost(s) — Apache2 ou Nginx
  const conf = webserver === 'nginx'
    ? renderNginxConfig({ project, domain, ports, mode })
    : renderApacheVhost({ project, domain, ports, mode })
  await writeFile(webserverConfPath, conf)
  filesCreated.push(webserverConfPath)

  // 5. pm2 ecosystem
  const pm2Path = join(projectDir, 'ecosystem.config.cjs')
  await writeFile(pm2Path, renderPm2Ecosystem({ project, projectDir, ports }))
  filesCreated.push(pm2Path)

  // 6. WORKFLOW.md
  const workflowPath = join(projectDir, 'WORKFLOW.md')
  await writeFile(workflowPath, renderWorkflowDoc({ project, domain, ports, mode, webserver }))
  filesCreated.push(workflowPath)

  // 7. README projet
  const readmePath = join(projectDir, 'README.md')
  await writeFile(readmePath, renderProjectReadme({ project, domain, ports, mode }))
  filesCreated.push(readmePath)

  return {
    projectDir,
    envDirs,
    webserverConfPath,
    apacheConfPath: webserverConfPath,
    webserver,
    pm2EcosystemPath: pm2Path,
    workflowDocPath: workflowPath,
    filesCreated,
    warnings,
  }
}

// ─── Helpers internes ──────────────────────────────────────────────

function resolveTemplatesRoot(): string {
  // En dev (sans build) : src/templates ; après build : dist/../src/templates est embarqué via files.
  // Stratégie : depuis __dirname (= dist/lib), remonter à la racine du package puis src/templates.
  const distLib = __dirname              // .../dist/lib
  const distRoot = resolve(distLib, '..') // .../dist
  const pkgRoot = resolve(distRoot, '..') // racine du package
  return join(pkgRoot, 'src', 'templates')
}

async function copyTemplate(
  src: string,
  dst: string,
  vars: { project: string; domain: string; deps: Record<string, string> },
): Promise<void> {
  await cp(src, dst, { recursive: true, force: false })
  // Post-process : substituer les placeholders dans les fichiers texte connus
  const placeholderFiles = [
    'package.json', 'next.config.ts', 'README.md', 'lib/bootstrap.ts',
    'app/layout.tsx', 'app/page.tsx',
  ]
  for (const rel of placeholderFiles) {
    const fpath = join(dst, rel)
    try {
      const orig = await readFile(fpath, 'utf-8')
      const next = applyTemplateVars(orig, vars)
      if (next !== orig) await writeFile(fpath, next)
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
  }
}

function applyTemplateVars(content: string, vars: { project: string; domain: string; deps: Record<string, string> }): string {
  const depsJson = Object.entries(vars.deps)
    .map(([k, v]) => `    "${k}": "${v}"`)
    .join(',\n')
  return content
    .replaceAll('__PROJECT__', vars.project)
    .replaceAll('__DOMAIN__', vars.domain)
    .replaceAll('"__MOSTAJS_DEPS__": "PLACEHOLDER"', depsJson)
}

function renderEnvFile(opts: { env: Env; project: string; domain: string; port: number; mode: UrlMode }): string {
  const url = envUrl(opts.env, opts.project, opts.domain, opts.mode)
  const basePath = envBasePath(opts.env, opts.mode)
  return `# ${opts.project} — environnement ${opts.env}
# Auto-généré par @mostajs/workspace — éditer dev/.env, les autres sont remplacés par promote
MOSTA_ENV=${opts.env}
PORT=${opts.port}
BASE_PATH=${basePath}
PUBLIC_URL=${url}
NEXTAUTH_URL=${url}

# DB (à compléter)
DB_DIALECT=sqlite
SGBD_URI=./data/${opts.project}-${opts.env}.sqlite
DB_SCHEMA_STRATEGY=${opts.env === 'dev' ? 'create-drop' : 'verify'}

# Secrets — REGÉNÉRER avant prod (openssl rand -hex 32)
NEXTAUTH_SECRET=__CHANGE_ME__
INVITE_SECRET=__CHANGE_ME__
`
}

function renderApacheVhost(opts: { project: string; domain: string; ports: PortAllocation; mode: UrlMode }): string {
  return opts.mode === 'subdomain'
    ? renderApacheSubdomain(opts)
    : renderApachePath(opts)
}

function renderApachePath(opts: { project: string; domain: string; ports: PortAllocation }): string {
  const { project, domain, ports } = opts
  const fqdn = `${project}.${domain}`
  return `# Apache2 vhost — ${fqdn} (mode 'path')
# Trois sous-paths /dev, /test, /prod proxifiés vers 3 ports pm2 distincts.
# Auto-généré par @mostajs/workspace — recopier dans /etc/apache2/sites-available/ puis a2ensite
#
# Pré-requis : a2enmod proxy proxy_http rewrite headers ssl
# Cert :       sudo certbot --apache -d ${fqdn}

<VirtualHost *:80>
    ServerName ${fqdn}
    RewriteEngine On
    RewriteRule ^/?(.*) https://${fqdn}/$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName ${fqdn}

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/${fqdn}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${fqdn}/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf

    ProxyPreserveHost On
    ProxyRequests Off
    RequestHeader set X-Forwarded-Proto "https"

    # ─── /dev → port ${ports.dev} ───
    ProxyPass        /dev/ http://127.0.0.1:${ports.dev}/dev/
    ProxyPassReverse /dev/ http://127.0.0.1:${ports.dev}/dev/

    # ─── /test → port ${ports.test} ───
    ProxyPass        /test/ http://127.0.0.1:${ports.test}/test/
    ProxyPassReverse /test/ http://127.0.0.1:${ports.test}/test/

    # ─── /prod → port ${ports.prod} ───
    ProxyPass        /prod/ http://127.0.0.1:${ports.prod}/prod/
    ProxyPassReverse /prod/ http://127.0.0.1:${ports.prod}/prod/

    RedirectMatch ^/$ /prod/

    ErrorLog \${APACHE_LOG_DIR}/${project}-error.log
    CustomLog \${APACHE_LOG_DIR}/${project}-access.log combined
</VirtualHost>
`
}

function renderNginxConfig(opts: { project: string; domain: string; ports: PortAllocation; mode: UrlMode }): string {
  return opts.mode === 'subdomain'
    ? renderNginxSubdomain(opts)
    : renderNginxPath(opts)
}

function renderNginxPath(opts: { project: string; domain: string; ports: PortAllocation }): string {
  const { project, domain, ports } = opts
  const fqdn = `${project}.${domain}`
  const locBlock = (env: Env, port: number) => `    location /${env}/ {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }`
  return `# Nginx vhost — ${fqdn} (mode 'path')
# Trois sous-paths /dev, /test, /prod proxifiés vers 3 ports pm2 distincts.
# Auto-généré par @mostajs/workspace — recopier dans /etc/nginx/sites-available/ puis ln -s
#
# Cert :       sudo certbot --nginx -d ${fqdn}

server {
    listen 80;
    server_name ${fqdn};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${fqdn};

    ssl_certificate /etc/letsencrypt/live/${fqdn}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${fqdn}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20m;

${locBlock('dev', ports.dev)}

${locBlock('test', ports.test)}

${locBlock('prod', ports.prod)}

    location = / {
        return 301 /prod/;
    }

    access_log /var/log/nginx/${project}-access.log;
    error_log  /var/log/nginx/${project}-error.log;
}
`
}

function renderNginxSubdomain(opts: { project: string; domain: string; ports: PortAllocation }): string {
  const { project, domain, ports } = opts
  const server = (env: Env, fqdn: string, port: number) => `
server {
    listen 80;
    server_name ${fqdn};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${fqdn};

    ssl_certificate /etc/letsencrypt/live/${fqdn}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${fqdn}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }

    access_log /var/log/nginx/${project}-${env}-access.log;
    error_log  /var/log/nginx/${project}-${env}-error.log;
}`
  return `# Nginx vhosts — ${project}.${domain} (mode 'subdomain')
# Trois sous-domaines (dev|test).${project}.${domain} + ${project}.${domain} (prod).
# Auto-généré par @mostajs/workspace — recopier dans /etc/nginx/sites-available/ puis ln -s
#
# Certs :
#   sudo certbot --nginx -d dev.${project}.${domain}
#   sudo certbot --nginx -d test.${project}.${domain}
#   sudo certbot --nginx -d ${project}.${domain}
${server('dev', `dev.${project}.${domain}`, ports.dev)}
${server('test', `test.${project}.${domain}`, ports.test)}
${server('prod', `${project}.${domain}`, ports.prod)}
`
}

function renderApacheSubdomain(opts: { project: string; domain: string; ports: PortAllocation }): string {
  const { project, domain, ports } = opts
  const vhost = (env: Env, fqdn: string, port: number) => `
<VirtualHost *:80>
    ServerName ${fqdn}
    RewriteEngine On
    RewriteRule ^/?(.*) https://${fqdn}/$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName ${fqdn}

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/${fqdn}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${fqdn}/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf

    ProxyPreserveHost On
    ProxyRequests Off
    RequestHeader set X-Forwarded-Proto "https"

    ProxyPass        / http://127.0.0.1:${port}/
    ProxyPassReverse / http://127.0.0.1:${port}/

    ErrorLog \${APACHE_LOG_DIR}/${project}-${env}-error.log
    CustomLog \${APACHE_LOG_DIR}/${project}-${env}-access.log combined
</VirtualHost>`
  return `# Apache2 vhosts — ${project}.${domain} (mode 'subdomain')
# Trois sous-domaines (dev|test).${project}.${domain} + ${project}.${domain} (prod).
# Auto-généré par @mostajs/workspace — recopier dans /etc/apache2/sites-available/ puis a2ensite
#
# Pré-requis : a2enmod proxy proxy_http rewrite headers ssl
# Certs :
#   sudo certbot --apache -d dev.${project}.${domain}
#   sudo certbot --apache -d test.${project}.${domain}
#   sudo certbot --apache -d ${project}.${domain}
${vhost('dev', `dev.${project}.${domain}`, ports.dev)}
${vhost('test', `test.${project}.${domain}`, ports.test)}
${vhost('prod', `${project}.${domain}`, ports.prod)}
`
}

function renderPm2Ecosystem(opts: { project: string; projectDir: string; ports: PortAllocation }): string {
  const { project, projectDir, ports } = opts
  const make = (env: Env, port: number) => `    {
      name: '${project}-${env}',
      cwd: '${projectDir}/${env}',
      script: 'node_modules/.bin/next',
      args: 'start -p ${port}',
      env: {
        NODE_ENV: 'production',
        MOSTA_ENV: '${env}',
        PORT: '${port}',
      },
      max_memory_restart: '512M',
      autorestart: true,
      watch: false,
    }`
  return `// ecosystem.config.cjs — pm2 multi-env pour ${project}
// Auto-généré par @mostajs/workspace
//
// Usage :
//   pm2 start ecosystem.config.cjs
//   pm2 restart ${project}-dev
//   pm2 logs ${project}-prod

module.exports = {
  apps: [
${[make('dev', ports.dev), make('test', ports.test), make('prod', ports.prod)].join(',\n')}
  ],
}
`
}

function renderWorkflowDoc(opts: { project: string; domain: string; ports: PortAllocation; mode: UrlMode; webserver: Webserver }): string {
  const { project, domain, ports, mode, webserver } = opts
  const url = (e: Env) => envUrl(e, project, domain, mode)
  const wsDir = webserver === 'nginx' ? 'nginx' : 'apache2'
  const wsConfName = mode === 'subdomain'
    ? `${project}.${domain}-multienv.conf`
    : `${project}.${domain}.conf`
  const wsInstall = webserver === 'nginx'
    ? `sudo cp ${wsDir}/${wsConfName} /etc/nginx/sites-available/\nsudo ln -s /etc/nginx/sites-available/${wsConfName} /etc/nginx/sites-enabled/\nsudo nginx -t && sudo systemctl reload nginx\n\n# Certificat Let's Encrypt\nsudo certbot --nginx -d ${project}.${domain}`
    : `sudo cp ${wsDir}/${wsConfName} /etc/apache2/sites-available/\nsudo a2ensite ${wsConfName}\nsudo systemctl reload apache2\n\n# Certificat Let's Encrypt\nsudo certbot --apache -d ${project}.${domain}`
  return `# Workflow ${project} — promotion dev → test → prod

**Auteur** : Dr Hamid MADANI <drmdh@msn.com>
**Généré par** : \`@mostajs/workspace\` (mode \`${mode}\`, webserver \`${webserver}\`)

## Topologie

| Env  | URL                          | Port pm2 | Statut    |
|------|------------------------------|----------|-----------|
| dev  | ${url('dev')}  | ${ports.dev} | **modifiable** |
| test | ${url('test')} | ${ports.test} | immuable (remplacé par dev validée) |
| prod | ${url('prod')} | ${ports.prod} | immuable (remplacé par test validée) |

## Règles

1. **Seul \`dev/\` est éditable.** test/ et prod/ sont sacrés — ne JAMAIS modifier directement.
2. **Promotion par rsync, pas par git** : \`mostajs-workspace promote dev->test\` copie tout dev/ vers test/ sauf \`.env\`, \`node_modules/\`, \`.next/\`, \`data/\`.
3. **Validation avant promote** : smoke E2E manuel sur l'env source (dev pour dev→test, test pour test→prod) AVANT le promote.
4. **DB** : chaque env a sa propre DB (cf .env \`SGBD_URI\`). Aucun partage. Pour copier des données entre envs, utiliser \`@mostajs/orm-copy-data\`.
5. **Secrets** : régénérer \`NEXTAUTH_SECRET\`, \`INVITE_SECRET\` avant tout promote vers prod.

## Commandes

\`\`\`bash
# Status des 3 envs
mostajs-workspace status

# Promote dev → test (après smoke E2E sur dev)
mostajs-workspace promote dev->test

# Promote test → prod (après smoke E2E sur test)
mostajs-workspace promote test->prod

# Restart pm2 d'un env
pm2 restart ${project}-dev   # ou test, prod

# Logs
pm2 logs ${project}-prod
\`\`\`

## Mise en service ${webserver === 'nginx' ? 'Nginx' : 'Apache2'}

\`\`\`bash
${wsInstall}
\`\`\`

## Mise en service pm2

\`\`\`bash
cd ${project}
pm2 start ecosystem.config.cjs
pm2 save                          # sauvegarder le statut
sudo pm2 startup systemd          # auto-start au boot (1 fois)
\`\`\`
`
}

function renderProjectReadme(opts: { project: string; domain: string; ports: PortAllocation; mode: UrlMode }): string {
  const { project, domain, mode } = opts
  const url = (e: Env) => envUrl(e, project, domain, mode)
  return `# ${project}

App ${project} multi-env (mode \`${mode}\`) :
- dev : ${url('dev')}
- test : ${url('test')}
- prod : ${url('prod')}

Généré par [\`@mostajs/workspace\`](https://github.com/apolocine/mosta-workspace).

- **Auteur** : Dr Hamid MADANI <drmdh@msn.com>
- **Stack** : Next.js + @mostajs/* (config, data-plug, orm, auth, mailer, rbac, storage, subscriptions-plan, qrpanel, pwa-scan, payment, pm2)

## Quickstart

\`\`\`bash
cd dev
cp .env .env.local                  # éditer secrets + DB
npm install
npm run dev                          # http://localhost:${opts.ports.dev}/dev
\`\`\`

Voir [WORKFLOW.md](./WORKFLOW.md) pour le pipeline promotion dev → test → prod.
`
}
