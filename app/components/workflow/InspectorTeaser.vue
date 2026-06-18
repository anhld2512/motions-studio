<template>
  <!-- ALD 31/05/2026 - Teaser inspector (Phase 2). Cổng động: Sản phẩm (productCount 1-6)
       + Người mẫu (modelCount 0-3, opt). Bỏ cổng Motion + Nhạc → Nhạc upload tại đây. -->
  <div class="space-y-4">
    <!-- Kịch bản / Storyboard (AI dàn cảnh) -->
    <div class="apl-fm-group">
      <div class="flex items-center justify-between mb-2">
        <p class="apl-fm-heading !mb-0">Kịch bản / Storyboard</p>
        <label class="apl-toggle" :class="local.aiDirector && 'is-on'">
          <input v-model="local.aiDirector" type="checkbox" class="sr-only" />
          <i class="bi bi-stars" /> AI dàn cảnh
        </label>
      </div>
      <textarea
        v-model="local.scriptText"
        rows="6"
        class="apl-fm-input"
        style="height:auto;padding:8px 10px;font-family:inherit;line-height:1.5;resize:vertical"
        :placeholder="local.aiDirector
          ? 'Dán cả storyboard/kịch bản (kể cả dạng bảng Giây · Hình ảnh · Lời thoại · Chữ màn hình). AI tự bóc VO sạch + caption + chia shot.'
          : 'Lời đọc (voiceover) nguyên văn — TTS đọc đúng từng chữ…'"
      />
      <p class="apl-fm-hint">
        <template v-if="local.aiDirector">
          <i class="bi bi-stars me-1 text-primary" />Dán thoải mái kịch bản lộn xộn — AI bóc <b>VO sạch</b> + <b>caption</b> + <b>cảnh quay</b> mỗi shot + tự chia shot.
        </template>
        <template v-else>
          Dùng <b>nguyên văn</b> làm voiceover (đọc đúng từng chữ, không xử lý). Tự tay viết VO sạch nếu chọn cách này.
        </template>
      </p>
      <!-- ALD 02/06/2026 - Chọn model Ollama cho AI dàn cảnh (list từ /ai-providers/ollama/models). -->
      <div v-if="local.aiDirector" class="mt-2">
        <span class="apl-fm-label">Model AI dàn cảnh <span class="opacity-50 normal-case font-medium">(Ollama)</span></span>
        <div class="flex items-center gap-1.5 mt-1">
          <UiDropdown
            v-model="local.scriptModel"
            :options="scriptModelOptions"
            :disabled="loadingModels"
            :placeholder="loadingModels ? 'Đang tải…' : (scriptModelOptions.length ? '— Mặc định (qwen3.6:35b) —' : 'Bấm ⟳ để tải model')"
            icon="bi-cpu"
            full-width
            force-search
            class="flex-1 min-w-0"
          />
          <button
            type="button"
            :disabled="loadingModels"
            class="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-primary/40 hover:text-primary disabled:opacity-50"
            title="Tải lại danh sách model"
            @click="loadScriptModels"
          >
            <i :class="['bi', loadingModels ? 'bi-arrow-repeat animate-spin' : 'bi-arrow-clockwise']" />
          </button>
        </div>
        <p class="apl-fm-hint">Trống = model mặc định <b>qwen3.6:35b</b>. Chọn model mạnh (suy luận) để dàn cảnh + caption tốt hơn.</p>
      </div>
    </div>

    <!-- Ảnh sản phẩm (product-hero, KHÔNG người mẫu — dùng node Lookbook nếu cần mẫu mặc đồ) -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Ảnh sản phẩm · <span class="normal-case font-medium text-primary">1 sản phẩm / teaser</span></p>
      <span class="apl-fm-label">Số ảnh (góc) <span class="text-rose-600">*</span></span>
      <div class="apl-stepper mt-1">
        <button type="button" class="apl-step-btn" :disabled="productCount <= 1" @click="local.productCount = Math.max(1, productCount - 1)"><i class="bi bi-dash-lg" /></button>
        <span class="apl-step-val">{{ productCount }}</span>
        <button type="button" class="apl-step-btn" :disabled="productCount >= 6" @click="local.productCount = Math.min(6, productCount + 1)"><i class="bi bi-plus-lg" /></button>
      </div>
      <p class="apl-fm-hint">
        <i class="bi bi-images me-1 text-primary" /><b>{{ productCount }} ảnh = {{ productCount }} góc/chi tiết của CÙNG 1 sản phẩm</b> (không phải nhiều SP khác nhau). AI dựng bối cảnh điện ảnh từ các ảnh này.
        <br><i class="bi bi-info-circle me-1" />Teaser <b>product-hero</b> — KHÔNG cần người mẫu. Cần mẫu mặc sản phẩm? Dùng node <b>Lookbook</b>.
      </p>
    </div>

    <!-- Kiểu chuyển động -->
    <div class="apl-fm-group">
      <div class="flex items-center justify-between mb-2">
        <p class="apl-fm-heading !mb-0">Kiểu chuyển động</p>
        <label class="apl-toggle" :class="local.sceneMode !== 'off' && 'is-on'">
          <input :checked="local.sceneMode !== 'off'" type="checkbox" class="sr-only" @change="local.sceneMode = $event.target.checked ? 'auto' : 'off'" />
          <i class="bi bi-easel" /> AI dựng bối cảnh
        </label>
      </div>
      <div class="grid grid-cols-1 gap-1.5">
        <button
          type="button"
          :class="['apl-motion-tile', 'is-active']"
        >
          <i class="bi bi-film" />
          <span class="flex-1 text-left">
            <b>AI chuyển động thật</b> <span class="opacity-60">(Wan I2V)</span>
            <small class="block opacity-70">Mỗi cảnh tự cử động (~1-2'/shot GPU). Cắt nhanh + transition TikTok ở khâu ghép.</small>
          </span>
        </button>
      </div>
      <p class="apl-fm-hint">
        <i class="bi bi-easel me-1 text-primary" /><b>AI dựng bối cảnh</b>: mỗi shot AI tạo cảnh điện ảnh từ ảnh sản phẩm theo storyboard (hợp teaser showcase). Tắt → giữ nguyên ảnh sản phẩm/try-on.
      </p>
    </div>

    <!-- Giọng đọc voiceover — Ngôn ngữ → Giọng (dropdown list) -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Giọng đọc voiceover</p>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <span class="apl-fm-label">Loại giọng</span>
          <UiDropdown v-model="selectedLang" :options="LANG_OPTIONS" icon="bi-mic" full-width no-clear :clearable="false" class="mt-1" />
        </div>
        <div>
          <span class="apl-fm-label">Giọng</span>
          <UiDropdown v-model="local.voice" :options="voiceOptions" icon="bi-soundwave" full-width no-clear :clearable="false" class="mt-1" />
        </div>
      </div>
      <p class="apl-fm-hint"><b>Clone từ file mẫu</b> = giọng giống file bạn cung cấp (viXTTS). Hoặc chọn <b>Gemini</b> (giọng tự nhiên có sẵn).</p>
    </div>

    <!-- Thời lượng -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Thời lượng teaser</p>
      <div class="grid grid-cols-3 gap-1.5">
        <button
          v-for="d in DURATIONS"
          :key="d.sec"
          type="button"
          :class="[
            'press flex flex-col items-center justify-center gap-0.5 h-12 rounded-2xl border text-[11px] font-bold transition-colors',
            local.targetDurationSec === d.sec
              ? 'bg-primary text-white border-primary shadow-pill'
              : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
          ]"
          @click="local.targetDurationSec = d.sec"
        >
          <span>{{ d.sec }}s</span>
          <span class="text-[9px] font-medium opacity-80">{{ d.hint }}</span>
        </button>
      </div>
      <p class="apl-fm-hint">Tổng độ dài ≈ {{ local.targetDurationSec }}s, chia đều cho số shot.</p>
    </div>

    <!-- Số shot -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Số shot (cảnh)</p>
      <UiDropdown v-model="local.numShots" :options="SHOT_OPTIONS" icon="bi-collection-play" full-width no-clear :clearable="false" />
      <p class="apl-fm-hint">Nhiều shot = cắt nhanh (hợp TikTok); ít = chậm/sang. <b>Auto</b> = AI tự chia (3–6).</p>
    </div>

    <!-- Nhạc nền (upload tuỳ chọn) -->
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
      <p class="apl-fm-hint">Nhạc nền trộn dưới voiceover. Bỏ trống → chỉ có giọng đọc.</p>
    </div>

  </div>
