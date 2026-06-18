<template>
  <!-- ALD 14/06/2026 - Node "SS": ẢNH + prompt → VIDEO (LTX-2.3 + LoRA custom user tự train, upload qua Settings → Model AI).
       Ảnh đầu vào lấy từ node Input nối vào. Chọn LoRA của bạn ở dropdown (nạp từ /models?type=loras). -->
  <div class="space-y-4">
    <div class="apl-info-card">
      <p class="font-semibold flex items-center gap-1.5"><i class="bi bi-film" /> SS · Ảnh→Video / Text→Video</p>
      <p class="text-[11px] opacity-70 mt-1">
        LTX-2.3 + <b>LoRA bạn tự train</b>. <b>Có</b> node Input (ảnh) nối vào → <b>Ảnh→Video</b>;
        <b>không</b> nối ảnh → <b>Text→Video</b> (chỉ prompt). Sweet-spot ~5s; chọn dài hơn (15/30s) thì
        hệ thống <b>chia đoạn + ghép nối tiếp</b> (lâu hơn).
      </p>
    </div>

    <!-- ALD 15/06/2026 - Số ảnh đầu vào ĐỘNG (model động): 1/2/3 → node hiện đúng số cổng. Nối mỗi cổng 1 node Input (ảnh). -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Số ảnh đầu vào (cổng)</p>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="n in [1, 2, 3]" :key="n" type="button"
          :class="['apl-fm-tile', Number(local.inputCount) === n && 'is-active']" @click="local.inputCount = n">
          <i class="bi bi-images text-base" /><span class="apl-fm-tile-label">{{ n }} ảnh</span>
        </button>
      </div>
      <p class="apl-fm-hint">Tuỳ model bạn train cần mấy ảnh. Node sẽ hiện đúng số cổng — nối mỗi cổng 1 node Input (ảnh). Giảm số → cổng thừa + dây nối tự gỡ.</p>
    </div>

    <!-- LoRA (model custom) -->
    <div class="apl-fm-group relative">
      <p class="apl-fm-heading">LoRA (model bạn upload)</p>
      <button type="button" class="apl-fm-input w-full flex items-center justify-between gap-2 text-xs" @click="openLora = !openLora">
        <span class="flex items-center gap-2 min-w-0">
          <i class="bi bi-stars text-violet-500 flex-shrink-0" />
          <span class="truncate">{{ currentLoraLabel }}</span>
        </span>
        <i :class="['bi bi-chevron-down text-gray-400 transition-transform flex-shrink-0', openLora && 'rotate-180']" />
      </button>
      <template v-if="openLora">
        <div class="fixed inset-0 z-10" @click="openLora = false" />
        <div class="absolute left-3 right-3 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden py-1 max-h-60 overflow-y-auto">
          <button type="button"
            :class="['w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 transition', !local.loraName && 'bg-violet-50 text-violet-700 font-semibold']"
            @click="local.loraName = ''; openLora = false"
          ><i class="bi bi-slash-circle" />(Không dùng LoRA — chỉ base LTX-2.3)</button>
          <button
            v-for="l in loras" :key="l.filename" type="button"
            :class="['w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 transition', local.loraName === l.filename && 'bg-violet-50 text-violet-700 font-semibold']"
            @click="local.loraName = l.filename; openLora = false"
          ><i class="bi bi-stars" /><span class="truncate">{{ l.filename }}</span></button>
          <div v-if="!loras.length" class="px-3 py-2 text-[11px] text-gray-400 italic">
            Chưa có LoRA nào. Vào <b>Settings → Model AI</b> để upload (loại "LoRA").
          </div>
        </div>
      </template>
      <p class="apl-fm-hint">LoRA hiển thị ở đây là các file loại "LoRA" bạn đã upload trong Settings → Model AI.</p>
    </div>

    <!-- Độ mạnh LoRA -->
    <div v-if="local.loraName" class="apl-fm-group">
      <p class="apl-fm-heading">Độ mạnh LoRA</p>
      <div class="grid grid-cols-4 gap-1.5">
        <button v-for="s in STRENGTHS" :key="s" type="button"
          :class="['apl-fm-tile', Number(local.loraStrength) === s && 'is-active']" @click="local.loraStrength = s">
          <span class="apl-fm-tile-label">{{ s.toFixed(2) }}</span>
        </button>
      </div>
      <p class="apl-fm-hint">1.00 = áp dụng đầy đủ. Hạ xuống nếu LoRA làm cảnh bị biến dạng/quá tay.</p>
    </div>

    <!-- Prompt -->
    <div class="apl-fm-group">
      <div class="flex items-center justify-between mb-2">
        <p class="apl-fm-heading !mb-0">Mô tả (prompt) · tiếng Anh</p>
        <!-- ALD 14/06/2026 - Toggle Text/JSON giống Create Image. JSON = cấu trúc scene/motion/camera → BE tự ghép. -->
        <div class="inline-flex rounded-lg bg-gray-100 p-0.5 text-[11px] font-semibold select-none">
          <button type="button" :class="['px-2.5 py-1 rounded-md transition', local.promptMode !== 'json' ? 'bg-white shadow text-gray-800' : 'text-gray-500']" @click="local.promptMode = 'text'">Text</button>
          <button type="button" :class="['px-2.5 py-1 rounded-md transition', local.promptMode === 'json' ? 'bg-white shadow text-violet-700' : 'text-gray-500']" @click="local.promptMode = 'json'">JSON</button>
        </div>
      </div>
      <!-- TEXT mode -->
      <template v-if="local.promptMode !== 'json'">
        <textarea v-model="local.prompt" rows="4" spellcheck="false" class="apl-fm-input" style="height:auto;padding:8px 10px;line-height:1.5;resize:vertical"
          placeholder="e.g. slow gentle camera push-in on a ceramic vase, soft warm studio light, shallow depth of field, cinematic, photorealistic" />
        <p class="apl-fm-hint">Mô tả cảnh + chuyển động máy/ánh sáng (tiếng Anh). Càng cụ thể → bám đúng ý.</p>
      </template>
      <!-- JSON mode -->
      <template v-else>
        <textarea v-model="local.promptJson" rows="11" spellcheck="false" class="apl-fm-input"
          style="height:auto;min-height:200px;padding:8px 10px;line-height:1.5;resize:vertical;font-family:ui-monospace,monospace;font-size:11px"
          :placeholder="SS_JSON_PLACEHOLDER" />
        <div v-if="jsonError" class="mt-1.5 px-2.5 py-2 rounded-lg bg-rose-50 border border-rose-300 text-[11px] text-rose-700 flex items-start gap-1.5">
          <i class="bi bi-exclamation-triangle-fill mt-0.5 shrink-0" /><span><b>JSON lỗi cú pháp — sửa giúp.</b> {{ jsonError }}</span>
        </div>
        <p v-else class="apl-fm-hint"><i class="bi bi-check-circle-fill me-1 text-emerald-500" />JSON hợp lệ. BE ghép <b>subject/scene/camera/motion/lighting</b> → prompt + lấy <b>negative_prompt</b> + <b>aspect_ratio</b>.</p>
      </template>
    </div>

    <!-- Negative (ẩn ở JSON mode — đã nằm trong JSON) -->
    <div v-if="local.promptMode !== 'json'" class="apl-fm-group">
      <p class="apl-fm-heading">Tránh xuất hiện <span class="opacity-50 normal-case font-medium">(tuỳ chọn)</span></p>
      <input v-model="local.negativePrompt" type="text" class="apl-fm-input" placeholder="e.g. static, blurry, watermark, text" />
    </div>

    <!-- Thời lượng -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Thời lượng</p>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="d in DURATIONS" :key="d.v" type="button"
          :class="['apl-fm-tile', Number(local.duration) === d.v && 'is-active']" @click="local.duration = d.v">
          <i class="bi bi-clock text-base" /><span class="apl-fm-tile-label">{{ d.label }}</span>
        </button>
      </div>
      <p class="apl-fm-hint">~5s là tối ưu (1 đoạn). Dài hơn → chia đoạn ~5s rồi ghép.</p>
      <!-- ALD 14/06/2026 - chỉ video dài (>8s = nhiều đoạn): cách nối để chống trôi cảnh -->
      <div v-if="Number(local.duration) > 8" class="mt-2.5 pt-2.5 border-t border-gray-200/60">
        <p class="apl-fm-heading">Nối đoạn (chống trôi)</p>
        <div class="grid grid-cols-2 gap-1.5">
          <button type="button" :class="['apl-fm-tile', local.linkMode !== 'anchor' && 'is-active']" style="height:auto;padding:8px 6px;flex-direction:column;gap:2px" @click="local.linkMode = 'chain'">
            <span class="apl-fm-tile-label">Nối tiếp</span><span class="text-[9px] opacity-60 normal-case font-normal leading-tight">mượt · có thể trôi dần</span>
          </button>
          <button type="button" :class="['apl-fm-tile', local.linkMode === 'anchor' && 'is-active']" style="height:auto;padding:8px 6px;flex-direction:column;gap:2px" @click="local.linkMode = 'anchor'">
            <span class="apl-fm-tile-label">Bám ảnh gốc</span><span class="text-[9px] opacity-60 normal-case font-normal leading-tight">mỗi đoạn từ ảnh input</span>
          </button>
        </div>
        <p class="apl-fm-hint">Trôi cảnh ở video dài? Chọn <b>Bám ảnh gốc</b> — mỗi đoạn render lại từ ảnh input (giữ chủ thể, không trôi).</p>
      </div>
    </div>

    <!-- Tỉ lệ khung -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Tỉ lệ khung</p>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="r in ASPECTS" :key="r.id" type="button"
          :class="['apl-fm-tile', local.aspectRatio === r.id && 'is-active']" @click="local.aspectRatio = r.id">
          <span class="apl-ar-icon" :style="{ width: r.w + 'px', height: r.h + 'px' }" />
          <span class="apl-fm-tile-label">{{ r.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  config: { type: Object, required: true },
  nodeType: { type: String, default: 'ss' }
})
const emit = defineEmits(['update:config'])
const auth = useAuth()

