<template>
  <!-- #region ALD 18/06/2026 - motions-studio: trang Cài đặt tối giản, 2 tab — Provider + Dữ liệu. -->
  <div class="flex-1 min-h-0 overflow-hidden flex flex-col px-3 sm:px-6 py-3 gap-3">
    <header class="glass shadow-island rounded-3xl px-4 sm:px-6 py-3 flex-shrink-0">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="min-w-0 flex-1">
          <h2 class="text-lg sm:text-xl font-black tracking-tight title-gradient leading-tight">{{ t('settingsPage.title') }}</h2>
          <p class="text-[12px] text-gray-500 truncate">{{ activeSubtitle }}</p>
        </div>
        <nav class="flex gap-1.5 flex-shrink-0">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            :class="['press inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold transition-colors',
              activeTab === tab.id ? 'bg-primary text-white shadow-pill' : 'glass text-gray-600 hover:bg-white']"
            @click="activeTab = tab.id"
          >
            <i :class="['bi', tab.icon]" />
            {{ tab.label }}
          </button>
        </nav>
      </div>
    </header>

    <section class="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
      <SettingsProviderManager v-if="activeTab === 'provider'" />
      <SettingsDatabaseManager v-else-if="activeTab === 'data'" />
    </section>
  </div>
  <!-- #endregion -->
</template>

<script setup>
definePageMeta({ middleware: ['auth'] })
const { t } = useI18n()
useHead({ title: t('settingsPage.pageTitle') })

const tabs = computed(() => [
  { id: 'provider', label: t('settingsPage.tabProvider'), icon: 'bi-plug-fill' },
  { id: 'data',     label: t('settingsPage.tabData'),     icon: 'bi-database' }
])
const route = useRoute()
const activeTab = ref(tabs.value.some((tb) => tb.id === route.query.tab) ? String(route.query.tab) : 'provider')

const SUBTITLES = computed(() => ({
  provider: t('settingsPage.subtitleProvider'),
  data: t('settingsPage.subtitleData')
}))
const activeSubtitle = computed(() => SUBTITLES.value[activeTab.value] || '')
</script>
