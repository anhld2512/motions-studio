<template>
  <!-- #region ALD 18/06/2026 - Lồng tiếng (provider-based, nhóm Giọng nói). Engine do provider quyết định. -->
  <div class="space-y-4">
    <ProviderBadge capability="speech" />
    <div>
      <label class="ins-label">{{ t('inspector.voiceover.scriptLabel') }}</label>
      <textarea v-model="local.script" rows="4" class="ins-input mt-1.5 w-full resize-y"
        :placeholder="t('inspector.voiceover.scriptPlaceholder')" />
    </div>
    <div>
      <label class="ins-label">{{ t('inspector.voiceover.voiceLabel') }}</label>
      <div class="flex flex-wrap gap-1.5 mt-1.5">
        <button v-for="v in VOICE_PRESETS" :key="v" type="button" :class="['ins-chip', local.voice === v && 'is-active']" @click="local.voice = v">{{ v }}</button>
      </div>
      <input v-model="local.voice" type="text" class="ins-input mt-2 w-full font-mono text-[13px]" :placeholder="t('inspector.voiceover.voicePlaceholder')" />
      <p class="ins-hint">OpenAI <code>alloy/nova…</code> · Gemini <code>Kore/Puck…</code> · {{ t('inspector.voiceover.voiceHint') }}</p>
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({ config: { type: Object, default: () => ({}) }, nodeType: { type: String, default: 'voiceover' } })
const emit = defineEmits(['update:config'])
const { t } = useI18n()
const VOICE_PRESETS = ['alloy', 'nova', 'shimmer', 'Kore', 'Puck', 'Aoede']
const local = ref({ script: '', voice: 'alloy', ...props.config })
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
