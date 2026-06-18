<template>
  <!-- #region ALD 18/06/2026 - Báo cáo tổng: thống kê workflow / run / kết quả / cấu hình (FE-only, từ store). -->
  <div class="flex-1 min-h-0 overflow-hidden flex flex-col px-3 sm:px-5 py-3 gap-2.5">
    <header class="flex-shrink-0 flex items-center gap-3 flex-wrap px-1">
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-bold uppercase tracking-widest text-primary leading-none">{{ t('reports.eyebrow') }}</p>
        <h2 class="text-lg sm:text-xl font-black tracking-tighter title-gradient leading-tight mt-0.5">{{ t('reports.title') }}</h2>
      </div>
      <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" @click="refresh">
        <i class="bi bi-arrow-clockwise me-1" />{{ t('reports.refresh') }}
      </button>
    </header>

    <!-- KPI -->
    <div class="grid grid-cols-4 gap-2.5 flex-shrink-0">
      <div v-for="k in kpis" :key="k.label" class="glass shadow-card rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5">
        <span :class="['inline-flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0', k.bg]"><i :class="['bi', k.icon]" /></span>
        <div class="min-w-0">
          <div class="text-xl font-black tracking-tighter text-gray-900 leading-none">{{ k.value }}</div>
          <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500 mt-0.5 truncate">{{ k.label }}</div>
        </div>
      </div>
    </div>

    <!-- Lưới biểu đồ — lấp đầy phần còn lại, KHÔNG cuộn -->
    <div class="flex-1 min-h-0 grid grid-cols-12 grid-rows-2 gap-2.5">
      <!-- Donut trạng thái -->
      <section class="glass shadow-card rounded-2xl p-3.5 col-span-4 row-span-1 flex flex-col">
        <h3 class="text-[13px] font-bold text-gray-900 mb-1"><i class="bi bi-pie-chart-fill me-1.5 text-primary" />{{ t('reports.statusTitle') }}</h3>
        <div v-if="!totalRuns" class="flex-1 flex items-center justify-center text-[12px] text-gray-400">{{ t('reports.noRuns') }}</div>
        <div v-else class="flex-1 flex items-center gap-3 min-h-0">
          <svg viewBox="0 0 42 42" class="h-[104px] w-[104px] flex-shrink-0 -rotate-90">
            <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#eef0f3" stroke-width="5" />
            <circle v-for="seg in donut" :key="seg.key" cx="21" cy="21" r="15.9155" fill="none"
              :stroke="seg.color" stroke-width="5" :stroke-dasharray="`${seg.pct} ${100 - seg.pct}`" :stroke-dashoffset="seg.offset" />
            <text x="21" y="20.5" transform="rotate(90 21 21)" text-anchor="middle" class="fill-gray-900" style="font-size:7px;font-weight:800">{{ successRate }}%</text>
            <text x="21" y="26" transform="rotate(90 21 21)" text-anchor="middle" class="fill-gray-400" style="font-size:3px;font-weight:600">SUCCESS</text>
          </svg>
          <div class="flex-1 min-w-0 space-y-1.5">
            <div v-for="s in statusRows" :key="s.key" class="flex items-center gap-1.5 text-[12px]">
              <span class="h-2.5 w-2.5 rounded-full flex-shrink-0" :style="{ background: s.color }" />
              <span class="font-semibold text-gray-700 truncate">{{ s.label }}</span>
              <span class="ml-auto text-gray-500 flex-shrink-0">{{ s.count }} · {{ s.pct }}%</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 7 ngày -->
      <section class="glass shadow-card rounded-2xl p-3.5 col-span-8 row-span-1 flex flex-col">
        <h3 class="text-[13px] font-bold text-gray-900 mb-1"><i class="bi bi-bar-chart-fill me-1.5 text-violet-600" />{{ t('reports.activity7d') }} <span class="text-gray-400 font-normal float-right">{{ t('reports.runCount', { n: days.reduce((a, b) => a + b.count, 0) }) }}</span></h3>
        <div class="flex-1 flex items-end gap-2.5 min-h-0 pt-2">
          <div v-for="d in days" :key="d.key" class="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full">
            <span class="text-[10px] font-bold text-gray-500" :class="{ 'opacity-0': !d.count }">{{ d.count }}</span>
            <div class="w-full rounded-t-md bg-gradient-to-t from-primary to-violet-400" :style="{ height: pctH(d.count) }" :title="`${d.count} run`" />
            <span class="text-[9.5px] text-gray-400">{{ d.label }}</span>
          </div>
        </div>
      </section>

      <!-- Top workflow -->
      <section class="glass shadow-card rounded-2xl p-3.5 col-span-5 row-span-1 flex flex-col min-h-0">
        <h3 class="text-[13px] font-bold text-gray-900 mb-1.5"><i class="bi bi-trophy-fill me-1.5 text-amber-500" />{{ t('reports.topWorkflows') }}</h3>
        <div v-if="!topWorkflows.length" class="flex-1 flex items-center justify-center text-[12px] text-gray-400">{{ t('reports.noData') }}</div>
        <div v-else class="flex-1 min-h-0 overflow-auto space-y-1.5 pr-1">
          <div v-for="w in topWorkflows" :key="w.id" class="flex items-center gap-2">
            <div class="min-w-0 flex-1">
              <div class="text-[12px] font-bold text-gray-800 truncate">{{ w.name }}</div>
              <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1"><div class="h-full rounded-full bg-primary" :style="{ width: w.pct + '%' }" /></div>
            </div>
            <div class="text-[10.5px] text-gray-500 text-right flex-shrink-0 leading-tight">{{ t('reports.runCount', { n: w.total }) }}<br><span class="text-emerald-600">{{ t('reports.okCount', { n: w.ok }) }}</span></div>
          </div>
        </div>
      </section>

      <!-- Kết quả -->
      <section class="glass shadow-card rounded-2xl p-3.5 col-span-3 row-span-1 flex flex-col">
        <h3 class="text-[13px] font-bold text-gray-900 mb-1.5"><i class="bi bi-collection-fill me-1.5 text-rose-500" />{{ t('reports.outputsTitle') }}</h3>
        <div class="flex-1 grid grid-rows-3 gap-1.5">
          <div v-for="o in outputs" :key="o.label" class="rounded-xl bg-white/60 border border-white/70 px-3 flex items-center gap-2">
            <i :class="['bi text-lg', o.icon, o.text]" />
            <span class="text-[12px] font-semibold text-gray-600">{{ o.label }}</span>
            <span class="ml-auto text-lg font-black text-gray-900">{{ o.value }}</span>
          </div>
        </div>
      </section>

      <!-- Cấu hình -->
      <section class="glass shadow-card rounded-2xl p-3.5 col-span-4 row-span-1 flex flex-col">
        <h3 class="text-[13px] font-bold text-gray-900 mb-1.5"><i class="bi bi-gear-fill me-1.5 text-gray-500" />{{ t('reports.configTitle') }}</h3>
        <div class="flex-1 flex flex-col justify-center space-y-2 text-[12.5px]">
          <div class="flex items-center justify-between"><span class="text-gray-600"><i class="bi bi-database me-1.5" />{{ t('reports.cfgWorkflowStore') }}</span><span class="font-semibold px-2 py-0.5 rounded-full" :class="cfg.db === 'Neon' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'">{{ cfg.db }}</span></div>
          <div class="flex items-center justify-between"><span class="text-gray-600"><i class="bi bi-images me-1.5" />{{ t('reports.cfgFileStore') }}</span><span class="font-semibold px-2 py-0.5 rounded-full" :class="cfg.file === 'Supabase' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'">{{ cfg.file }}</span></div>
          <div class="flex items-center justify-between"><span class="text-gray-600"><i class="bi bi-plug me-1.5" />{{ t('reports.cfgProvider') }}</span><span class="font-semibold text-gray-700">{{ t('reports.cfgProviderValue', { providers: cfg.providers, bound: cfg.bound }) }}</span></div>
        </div>
      </section>
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Báo cáo — Motions Studio' })
const { t } = useI18n()

