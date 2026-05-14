# @mostajs/workspace

**Auteur** : Dr Hamid MADANI <drmdh@msn.com>
**License** : AGPL-3.0-or-later

Scaffold multi-environnement (`dev/test/prod`) pour les apps de l'écosystème `@mostajs`. Crée la structure de projet, les vhosts Apache2, le fichier pm2 ecosystem, et un template Next.js avec les 11 modules `@mostajs/*` pré-câblés (`config`, `data-plug`, `orm`, `auth`, `mailer`, `rbac`, `storage`, `subscriptions-plan`, `qrpanel`, `pwa-scan`, `payment`, `pm2`).

## Topologie

Un projet `<project>` scaffolde 3 dossiers locaux :

```
<workspace-root>/<project>/
  dev/             ← MODIFIABLE — code en cours
  test/            ← IMMUABLE — remplacé par rsync depuis dev validée
  prod/            ← IMMUABLE — remplacé par rsync depuis test validée
  apache2/<project>.<domain>.conf
  ecosystem.config.cjs
  WORKFLOW.md
  README.md
```

Deux modes d'URL :

| Mode      | dev                          | test                          | prod                  |
|-----------|------------------------------|-------------------------------|-----------------------|
| `path`    | `<p>.<d>/dev`                | `<p>.<d>/test`                | `<p>.<d>/prod`        |
| `subdomain` | `dev.<p>.<d>`              | `test.<p>.<d>`                | `<p>.<d>`             |

Mode `path` (default) utilise **1 vhost Apache** avec 3 `ProxyPass` paths. Mode `subdomain` utilise **3 vhosts Apache** indépendants.

## Installation

```bash
npm install -g @mostajs/workspace
# ou
npx @mostajs/workspace ...
```

## CLI

### `init`

```bash
mostajs-workspace init <project> [<domain>] [options]
```

Le **domaine** peut être passé en 2e argument positionnel **ou** via `--domain=<domain>` (default `amia.fr`).

| Option                  | Default                | Description                                  |
|-------------------------|------------------------|----------------------------------------------|
| `--mode=path|subdomain` | `path`                 | Topologie URL                                |
| `--webserver=apache2|nginx` | `apache2`          | Reverse proxy                                |
| `--domain=<domain>`     | `amia.fr`              | Domaine apex (alternative au positionnel)    |
| `--root=<path>`         | `process.cwd()`        | Workspace root (ou `$MOSTAJS_WORKSPACE_ROOT`)|
| `--ports=3021,3022,3023`| `3021,3022,3023`       | Ports dev,test,prod                          |
| `--dry-run`             | —                      | Affiche le plan sans rien écrire             |
| `--force`               | —                      | Overwrite si le dossier existe               |

Exemples :

```bash
mostajs-workspace init iquesta-light amia.fr
mostajs-workspace init iquesta amia.fr --mode=path --webserver=apache2
mostajs-workspace init mostablog example.com --mode=subdomain --webserver=nginx
mostajs-workspace init demo --dry-run
```

### `promote`

```bash
mostajs-workspace promote dev->test [<project-dir>]
mostajs-workspace promote test->prod [<project-dir>]
```

`rsync` source vers target en excluant `node_modules/`, `.next/`, `.env`, `.env.template`, `data/`, `*.sqlite*`, `.git/`, `logs/`. Le `.env` de la destination est créé depuis `.env.template` (premier promote) ou patché (`MOSTA_ENV` mis à jour) si déjà présent.

**Règle stricte** : seul `dev/` est éditable. `test/` et `prod/` sont remplacés par `promote`.

### `status`

```bash
mostajs-workspace status [<project-dir>]
```

Affiche un tableau de l'état des 3 envs (existence, package.json, .next build, .env, MOSTA_ENV détecté, port, version package). Émet des warnings sur les versions divergentes ou MOSTA_ENV inconsistant.

## Reverse proxy + pm2

Le scaffold génère :

- **Apache2** (default) : `apache2/<project>.<domain>.conf` — copier dans `/etc/apache2/sites-available/`, puis `a2ensite` + `systemctl reload apache2`. Pré-requis : `a2enmod proxy proxy_http rewrite headers ssl`. Cert Let's Encrypt via `certbot --apache -d <fqdn>`.
- **Nginx** (option `--webserver=nginx`) : `nginx/<project>.<domain>.conf` — copier dans `/etc/nginx/sites-available/`, `ln -s` vers `sites-enabled/`, `nginx -t && systemctl reload nginx`. Cert Let's Encrypt via `certbot --nginx -d <fqdn>`.
- `ecosystem.config.cjs` — `pm2 start ecosystem.config.cjs` lance les 3 process (`<project>-dev`, `<project>-test`, `<project>-prod`) sur les ports configurés.

## Template app

Le dossier `dev/` est initialisé avec une app Next.js 15 minimaliste :

```
dev/
  package.json        ← @mostajs/* deps + next
  tsconfig.json
  next.config.ts      ← basePath dynamique (lit BASE_PATH env)
  .env                ← MOSTA_ENV + PORT + BASE_PATH + URLs
  lib/
    bootstrap.ts      ← chaîne des 11 modules mostajs (à décommenter selon besoins)
    db.ts             ← ORM singleton + bootstrap lazy
  schemas/
    index.ts          ← placeholder à remplir
  app/
    layout.tsx
    page.tsx
    api/health/route.ts ← GET /api/health
```

Le `bootstrap.ts` est idempotent : le premier appel exécute la chaîne (registerSchemas + configure mailer/auth/rbac/storage/subscriptions/qrpanel/pwa-scan/payment), les suivants no-op. Appelé lazy depuis `lib/db.ts:getDialect()` au premier hit DB.

## Workflow promotion

```
┌──────┐                ┌──────┐                ┌──────┐
│ dev/ │ ── promote ──▶ │test/ │ ── promote ──▶ │prod/ │
└──────┘                └──────┘                └──────┘
modifiable           remplacé via               remplacé via
                     dev validée                test validée
```

Critère AVANT chaque promote :
- Smoke E2E manuel sur l'env source (curl /api/health, login, workflows métier)
- `npm run build` vert sur l'env source
- Pas de regression vs précédent

Voir `WORKFLOW.md` généré dans chaque projet pour les commandes complètes.

## Tests

```bash
npm run build
node --test test-scripts/
```

25 tests verts : scaffold (17) + promote+status (8).

## License

AGPL-3.0-or-later — Dr Hamid MADANI <drmdh@msn.com>
