<template>
  <!-- ALD 03/06/2026 - Node "Ghép cảnh": nối ≥2 clip video (từ talk/motion/teaser) thành 1 video,
       GIỮ tiếng từng cảnh. Số cổng = clipCount; nối clip1, clip2… vào các node phía trước. -->
  <div class="space-y-4">
    <div class="apl-info-card">
      <p class="font-semibold flex items-center gap-1.5"><i class="bi bi-collection-play-fill" /> Ghép cảnh</p>
      <p class="text-[11px] opacity-70 mt-1">
        Nối <b>nhiều phân cảnh</b> (clip video) thành 1 video, <b>giữ tiếng từng cảnh</b> (mỗi cảnh giọng riêng).
        Mỗi cổng <code>Cảnh N</code> nối tới 1 node tạo video (Nói/Motion/Teaser). Clip được chuẩn hoá cùng khung hình rồi nối tuần tự.
      </p>
    </div>

    <!-- Số cảnh (số cổng vào) -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Số phân cảnh ghép</p>
      <div class="grid grid-cols-5 gap-1.5">
        <button v-for="n in [2,3,4,5,6]" :key="n" type="button"
          :class="['apl-fm-tile', Number(local.clipCount) === n && 'is-active']" @click="local.clipCount = n">
          <span class="apl-fm-tile-label">{{ n }}</span>
        </button>
      </div>
      <p class="apl-fm-hint">Số cổng vào (Cảnh 1…N). Nối mỗi cổng tới 1 clip; clip ghép theo thứ tự cổng.</p>
    </div>

    <!-- FPS -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Khung hình / giây (fps)</p>
      <input v-model.number="local.fps" type="number" min="12" max="30" class="apl-fm-input" placeholder="25" />
      <p class="apl-fm-hint">Chuẩn hoá mọi clip về fps này khi ghép. Mặc định 25.</p>
    </div>

    <!-- ALD 17/06/2026 - Nhạc nền (upload tuỳ chọn) → mux vào video ghép. Hợp khi KHÔNG dùng voice. -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Nhạc nền <span class="opacity-50 normal-case font-medium">(tuỳ chọn)</span></p>
      <input ref="musicInput" type="file" accept="audio/*" class="hidden" @change="onMusicSelected" />
      <button v-if="!local.musicKey" type="button" class="apl-upload-btn" :disabled="musicUploading" @click="musicInput?.click()">
        <i :class="['bi', musicUploading ? 'bi-arrow-repeat animate-spin' : 'bi-music-note-beamed']" />
        <span>{{ musicUploading ? 'Đang upload…' : 'Chọn file nhạc (MP3/WAV)' }}</span>
      </button>
      <div v-else class="apl-music-card">
        <i class="bi bi-file-music-fill text-primary text-lg" />
        <div class="min-w-0 flex-1">
          <div class="text-xs font-semibold truncate">{{ local.musicName || 'audio' }}</div>
          <audio v-if="local.musicUrl" :src="local.musicUrl" controls class="w-full mt-1 h-8" />
        </div>
        <button type="button" class="apl-icon-btn-mini" title="Xoá nhạc" :disabled="musicUploading" @click="clearMusic"><i class="bi bi-trash" /></button>
      </div>
      <div v-if="local.musicKey" class="mt-2">
        <p class="apl-fm-heading" style="margin-bottom:4px">Âm lượng nhạc: {{ Number(local.musicVolume ?? 0.6).toFixed(2) }}</p>
        <input v-model.number="local.musicVolume" type="range" min="0" max="1" step="0.05" class="w-full" />
        <p class="apl-fm-hint">0.3–0.4 nếu CÓ giọng đọc (nhạc dưới) · 0.8–1.0 nếu KHÔNG giọng (nhạc làm nền chính).</p>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  config: { type: Object, required: true },
  nodeType: { type: String, default: 'concat' }
})
const emit = defineEmits(['update:config'])

const local = ref({ clipCount: 2, transition: 'cut', fps: 25, musicKey: '', musicBucket: '', musicName: '', musicUrl: '', musicVolume: 0.6, ...props.config })

