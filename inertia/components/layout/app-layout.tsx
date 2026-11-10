import type { ComponentProps, ReactNode } from 'react'
import AppHeader from '~/components/layout/app-header'
import AppFooter from '~/components/layout/app-footer'
import { cn } from '~/lib/utils'

type HeaderProps = ComponentProps<typeof AppHeader>

interface Props extends HeaderProps {
  /** 'wide' for listings and dashboards, 'narrow' for forms and reading pages. */
  width?: 'wide' | 'narrow'
  children: ReactNode
}

/**
 * Page shell shared by authenticated pages: navigation header, centred main
 * column at one of two standard widths, footer kept at the bottom of short pages.
 */
export default function AppLayout({ user, appSettings, menus, width = 'wide', children }: Props) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader user={user} appSettings={appSettings} menus={menus} />
      <main
        id="main-content"
        className={cn(
          'flex-1 w-full mx-auto px-4 py-8',
          width === 'narrow' ? 'max-w-4xl' : 'container'
        )}
      >
        {children}
      </main>
      <AppFooter appSettings={appSettings} menus={menus} />
    </div>
  )
}
