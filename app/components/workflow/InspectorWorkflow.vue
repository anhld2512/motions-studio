<template>
  <div class="space-y-3">
    <div>
      <label class="apl-label">{{ t('inspector.subworkflow.slugLabel') }}</label>
      <select v-model="local.slug" class="apl-input mt-1.5 font-mono">
        <option value="">{{ t('inspector.subworkflow.selectPlaceholder') }}</option>
        <option v-for="w in availableSlugs" :key="w.slug" :value="w.slug">/{{ w.slug }} · {{ w.name }}</option>
      </select>
      <p class="apl-hint">{{ t('inspector.subworkflow.hintPrefix') }} <code>input.text</code> {{ t('inspector.subworkflow.hintSuffix') }}</p>
    </div>
    <div v-if="local.slug" class="apl-info">
      <i class="bi bi-info-circle mr-1" />
      {{ t('inspector.subworkflow.nestingNote') }}
    </div>
  </div>
</template>
<script setup>
const props = defineProps({ config: { type: Object, required: true } })
const emit = defineEmits(['update:config'])
const { t } = useI18n()
const local = reactive({ slug: props.config.slug || '' })
watch(local, (v) => emit('update:config', { ...v }), { deep: true })

const wf = useWorkflows()
const route = useRoute()
const availableSlugs = computed(() =>
  (wf.items.value || []).filter((w) => w.is_active && w.id !== route.params.id)
)
onMounted(() => { if (!wf.items.value.length) wf.load() })
</script>
<style scoped>
.apl-label { display: block; font-size: 11px; font-weight: 700; color: rgba(60,60,67,0.6); text-transform: uppercase; letter-spacing: 0.04em; }
.apl-hint  { font-size: 11px; color: rgba(60,60,67,0.5); margin-top: 4px; line-height: 1.4; }
.apl-hint code { background: rgba(118,118,128,0.12); padding: 1px 4px; border-radius: 4px; font-size: 10.5px; }
.apl-input { display: block; width: 100%; padding: 8px 10px; background: white; border: 0.5px solid rgba(60,60,67,0.18); border-radius: 8px; font-size: 13px; color: #1c1c1e; outline: none; transition: all 0.15s; font-family: inherit; }
.apl-input:focus { border-color: #007AFF; box-shadow: 0 0 0 3px rgba(0,122,255,0.2); }
.apl-info { font-size: 11px; color: #0050B5; background: #E5F1FF; padding: 8px 10px; border-radius: 8px; border: 0.5px solid rgba(0,122,255,0.15); }
</style>
