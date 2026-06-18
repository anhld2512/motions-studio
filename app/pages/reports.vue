<template>
  <!-- #region ALD 18/06/2026 - Báo cáo tổng: thống kê workflow / run / kết quả / cấu hình (FE-only, từ store). -->
  <div class="flex-1 min-h-0 overflow-hidden flex flex-col px-3 sm:px-6 py-3 gap-3">
    <header class="glass shadow-island rounded-3xl px-4 sm:px-6 py-3 flex-shrink-0 flex items-center gap-3 flex-wrap">
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-bold uppercase tracking-widest text-primary leading-none">BÁO CÁO</p>
        <h2 class="text-xl sm:text-2xl font-black tracking-tighter title-gradient leading-tight mt-0.5">Tổng quan hoạt động</h2>
      </div>
      <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" @click="refresh">
        <i class="bi bi-arrow-clockwise me-1" />Làm mới
      </button>
    </header>

    <section class="flex-1 min-h-0 overflow-y-auto pr-1 pb-4 space-y-3">
      <!-- KPI -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div v-for="k in kpis" :key="k.label" class="glass shadow-card rounded-3xl p-4 flex items-center gap-3">
          <span :class="['inline-flex h-11 w-11 items-center justify-center rounded-2xl flex-shrink-0', k.bg]"><i :class="['bi text-lg', k.icon]" /></span>
          <div class="min-w-0">
            <div class="text-2xl font-black tracking-tighter text-gray-900 leading-none">{{ k.value }}</div>
            <div class="text-[11px] font-bold uppercase tracking-wide text-gray-500 mt-1 truncate">{{ k.label }}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <!-- Tỷ lệ trạng thái -->
        <section class="glass shadow-card rounded-3xl p-4">
          <h3 class="text-sm font-bold text-gray-900 mb-3"><i class="bi bi-pie-chart me-1.5 text-primary" />Trạng thái run</h3>
          <div v-if="!totalRuns" class="text-[13px] text-gray-400 py-4 text-center">Chưa có run nào.</div>
          <div v-else class="space-y-2.5">
            <div v-for="s in statusRows" :key="s.key">
              <div class="flex items-center justify-between text-[12px] mb-1">
                <span class="font-semibold text-gray-700 inline-flex items-center gap-1.5"><i :class="['bi', s.icon, s.text]" />{{ s.label }}</span>
                <span class="text-gray-500">{{ s.count }} · {{ s.pct }}%</span>
              </div>
              <div class="h-2 rounded-full bg-gray-100 overflow-hidden"><div :class="['h-full rounded-full', s.bar]" :style="{ width: s.pct + '%' }" /></div>
            </div>
            <div class="pt-1 text-[12px] text-gray-500">Tỷ lệ thành công: <b class="text-emerald-600">{{ successRate }}%</b></div>
          </div>
        </section>

        <!-- Top workflow theo số run -->
        <section class="glass shadow-card rounded-3xl p-4">
          <h3 class="text-sm font-bold text-gray-900 mb-3"><i class="bi bi-trophy me-1.5 text-amber-500" />Workflow chạy nhiều nhất</h3>
          <div v-if="!topWorkflows.length" class="text-[13px] text-gray-400 py-4 text-center">Chưa có dữ liệu.</div>
          <div v-else class="space-y-2">
            <div v-for="w in topWorkflows" :key="w.id" class="flex items-center gap-2.5">
              <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-primary flex-shrink-0"><i class="bi bi-diagram-3-fill text-sm" /></span>
              <div class="min-w-0 flex-1">
                <div class="text-[13px] font-bold text-gray-900 truncate">{{ w.name }}</div>
                <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1"><div class="h-full rounded-full bg-primary" :style="{ width: w.pct + '%' }" /></div>
              </div>
              <div class="text-[11px] text-gray-500 text-right flex-shrink-0">{{ w.total }} run<br><span class="text-emerald-600">{{ w.ok }} ok</span></div>
            </div>
          </div>
        </section>

        <!-- Hoạt động 7 ngày -->
        <section class="glass shadow-card rounded-3xl p-4">
          <h3 class="text-sm font-bold text-gray-900 mb-3"><i class="bi bi-calendar3 me-1.5 text-violet-600" />7 ngày gần đây</h3>
          <div class="flex items-end gap-2 h-28">
            <div v-for="d in days" :key="d.key" class="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
              <div class="w-full rounded-t-lg bg-primary/80" :style="{ height: (maxDay ? (d.count / maxDay * 88) : 0) + 'px', minHeight: d.count ? '4px' : '0' }" :title="`${d.count} run`" />
              <span class="text-[9.5px] text-gray-400">{{ d.label }}</span>
            </div>
          </div>
          <div class="text-[11px] text-gray-500 mt-2">Tổng 7 ngày: <b>{{ days.reduce((a, b) => a + b.count, 0) }}</b> run</div>
        </section>

        <!-- Kết quả + cấu hình -->
        <section class="glass shadow-card rounded-3xl p-4 space-y-3">
          <div>
            <h3 class="text-sm font-bold text-gray-900 mb-2"><i class="bi bi-collection me-1.5 text-rose-500" />Kết quả đã tạo</h3>
            <div class="flex gap-2">
              <div v-for="o in outputs" :key="o.label" class="flex-1 rounded-2xl bg-white/60 border border-white/70 p-2.5 text-center">
                <div class="text-lg font-black text-gray-900">{{ o.value }}</div>
                <div class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide"><i :class="['bi me-0.5', o.icon]" />{{ o.label }}</div>
              </div>
            </div>
          </div>
          <div>
            <h3 class="text-sm font-bold text-gray-900 mb-2"><i class="bi bi-gear me-1.5 text-gray-500" />Cấu hình</h3>
            <div class="space-y-1.5 text-[12.5px]">
              <div class="flex items-center justify-between"><span class="text-gray-600"><i class="bi bi-database me-1.5" />Lưu workflow</span><span class="font-semibold" :class="cfg.db === 'Neon' ? 'text-emerald-600' : 'text-gray-700'">{{ cfg.db }}</span></div>
              <div class="flex items-center justify-between"><span class="text-gray-600"><i class="bi bi-images me-1.5" />Lưu file</span><span class="font-semibold" :class="cfg.file === 'Supabase' ? 'text-emerald-600' : 'text-gray-700'">{{ cfg.file }}</span></div>
              <div class="flex items-center justify-between"><span class="text-gray-600"><i class="bi bi-plug me-1.5" />Provider đã gắn</span><span class="font-semibold text-gray-700">{{ cfg.providers }} · {{ cfg.bound }}/5 nhóm</span></div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
  <!-- #endregion -->