const DURATIONS = [
  { v: 3, label: '3 giây' },
  { v: 5, label: '5 giây' },
  { v: 8, label: '8 giây' },
  { v: 15, label: '15 giây' },
]
const ASPECTS = [
  { id: '16:9', label: '16:9', w: 24, h: 14 },
  { id: '9:16', label: '9:16', w: 13, h: 22 },
  { id: '1:1',  label: '1:1',  w: 20, h: 20 },
]
const STRENGTHS = [0.5, 0.75, 1.0, 1.25]
// ALD 14/06/2026 - mẫu JSON prompt video (BE _build_prompt_from_json ghép subject/scene/camera/motion/lighting + lấy negative + aspect).
const SS_JSON_PLACEHOLDER = `{
  "meta": { "aspect_ratio": "9:16" },
  "subject": "a ceramic vase on a wooden table",
  "scene": "cozy warm room, soft morning light",
  "camera": "slow push-in, shallow depth of field",
  "motion": "gentle subtle movement, smooth",
  "lighting": "soft warm studio light",
  "negative_prompt": "static, blurry, deformed, watermark, text"
}`

const local = ref({
  prompt: '',
  negativePrompt: '',
  promptMode: 'text',  // 'text' | 'json' (giống Create Image) — JSON = cấu trúc, BE ghép thành prompt + negative + tỉ lệ
  promptJson: '',
  duration: 5,
  aspectRatio: '9:16',
  linkMode: 'anchor',  // ALD 14/06/2026 - 'anchor' bám ảnh gốc mỗi cảnh (I2V giữ ảnh mẫu, không trôi) | 'chain' nối frame cuối (mượt)
  loraName: '',        // tên file LoRA (khớp model_files.filename) — worker nạp qua LoraLoaderModelOnly
  loraStrength: 1.0,
  inputCount: 1,       // ALD 15/06/2026 - số cổng ảnh đầu vào động (1–3) cho model động
  ...props.config,
})
const openLora = ref(false)
const loras = ref([])
const currentLoraLabel = computed(() => local.value.loraName || '(Không dùng LoRA — chỉ base LTX-2.3)')
// ALD 14/06/2026 - validate JSON tại chỗ khi promptMode='json' (không chặn lưu; BE cũng tự fallback).
const jsonError = computed(() => {
  if (local.value.promptMode !== 'json') return ''
  const raw = String(local.value.promptJson || '').trim()
  if (!raw) return ''
  try { JSON.parse(raw); return '' } catch (e) { return String(e.message || e) }
})

