// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-05-23',

  future: {
    compatibilityVersion: 4
  },

  devServer: {
    port: 2031
  },

  modules: ['@nuxt/image', '@pinia/nuxt', '@vueuse/nuxt', '@nuxtjs/i18n'],

  // ALD 18/06/2026 - i18n: chỉ quản lý locale + cookie + detect (no URL prefix). Chuỗi dịch dùng helper t('vi','en') trong [[useLang]].
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'vi',
    langDir: 'locales',
    locales: [
      { code: 'vi', language: 'vi-VN', name: 'Tiếng Việt', files: ['vi.json'] },
      { code: 'en', language: 'en-US', name: 'English', files: ['en.json'] }
    ],
    detectBrowserLanguage: { useCookie: true, cookieKey: 'ms_lang', alwaysRedirect: false, fallbackLocale: 'vi' }
  },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()]
  },

  app: {
    head: {
      title: 'Motions Studio',
      htmlAttrs: { lang: 'vi' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Pebsteel Motion Transfer — Wan 2.2 Animate' }
      ]
    }
  },

  runtimeConfig: {
    // #region ALD 31/05/2026 - motion-backend (server-side, KHÔNG để lộ key ra browser).
    // Motion job gọi qua proxy /api/motion/* thay vì Supabase edge function.
    motionApiUrl: process.env.NUXT_MOTION_API_URL || 'https://motion-server.datools.info',
    motionApiKey: process.env.NUXT_MOTION_API_KEY || '',
    // #endregion
    public: {
      appName: 'Motions Studio',
      // #region ALD 31/05/2026 - motion-backend public (FE gọi trực tiếp workflows/storage/ai-providers
      // bằng session Bearer qua CORS). Khác motionApiUrl (private, proxy job/audio bằng API key).
      motionBackendUrl: process.env.NUXT_PUBLIC_MOTION_BACKEND_URL || 'https://motion-server.datools.info'
      // #endregion
    }
  },

  nitro: {
    experimental: {
      openAPI: true
    }
  },

  typescript: {
    strict: false,
    typeCheck: false
  },

  imports: {
    dirs: ['composables/**', 'utils/**']
  },
  devtools: {
    enabled: false
  }
})
