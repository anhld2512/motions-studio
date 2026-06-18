<template>
  <!-- #region ALD 24/05/2026 - Motion Transfer node inspector chuẩn hoá theo Fashion Motion.
       Multi-input qua handles: image (ref nhân vật) + video (motion) + audio (optional).
       Không còn refImageSource/motionVideoSource — cấu hình đó là của node Input upstream. -->
  <div class="space-y-3">
    <!-- ALD 11/06/2026 - provider HuggingFace ĐÃ GỠ theo yêu cầu user (HF chỉ có i2v, không có motion-transfer
         thật — Wan Animate không được provider nào trên HF phục vụ). Node luôn chạy Self-host Wan Animate. -->
    <!-- Preset -->
    <div>
      <label class="apl-fm-label">Preset</label>
      <UiDropdown
        v-model="local.preset"
        :options="PRESETS.map((p) => ({ value: p.id, label: p.label, hint: `${p.resolution} · ${p.frames}f · ${p.eta}` }))"
        full-width
        no-clear
      />
      <p v-if="currentPreset" class="apl-fm-hint">
        {{ currentPreset.resolution }} · {{ currentPreset.frames }} frames · {{ currentPreset.steps }} steps · {{ currentPreset.note }}
      </p>
    </div>

    <!-- Mode -->
    <div>
      <label class="apl-fm-label">Mode</label>
      <div class="grid grid-cols-2 gap-1.5 mt-1.5">
        <button
          v-for="m in MODES"
          :key="m.id"
          type="button"
          :class="['apl-fm-tile', local.mode === m.id && 'is-active']"
          @click="local.mode = m.id"
        >
          <i :class="['bi text-base', m.icon]" />
          <span class="apl-fm-tile-label">{{ m.label }}</span>
        </button>
      </div>
    </div>

    <!-- Aspect ratio -->
    <div>
      <label class="apl-fm-label">Tỉ lệ video</label>
      <div class="grid grid-cols-3 gap-1.5 mt-1.5">
        <button
          v-for="a in ASPECT_RATIOS"
          :key="a.id"
          type="button"
          :class="['apl-fm-aspect', local.aspectRatio === a.id && 'is-active']"
          @click="local.aspectRatio = a.id"
          :title="a.hint"
        >
          <span class="apl-fm-aspect-id">{{ a.label }}</span>
          <span class="apl-fm-aspect-hint">{{ a.hint }}</span>
        </button>
      </div>
    </div>

    <!-- Âm thanh -->
    <div>
      <label class="apl-fm-label">Âm thanh</label>
      <div class="grid grid-cols-2 gap-1.5 mt-1.5">
        <button
          type="button"
          :class="['apl-fm-tile', local.audioPassthrough && 'is-active']"
          @click="local.audioPassthrough = true"
        >
          <i class="bi bi-music-note-beamed text-base" />
          <span class="apl-fm-tile-label">Âm gốc video</span>
        </button>
        <button
          type="button"
          :class="['apl-fm-tile', !local.audioPassthrough && 'is-active']"
          @click="local.audioPassthrough = false"
        >
          <i class="bi bi-soundwave text-base" />
          <span class="apl-fm-tile-label">Âm thay thế</span>
        </button>
      </div>
      <p class="apl-fm-hint mt-1">
        "Âm thay thế" dùng file nối vào cổng <b>audio</b> của node. Chưa nối → video sẽ không tiếng.
      </p>
    </div>

    <!-- ALD 15/06/2026 - Nội suy mượt (RIFE) MẶC ĐỊNH TẮT (16fps gốc, render nhanh nhất). Toggle bật lại nếu cần
         mượt — nhưng pass RIFE riêng làm render LÂU hơn. -->
    <!-- ALD 16/06/2026 - ẩn toggle nội suy khi preset CHỈ 16fps (maxFps<=16, vd 15s-720p) → không lựa chọn fps -->
    <div v-if="maxFps > 16">
      <label class="apl-fm-label">Nội suy mượt (RIFE)</label>
      <div class="grid grid-cols-2 gap-1.5 mt-1.5">
        <button
          type="button"
          :class="['apl-fm-tile', Number(local.fps) <= 16 && 'is-active']"
          @click="local.fps = 16"
        >
          <span class="apl-fm-tile-label">Tắt · 16fps gốc</span>
        </button>
        <button
          type="button"
          :class="['apl-fm-tile', Number(local.fps) > 16 && 'is-active']"
          @click="local.fps = Number(local.fps) > 16 ? Math.min(Number(local.fps), maxFps) : maxFps"
        >
          <span class="apl-fm-tile-label">Bật · mượt</span>
        </button>
      </div>
      <p class="apl-fm-hint mt-1">Tắt = 16fps gốc, render <b>nhanh nhất</b> (khuyến nghị). Bật = nội suy RIFE mượt hơn nhưng render <b>lâu hơn</b>.</p>
      <div v-if="Number(local.fps) > 16" class="grid grid-cols-2 gap-1.5 mt-1.5">
        <button
          v-for="f in FPS_OPTS.filter((o) => o.id > 16 && o.id <= maxFps)"
          :key="f.id"
          type="button"
          :class="['apl-fm-tile', local.fps === f.id && 'is-active']"
          @click="local.fps = f.id"
        >
          <span class="apl-fm-tile-label">{{ f.label }}</span>
        </button>
      </div>
    </div>

    <!-- Info -->
    <div class="apl-info-card">
      <p class="font-semibold flex items-center gap-1.5">
        <i class="bi bi-info-circle-fill text-violet-500" />
        Cổng input
      </p>
    </div>

    <!-- Advanced -->
    <details class="apl-fm-group">
      <summary class="apl-fm-summary">Advanced · Wan Animate tune</summary>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <label class="block">
          <span class="apl-fm-label">Face strength</span>
          <input v-model.number="local.faceStrength" type="number" step="0.1" min="0" max="1.5" class="apl-fm-input mt-1" />
          <span class="apl-fm-hint mt-0.5">Độ bám BIỂU CẢM khuôn mặt theo motion. 1.0 = đồng bộ mặt theo video · 0.0 = giữ nguyên mặt ref.</span>
        </label>
        <label class="block">
          <span class="apl-fm-label">Pose strength</span>
          <input v-model.number="local.poseStrength" type="number" step="0.1" min="0" max="1.5" class="apl-fm-input mt-1" />
          <span class="apl-fm-hint mt-0.5">Độ bám TƯ THẾ/động tác theo motion. Cao = bám sát động tác gốc; thấp = nhân vật cử động nhẹ hơn.</span>
        </label>
        <label class="block">
          <span class="apl-fm-label">CLIP strength</span>
          <input v-model.number="local.clipStrength" type="number" step="0.1" min="0.5" max="2.0" class="apl-fm-input mt-1" />
          <span class="apl-fm-hint mt-0.5">Khóa NHẬN DẠNG (giữ giống mặt ref). 1.2 = mặc định · 1.5+ = giữ giống chặt hơn.</span>
        </label>
        <label class="block">
          <span class="apl-fm-label">Relight LoRA</span>
          <input v-model.number="local.loraRelight" type="number" step="0.05" min="0" max="1.5" class="apl-fm-input mt-1" />
          <span class="apl-fm-hint mt-0.5">Cao = dễ CHÓI/cháy sáng (nhất là đồ trắng). Đồ sáng: 0-0.15 · đồ tối/đèn phức tạp: 0.3-0.5.</span>
        </label>
        <label class="block col-span-2">
          <span class="apl-fm-label">Skip first frames</span>
          <input v-model.number="local.skipFirstFrames" type="number" step="1" min="0" max="32" class="apl-fm-input mt-1" />
          <span class="apl-fm-hint mt-0.5">Bỏ N frame đầu motion video để tránh hybrid gesture khi ref pose ≠ motion frame 0. Default 4 (≈0.25s).</span>
        </label>
        <!-- ALD 12/06/2026 - tăng tốc chuyển động driver so với motion gốc (vd 5 = nhanh hơn 5%). 0 = giữ nguyên. -->
        <label class="block col-span-2">
          <span class="apl-fm-label">Tăng tốc chuyển động (%)</span>
          <input v-model.number="local.motionSpeedup" type="number" step="1" min="0" max="100" class="apl-fm-input mt-1" />
          <span class="apl-fm-hint mt-0.5">Làm chuyển động NHANH hơn motion gốc bao nhiêu %. VD 5 = nhanh hơn 5% (video ngắn lại tương ứng). 0 = giữ nguyên tốc độ gốc.</span>
        </label>
      </div>
      <p class="apl-fm-hint mt-2">
        face=1.0 (sync expression) · 0.0 (giữ ref). clip=1.2 default · 1.5+ (lock identity).
      </p>
    </details>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({
  config: { type: Object, required: true },
  nodeType: { type: String, default: 'motion' }
})
const emit = defineEmits(['update:config'])

