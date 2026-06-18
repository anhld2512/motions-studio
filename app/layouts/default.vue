<template>
  <!-- #region ALD 23/05/2026 - Shell: fixed inset-0, no h-screen (iOS Safari friendly) -->
  <div class="fixed inset-0 flex overflow-hidden">
    <!-- #endregion -->

    <!-- #region ALD 23/05/2026 - Backdrop khi sidebar mở -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="absolute inset-0 z-30 bg-black/20 backdrop-blur-[2px]"
        @click="sidebarOpen = false"
      />
    </Transition>
    <!-- #endregion -->

    <!-- #region ALD 23/05/2026 - Sidebar floating drawer (mặc định đóng, persist localStorage) -->
    <aside
      :class="cn(
        'flex flex-col glass shadow-island-lg rounded-3xl z-40 transition-transform duration-300',
        'w-72 fixed inset-y-2 left-2',
        sidebarOpen ? 'translate-x-0' : '-translate-x-[110%]'
      )"
    >
      <!-- Brand + close -->
      <div class="flex items-center justify-between gap-2 p-3 border-b border-white/40">
        <NuxtLink to="/" class="flex items-center min-w-0 press" @click="sidebarOpen = false">
          <img :src="appConfig.app.logoLight" :alt="appConfig.app.name" class="h-11 w-auto max-w-[172px] object-contain" />
        </NuxtLink>
        <button
          type="button"
          class="h-9 w-9 flex items-center justify-center rounded-2xl text-gray-500 hover:bg-white/70 press"
          title="Đóng"
          @click="sidebarOpen = false"
        >
          <i class="bi bi-x text-xl" />
        </button>
      </div>

      <!-- Primary CTA: workflow mới -->
      <div class="p-3">
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-primary text-white font-semibold text-sm shadow-pill press hover:bg-primary-dark transition-colors"
          @click="onNewWorkflow"
        >
          <i class="bi bi-plus-circle" />
          {{ t('Workflow mới', 'New workflow') }}
        </button>
      </div>

      <!-- Nav primary -->
      <nav class="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
        <NuxtLink
          v-for="item in visibleNavItems"
          :key="item.to"
          :to="item.to"
          :class="cn(
            'flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-spring',
            isActive(item.to)
              ? 'bg-white shadow-card text-gray-900'
              : 'text-gray-600 hover:bg-white/60'
          )"
          @click="sidebarOpen = false"
        >
          <i :class="['bi text-base flex-shrink-0', item.icon]" />
          <span class="flex-1 truncate">{{ lang === 'en' ? item.en : item.label }}</span>
          <i v-if="isActive(item.to)" class="bi bi-chevron-right text-xs text-gray-400" />
        </NuxtLink>
      </nav>

      <!-- Footer user menu -->
      <div ref="userMenuWrapRef" class="p-2 border-t border-white/40 relative">
        <button
          type="button"
          class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl hover:bg-white/70 press transition-colors"
          @click="userMenuOpen = !userMenuOpen"
        >
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-primary font-bold text-sm flex-shrink-0">
            {{ userInitial }}
          </span>
          <div class="flex-1 min-w-0 text-left">
            <div class="text-sm font-semibold text-gray-900 truncate">
              {{ userEmail }}
            </div>
            <div class="text-[0.7rem] text-gray-500 truncate">
              {{ isAdmin ? 'Admin' : 'Thành viên' }}
            </div>
          </div>
          <i :class="['bi text-gray-400 text-xs', userMenuOpen ? 'bi-chevron-down' : 'bi-chevron-up']" />
        </button>

        <Transition
          enter-active-class="transition duration-200"
          leave-active-class="transition duration-150"
          enter-from-class="opacity-0 translate-y-1"
          leave-to-class="opacity-0 translate-y-1"
        >
          <div
            v-if="userMenuOpen"
            class="absolute bottom-full left-2 right-2 mb-2 glass rounded-2xl shadow-island-lg overflow-hidden"
          >
            <NuxtLink
              to="/settings"
              class="flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-white/70 transition-colors"
              @click="userMenuOpen = false; sidebarOpen = false"
            >
              <i class="bi bi-gear text-base" />
              {{ t('Cài đặt', 'Settings') }}
            </NuxtLink>
            <button
              type="button"
              class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
              @click="onLogout"
            >
              <i class="bi bi-box-arrow-right text-base" />
              {{ t('Đăng xuất', 'Log out') }}
            </button>
          </div>
        </Transition>
      </div>
    </aside>
    <!-- #endregion -->

    <!-- #region ALD 23/05/2026 - Main content area -->
    <div class="flex flex-1 min-w-0 flex-col">
      <header class="flex items-center gap-3 px-3 py-2 flex-shrink-0">
        <button
          type="button"
          class="h-10 w-10 flex items-center justify-center rounded-2xl glass shadow-card press hover:bg-white transition-colors flex-shrink-0"
          :title="sidebarOpen ? 'Đóng sidebar' : 'Mở sidebar'"
          @click="sidebarOpen = !sidebarOpen"
        >
          <i class="bi bi-layout-sidebar-inset text-xl text-gray-700" />
        </button>

        <NuxtLink to="/" class="hidden sm:flex items-center gap-2 min-w-0 flex-shrink-0 press">
          <span class="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-card">
            <img :src="appConfig.app.logoIcon" alt="" class="h-full w-full object-cover" />
          </span>
        </NuxtLink>

        <div class="min-w-0 flex-1 hidden md:flex items-baseline gap-3">
          <h1 class="text-2xl font-black tracking-tighter title-gradient truncate leading-none">
            {{ pageTitle }}
          </h1>
          <p class="text-[12px] text-slate-500 font-bold tracking-tight border-l border-slate-200 pl-3 truncate whitespace-nowrap">
            {{ pageSubtitle }}
          </p>
        </div>

        <!-- ALD 18/06/2026 - Nút đổi ngôn ngữ VI ⇄ EN (lưu localStorage). -->
        <button
          type="button"
          class="h-10 px-3 flex items-center gap-1.5 rounded-2xl glass shadow-card press hover:bg-white transition-colors flex-shrink-0 font-bold text-[13px] text-gray-700"
          :title="lang === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'"
          @click="toggle"
        >
          <i class="bi bi-translate text-base text-primary" />
          <span>{{ lang === 'vi' ? 'VI' : 'EN' }}</span>
        </button>

        <!-- ALD 25/05/2026 - Notification bell, hiển thị mọi page. -->
        <NotificationBell />
      </header>

      <div class="flex flex-1 min-h-0 flex-col">
        <slot />
      </div>
    </div>
    <!-- #endregion -->
  </div>
