// App layout — __PROJECT__
// Author: Dr Hamid MADANI <drmdh@msn.com>

export const metadata = {
  title: '__PROJECT__',
  description: 'App __PROJECT__ multi-env (généré par @mostajs/workspace)',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