</template>

<script setup>
definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Báo cáo — Motions Studio' })

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
  { label: 'Workflow', value: workflows.value.length, icon: 'bi-diagram-3-fill', bg: 'bg-blue-100 text-primary' },
  { label: 'Tổng run', value: totalRuns.value, icon: 'bi-play-circle-fill', bg: 'bg-violet-100 text-violet-700' },
  { label: 'Thành công', value: countBy('success'), icon: 'bi-check2-circle', bg: 'bg-emerald-100 text-emerald-700' },
  { label: 'Lỗi', value: countBy('error'), icon: 'bi-x-circle', bg: 'bg-rose-100 text-rose-700' }
])

const statusRows = computed(() => {
  const defs = [
    { key: 'success', label: 'Xong', icon: 'bi-check2-circle', text: 'text-emerald-600', bar: 'bg-emerald-500' },
    { key: 'running', label: 'Đang chạy', icon: 'bi-arrow-repeat', text: 'text-amber-600', bar: 'bg-amber-400' },
    { key: 'queued', label: 'Chờ', icon: 'bi-hourglass-split', text: 'text-primary', bar: 'bg-blue-400' },
    { key: 'error', label: 'Lỗi', icon: 'bi-x-circle', text: 'text-rose-600', bar: 'bg-rose-500' }
  ]
  return defs.map((d) => {
    const count = countBy(d.key)
    return { ...d, count, pct: totalRuns.value ? Math.round(count / totalRuns.value * 100) : 0 }
  }).filter((d) => d.count > 0)
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
  return arr.map((x) => ({ ...x, name: nameOf[x.id] || '— đã xoá —', pct: Math.round(x.total / max * 100) }))
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

const outputs = computed(() => {
  let img = 0, vid = 0, txt = 0
  for (const r of runs.value) {
    const m = r.output?.metadata || {}
    if (m.image || m.images?.length) img++
    if (m.video || m.videos?.length) vid++
    if (m.text) txt++
  }
  return [
    { label: 'Ảnh', value: img, icon: 'bi-image' },
    { label: 'Video', value: vid, icon: 'bi-camera-reels' },
    { label: 'Văn bản', value: txt, icon: 'bi-card-text' }
  ]
})

const cfg = computed(() => ({
  db: db.isNeon() ? 'Neon' : 'Local',
  file: fileStore.enabled() ? 'Supabase' : 'Local',
  providers: prov.providers.value.length,
  bound: Object.keys(prov.bindings.value || {}).filter((k) => prov.bindings.value[k]?.providerId).length
}))
</script>
