 25/25 toujours verts.

  Nouvelle syntaxe CLI :

  mostajs-workspace init iquesta-light amia.fr               # domaine
  positionnel
  mostajs-workspace init iquesta-light amia.fr --mode=path   # avec options
  mostajs-workspace init mostablog example.com --mode=subdomain
  mostajs-workspace init demo                                # default amia.fr
  mostajs-workspace init demo --domain=other.fr              # form longue
  toujours possible

  Le domaine peut être passé soit en 2e argument positionnel, soit via --domain=
   (dans cet ordre de précédence : si --domain= est fourni, il override le
  positionnel). Tests + smoke validés (vhost Apache iquesta-light.amia.fr,
  PUBLIC_URL=https://iquesta-light.amia.fr/dev).
  
  
  



● Publish ack par npm mais propagation CDN encore en cours (5min). Récap des    
  actions exécutées :                                                           
                                                                                
  ┌────────────────────────┬───────┬────────────────────────────────────────┐   
  │         Action         │ Statu │               Référence                │   
  │                        │   t   │                                        │   
  ├────────────────────────┼───────┼────────────────────────────────────────┤   
  │                        │       │ sha a0186f9, signature Dr Hamid MADANI │   
  │ git init + commit      │ ✓     │  <drmdh@msn.com>, aucune attribution   │   
  │                        │       │ Claude                                 │
  ├────────────────────────┼───────┼────────────────────────────────────────┤   
  │ gh repo create apoloci │       │ https://github.com/apolocine/mosta-wor │
  │ ne/mosta-workspace     │ ✓     │ kspace                                 │   
  │ --public               │       │                                        │
  ├────────────────────────┼───────┼────────────────────────────────────────┤
  │ git push               │ ✓     │ branche main                           │
  ├────────────────────────┼───────┼────────────────────────────────────────┤   
  │ npm publish            │ ✓ ack │ + @mostajs/workspace@0.1.0 (47         │
  │ --access=public        │       │ fichiers, 25.3 kB)                     │   
  ├────────────────────────┼───────┼────────────────────────────────────────┤
  │ Propagation CDN        │ ⏳    │ poll en cours (b6oig7fza) — typique    │   
  │ registry               │       │ 1-5 min pour premier scoped publish    │   
  └────────────────────────┴───────┴────────────────────────────────────────┘ 
                                                                                
  Le background poll attend que curl -sf                                        
  https://registry.npmjs.org/@mostajs/workspace retourne 200 puis run npm view.
  Tu seras notifié quand c'est OK. Une fois propagé, n'importe quel projet      
  pourra faire npm install @mostajs/workspace.                 
                                                                                
  Mémoire mise à jour avec les URLs GitHub + npm et le sha de commit.           
   
✻ Crunched for 3m 52s · 1 shell still running                                   
                                                                              
● Background command "Wait for npm CDN propagation" completed (exit code 0)     
                        
  Read 1 file (ctrl+o to expand)                                                
                                                                                
● Propagation CDN OK — @mostajs/workspace@0.1.0 est disponible sur npmjs.       
                                                                                
  Récap final :                                                                 
                                                            
  ┌────────────┬────────────────────────────────────────────────────────────┐   
  │   Action   │                         Référence                          │
  ├────────────┼────────────────────────────────────────────────────────────┤   
  │ Repo       │ https://github.com/apolocine/mosta-workspace               │   
  │ GitHub     │                                                            │
  ├────────────┼────────────────────────────────────────────────────────────┤   
  │ npm        │ https://www.npmjs.com/package/@mostajs/workspace           │
  │ registry   │                                                            │   
  ├────────────┼────────────────────────────────────────────────────────────┤   
  │ Commit     │ a0186f9 (signature Dr Hamid MADANI, aucune attribution     │
  │            │ Claude)                                                    │   
  ├────────────┼────────────────────────────────────────────────────────────┤
  │ Tests      │ 28/28 verts                                                │
  ├────────────┼────────────────────────────────────────────────────────────┤
  │ Tarball    │ 47 fichiers, 25.3 kB                                       │
  └────────────┴────────────────────────────────────────────────────────────┘   
  
  N'importe quel projet peut désormais faire :                                  
  npm install -g @mostajs/workspace                         
  mostajs-workspace init <project> <domain>
                                                                                
  Mémoire mise à jour pour refléter le publish.
                                                                                
✻ Churned for 12s                                           
                                                                                
※ recap: Goal: livrer `@mostajs/workspace` v0.1.0 (scaffold multi-env           
  dev/test/prod pour apps mostajs). Tout est publié — GitHub 
  `apolocine/mosta-workspace` + npm `@mostajs/workspace@0.1.0` (28/28 tests     
  verts). Prochaine action : utiliser le CLI pour scaffolder `iquesta-light` 
  (app pilote migration ixarchive).


