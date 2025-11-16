import { defineConfig } from '@adonisjs/inertia'
import type { InferSharedProps } from '@adonisjs/inertia/types'
import AppSetting from '#models/app_setting'
import MenuLocation from '#models/menu_location'

const inertiaConfig = defineConfig({
  /**
   * Path to the Edge view that will be used as the root view for Inertia responses
   */
  rootView: 'inertia_layout',

  /**
   * Data that should be shared with all rendered pages
   */
  sharedData: {
    auth: (ctx) =>
      ctx.inertia.always(async () => {
        if (ctx.auth.user) {
          await ctx.auth.user.load('roles')
        }
        return {
          user: ctx.auth.user ? ctx.auth.user.toJSON() : null,
        }
      }),

    appSettings: (ctx) =>
      ctx.inertia.always(async () => {
        const settings = await AppSetting.getActiveSettings()
        return settings ? settings.toJSON() : null
      }),

    menus: (ctx) =>
      ctx.inertia.always(async () => {
        // Récupérer les menus pour chaque location
        const headerMenu = await MenuLocation.getMenuTreeForLocation('header', ctx.auth.user)
        const footerMenu = await MenuLocation.getMenuTreeForLocation('footer', ctx.auth.user)
        const userMenu = await MenuLocation.getMenuTreeForLocation('user-menu', ctx.auth.user)

        return {
          header: headerMenu || [],
          footer: footerMenu || [],
          userMenu: userMenu || [],
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
