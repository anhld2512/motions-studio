<template>
  <!-- #region ALD 18/06/2026 - Trang Giám sát: tổng quan các workflow run (job) đang chạy / đã xong. Tự refresh. -->
  <div class="flex-1 min-h-0 overflow-hidden flex flex-col px-3 sm:px-6 py-3 gap-3">
    <!-- Header + chip thống kê -->
    <header class="glass shadow-island rounded-3xl px-4 sm:px-6 py-3 flex-shrink-0 flex items-center gap-4 flex-wrap">
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-bold uppercase tracking-widest text-primary leading-none">GIÁM SÁT</p>
        <h2 class="text-xl sm:text-2xl font-black tracking-tighter title-gradient leading-tight mt-0.5">Job đang chạy</h2>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div v-for="s in stats" :key="s.label" class="flex items-center gap-2 h-10 px-3 rounded-2xl bg-white/50 border border-white/60">
          <span :class="['inline-flex h-7 w-7 items-center justify-center rounded-xl flex-shrink-0', s.bg]"><i :class="['bi text-sm', s.icon]" /></span>
          <div class="leading-none">
            <div class="text-sm font-black tracking-tight text-gray-900">{{ s.value }}</div>
            <div class="text-[9px] font-bold uppercase tracking-wide text-gray-500 mt-0.5">{{ s.label }}</div>
          </div>
        </div>
      </div>
      <button v-if="finishedCount" type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white flex-shrink-0" @click="clearFinished">
        <i class="bi bi-trash3 me-1" />Dọn đã xong
      </button>
    </header>

    <!-- Danh sách run -->
    <section class="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
      <div v-if="!runs.length" class="h-full flex flex-col items-center justify-center text-center text-gray-400">
        <i class="bi bi-activity text-4xl text-gray-300" />
        <p class="text-sm font-semibold text-gray-600 mt-3">Chưa có job nào</p>
        <p class="text-xs text-gray-400 mt-1">Mở 1 workflow và bấm Test để bắt đầu.</p>
        <NuxtLink to="/workflows" class="mt-4 press inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-white text-sm font-semibold shadow-pill hover:bg-primary-dark"><i class="bi bi-diagram-3" />Tới Workflows</NuxtLink>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div v-for="r in runs" :key="r.id" class="glass shadow-card rounded-3xl p-3.5 flex items-start gap-3">
          <span :class="['inline-flex h-10 w-10 items-center justify-center rounded-2xl flex-shrink-0 mt-0.5', stChip(r.status).bg]">
            <i :class="['bi', stChip(r.status).icon, r.status === 'running' && 'animate-spin']" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-gray-900 truncate">{{ wfName(r.workflow_id) }}</span>
              <span :class="['text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md', stChip(r.status).pill]">{{ stChip(r.status).label }}</span>
            </div>
            <div class="text-[11.5px] text-gray-500 truncate mt-0.5">
              <i class="bi bi-dot" />{{ lastMsg(r) }}
            </div>
            <!-- preview kết quả nếu có -->
            <div v-if="thumb(r)" class="mt-2">
              <img v-if="thumb(r).kind === 'image'" :src="thumb(r).url" class="h-16 rounded-lg border border-white/70 object-cover" alt="" />
              <video v-else-if="thumb(r).kind === 'video'" :src="thumb(r).url" class="h-16 rounded-lg border border-white/70" muted />
            </div>
            <div class="flex items-center gap-3 mt-2 text-[10.5px] text-gray-400">
              <span><i class="bi bi-clock me-1" />{{ fmtTime(r.created_at) }}</span>
              <span><i class="bi bi-list-task me-1" />{{ (r.events || []).length }} bước</span>
              <NuxtLink v-if="r.workflow_id" :to="`/workflows/${r.workflow_id}`" class="text-primary font-semibold hover:underline ml-auto">Mở</NuxtLink>
              <button type="button" class="press text-rose-400 hover:text-rose-600" title="Xoá" @click="removeRun(r.id)"><i class="bi bi-x-lg" /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
  <!-- #endregion -->
</template>

<script setup>
definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Giám sát — Motions Studio' })

const db = useLocalDb()
const runs = ref([])
const wfMap = ref({})
let timer = null

async function refresh() {
  try {
    const [rrows, wrows] = await Promise.all([db.list('workflow_runs'), db.list('workflows')])
    wfMap.value = Object.fromEntries((wrows || []).map((w) => [w.id, w.name || w.slug]))
    // running/queued lên đầu, còn lại theo created_at giảm dần
    const order = { running: 0, queued: 1, error: 2, success: 3 }
    runs.value = (rrows || []).slice().sort((a, b) =>
      (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
  } catch { /* offline ok */ }
}

onMounted(() => { refresh(); timer = setInterval(refresh, 1500) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const wfName = (id) => wfMap.value[id] || '— workflow đã xoá —'
const lastMsg = (r) => (r.events || [])[(r.events || []).length - 1]?.msg || 'đang chờ…'
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.max(0, Math.round(diff))}s trước`
  if (diff < 3600) return `${Math.round(diff / 60)}p trước`
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
function thumb(r) {
  const m = r.output?.metadata || {}
  if (m.video) return { kind: 'video', url: m.video }
  if (m.image) return { kind: 'image', url: m.image }
  return null
}

const ST = {
  running: { label: 'Đang chạy', icon: 'bi-arrow-repeat', bg: 'bg-amber-100 text-amber-700', pill: 'bg-amber-100 text-amber-700' },
  queued:  { label: 'Chờ',       icon: 'bi-hourglass-split', bg: 'bg-blue-50 text-primary', pill: 'bg-blue-100 text-primary' },
  success: { label: 'Xong',      icon: 'bi-check2-circle', bg: 'bg-emerald-100 text-emerald-700', pill: 'bg-emerald-100 text-emerald-700' },
  error:   { label: 'Lỗi',       icon: 'bi-x-circle', bg: 'bg-rose-100 text-rose-700', pill: 'bg-rose-100 text-rose-700' }
}
const stChip = (s) => ST[s] || { label: s || '?', icon: 'bi-question', bg: 'bg-gray-100 text-gray-500', pill: 'bg-gray-100 text-gray-500' }

const stats = computed(() => {
  const c = { running: 0, queued: 0, success: 0, error: 0 }
  for (const r of runs.value) c[r.status] = (c[r.status] || 0) + 1
  return [
    { label: 'Đang chạy', value: c.running + c.queued, icon: 'bi-arrow-repeat', bg: 'bg-amber-100 text-amber-700' },
    { label: 'Xong', value: c.success, icon: 'bi-check2-circle', bg: 'bg-emerald-100 text-emerald-700' },
    { label: 'Lỗi', value: c.error, icon: 'bi-x-circle', bg: 'bg-rose-100 text-rose-700' }
  ]
})
const finishedCount = computed(() => runs.value.filter((r) => r.status === 'success' || r.status === 'error').length)

async function removeRun(id) { await db.remove('workflow_runs', id); refresh() }
async function clearFinished() {
  for (const r of runs.value.filter((x) => x.status === 'success' || x.status === 'error')) await db.remove('workflow_runs', r.id)
  refresh()
}
</script>