</template>

<script setup>
import { useStorage } from '@vueuse/core'

const route = useRoute()
const appConfig = useAppConfig()
const auth = useAuth()
const { lang, t, toggle } = useLang()

// Sidebar default closed; persist user choice qua reload
const sidebarOpen = useStorage('motions_sidebar_open', false)

// ALD 18/06/2026 - motions-studio FE-only: nav gọn — Tổng quan / Workflows / Cài đặt.
const navItems = [
  { to: '/',          icon: 'bi-house-door', label: 'Tổng quan', en: 'Overview' },
  { to: '/workflows', icon: 'bi-diagram-3',  label: 'Workflows', en: 'Workflows' },
  { to: '/monitor',   icon: 'bi-activity',   label: 'Giám sát',  en: 'Monitor' },
  { to: '/reports',   icon: 'bi-bar-chart',  label: 'Báo cáo',   en: 'Reports' },
  { to: '/settings',  icon: 'bi-sliders',    label: 'Cài đặt',   en: 'Settings' }
]

const visibleNavItems = computed(() => navItems)

function isActive(to) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}
// #endregion

// #region ALD 23/05/2026 - Page title từ route, fallback theo nav item
const pageTitle = computed(() => {
  const meta = route.meta?.title
  if (meta) return meta
  const item = visibleNavItems.value.find((n) => isActive(n.to))
  if (item && item.to !== '/') return lang.value === 'en' ? item.en : item.label
  if (route.path.startsWith('/workflows/')) return t('Trình tạo workflow', 'Workflow editor')
  return 'Motions Studio'
})

const pageSubtitle = computed(() => {
  const sub = route.meta?.subtitle
  if (sub) return sub
  if (route.path === '/')           return t('Quản lý workflows AI', 'Manage AI workflows')
  if (route.path === '/workflows')  return t('Tất cả workflows', 'All workflows')
  if (route.path === '/monitor')    return t('Job đang chạy', 'Live jobs')
  if (route.path === '/reports')    return t('Tổng quan hoạt động', 'Activity overview')
  if (route.path === '/settings')   return t('Provider & dữ liệu', 'Providers & data')
  if (route.path.startsWith('/workflows/')) return t('Thiết kế graph', 'Design graph')
  return ''
})
// #endregion

const userMenuOpen = ref(false)
const userMenuWrapRef = ref(null)

// #region ALD 23/05/2026 - Click outside đóng user menu
function onUserMenuOutside(e) {
  if (userMenuOpen.value && userMenuWrapRef.value && !userMenuWrapRef.value.contains(e.target)) {
    userMenuOpen.value = false
  }
}
onMounted(() => document.addEventListener('mousedown', onUserMenuOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onUserMenuOutside))
// #endregion


// #region ALD 23/05/2026 - Decode JWT cho role + email
const sessionClaim = computed(() => {
  return decodeJwtPayload(auth.token.value)
})
const userEmail = computed(() => sessionClaim.value?.email || 'Khách')
const isAdmin = computed(() => sessionClaim.value?.role === 'admin')
const userInitial = computed(() => (userEmail.value || '?').slice(0, 1).toUpperCase())
// #endregion

async function onNewWorkflow() {
  sidebarOpen.value = false
  await navigateTo('/workflows?new=1')
}

async function onLogout() {
  userMenuOpen.value = false
  auth.logout()
  await navigateTo('/login')
}

// Đóng menu khi route đổi
watch(() => route.path, () => {
  userMenuOpen.value = false
  sidebarOpen.value = false
})
</script>