const { PRESETS } = useMotionJobs()

const MODES = [
  { id: 'transfer', label: 'Transfer', icon: 'bi-arrow-left-right', hint: 'Lấy motion áp lên ref. Background từ ref.' },
  { id: 'replace',  label: 'Replace',  icon: 'bi-person-circle',    hint: 'Giữ video, thay nhân vật. Background từ video.' }
]

const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', hint: 'Reels/TikTok' },
  { id: '16:9', label: '16:9', hint: 'YouTube' },
  { id: '1:1',  label: '1:1',  hint: 'Square' },
  { id: '3:4',  label: '3:4',  hint: 'Portrait' },
  { id: '4:3',  label: '4:3',  hint: 'Landscape' },
  { id: '21:9', label: '21:9', hint: 'Ultrawide' }
]

// ALD 16/06/2026 - ĐÃ BỎ 60fps. fps đầu ra: Gốc 16fps (tắt nội suy) · 30fps (RIFE ×2).
const FPS_OPTS = [
  { id: 16, label: 'Gốc 16fps' },
  { id: 30, label: '30fps' }
]

// ALD 05/06/2026 - Bỏ dropdown "Chất lượng": Preset đã quyết định resolution (gồm short trong tên preset).
// BE (_normalize_motion_params) ưu tiên short của preset; node cũ còn field quality thì BE chỉ cho kéo LÊN.
const local = ref({
  preset: '15s-720p',   // ALD 11/06/2026 - 10s-720p đã ẩn khỏi list; default sang 15s-720p
  mode: 'transfer',
  aspectRatio: '9:16',
  audioPassthrough: true,   // true = âm gốc video motion · false = âm thay thế (cổng input audio)
  faceStrength: 0.6,
  poseStrength: 1.0,
  clipStrength: 1.2,
  loraRelight: 0.15,   // ALD 10/06/2026 - 0.3 hay gây CHÓI với đồ trắng/sáng → hạ mặc định, có hint ở input
  skipFirstFrames: 4,
  motionSpeedup: 0,    // ALD 12/06/2026 - % tăng tốc chuyển động driver (0 = giữ nguyên)
  ...props.config,
  // ALD 05/06/2026 - fps: 16 gốc | 30 | 60. Migrate từ toggle fps60 cũ. Sau spread để override.
  fps: Number(props.config?.fps) || (props.config?.fps60 ? 30 : 16),
  // ALD 11/06/2026 - HF đã gỡ: workflow cũ lỡ lưu provider 'huggingface' → tự lành về self-host (sau spread).
  provider: String(props.config?.provider || '').toLowerCase() === 'huggingface' ? 'qwen' : (props.config?.provider || 'qwen'),
})

watch(local, (v) => emit('update:config', { ...v }), { deep: true })
watch(() => props.config, (v) => {
  if (v && JSON.stringify(v) !== JSON.stringify(local.value)) {
    local.value = { ...local.value, ...v }
  }
})

const currentPreset = computed(() => PRESETS.find((p) => p.id === local.value.preset))
// ALD 16/06/2026 - fps tối đa theo preset (vd 15s-720p ≤30fps). Lọc lựa chọn + kẹp fps khi đổi preset.
const maxFps = computed(() => Number(currentPreset.value?.maxFps) || 30)
watch(() => local.value.preset, () => {
  if (Number(local.value.fps) > maxFps.value) local.value.fps = maxFps.value
})
</script>
