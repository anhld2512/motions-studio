<template>
  <!-- #region ALD 18/06/2026 - Ảnh → Video (provider-based, nhóm Tạo video). Cổng: Ảnh đầu (+ Ảnh cuối tuỳ chọn). -->
  <div class="space-y-4">
    <ProviderBadge capability="video" />
    <div>
      <label class="ins-label">{{ t('inspector.wanI2v.promptLabel') }}</label>
      <textarea v-model="local.prompt" rows="4" class="ins-input mt-1.5 w-full resize-y"
        :placeholder="t('inspector.wanI2v.promptPlaceholder')" />
      <p class="ins-hint" v-html="t('inspector.wanI2v.promptHint')"></p>
    </div>
    <div>
      <label class="ins-label">{{ t('inspector.wanI2v.aspectRatioLabel') }}</label>
      <UiDropdown v-model="local.aspectRatio" :options="ASPECTS" icon="bi-aspect-ratio" full-width no-clear class="mt-1.5" />
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({ config: { type: Object, default: () => ({}) }, nodeType: { type: String, default: 'wan-i2v' } })
const emit = defineEmits(['update:config'])
const { t } = useI18n()
const ASPECTS = computed(() => [{ value: '9:16', label: t('inspector.wanI2v.aspect.vertical') }, { value: '16:9', label: t('inspector.wanI2v.aspect.horizontal') }, { value: '1:1', label: t('inspector.wanI2v.aspect.square') }])
const local = ref({ prompt: '', aspectRatio: '9:16', ...props.config })
watch(local, (v) => emit('update:config', { ...v }), { deep: true })
watch(() => props.config, (v) => { if (v && JSON.stringify(v) !== JSON.stringify(local.value)) local.value = { ...local.value, ...v } })
</script>

<style scoped>
.ins-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; color: #6b7280; }
.ins-input { border: 1px solid rgba(60,60,67,0.16); border-radius: 12px; padding: 8px 12px; background: rgba(255,255,255,0.7); outline: none; font-size: 13px; transition: border-color .15s, box-shadow .15s; }
.ins-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
.ins-hint { font-size: 11px; color: #9ca3af; margin-top: 6px; line-height: 1.4; }
</style>
