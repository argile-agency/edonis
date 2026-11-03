import ReactDOMServer from 'react-dom/server'
import { createInertiaApp } from '@inertiajs/react'
import { ThemeProvider } from '~/components/theme-provider'
import { Toaster } from 'sonner'
import { PwaInstallPrompt } from '~/components/pwa-install-prompt'
import { ConnectivityIndicator } from '~/components/connectivity-indicator'

export default function render(page: any) {
  return createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      const pages = import.meta.glob('../pages/**/*.tsx', { eager: true })
      return pages[`../pages/${name}.tsx`]
    },
    setup: ({ App, props }) => (
      // Same tree as app.tsx: React.useId (Radix ids) depends on tree position, so any
      // difference here causes hydration id mismatches
      <ThemeProvider defaultTheme="system" storageKey="edonis-ui-theme">
        <ConnectivityIndicator />
        <App {...props} />
        <Toaster position="top-right" richColors closeButton />
        <PwaInstallPrompt />
      </ThemeProvider>
    ),
  })
}