</template>

<script setup>
const props = defineProps({
  config: { type: Object, required: true },
  nodeType: { type: String, default: 'teaser' }
})
const emit = defineEmits(['update:config'])

const DURATIONS = [
  { sec: 15, hint: 'ngắn' },
  { sec: 30, hint: 'test' },
  { sec: 60, hint: 'production' }
]
// ALD 03/06/2026 - Số shot: 0 = Auto (AI tự chia 3-6); 3-8 = ép đúng số (numShots → handlers.js).
const SHOT_OPTIONS = [
  { value: 0, label: 'Auto (AI tự chia)' },
  { value: 3, label: '3 shot' }, { value: 4, label: '4 shot' }, { value: 5, label: '5 shot' },
  { value: 6, label: '6 shot' }, { value: 7, label: '7 shot' }, { value: 8, label: '8 shot' }
]
// ALD 18/06/2026 - motions-studio: giọng theo provider nhóm Speech. Clone giọng = ElevenLabs (dán voice_id).
const VOICE_GROUPS = [
  { label: 'OpenAI', voices: [
    { id: 'alloy', label: 'alloy' }, { id: 'nova', label: 'nova' }, { id: 'shimmer', label: 'shimmer' }, { id: 'echo', label: 'echo' }
  ] },
  { label: 'Gemini', voices: [
    { id: 'Kore',   label: 'Nữ — chắc (Kore)' },
    { id: 'Aoede',  label: 'Nữ — nhẹ (Aoede)' },
    { id: 'Charon', label: 'Nam — trầm (Charon)' },
    { id: 'Puck',   label: 'Nam — sôi nổi (Puck)' }
  ] }
]

