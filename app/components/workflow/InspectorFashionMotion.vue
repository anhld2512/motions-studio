<template>
  <!-- #region ALD 24/05/2026 - Fashion Motion inspector v2 — UiDropdown thay <select>,
       layout phân nhóm rõ + spacing đều. -->
  <div class="space-y-4">
    <!-- Preset -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Chất lượng</p>
      <UiDropdown v-model="local.preset" :options="presetOptions" placeholder="Chọn preset…" icon="bi-stars" full-width no-clear />
      <p v-if="currentPreset" class="apl-fm-hint">
        {{ currentPreset.resolution }} · {{ currentPreset.frames }} frames · {{ currentPreset.steps }} steps · ETA {{ currentPreset.eta }}
      </p>
    </div>

    <!-- Aspect ratio + Quality -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Tỉ lệ màn hình & chất lượng</p>
      <div class="grid grid-cols-3 gap-1.5 mb-2">
        <button
          v-for="r in ASPECT_RATIOS"
          :key="r.id"
          type="button"
          :class="[
            'press flex flex-col items-center justify-center gap-1 h-14 rounded-2xl border text-[10px] font-bold transition-colors',
            local.aspectRatio === r.id
              ? 'bg-primary text-white border-primary shadow-pill'
              : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
          ]"
          :title="r.label"
          @click="local.aspectRatio = r.id"
        >
          <span class="rounded-sm" :style="ratioPreviewStyle(r)" />
          <span>{{ r.label }}</span>
        </button>
      </div>
      <label class="apl-fm-label">Độ phân giải</label>
      <UiDropdown v-model="local.quality" :options="qualityOptions" full-width no-clear />
      <p class="apl-fm-hint">
        Output: <code>{{ outputResolution.w }}×{{ outputResolution.h }}</code> ({{ currentAspect?.label }} · {{ currentQuality?.label }})
      </p>
    </div>

    <!-- ALD 27/05/2026 - Loại sản phẩm chuyển vào Advanced bên dưới. Vision LLM
         (autoAnalyze=true default) tự detect → không cần user pick mặc định. -->


    <!-- ALD 24/05/2026 - 4 cổng trái = 3 bắt buộc + 1 tùy chọn (Audio).
         User wire input vào đúng cổng tương ứng. -->
    <div class="apl-fm-group apl-fm-info">
      <i class="bi bi-info-circle me-1.5 text-primary" />
      <span>
        Cổng bắt buộc: <b>Người mẫu</b> · <b>Sản phẩm</b> · <b>Motion</b>.
        Cổng <b>Audio</b> tuỳ chọn — wire Input Audio vào nếu muốn thay nhạc.
      </span>
    </div>

    <!-- #region ALD 10/06/2026 - Số ảnh sản phẩm (góc độ): 2 → node thêm cổng "Ảnh SP 2" (mặt sau/bên hông) → AI render đúng SP từ mọi góc khi người mẫu xoay người. -->
    <div>
      <span class="apl-fm-label">Số góc độ sản phẩm</span>
      <div class="grid grid-cols-2 gap-1.5 mt-1.5">
        <button
          v-for="n in [1, 2]"
          :key="n"
          type="button"
          :class="[
            'press inline-flex items-center justify-center gap-1.5 h-9 px-2 rounded-2xl text-[11px] font-bold border transition-colors',
            (Number(local.productCount) || 1) === n
              ? 'bg-primary text-white border-primary shadow-pill'
              : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40 hover:text-primary'
          ]"
          @click="local.productCount = n"
        >
          <i :class="['bi', n === 1 ? 'bi-image' : 'bi-images']" /> {{ n === 1 ? '1 ảnh' : '2 ảnh (đa góc)' }}
        </button>
      </div>
      <p class="apl-fm-hint mt-1">
        Chọn <b>2 ảnh</b> → node có thêm cổng <b>Ảnh SP 2</b>: nối ảnh <b>mặt sau / bên hông</b> của CÙNG sản phẩm
        để AI render đúng sản phẩm khi người mẫu quay lưng / xoay người theo motion.
      </p>
    </div>
    <!-- #endregion -->

    <!-- Advanced -->
    <details class="apl-fm-group">
      <summary class="apl-fm-summary">Advanced · Stage 1 Tryon (Leffa)</summary>
      <!-- ALD 27/05/2026 - Loại sản phẩm override. Default để vision LLM detect; chỉ chọn khi cần override. -->
      <div class="mt-3">
        <span class="apl-fm-label">Loại sản phẩm (override)</span>
        <div class="grid grid-cols-2 gap-1.5 mt-1.5">
          <button
            v-for="g in GARMENT_TYPES"
            :key="g.id"
            type="button"
            :class="[
              'press inline-flex items-center justify-center gap-1.5 h-9 px-2 rounded-2xl text-[11px] font-bold border transition-colors',
              local.garmentType === g.id
                ? 'bg-primary text-white border-primary shadow-pill'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40 hover:text-primary'
            ]"
            @click="local.garmentType = g.id"
          >
            <i :class="['bi', g.icon]" /> {{ g.label }}
          </button>
        </div>
        <p class="apl-fm-hint mt-1">Mặc định để Vision LLM detect (autoAnalyze). Chỉ override khi vision sai.</p>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <!-- ALD 28/05/2026 - Bỏ steps/cfg input. Stage 1 chỉ còn Qwen-Image-Edit-2509
             với preset hardcoded (steps=25, cfg=4). CatVTON + IDM-VTON + Leffa đã remove. -->
        <label class="block col-span-2">
          <span class="apl-fm-label">Relight strength (Stage 2 Wan)</span>
          <input v-model.number="local.loraRelight" type="number" step="0.1" min="0" max="1.5" class="apl-fm-input mt-1" />
        </label>
        <label class="inline-flex items-center gap-2 col-span-2 mt-1">
          <input v-model="local.saveIntermediate" type="checkbox" class="rounded text-primary" />
          <span class="text-xs text-gray-700 font-semibold">Giữ ảnh thử đồ trung gian (output.tryon)</span>
        </label>
        <label class="inline-flex items-start gap-2 col-span-2 mt-1 p-2 rounded-lg bg-violet-50 border border-violet-200">
          <input v-model="local.autoAnalyze" type="checkbox" class="rounded text-violet-600 mt-0.5" />
          <span class="text-xs">
            <b class="text-violet-900"><i class="bi bi-magic" /> Vision pre-analyze (qwen3.6:35b)</b><br>
            <span class="text-violet-700">Phân tích model + product image để auto-set garment_type, mask_grow, detail_dilate. +5-8s latency, +identity preservation.</span>
          </span>
        </label>
        <label class="inline-flex items-start gap-2 col-span-2 mt-1 p-2 rounded-lg bg-amber-50 border border-amber-200">
          <input v-model="local.stopAfterTryon" type="checkbox" class="rounded text-amber-600 mt-0.5" />
          <span class="text-xs">
            <b class="text-amber-900">Chỉ render try-on (skip animate)</b><br>
            <span class="text-amber-700">Dừng sau Stage 1 → output là ảnh try-on. Dùng để validate mask + chi tiết đồ cũ trước khi tốn 10-20 phút Stage 2.</span>
          </span>
        </label>
      </div>
    </details>
  </div>
  <!-- #endregion -->
