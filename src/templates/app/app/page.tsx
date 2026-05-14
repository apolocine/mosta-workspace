// Home — __PROJECT__
// Author: Dr Hamid MADANI <drmdh@msn.com>

export default function Home() {
  const env = process.env.MOSTA_ENV ?? 'dev'
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>__PROJECT__</h1>
      <p>Environnement actif : <strong>{env}</strong></p>
      <p>Application générée par <code>@mostajs/workspace</code>.</p>
      <p>Voir <code>../WORKFLOW.md</code> pour le pipeline dev → test → prod.</p>
    </main>
  )
}