const local = ref({
  scriptText: '',
  targetDurationSec: 30,
  productCount: 1,      // ALD 31/05/2026 - số ảnh (góc) của 1 sản phẩm (1-6)
  numShots: 0,          // ALD 03/06/2026 - 0 = Auto; 3-8 = ép số shot
  voice: 'alloy',       // ALD 18/06/2026 - giọng theo provider nhóm Speech
  motionMode: 'i2v',    // ALD 04/06/2026 - Ken Burns đã GỠ (vô dụng/cảnh tĩnh). Mặc định chuyển động AI thật (Wan I2V).
  sceneMode: 'auto',    // ALD 02/06/2026 - 'auto' AI dựng bối cảnh điện ảnh từng shot (product-hero) | 'off'
  aiDirector: true,     // ALD 31/05/2026 - AI bóc storyboard → shotlist + caption + VO sạch
  scriptModel: '',      // ALD 02/06/2026 - model Ollama cho AI dàn cảnh (trống = mặc định BE qwen3.6:35b)
  mode: 'single',
  musicKey: '', musicBucket: '', musicName: '', musicUrl: '',
  ...props.config
})

// Clamp hiển thị (không cho ngoài range dù config lỗi)
const productCount = computed(() => Math.max(1, Math.min(6, Number(local.value.productCount) || 1)))

const allVoiceGroups = computed(() => VOICE_GROUPS)

// ALD 02/06/2026 - Picker Ngôn ngữ → Giọng (UiDropdown, không dùng <select>). selectedLang là computed
// writable: đổi ngôn ngữ → đặt voice = giọng ĐẦU của ngôn ngữ đó. local.voice (id) là giá trị lưu thật.
const LANG_OPTIONS = computed(() => allVoiceGroups.value.map((g) => ({ value: g.label, label: g.label })))
const selectedLang = computed({
  get: () => allVoiceGroups.value.find((g) => g.voices.some((v) => v.id === local.value.voice))?.label || allVoiceGroups.value[0].label,
  set: (label) => { const g = allVoiceGroups.value.find((x) => x.label === label); if (g) local.value.voice = g.voices[0].id }
})
const voiceOptions = computed(() => {
  const g = allVoiceGroups.value.find((x) => x.label === selectedLang.value) || allVoiceGroups.value[0]
  return g.voices.map((v) => ({ value: v.id, label: v.label }))
})

// ALD 02/06/2026 - Model picker AI dàn cảnh (Ollama). List qua useAiProviders.listModels('ollama')
// (BE GET /ai-providers/ollama/models → /api/tags). local.scriptModel trống = mặc định BE.
const aiProviders = useAiProviders()
const scriptModels = ref([])
const loadingModels = ref(false)
const scriptModelOptions = computed(() => scriptModels.value.map((m) => ({ value: m, label: m })))
async function loadScriptModels() {
  loadingModels.value = true
  try {
    scriptModels.value = await aiProviders.listModels('ollama')
  } catch {
    scriptModels.value = []
  } finally {
    loadingModels.value = false
  }
}
onMounted(() => { if (local.value.aiDirector) loadScriptModels() })

// #region ALD 31/05/2026 - Upload nhạc nền → storage (bucket motion-audio) → musicKey/musicBucket.
// Engine teaser nạp musicKey từ storage vào inputs.music (run_teaser đọc inputs.music).
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
    local.value.musicUrl = await fileStore.putFile(dataUrl, { contentType: file.type, prefix: 'wf-teaser-music' })
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
// #endregion

