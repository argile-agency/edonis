import ReactDOMServer from 'react-dom/server'
import { createInertiaApp } from '@inertiajs/react'
import { ThemeProvider } from '~/components/theme-provider'

export default function render(page: any) {
  return createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      const pages = import.meta.glob('../pages/**/*.tsx', { eager: true })
      return pages[`../pages/${name}.tsx`]
    },
    setup: ({ App, props }) => (
      <ThemeProvider defaultTheme="system" storageKey="edonis-ui-theme">
        <App {...props} />
      </ThemeProvider>
    ),
  })
}