const db = useLocalDb()
const prov = useProviders()
const fileStore = useFileStore()
prov.load(); fileStore.load()

const runs = ref([])
const workflows = ref([])

async function refresh() {
  try {
    const [r, w] = await Promise.all([db.list('workflow_runs'), db.list('workflows')])
    runs.value = r || []; workflows.value = w || []
  } catch { /* ok */ }
}
onMounted(refresh)

const totalRuns = computed(() => runs.value.length)
const countBy = (s) => runs.value.filter((r) => r.status === s).length
const successRate = computed(() => totalRuns.value ? Math.round(countBy('success') / totalRuns.value * 100) : 0)

const kpis = computed(() => [
  { label: t('reports.kpiWorkflows'), value: workflows.value.length, icon: 'bi-diagram-3-fill', bg: 'bg-blue-100 text-primary' },
  { label: t('reports.kpiTotalRuns'), value: totalRuns.value, icon: 'bi-play-circle-fill', bg: 'bg-violet-100 text-violet-700' },
  { label: t('reports.kpiSuccess'), value: countBy('success'), icon: 'bi-check2-circle', bg: 'bg-emerald-100 text-emerald-700' },
  { label: t('reports.kpiErrors'), value: countBy('error'), icon: 'bi-x-circle', bg: 'bg-rose-100 text-rose-700' }
])

