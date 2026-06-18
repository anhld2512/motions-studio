<template>
  <!-- #region ALD 22/05/2026 - Workflows list (embedded trong Settings)
       Click 1 workflow → navigate /workflows/[id] (editor full-screen).
       Copy API URL ngay tại đây. -->
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-gray-500">{{ wf.items.value.length }} workflow</p>
      <button
        type="button"
        class="press inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-primary text-white text-xs font-bold shadow-pill hover:bg-primary-dark"
        @click="showCreate = true"
      >
        <i class="bi bi-plus-lg" />
        Tạo workflow
      </button>
    </div>

    <div v-if="wf.loading.value" class="text-center text-xs text-gray-400 py-8">
      <i class="bi bi-hourglass-split animate-pulse mr-1" /> Đang tải...
    </div>
    <div v-else-if="!wf.items.value.length" class="text-center py-12 glass shadow-card rounded-3xl">
      <i class="bi bi-diagram-3 text-5xl text-gray-300" />
      <p class="text-sm text-gray-500 mt-3">Chưa có workflow nào.</p>
      <p class="text-xs text-gray-400 mt-1">Tạo flow đầu tiên — vd <code>/price-matrix</code> = <code>/ocr</code> → <code>/chat</code>.</p>
    </div>
    <!-- ALD 24/05/2026 - Card v3 Apple polish: equal-height grid via min-h, large hero
         action row at footer, secondary actions on hover-revealed top-right menu. -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <article
        v-for="w in wf.items.value"
        :key="w.id"
        class="apl-wf-card"
        @click="navigateTo(`/workflows/${w.id}`)"
      >
        <!-- Hover-revealed action toolbar top-right -->
        <div class="apl-wf-tools" @click.stop>
          <button
            v-if="w.owned"
            type="button"
            class="apl-wf-tool"
            title="Sửa graph"
            @click="navigateTo(`/workflows/${w.id}`)"
          >
            <i class="bi bi-pencil" />
          </button>
          <button
            v-if="w.owned"
            type="button"
            class="apl-wf-tool"
            title="Lịch sử run"
            @click="navigateTo(`/workflows/${w.id}/runs`)"
          >
            <i class="bi bi-clock-history" />
          </button>
          <button
            v-if="w.owned"
            type="button"
            class="apl-wf-tool apl-wf-tool-danger"
            title="Xoá"
            @click="onDelete(w)"
          >
            <i class="bi bi-trash" />
          </button>
        </div>

        <!-- Header -->
        <div class="apl-wf-head">
          <div class="apl-wf-slug-row">
            <code class="apl-wf-slug">/{{ w.slug }}</code>
            <span v-if="!w.owned" class="apl-wf-badge apl-wf-badge-public">Public</span>
            <span v-if="!w.is_active" class="apl-wf-badge apl-wf-badge-disabled">Disabled</span>
          </div>
          <h3 class="apl-wf-title">{{ w.name }}</h3>
          <p class="apl-wf-desc">{{ w.description || '— Chưa có mô tả' }}</p>
        </div>

        <!-- Footer: hero action -->
        <button
          type="button"
          class="apl-wf-run"
          title="Mở editor + chạy workflow"
          @click.stop="navigateTo(`/workflows/${w.id}`)"
        >
          <i class="bi bi-play-fill" />
          <span>Chạy workflow</span>
          <i class="bi bi-arrow-right ms-auto" />
        </button>
      </article>
    </div>

    <!-- Create modal -->
    <Transition enter-active-class="transition duration-200" leave-active-class="transition duration-150" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="showCreate" class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" @click.self="showCreate = false">
        <div class="bg-white rounded-3xl shadow-island-lg max-w-md w-full p-5 space-y-3">
          <h2 class="text-lg font-bold text-gray-900">Tạo workflow mới</h2>
          <div>
            <label class="text-[11px] font-bold text-gray-600 uppercase">Slug (URL command)</label>
            <div class="mt-1 flex items-center gap-1.5">
              <span class="text-sm font-mono text-gray-400">/</span>
              <input v-model="newWf.slug" type="text" placeholder="price-matrix" class="flex-1 px-3 py-2 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-mono focus:outline-none focus:border-primary" @input="onSlugInput" />
            </div>
            <p class="text-[11px] text-gray-400 mt-1">a-z, 0-9, -. Dùng làm /command trong chat và API endpoint.</p>
          </div>
          <div>
            <label class="text-[11px] font-bold text-gray-600 uppercase">Tên hiển thị</label>
            <input v-model="newWf.name" type="text" placeholder="Trích xuất bảng giá hợp đồng" class="mt-1 w-full px-3 py-2 rounded-2xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label class="text-[11px] font-bold text-gray-600 uppercase">Mô tả (optional)</label>
            <textarea v-model="newWf.description" rows="2" class="mt-1 w-full px-3 py-2 rounded-2xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-primary" />
          </div>
          <p v-if="errorMsg" class="text-xs text-rose-600">{{ errorMsg }}</p>
          <div class="flex items-center justify-end gap-2 pt-1">
            <button type="button" class="press h-9 px-4 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-100" @click="showCreate = false">Huỷ</button>
            <button type="button" :disabled="creating || !newWf.slug || !newWf.name" class="press inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-50" @click="onCreate">
              <i :class="['bi', creating ? 'bi-hourglass-split animate-pulse' : 'bi-check2']" />
              Tạo
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const wf = useWorkflows()
const toast = useToast()
const confirmDialog = useConfirm()
const config = useRuntimeConfig()

