<template>
  <!-- #region ALD 18/06/2026 - Motion Control (provider-based). Tạo video do PROVIDER nhóm "Tạo video"
       quyết định (Cài đặt → Provider, vd Gemini Veo). chỉ còn mô tả + tỉ lệ. -->
  <div class="space-y-4">
    <ProviderBadge capability="video" />

    <div>
      <label class="ins-label">{{ t('inspector.motionTransfer.promptLabel') }}</label>
      <textarea v-model="local.prompt" rows="4" class="ins-input mt-1.5 w-full resize-y"
        :placeholder="t('inspector.motionTransfer.promptPlaceholder')" />
      <p class="ins-hint" v-html="t('inspector.motionTransfer.promptHint')"></p>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <div>
        <label class="ins-label">{{ t('inspector.motionTransfer.aspectRatioLabel') }}</label>
        <UiDropdown v-model="local.aspectRatio" :options="ASPECTS" icon="bi-aspect-ratio" full-width no-clear class="mt-1.5" />
      </div>
      <div>
        <label class="ins-label">{{ t('inspector.motionTransfer.durationLabel') }}</label>
        <UiDropdown v-model="local.duration" :options="DURATIONS" icon="bi-clock" full-width no-clear class="mt-1.5" />
      </div>
      <div>
        <label class="ins-label">{{ t('inspector.motionTransfer.qualityLabel') }}</label>
        <UiDropdown v-model="local.resolution" :options="QUALITIES" icon="bi-badge-hd" full-width no-clear class="mt-1.5" />
      </div>
    </div>
    <p class="ins-hint">{{ t('inspector.motionTransfer.durationHint') }}</p>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({
  config: { type: Object, default: () => ({}) },
  nodeType: { type: String, default: 'motion' }
})
const emit = defineEmits(['update:config'])
const { t } = useI18n()

const ASPECTS = computed(() => [
  { value: '9:16', label: t('inspector.motionTransfer.aspect.vertical') }, { value: '16:9', label: t('inspector.motionTransfer.aspect.horizontal') },
  { value: '1:1', label: t('inspector.motionTransfer.aspect.square') }, { value: '4:3', label: '4:3' }
])
const DURATIONS = [
  { value: 5, label: '5s' }, { value: 10, label: '10s' }, { value: 15, label: '15s' }, { value: 30, label: '30s' }
]
const QUALITIES = [
  { value: '480p', label: '480p' }, { value: '720p', label: '720p' }, { value: '1080p', label: '1080p' },
  { value: '2k', label: '2K' }, { value: '4k', label: '4K' }
]

const local = ref({ prompt: '', aspectRatio: '9:16', duration: 5, resolution: '720p', ...props.config })
watch(local, (v) => emit('update:config', { ...v }), { deep: true })
watch(() => props.config, (v) => { if (v && JSON.stringify(v) !== JSON.stringify(local.value)) local.value = { ...local.value, ...v } })
</script>

<style scoped>
.ins-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; color: #6b7280; }
.ins-input { border: 1px solid rgba(60,60,67,0.16); border-radius: 12px; padding: 8px 12px; background: rgba(255,255,255,0.7); outline: none; font-size: 13px; transition: border-color .15s, box-shadow .15s; }
.ins-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
.ins-hint { font-size: 11px; color: #9ca3af; margin-top: 6px; line-height: 1.4; }
</style>