</template>

<script setup>
// ALD 24/05/2026 - Parent (workflows/[id]/index.vue) passes :config and listens
// @update:config — phải dùng tên props này, không phải modelValue, để inspector sync
// về node.data.config. Trước fix: chọn "Váy" trong inspector không lưu xuống config.
const props = defineProps({
  config: { type: Object, required: true },
  nodeType: { type: String, default: 'fashion-motion' }
})
const emit = defineEmits(['update:config'])

const { PRESETS, GARMENT_TYPES } = useFashionMotionJobs()

const local = ref({
  preset: '15s-720p',
  garmentType: 'upper',
  aspectRatio: '9:16',
  quality: '720p',
  loraRelight: 0.7,
  saveIntermediate: false,
  stopAfterTryon: false,
  autoAnalyze: true,
  productCount: 1,   // ALD 10/06/2026 - 2 = thêm cổng Ảnh SP 2 (góc mặt sau/bên hông)
  ...props.config,
  // ALD 28/05/2026 - VITON locked sang Qwen-Image-Edit-2509. CatVTON + IDM-VTON +
  // Leffa đã remove. Mọi giá trị legacy coerce → 'qwen'.
  vitonModel: 'qwen'
})

// ALD 24/05/2026 - Aspect ratio + Quality — output resolution = aspect × quality
const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', w: 9, h: 16, hint: 'Reels/TikTok/Story' },
  { id: '16:9', label: '16:9', w: 16, h: 9, hint: 'YouTube/Facebook' },
  { id: '1:1',  label: '1:1',  w: 1,  h: 1, hint: 'Instagram square' },
  { id: '3:4',  label: '3:4',  w: 3,  h: 4, hint: 'Portrait classic' },
  { id: '4:3',  label: '4:3',  w: 4,  h: 3, hint: 'Old TV' },
  { id: '21:9', label: '21:9', w: 21, h: 9, hint: 'Cinematic ultrawide' }
]
const QUALITY_TIERS = [
  { id: '480p',  label: '480p',  short: 480,  hint: 'Smoke test, render nhanh' },
  { id: '720p',  label: '720p',  short: 720,  hint: 'Recommended' },
  { id: '1080p', label: '1080p', short: 1080, hint: 'HD, render lâu hơn' }
]
function ratioPreviewStyle(r) {
  // 24px max thumbnail of the ratio rectangle (tinted)
  const max = 22
  const w = r.w >= r.h ? max : Math.round((r.w / r.h) * max)
  const h = r.h >= r.w ? max : Math.round((r.h / r.w) * max)
  return { width: `${w}px`, height: `${h}px`, background: 'currentColor', opacity: 0.4 }
}
const qualityOptions = computed(() => QUALITY_TIERS.map((q) => ({ value: q.id, label: `${q.label} · ${q.hint}` })))
const currentAspect = computed(() => ASPECT_RATIOS.find((r) => r.id === local.value.aspectRatio))
const currentQuality = computed(() => QUALITY_TIERS.find((q) => q.id === local.value.quality))
// Resolution = short side × (long side derived from aspect). Round to multiple of 16 for Wan.
const outputResolution = computed(() => {
  const r = currentAspect.value
  const q = currentQuality.value
  if (!r || !q) return { w: 720, h: 1280 }
  const short = q.short
  const long = Math.round((short * Math.max(r.w, r.h)) / Math.min(r.w, r.h) / 16) * 16
  // Orientation: portrait nếu h>w trong ratio
  return r.h > r.w
    ? { w: short, h: long }
    : r.w > r.h
      ? { w: long, h: short }
      : { w: short, h: short }
})

