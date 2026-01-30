import { defineConfig } from '@adonisjs/inertia'
import type { InferSharedProps } from '@adonisjs/inertia/types'
import AppSetting from '#models/app_setting'
import MenuLocation from '#models/menu_location'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

const inertiaConfig = defineConfig({
  /**
   * Path to the Edge view that will be used as the root view for Inertia responses
   */
  rootView: 'inertia_layout',

  /**
   * Data that should be shared with all rendered pages.
   * Each resolver is wrapped in try/catch so that pages can still render
   * when the database is unreachable (graceful degradation).
   */
  sharedData: {
    auth: (ctx) =>
      ctx.inertia.always(async () => {
        try {
          const user = ctx.auth?.user
          if (user) {
            await user.load('roles')
          }
          return {
            user: user ? user.toJSON() : null,
          }
        } catch (error) {
          logger.warn('Failed to load auth shared data: %s', (error as Error).message)
          return { user: null }
        }
      }),

    appSettings: (ctx) =>
      ctx.inertia.always(async () => {
        try {
          const settings = await AppSetting.getActiveSettings()
          return settings ? settings.toJSON() : null
        } catch (error) {
          logger.warn('Failed to load appSettings shared data: %s', (error as Error).message)
          return null
        }
      }),

    flash: (ctx) =>
      ctx.inertia.always(() => {
        try {
          return {
            success: ctx.session.flashMessages.get('success') as string | undefined,
            error: ctx.session.flashMessages.get('error') as string | undefined,
          }
        } catch {
          return { success: undefined, error: undefined }
        }
      }),

    termsConsentRequired: (ctx) =>
      ctx.inertia.always(() => {
        try {
          const user = ctx.auth?.user
          const currentVersion = env.get('TERMS_VERSION', '')
          if (!user || !currentVersion) return false
          return user.termsAcceptedVersion !== currentVersion
        } catch {
          return false
        }
      }),

    menus: (ctx) =>
      ctx.inertia.always(async () => {
        try {
          const user = ctx.auth?.user
          const headerMenu = await MenuLocation.getMenuTreeForLocation('header', user)
          const footerMenu = await MenuLocation.getMenuTreeForLocation('footer', user)
          const userMenu = await MenuLocation.getMenuTreeForLocation('user-menu', user)

          return {
            header: headerMenu || [],
            footer: footerMenu || [],
            userMenu: userMenu || [],
          }
        } catch (error) {
          logger.warn('Failed to load menus shared data: %s', (error as Error).message)
          return { header: [], footer: [], userMenu: [] }
        }
      }),
  },

  /**
   * Options for the server-side rendering
   */
  ssr: {
    enabled: true,
    entrypoint: 'inertia/app/ssr.tsx',
  },
})

export default inertiaConfig

declare module '@adonisjs/inertia/types' {
  export interface SharedProps extends InferSharedProps<typeof inertiaConfig> {}
}
