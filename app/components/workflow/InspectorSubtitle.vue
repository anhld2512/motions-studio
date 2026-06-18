<template>
  <!-- #region ALD 18/06/2026 - Phụ đề (provider-based, nhóm Nhận dạng/phụ đề). ASR + dịch do provider quyết định. -->
  <div class="space-y-4">
    <ProviderBadge capability="transcription" />
    <div>
      <label class="ins-label">{{ t('inspector.subtitle.modeLabel') }}</label>
      <div class="flex gap-1.5 mt-1.5">
        <button v-for="m in MODES" :key="m.id" type="button" :class="['ins-chip', (local.mode||'subtitle') === m.id && 'is-active']" @click="local.mode = m.id">{{ m.label }}</button>
      </div>
    </div>
    <div v-if="local.mode !== 'subtitle-only'">
      <label class="ins-label">{{ t('inspector.subtitle.targetLangLabel') }}</label>
      <UiDropdown v-model="local.targetLang" :options="LANGS" icon="bi-translate" full-width no-clear class="mt-1.5" />
      <p class="ins-hint">{{ t('inspector.subtitle.targetLangHint') }}</p>
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({ config: { type: Object, default: () => ({}) }, nodeType: { type: String, default: 'subtitle' } })
const emit = defineEmits(['update:config'])
const { t } = useI18n()
const MODES = computed(() => [{ id: 'subtitle-only', label: t('inspector.subtitle.modeSubtitleOnly') }, { id: 'translate', label: t('inspector.subtitle.modeTranslate') }])
const LANGS = computed(() => [{ value: 'vi', label: t('inspector.subtitle.langVi') }, { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' }, { value: 'ko', label: '한국어' }, { value: 'zh', label: '中文' }])
const local = ref({ mode: 'translate', targetLang: 'vi', ...props.config })
watch(local, (v) => emit('update:config', { ...v }), { deep: true })
watch(() => props.config, (v) => { if (v && JSON.stringify(v) !== JSON.stringify(local.value)) local.value = { ...local.value, ...v } })
</script>

<style scoped>
.ins-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; color: #6b7280; }
.ins-hint { font-size: 11px; color: #9ca3af; margin-top: 6px; line-height: 1.4; }
.ins-chip { padding: 5px 11px; border-radius: 999px; font-size: 12px; font-weight: 600; background: white; border: 1px solid rgba(60,60,67,0.16); color: #3c3c43; cursor: pointer; transition: all .15s; }
.ins-chip.is-active { background: #2563eb; color: white; border-color: #2563eb; }
</style>
