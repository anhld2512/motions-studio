<template>
  <!-- #region ALD 18/06/2026 - motions-studio: trang Cài đặt tối giản, 2 tab — Provider + Dữ liệu. -->
  <div class="flex-1 min-h-0 overflow-hidden flex flex-col px-3 sm:px-6 py-3 gap-3">
    <header class="glass shadow-island rounded-3xl px-4 sm:px-6 py-3 flex-shrink-0">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="min-w-0 flex-1">
          <h2 class="text-lg sm:text-xl font-black tracking-tight title-gradient leading-tight">Cài đặt</h2>
          <p class="text-[12px] text-gray-500 truncate">{{ activeSubtitle }}</p>
        </div>
        <nav class="flex gap-1.5 flex-shrink-0">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            :class="['press inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold transition-colors',
              activeTab === t.id ? 'bg-primary text-white shadow-pill' : 'glass text-gray-600 hover:bg-white']"
            @click="activeTab = t.id"
          >
            <i :class="['bi', t.icon]" />
            {{ t.label }}
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
useHead({ title: 'Cài đặt — Motions Studio' })

const tabs = [
  { id: 'provider', label: 'Provider', icon: 'bi-plug-fill' },
  { id: 'data',     label: 'Dữ liệu',  icon: 'bi-database' }
]
const route = useRoute()
const activeTab = ref(tabs.some((t) => t.id === route.query.tab) ? String(route.query.tab) : 'provider')

const SUBTITLES = {
  provider: 'Gắn AI provider theo nhóm năng lực. API key được mã hoá an toàn trong trình duyệt.',
  data: 'Lưu workflow ở localStorage hoặc Neon; file ở Supabase (nếu cấu hình) hoặc localStorage.'
}
const activeSubtitle = computed(() => SUBTITLES[activeTab.value] || '')
</script>