watch(local, (v) => emit('update:config', { ...v }), { deep: true })
watch(() => props.config, (v) => {
  if (v && JSON.stringify(v) !== JSON.stringify(local.value)) {
    local.value = { ...local.value, ...v }
  }
})
</script>

<style scoped>
.apl-fm-group { background: rgba(255,255,255,0.6); border: 0.5px solid rgba(60,60,67,0.12); border-radius: 14px; padding: 12px; }
.apl-fm-heading { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(60,60,67,0.6); margin-bottom: 8px; }
.apl-fm-label { display: block; font-size: 11px; font-weight: 600; color: rgba(60,60,67,0.8); margin-bottom: 4px; }
.apl-fm-hint { margin-top: 6px; font-size: 10.5px; color: rgba(60,60,67,0.55); line-height: 1.4; }
.apl-fm-input { width: 100%; height: 32px; padding: 0 10px; background: white; border: 0.5px solid rgba(60,60,67,0.18); border-radius: 9px; font-size: 12px; transition: border-color 0.18s; }
.apl-fm-input:focus { outline: none; border-color: var(--color-primary, #0031A7); }
.apl-fm-summary { cursor: pointer; user-select: none; font-size: 11.5px; font-weight: 700; color: rgba(60,60,67,0.85); text-transform: uppercase; letter-spacing: 0.04em; }
.apl-fm-summary:hover { color: var(--color-primary, #0031A7); }
/* Toggle AI dàn cảnh */
.apl-toggle { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; border: 0.5px solid rgba(60,60,67,0.18); background: white; color: rgba(60,60,67,0.5); transition: all 0.15s; }
.apl-toggle.is-on { background: var(--color-primary, #0031A7); border-color: var(--color-primary, #0031A7); color: white; box-shadow: 0 1px 3px rgba(0,49,167,0.25); }
.apl-toggle i { font-size: 11px; }
/* Motion mode tiles */
.apl-motion-tile { display: flex; align-items: flex-start; gap: 9px; padding: 9px 11px; border-radius: 12px; border: 0.5px solid rgba(60,60,67,0.18); background: white; font-size: 12px; color: rgba(60,60,67,0.85); transition: all 0.15s; }
.apl-motion-tile i { font-size: 16px; margin-top: 1px; color: rgba(60,60,67,0.45); }
.apl-motion-tile small { font-size: 10px; line-height: 1.35; margin-top: 1px; }
.apl-motion-tile:hover { border-color: rgba(0,49,167,0.4); }
.apl-motion-tile.is-active { border-color: var(--color-primary, #0031A7); background: rgba(0,49,167,0.05); box-shadow: 0 0 0 1px var(--color-primary, #0031A7) inset; }
.apl-motion-tile.is-active i { color: var(--color-primary, #0031A7); }
/* Stepper số cổng */
.apl-stepper { display: inline-flex; align-items: stretch; width: 100%; border: 0.5px solid rgba(60,60,67,0.18); border-radius: 10px; background: white; overflow: hidden; }
.apl-step-btn { flex: 0 0 auto; width: 34px; display: flex; align-items: center; justify-content: center; color: rgba(60,60,67,0.7); transition: background 0.15s; }
.apl-step-btn:hover:not(:disabled) { background: rgba(60,60,67,0.06); color: var(--color-primary, #0031A7); }
.apl-step-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.apl-step-val { flex: 1; text-align: center; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 34px; border-left: 0.5px solid rgba(60,60,67,0.12); border-right: 0.5px solid rgba(60,60,67,0.12); }
/* Upload nhạc */
.apl-upload-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 38px; border: 1px dashed rgba(60,60,67,0.3); border-radius: 11px; background: white; font-size: 12px; font-weight: 600; color: rgba(60,60,67,0.75); transition: border-color 0.18s, color 0.18s; }
.apl-upload-btn:hover:not(:disabled) { border-color: var(--color-primary, #0031A7); color: var(--color-primary, #0031A7); }
.apl-upload-btn:disabled { opacity: 0.6; cursor: wait; }
.apl-music-card { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: white; border: 0.5px solid rgba(60,60,67,0.18); border-radius: 11px; }
.apl-icon-btn-mini { flex: 0 0 auto; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: rgba(220,38,38,0.8); transition: background 0.15s; }
.apl-icon-btn-mini:hover:not(:disabled) { background: rgba(220,38,38,0.1); }
</style>
