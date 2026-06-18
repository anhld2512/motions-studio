<template>
  <!-- #region ALD 18/06/2026 - Ảnh → Video (provider-based, nhóm Tạo video). Engine do provider quyết định. -->
  <div class="space-y-4">
    <ProviderBadge capability="video" />
    <div>
      <label class="ins-label">Mô tả chuyển động (prompt)</label>
      <textarea v-model="local.prompt" rows="4" class="ins-input mt-1.5 w-full resize-y"
        placeholder="VD: máy quay lia nhẹ quanh sản phẩm, ánh sáng điện ảnh, nền chuyển động mượt" />
      <p class="ins-hint">Provider video sinh clip từ (các) ảnh đầu vào + mô tả này.</p>
    </div>
    <div>
      <label class="ins-label">Số ảnh đầu vào (cổng)</label>
      <div class="flex gap-1.5 mt-1.5">
        <button v-for="n in [1,2,3]" :key="n" type="button" :class="['ins-chip', (Number(local.inputCount)||1) === n && 'is-active']" @click="local.inputCount = n">{{ n }} ảnh</button>
      </div>
    </div>
    <div>
      <label class="ins-label">Tỉ lệ khung</label>
      <UiDropdown v-model="local.aspectRatio" :options="ASPECTS" icon="bi-aspect-ratio" full-width no-clear class="mt-1.5" />
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({ config: { type: Object, default: () => ({}) }, nodeType: { type: String, default: 'ss' } })
const emit = defineEmits(['update:config'])
const ASPECTS = [{ value: '9:16', label: 'Dọc 9:16' }, { value: '16:9', label: 'Ngang 16:9' }, { value: '1:1', label: 'Vuông 1:1' }]
const local = ref({ prompt: '', inputCount: 1, aspectRatio: '9:16', ...props.config })
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
