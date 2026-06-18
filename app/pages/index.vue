<template>
  <!-- #region ALD 18/06/2026 - Trang chủ 1 màn hình KHÔNG scroll: header gọn + lưới TẤT CẢ workflow lấp đầy viewport. -->
  <div class="flex-1 min-h-0 overflow-hidden flex flex-col px-3 sm:px-6 py-3 gap-3">
    <!-- Header gọn: tiêu đề + chip thống kê + nút -->
    <header class="glass shadow-island rounded-3xl px-4 sm:px-6 py-3 flex-shrink-0 flex items-center gap-4 flex-wrap">
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-bold uppercase tracking-widest text-primary leading-none">
          MOTIONS - AI STUDIO
        </p>
        <h2 class="text-xl sm:text-2xl font-black tracking-tighter title-gradient leading-tight mt-0.5">
          {{ t('home.title') }}
        </h2>
      </div>

      <!-- Chip thống kê (inline, gọn) -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <div
          v-for="s in stats"
          :key="s.label"
          class="flex items-center gap-2 h-10 px-3 rounded-2xl bg-white/50 border border-white/60"
        >
          <span :class="cn('inline-flex h-7 w-7 items-center justify-center rounded-xl flex-shrink-0', s.bg)">
            <i :class="['bi text-sm', s.icon]" />
          </span>
          <div class="leading-none">
            <div class="text-sm font-black tracking-tight text-gray-900">{{ s.value }}</div>
            <div class="text-[9px] font-bold uppercase tracking-wide text-gray-500 mt-0.5">{{ s.label }}</div>
          </div>
        </div>
      </div>

      <div class="flex gap-2 flex-shrink-0">
        <NuxtLink
          to="/workflows?new=1"
          class="press inline-flex items-center gap-2 h-10 px-4 rounded-full bg-primary text-white text-sm font-semibold shadow-pill hover:bg-primary-dark transition-colors"
        >
          <i class="bi bi-plus-circle" />
          {{ t('home.newWorkflow') }}
        </NuxtLink>
        <NuxtLink
          to="/workflows"
          class="press inline-flex items-center gap-2 h-10 px-4 rounded-full glass shadow-card text-sm font-semibold text-gray-700 hover:bg-white transition-colors"
        >
          {{ t('home.editor') }}
          <i class="bi bi-arrow-right" />
        </NuxtLink>
      </div>
    </header>

    <!-- Lưới workflow lấp đầy phần còn lại, KHÔNG scroll -->
    <section class="flex-1 min-h-0 overflow-hidden">
      <div v-if="workflows.loading.value" class="h-full flex items-center justify-center text-gray-400">
        <i class="bi bi-arrow-clockwise animate-spin text-3xl" />
      </div>

      <div v-else-if="!workflows.items.value.length" class="h-full flex flex-col items-center justify-center text-center">
        <i class="bi bi-diagram-3 text-4xl text-gray-300" />
        <p class="text-sm font-semibold text-gray-600 mt-3">{{ t('home.emptyTitle') }}</p>
        <p class="text-xs text-gray-400 mt-1">{{ t('home.emptyHint') }}</p>
        <NuxtLink
          to="/workflows?new=1"
          class="mt-4 press inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-white text-sm font-semibold shadow-pill hover:bg-primary-dark transition-colors"
        >
          <i class="bi bi-plus-circle" />
          {{ t('home.createWorkflow') }}
        </NuxtLink>
      </div>

      <!-- Lưới thẻ workflow — thẻ CO theo nội dung (không kéo giãn full chiều cao), tự xuống dòng. -->
      <div
        v-else
        class="grid gap-3 content-start auto-rows-min overflow-y-auto pb-2"
        style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));"
      >
        <NuxtLink
          v-for="wf in workflows.items.value"
          :key="wf.id"
          :to="`/workflows/${wf.id}`"
          class="group glass shadow-card rounded-3xl p-4 min-h-[104px] flex flex-col gap-2 hover:bg-white hover:shadow-island transition-spring press"
        >
          <div class="flex items-center gap-3">
            <span class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-primary flex-shrink-0">
              <i class="bi bi-diagram-3-fill text-lg" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-bold text-gray-900 truncate">{{ wf.name || wf.slug }}</div>
              <code class="text-[10px] font-mono text-gray-400 truncate block">{{ wf.slug }}</code>
            </div>
            <i class="bi bi-chevron-right text-gray-300 text-xs flex-shrink-0 group-hover:text-primary transition-colors" />
          </div>
          <p v-if="wf.description" class="text-[11px] text-gray-500 leading-snug line-clamp-2 min-h-0">
            {{ wf.description }}
          </p>
        </NuxtLink>

        <!-- Thẻ tạo mới luôn ở cuối -->
        <NuxtLink
          to="/workflows?new=1"
          class="rounded-3xl border-2 border-dashed border-gray-200 hover:border-primary/50 min-h-[104px] flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-primary transition-colors press"
        >
          <i class="bi bi-plus-lg text-2xl" />
          <span class="text-xs font-semibold">{{ t('home.newWorkflow') }}</span>
        </NuxtLink>
      </div>
    </section>
  </div>
  <!-- #endregion -->
</template>

<script setup>
definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
useHead({ title: t('home.pageTitle') })

const workflows = useWorkflows()
const db = useLocalDb()
const fileStore = useFileStore()
db.load(); fileStore.load()

onMounted(async () => {
  try { await workflows.seedStarters() } catch { /* OK */ }   // 3 workflow mẫu (seed 1 lần)
  try { await workflows.load() } catch { /* OK */ }
})

// ALD 18/06/2026 - motions-studio FE-only: chip thống kê thuần client (không gọi backend).
const stats = computed(() => [
  { label: t('home.statWorkflows'), value: workflows.items.value.length, icon: 'bi-diagram-3-fill', bg: 'bg-blue-100 text-primary' },
  { label: t('home.statStorage'),   value: db.isNeon() ? 'Neon' : 'Local', icon: 'bi-database', bg: 'bg-violet-100 text-violet-700' },
  { label: t('home.statFiles'),     value: fileStore.enabled() ? 'Supabase' : 'Local', icon: 'bi-hdd', bg: 'bg-rose-100 text-rose-700' }
])
</script>
