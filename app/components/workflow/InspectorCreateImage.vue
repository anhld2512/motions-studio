<template>
  <!-- #region ALD 18/06/2026 - Create Image (provider-based). Engine/model do PROVIDER nhóm "Tạo/sửa ảnh" quyết định
       (Cài đặt → Provider). Ở đây chỉ còn tham số sáng tạo: prompt, số ảnh tham chiếu, tỉ lệ, negative. -->
  <div class="space-y-4">
    <ProviderBadge capability="image" />

    <div>
      <label class="ins-label">{{ t('inspector.createImage.prompt') }}</label>
      <textarea v-model="local.prompt" rows="4" class="ins-input mt-1.5 w-full resize-y"
        :placeholder="t('inspector.createImage.promptPlaceholder')" />
      <p class="ins-hint">
        <template v-if="inputCount === 0">{{ t('inspector.createImage.promptHint') }}</template>
        <template v-else-if="inputCount === 1">{{ t('inspector.createImage.promptHint1') }}</template>
        <template v-else>{{ t('inspector.createImage.promptHintN', { n: inputCount }) }}</template>
      </p>
    </div>

    <div>
      <label class="ins-label">{{ t('inspector.createImage.refCount') }}</label>
      <div class="flex flex-wrap gap-1.5 mt-1.5">
        <button v-for="n in [0,1,2,3]" :key="n" type="button"
          :class="['ins-chip', inputCount === n && 'is-active']" @click="local.inputCount = n">
          {{ n === 0 ? t('inspector.createImage.refNone') : t('inspector.createImage.refN', { n }) }}
        </button>
      </div>
    </div>

    <div>
      <label class="ins-label">{{ t('inspector.createImage.aspect') }}</label>
      <UiDropdown v-model="local.aspectRatio" :options="ASPECTS" icon="bi-aspect-ratio" full-width no-clear class="mt-1.5" />
    </div>

    <div>
      <label class="ins-label">{{ t('inspector.createImage.negative') }}</label>
      <textarea v-model="local.negativePrompt" rows="2" class="ins-input mt-1.5 w-full resize-y"
        :placeholder="t('inspector.createImage.negativePlaceholder')" />
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
const { t } = useI18n()

const ASPECTS = computed(() => [
  { value: 'auto', label: t('inspector.createImage.aspectAuto') }, { value: '1:1', label: t('inspector.createImage.aspectSquare') },
  { value: '16:9', label: t('inspector.createImage.aspectLandscape') }, { value: '9:16', label: t('inspector.createImage.aspectPortrait') },
  { value: '4:3', label: '4:3' }, { value: '3:4', label: '3:4' }
])

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
