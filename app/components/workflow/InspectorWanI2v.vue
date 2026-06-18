<template>
  <!-- ALD 17/06/2026 - Node "Ảnh → Video (Wan)": cổng trái nhận 1 ẢNH (từ Create Image / Input) + prompt TIẾNG ANH →
       video chuyển động bằng Wan 2.1/2.2 I2V (engine đã cài trên box; KHÔNG cần LTX). Dùng cho time-lapse BĐS. -->
  <div class="space-y-4">
    <div class="apl-info-card">
      <p class="font-semibold flex items-center gap-1.5"><i class="bi bi-camera-reels" /> Ảnh → Video (Wan)</p>
      <p class="text-[11px] opacity-70 mt-1">
        Cổng trái nhận <b>1 ẢNH</b>. Mô tả chuyển động bằng <b>tiếng Anh</b> (text-encoder của Wan hiểu tiếng Anh tốt nhất) → ra clip ngắn.
      </p>
    </div>

    <!-- Engine Wan -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Engine</p>
      <div class="grid grid-cols-2 gap-1.5">
        <button type="button" :class="['apl-fm-tile', local.wanModel === 'wan2.1' && 'is-active']" @click="local.wanModel = 'wan2.1'">
          <span class="apl-fm-tile-label">Wan 2.1</span><span class="apl-fm-tile-sub">nhanh, ổn định</span>
        </button>
        <button type="button" :class="['apl-fm-tile', local.wanModel === 'wan2.2' && 'is-active']" @click="local.wanModel = 'wan2.2'">
          <span class="apl-fm-tile-label">Wan 2.2</span><span class="apl-fm-tile-sub">nét hơn, lâu hơn</span>
        </button>
      </div>
    </div>

    <!-- Prompt (English) -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Prompt chuyển động (English)</p>
      <textarea v-model="local.prompt" rows="3" class="apl-fm-input" style="height:auto;padding:8px 10px;font-family:inherit;line-height:1.5;resize:vertical"
        placeholder="e.g. Aerial drone slowly descends over an empty construction plot, workers placing survey stakes, morning light, gentle camera motion" />
      <p class="apl-fm-hint">PHẢI viết <b>tiếng Anh</b> (Wan không hiểu tiếng Việt → ra sai/đứng hình).</p>
    </div>

    <!-- Tỉ lệ + thời lượng -->
    <div class="grid grid-cols-2 gap-2">
      <div class="apl-fm-group">
        <p class="apl-fm-heading">Tỉ lệ</p>
        <select v-model="local.aspectRatio" class="apl-fm-input">
          <option value="9:16">Dọc 9:16</option>
          <option value="16:9">Ngang 16:9</option>
          <option value="1:1">Vuông 1:1</option>
          <option value="auto">Auto (theo ảnh)</option>
        </select>
      </div>
      <div class="apl-fm-group">
        <p class="apl-fm-heading">Thời lượng (giây)</p>
        <input v-model.number="local.duration" type="number" min="2" max="7" step="1" class="apl-fm-input" />
        <p class="apl-fm-hint">2–7s (Wan ~16fps). Dài hơn → tốn VRAM.</p>
      </div>
    </div>

    <!-- Negative (optional, English) -->
    <div class="apl-fm-group">
      <p class="apl-fm-heading">Tránh (negative, English — tuỳ chọn)</p>
      <input v-model="local.negativePrompt" type="text" class="apl-fm-input"
        placeholder="e.g. blurry, distorted, melting, jump cut" />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  config: { type: Object, required: true },
  nodeType: { type: String, default: 'wan-i2v' }
})
const emit = defineEmits(['update:config'])

const local = ref({ prompt: '', negativePrompt: '', duration: 5, aspectRatio: '9:16', wanModel: 'wan2.1', ...props.config })

watch(local, (v) => emit('update:config', { ...v }), { deep: true })
watch(() => props.config, (v) => {
  if (v && JSON.stringify(v) !== JSON.stringify(local.value)) local.value = { ...local.value, ...v }
})
</script>

<style scoped>
.apl-info-card { background: rgba(255,45,85,0.06); border: 0.5px solid rgba(255,45,85,0.22); border-radius: 12px; padding: 11px 12px; }
.apl-fm-group { background: rgba(255,255,255,0.6); border: 0.5px solid rgba(60,60,67,0.12); border-radius: 14px; padding: 12px; }
.apl-fm-heading { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(60,60,67,0.6); margin-bottom: 8px; }
.apl-fm-hint { margin-top: 6px; font-size: 10.5px; color: rgba(60,60,67,0.55); line-height: 1.4; }
.apl-fm-input { width: 100%; min-height: 32px; padding: 0 10px; background: white; border: 0.5px solid rgba(60,60,67,0.18); border-radius: 9px; font-size: 12px; transition: border-color 0.18s; }
.apl-fm-input:focus { outline: none; border-color: #FF2D55; }
.apl-fm-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; height: 50px; border-radius: 12px; border: 0.5px solid rgba(60,60,67,0.18); background: white; color: rgba(60,60,67,0.8); transition: all 0.15s; }
.apl-fm-tile:hover { border-color: rgba(255,45,85,0.4); }
.apl-fm-tile.is-active { border-color: #FF2D55; background: rgba(255,45,85,0.07); color: #A11D38; box-shadow: 0 0 0 1px #FF2D55 inset; }
.apl-fm-tile-label { font-size: 12px; font-weight: 700; }
.apl-fm-tile-sub { font-size: 9.5px; opacity: 0.6; }
</style>