async function loadLoras() {
  // ALD 18/06/2026 - motions-studio: không có catalog LoRA self-host → danh sách rỗng.
  loras.value = []
}

watch(local, (v) => emit('update:config', { ...v }), { deep: true })
watch(() => props.config, (v) => {
  if (v && JSON.stringify(v) !== JSON.stringify(local.value)) local.value = { ...local.value, ...v }
})
onMounted(loadLoras)
</script>

<style scoped>
.apl-info-card { background: rgba(88,86,214,0.07); border: 0.5px solid rgba(88,86,214,0.25); border-radius: 12px; padding: 11px 12px; }
.apl-fm-group { background: rgba(255,255,255,0.6); border: 0.5px solid rgba(60,60,67,0.12); border-radius: 14px; padding: 12px; }
.apl-fm-heading { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(60,60,67,0.6); margin-bottom: 8px; }
.apl-fm-hint { margin-top: 6px; font-size: 10.5px; color: rgba(60,60,67,0.55); line-height: 1.4; }
.apl-fm-input { width: 100%; height: 34px; padding: 0 10px; background: white; border: 0.5px solid rgba(60,60,67,0.18); border-radius: 9px; font-size: 12px; transition: border-color 0.18s; }
.apl-fm-input:focus { outline: none; border-color: #5856D6; }
.apl-fm-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 52px; border-radius: 12px; border: 0.5px solid rgba(60,60,67,0.18); background: white; color: rgba(60,60,67,0.8); transition: all 0.15s; }
.apl-fm-tile:hover { border-color: rgba(88,86,214,0.4); }
.apl-fm-tile.is-active { border-color: #5856D6; background: rgba(88,86,214,0.08); color: #3E3CA8; box-shadow: 0 0 0 1px #5856D6 inset; }
.apl-fm-tile-label { font-size: 11px; font-weight: 700; }
.apl-ar-icon { display: block; border: 1.5px solid currentColor; border-radius: 3px; opacity: 0.7; }
</style>
