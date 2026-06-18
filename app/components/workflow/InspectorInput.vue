<template>
  <!-- #region ALD 18/06/2026 - Input (FE-only): Tải lên (fileStore/data URL) · URL · Session. Bỏ thư viện backend. -->
  <div class="space-y-4">
    <div>
      <label class="ins-label">Loại dữ liệu</label>
      <div class="flex flex-wrap gap-1.5 mt-1.5">
        <button v-for="t in TYPES" :key="t.id" type="button" :class="['ins-chip', local.contentType === t.id && 'is-active']" @click="local.contentType = t.id">
          <i :class="['bi me-1', t.icon]" />{{ t.label }}
        </button>
      </div>
    </div>

    <div>
      <label class="ins-label">Nguồn</label>
      <div class="flex flex-wrap gap-1.5 mt-1.5">
        <button v-for="s in sources" :key="s.id" type="button" :class="['ins-chip', local.source === s.id && 'is-active']" @click="local.source = s.id">{{ s.label }}</button>
      </div>
    </div>

    <!-- TEXT tĩnh -->
    <div v-if="local.contentType === 'text' && local.source === 'static'">
      <label class="ins-label">Nội dung văn bản</label>
      <textarea v-model="local.staticText" rows="4" class="ins-input mt-1.5 w-full resize-y" placeholder="Nhập văn bản…" />
    </div>

    <!-- MEDIA tĩnh: tải lên -->
    <div v-else-if="local.source === 'static'">
      <label class="ins-label">Tải lên {{ typeLabel }}</label>
      <input ref="fileInput" type="file" :accept="acceptAttr" class="hidden" @change="onFileSelected" />
      <button type="button" class="press w-full h-10 mt-1.5 rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-gray-600 hover:border-primary hover:text-primary transition-colors" :disabled="uploading" @click="$refs.fileInput.click()">
        <i :class="['bi me-1', uploading ? 'bi-arrow-clockwise animate-spin' : 'bi-upload']" />{{ uploading ? 'Đang nạp…' : (local.staticName || 'Chọn file') }}
      </button>
      <div v-if="previewUrl" class="mt-2">
        <img v-if="local.contentType === 'image'" :src="previewUrl" class="max-h-40 rounded-xl border border-white/70" alt="" />
        <video v-else-if="local.contentType === 'video'" :src="previewUrl" controls muted class="max-h-40 rounded-xl border border-white/70" />
        <audio v-else-if="local.contentType === 'audio'" :src="previewUrl" controls class="w-full mt-1" />
        <p v-else class="ins-hint">{{ local.staticName }}</p>
      </div>
    </div>

    <!-- URL -->
    <div v-else-if="local.source === 'url'">
      <label class="ins-label">URL</label>
      <input v-model="local.url" type="text" class="ins-input mt-1.5 w-full font-mono text-[13px]" :placeholder="local.contentType === 'image' ? 'https://…/anh.jpg' : 'https://…'" />
    </div>

    <!-- SESSION (cho workflow gọi qua API) -->
    <div v-else-if="local.source === 'session'">
      <label class="ins-label">Tên trường (field)</label>
      <input v-model="local.field" type="text" class="ins-input mt-1.5 w-full font-mono text-[13px]" :placeholder="local.contentType" />
      <p class="ins-hint">Lấy giá trị từ input truyền vào khi chạy workflow.</p>
    </div>

    <div>
      <label class="ins-label">Nhãn node (tuỳ chọn)</label>
      <input v-model="local.label" type="text" class="ins-input mt-1.5 w-full" placeholder="vd Ảnh người mẫu" />
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({
  config: { type: Object, default: () => ({}) },
  nodeType: { type: String, default: 'input' }
})
const emit = defineEmits(['update:config'])
const toast = useToast()
const fileStore = useFileStore(); fileStore.load()

const TYPES = [
  { id: 'text', label: 'Văn bản', icon: 'bi-chat-left-text' },
  { id: 'image', label: 'Ảnh', icon: 'bi-image' },
  { id: 'video', label: 'Video', icon: 'bi-film' },
  { id: 'audio', label: 'Âm thanh', icon: 'bi-music-note-beamed' },
  { id: 'file', label: 'File', icon: 'bi-file-earmark' }
]
const MAX = 150 * 1024 * 1024

const inferType = { 'input-image': 'image', 'input-video': 'video', 'input-audio': 'audio', 'input-file': 'file' }[props.nodeType] || 'text'
const local = ref({ contentType: inferType, source: 'static', staticText: '', staticUrl: '', staticName: '', staticMime: '', staticSize: 0, url: '', field: '', label: '', ...props.config })
const uploading = ref(false)

const sources = computed(() => [
  { id: 'static', label: local.value.contentType === 'text' ? 'Nhập' : 'Tải lên' },
  { id: 'url', label: 'URL' },
  { id: 'session', label: 'Session' }
])
const typeLabel = computed(() => TYPES.find((t) => t.id === local.value.contentType)?.label || 'file')
const acceptAttr = computed(() => ({ image: 'image/*', video: 'video/*', audio: 'audio/*' }[local.value.contentType] || '*/*'))
const previewUrl = computed(() => local.value.staticUrl || (local.value.staticData ? `data:${local.value.staticMime};base64,${local.value.staticData}` : ''))

async function onFileSelected(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  if (file.size > MAX) { toast.error(`File > 150MB.`); ev.target.value = ''; return }
  uploading.value = true
  try {
    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file) })
    local.value.staticUrl = await fileStore.putFile(dataUrl, { contentType: file.type, prefix: 'wf-input' })
    local.value.staticName = file.name; local.value.staticMime = file.type; local.value.staticSize = file.size; local.value.staticData = ''
    toast.success(fileStore.enabled() ? `Đã upload ${file.name}` : `Đã nạp ${file.name}`, { duration: 1800 })
  } catch (err) {
    toast.error('Không nạp được file: ' + (err?.message || err))
  } finally {
    uploading.value = false; ev.target.value = ''
  }
}

watch(local, (v) => emit('update:config', { ...v }), { deep: true })
watch(() => props.config, (v) => { if (v && JSON.stringify(v) !== JSON.stringify(local.value)) local.value = { ...local.value, ...v } })
</script>

<style scoped>
.ins-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; color: #6b7280; }
.ins-input { border: 1px solid rgba(60,60,67,0.16); border-radius: 12px; padding: 8px 12px; background: rgba(255,255,255,0.7); outline: none; font-size: 13px; transition: border-color .15s, box-shadow .15s; }
.ins-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
.ins-hint { font-size: 11px; color: #9ca3af; margin-top: 6px; line-height: 1.4; }
.ins-chip { padding: 5px 11px; border-radius: 999px; font-size: 12px; font-weight: 600; background: white; border: 1px solid rgba(60,60,67,0.16); color: #3c3c43; cursor: pointer; transition: all .15s; }
.ins-chip.is-active { background: #2563eb; color: white; border-color: #2563eb; }
</style>
