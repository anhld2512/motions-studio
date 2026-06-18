<template>
  <!-- #region ALD 18/06/2026 - Create Image (provider-based). Engine/model do PROVIDER nhóm "Tạo/sửa ảnh" quyết định
       (Cài đặt → Provider). Ở đây chỉ còn tham số sáng tạo: prompt, số ảnh tham chiếu, tỉ lệ, negative. -->
  <div class="space-y-4">
    <ProviderBadge capability="image" />

    <div>
      <label class="ins-label">Mô tả ảnh (prompt)</label>
      <textarea v-model="local.prompt" rows="4" class="ins-input mt-1.5 w-full resize-y"
        placeholder="VD: Ảnh sản phẩm điện ảnh, ánh sáng studio cao cấp, chi tiết cao, chân thực" />
      <p class="ins-hint">
        <template v-if="inputCount === 0">Không nối ảnh → sinh ảnh thuần từ mô tả (text→image).</template>
        <template v-else-if="inputCount === 1">Mô tả cách chỉnh <b>Ảnh gốc</b> (nối vào cổng Ảnh).</template>
        <template v-else><b>Ảnh 1 = ảnh mẫu</b>; mô tả cách áp lên Ảnh 2…{{ inputCount }}.</template>
      </p>
    </div>

    <div>
      <label class="ins-label">Số ảnh tham chiếu (cổng vào)</label>
      <div class="flex flex-wrap gap-1.5 mt-1.5">
        <button v-for="n in [0,1,2,3]" :key="n" type="button"
          :class="['ins-chip', inputCount === n && 'is-active']" @click="local.inputCount = n">
          {{ n === 0 ? 'Không (text→ảnh)' : n + ' ảnh' }}
        </button>
      </div>
    </div>

    <div>
      <label class="ins-label">Tỉ lệ khung</label>
      <UiDropdown v-model="local.aspectRatio" :options="ASPECTS" icon="bi-aspect-ratio" full-width no-clear class="mt-1.5" />
    </div>

    <div>
      <label class="ins-label">Không muốn có (negative — tuỳ chọn)</label>
      <textarea v-model="local.negativePrompt" rows="2" class="ins-input mt-1.5 w-full resize-y"
        placeholder="VD: chữ, logo, méo tay, mờ" />
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({
  config: { type: Object, default: () => ({}) },
  nodeType: { type: String, default: 'create-image' }
})
const emit = defineEmits(['update:config'])

const ASPECTS = [
  { value: 'auto', label: 'Tự động' }, { value: '1:1', label: 'Vuông 1:1' },
  { value: '16:9', label: 'Ngang 16:9' }, { value: '9:16', label: 'Dọc 9:16' },
  { value: '4:3', label: '4:3' }, { value: '3:4', label: '3:4' }
]

const local = ref({ prompt: '', negativePrompt: '', inputCount: 0, aspectRatio: 'auto', ...props.config })
const inputCount = computed(() => Math.max(0, Math.min(6, Number(local.value.inputCount) || 0)))

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