const statusRows = computed(() => {
  const defs = [
    { key: 'success', label: t('reports.statusSuccess'), color: '#10b981' },
    { key: 'running', label: t('reports.statusRunning'), color: '#f59e0b' },
    { key: 'queued', label: t('reports.statusQueued'), color: '#3b82f6' },
    { key: 'error', label: t('reports.statusError'), color: '#f43f5e' }
  ]
  return defs.map((d) => {
    const count = countBy(d.key)
    return { ...d, count, pct: totalRuns.value ? Math.round(count / totalRuns.value * 100) : 0 }
  }).filter((d) => d.count > 0)
})

// Donut: mỗi segment = vòng tròn r=15.9155 (chu vi ≈ 100) với dasharray theo % + offset cộng dồn.
const donut = computed(() => {
  let acc = 0
  return statusRows.value.map((s) => {
    const seg = { key: s.key, color: s.color, pct: s.pct, offset: (100 - acc) % 100 || 0 }
    acc += s.pct
    return seg
  })
})

const topWorkflows = computed(() => {
  const m = {}
  for (const r of runs.value) {
    const id = r.workflow_id || '—'
    m[id] = m[id] || { id, total: 0, ok: 0 }
    m[id].total++; if (r.status === 'success') m[id].ok++
  }
  const nameOf = Object.fromEntries(workflows.value.map((w) => [w.id, w.name || w.slug]))
  const arr = Object.values(m).sort((a, b) => b.total - a.total).slice(0, 5)
  const max = arr[0]?.total || 1
  return arr.map((x) => ({ ...x, name: nameOf[x.id] || t('reports.deletedWorkflow'), pct: Math.round(x.total / max * 100) }))
})

const days = computed(() => {
  const out = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0, 0, 0, 0)
    const next = new Date(d); next.setDate(d.getDate() + 1)
    const count = runs.value.filter((r) => { const t = new Date(r.created_at || 0); return t >= d && t < next }).length
    out.push({ key: d.toISOString().slice(0, 10), label: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()], count })
  }
  return out
})
const maxDay = computed(() => Math.max(1, ...days.value.map((d) => d.count)))
const pctH = (n) => `${maxDay.value ? Math.max(n ? 6 : 0, Math.round(n / maxDay.value * 100)) : 0}%`

const outputs = computed(() => {
  let img = 0, vid = 0, txt = 0
  for (const r of runs.value) {
    const m = r.output?.metadata || {}
    if (m.image || m.images?.length) img++
    if (m.video || m.videos?.length) vid++
    if (m.text) txt++
  }
  return [
    { label: t('reports.outImages'), value: img, icon: 'bi-image', text: 'text-blue-500' },
    { label: t('reports.outVideos'), value: vid, icon: 'bi-camera-reels', text: 'text-violet-500' },
    { label: t('reports.outText'), value: txt, icon: 'bi-card-text', text: 'text-emerald-500' }
  ]
})

const cfg = computed(() => ({
  db: db.isNeon() ? 'Neon' : 'Local',
  file: fileStore.enabled() ? 'Supabase' : 'Local',
  providers: prov.providers.value.length,
  bound: Object.keys(prov.bindings.value || {}).filter((k) => prov.bindings.value[k]?.providerId).length
}))
</script>