const showCreate = ref(false)
const creating = ref(false)
const errorMsg = ref('')
const newWf = reactive({ slug: '', name: '', description: '' })

function onSlugInput() {
  newWf.slug = newWf.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

onMounted(() => wf.load())

async function onCreate() {
  errorMsg.value = ''
  creating.value = true
  try {
    const created = await wf.create({ slug: newWf.slug, name: newWf.name, description: newWf.description })
    showCreate.value = false
    newWf.slug = ''; newWf.name = ''; newWf.description = ''
    toast.success(`Đã tạo /${created.slug}`)
    navigateTo(`/workflows/${created.id}`)
  } catch (err) {
    errorMsg.value = err.data?.error || err.message
  } finally {
    creating.value = false
  }
}

async function onDelete(w) {
  const ok = await confirmDialog.ask({
    title: `Xoá workflow /${w.slug}?`,
    message: 'Lịch sử run + endpoint API sẽ bị xoá.',
    confirmText: 'Xoá',
    variant: 'danger'
  })
  if (!ok) return
  await wf.remove(w.id)
  toast.success('Đã xoá')
}

function onCopyApi(w) {
  const url = `${config.public.motionBackendUrl}/functions/v1/workflows/${w.slug}/invoke`
  navigator.clipboard.writeText(url).then(
    () => toast.success('Đã copy API URL'),
    () => toast.error('Copy failed')
  )
}
</script>

<style scoped>
/* ALD 24/05/2026 - Workflow card Apple polish v3 */
.apl-wf-card {
  position: relative;
  background: rgba(255,255,255,0.78);
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border: 0.5px solid rgba(60,60,67,0.10);
  border-radius: 22px;
  padding: 18px 18px 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 180px;
  box-shadow:
    0 0.5px 1px rgba(0,0,0,0.04),
    0 2px 6px rgba(0,0,0,0.04),
    0 12px 28px -8px rgba(0,0,0,0.08);
  transition: transform 0.18s cubic-bezier(0.32, 0.72, 0, 1),
              box-shadow 0.18s cubic-bezier(0.32, 0.72, 0, 1),
              border-color 0.18s cubic-bezier(0.32, 0.72, 0, 1);
}
.apl-wf-card:hover {
  transform: translateY(-3px);
  border-color: rgba(60,60,67,0.16);
  box-shadow:
    0 1px 3px rgba(0,0,0,0.06),
    0 14px 32px -6px rgba(0,49,167,0.14);
}
.apl-wf-card:active { transform: translateY(-1px); }

/* Tools toolbar top-right */
.apl-wf-tools {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.18s, transform 0.18s;
  background: rgba(255,255,255,0.85);
  padding: 2px;
  border-radius: 10px;
  border: 0.5px solid rgba(60,60,67,0.08);
  backdrop-filter: blur(10px);
}
.apl-wf-card:hover .apl-wf-tools { opacity: 1; transform: translateY(0); }
.apl-wf-tool {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  border-radius: 7px;
  color: rgba(60,60,67,0.6);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.14s;
}
.apl-wf-tool:hover {
  background: rgba(0,49,167,0.10);
  color: var(--color-primary, #0031A7);
}
.apl-wf-tool-danger:hover { background: rgba(255,59,48,0.12); color: #FF3B30; }

/* Header */
.apl-wf-head {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding-right: 100px; /* leave space for hover toolbar */
}
.apl-wf-slug-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.apl-wf-slug {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--color-primary-dark, #0040A0);
  letter-spacing: -0.01em;
}
.apl-wf-badge {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 999px;
}
.apl-wf-badge-public  { background: rgba(255,149,0,0.16); color: #8A4B00; }
.apl-wf-badge-disabled { background: rgba(118,118,128,0.18); color: rgba(60,60,67,0.65); }

.apl-wf-title {
  font-size: 16px;
  font-weight: 700;
  color: #1c1c1e;
  letter-spacing: -0.022em;
  line-height: 1.2;
  margin: 0;
}
.apl-wf-desc {
  font-size: 12.5px;
  font-weight: 500;
  color: rgba(60,60,67,0.55);
  line-height: 1.45;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Hero run button */
.apl-wf-run {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  border: none;
  border-radius: 14px;
  background: var(--color-primary, #0031A7);
  color: white;
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,49,167,0.18), 0 6px 16px rgba(0,49,167,0.22);
  transition: all 0.18s cubic-bezier(0.32, 0.72, 0, 1);
}
.apl-wf-run i.bi-play-fill { font-size: 16px; }
.apl-wf-run i.bi-arrow-right { font-size: 13px; opacity: 0.75; transition: transform 0.18s; }
.apl-wf-run:hover {
  background: var(--color-primary-dark, #0040A0);
  box-shadow: 0 1px 2px rgba(0,49,167,0.22), 0 8px 20px rgba(0,49,167,0.28);
}
.apl-wf-run:hover i.bi-arrow-right { transform: translateX(3px); opacity: 1; }
.apl-wf-run:active { transform: scale(0.985); }
</style>