watch(local, (v) => emit('update:config', { ...v }), { deep: true })
watch(() => props.config, (v) => {
  if (v && JSON.stringify(v) !== JSON.stringify(local.value)) {
    local.value = { ...local.value, ...v }
  }
})

const currentPreset = computed(() => PRESETS.find((p) => p.id === local.value.preset))
const presetOptions = computed(() => PRESETS.map((p) => ({ value: p.id, label: `${p.label} · ETA ${p.eta}` })))
</script>

<style scoped>
.apl-fm-group {
  background: rgba(255,255,255,0.6);
  border: 0.5px solid rgba(60,60,67,0.12);
  border-radius: 14px;
  padding: 12px;
}
.apl-fm-heading {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(60,60,67,0.6);
  margin-bottom: 8px;
}
.apl-fm-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: rgba(60,60,67,0.8);
  margin-bottom: 4px;
}
.apl-fm-hint {
  margin-top: 6px;
  font-size: 10.5px;
  color: rgba(60,60,67,0.55);
  line-height: 1.4;
}
.apl-fm-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  background: white;
  border: 0.5px solid rgba(60,60,67,0.18);
  border-radius: 9px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  transition: border-color 0.18s;
}
.apl-fm-input:focus {
  outline: none;
  border-color: var(--color-primary, #0031A7);
}
.apl-fm-summary {
  cursor: pointer;
  user-select: none;
  font-size: 11.5px;
  font-weight: 700;
  color: rgba(60,60,67,0.85);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.apl-fm-summary:hover { color: var(--color-primary, #0031A7); }
.apl-fm-info {
  font-size: 11.5px;
  color: rgba(60,60,67,0.7);
  display: flex;
  align-items: flex-start;
  line-height: 1.5;
}
.apl-fm-info b { color: var(--color-primary, #0031A7); }
</style>