// ALD 17/06/2026 - Nhạc nền: upload → config.musicKey/musicBucket → engine (mediaViaJob) nạp vào inputs.music → run_concat mux.
// ALD 18/06/2026 - motions-studio: nhạc nền → fileStore (Supabase nếu cấu hình, không thì data: URL).
const fileStore = useFileStore(); fileStore.load()
const toast = useToast()
const musicInput = ref(null)
const musicUploading = ref(false)
const MAX_MUSIC_BYTES = 50 * 1024 * 1024
async function onMusicSelected(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  if (file.size > MAX_MUSIC_BYTES) { toast.error('File nhạc > 50MB.'); ev.target.value = ''; return }
  musicUploading.value = true
  try {
    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file) })
    local.value.musicUrl = await fileStore.putFile(dataUrl, { contentType: file.type, prefix: 'wf-concat-music' })
    local.value.musicName = file.name
    local.value.musicKey = ''; local.value.musicBucket = ''
    toast.success(`Đã thêm nhạc: ${file.name}`, { duration: 2000 })
  } catch (err) {
    toast.error(`Nạp nhạc lỗi: ${err?.message || err}`)
  } finally {
    musicUploading.value = false
    ev.target.value = ''
  }
}
function clearMusic() {
  local.value.musicKey = ''; local.value.musicBucket = ''; local.value.musicName = ''; local.value.musicUrl = ''
}

watch(local, (v) => emit('update:config', { ...v }), { deep: true })
watch(() => props.config, (v) => {
  if (v && JSON.stringify(v) !== JSON.stringify(local.value)) local.value = { ...local.value, ...v }
})
</script>

<style scoped>
.apl-info-card { background: rgba(88,86,214,0.07); border: 0.5px solid rgba(88,86,214,0.25); border-radius: 12px; padding: 11px 12px; }
.apl-fm-group { background: rgba(255,255,255,0.6); border: 0.5px solid rgba(60,60,67,0.12); border-radius: 14px; padding: 12px; }
.apl-fm-heading { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(60,60,67,0.6); margin-bottom: 8px; }
.apl-fm-hint { margin-top: 6px; font-size: 10.5px; color: rgba(60,60,67,0.55); line-height: 1.4; }
.apl-fm-input { width: 100%; height: 32px; padding: 0 10px; background: white; border: 0.5px solid rgba(60,60,67,0.18); border-radius: 9px; font-size: 12px; transition: border-color 0.18s; }
.apl-fm-input:focus { outline: none; border-color: var(--color-primary, #0031A7); }
.apl-fm-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; height: 44px; border-radius: 12px; border: 0.5px solid rgba(60,60,67,0.18); background: white; color: rgba(60,60,67,0.8); transition: all 0.15s; }
.apl-fm-tile:hover { border-color: rgba(88,86,214,0.4); }
.apl-fm-tile.is-active { border-color: #5856D6; background: rgba(88,86,214,0.08); color: #3A38A6; box-shadow: 0 0 0 1px #5856D6 inset; }
.apl-fm-tile-label { font-size: 13px; font-weight: 700; }
.apl-upload-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 38px; border: 1px dashed rgba(60,60,67,0.3); border-radius: 11px; background: white; font-size: 12px; font-weight: 600; color: rgba(60,60,67,0.75); transition: border-color 0.18s, color 0.18s; }
.apl-upload-btn:hover:not(:disabled) { border-color: var(--color-primary, #0031A7); color: var(--color-primary, #0031A7); }
.apl-upload-btn:disabled { opacity: 0.6; cursor: wait; }
.apl-music-card { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: white; border: 0.5px solid rgba(60,60,67,0.18); border-radius: 11px; }
.apl-icon-btn-mini { flex: 0 0 auto; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: rgba(220,38,38,0.8); transition: background 0.15s; }
.apl-icon-btn-mini:hover:not(:disabled) { background: rgba(220,38,38,0.1); }
</style>
