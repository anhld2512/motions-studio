<template>
  <!-- #region ALD 18/06/2026 - Gắn AI Provider NGAY TRÊN NODE. Chọn/sửa provider + model ở đây → tự ghi vào
       binding nhóm năng lực (cũng là cấu hình ở Cài đặt → Provider). Thêm provider mới ngay tại node = tự tạo setting. -->
  <div class="pb-wrap">
    <button type="button" :class="['pb-head', bound ? 'is-on' : 'is-off']" @click="open = !open">
      <span :class="['pb-ico', bound ? 'on' : 'off']"><i :class="['bi', bound ? 'bi-plug-fill' : 'bi-plug']" /></span>
      <span class="pb-txt">
        <span class="pb-title"><span class="pb-cap">{{ capLabel }}:</span> {{ bound ? bound.name : t('providerBadge.noProvider') }}<span v-if="bound && curModel" class="pb-model"> · {{ curModel }}</span></span>
        <span class="pb-sub">{{ bound ? t('providerBadge.subChange') : t('providerBadge.subBind') }}</span>
      </span>
      <i :class="['bi pb-chev', open ? 'bi-chevron-up' : 'bi-chevron-down']" />
    </button>

    <div v-if="open" class="pb-body">
      <!-- Chọn provider có sẵn -->
      <template v-if="providers.length && mode !== 'new'">
        <label class="pb-label">{{ t('providerBadge.provider') }}</label>
        <UiDropdown :model-value="binding?.providerId || ''" :options="providerOptions" icon="bi-plug" :placeholder="t('providerBadge.pickProvider')" full-width @update:model-value="bindProvider" />

        <template v-if="bound">
          <label class="pb-label mt-2">{{ t('providerBadge.model') }} <span class="pb-cap font-normal normal-case">{{ t('providerBadge.modelHint') }}</span></label>
          <UiDropdown :model-value="modelDropdownValue" :options="modelOptions" icon="bi-box" :placeholder="t('providerBadge.pickModel')" full-width no-clear @update:model-value="onPickModel" />
          <input v-if="customMode" :value="curModel" type="text" class="pb-input mt-1.5 font-mono text-[12px]"
            :placeholder="t('providerBadge.modelIdPlaceholder')" autofocus @change="setModel($event.target.value)" />
        </template>

        <button type="button" class="pb-add" @click="startNew"><i class="bi bi-plus-lg me-1" />{{ t('providerBadge.newProvider') }}</button>
      </template>

      <!-- Thêm provider mới ngay tại node -->
      <template v-else>
        <label class="pb-label">{{ t('providerBadge.vendor') }}</label>
        <UiDropdown :model-value="form.kind" :options="kindOptions" icon="bi-grid" full-width no-clear @update:model-value="onKind" />
        <input v-model="form.name" type="text" class="pb-input mt-1.5" :placeholder="t('providerBadge.namePlaceholder')" />
        <input v-model="form.baseUrl" type="text" class="pb-input mt-1.5 font-mono text-[12px]" placeholder="https://…" />
        <input v-model="form.apiKey" type="password" class="pb-input mt-1.5 font-mono text-[12px]" :placeholder="t('providerBadge.apiKeyPlaceholder')" autocomplete="off" />
        <p v-if="formModelsHint" class="pb-hint"><i class="bi bi-info-circle me-1" />{{ t('providerBadge.modelLabel', { models: formModelsHint }) }}</p>
        <div class="flex gap-2 mt-2">
          <button type="button" class="pb-save" :disabled="saving || !form.apiKey" @click="saveNew">{{ saving ? t('providerBadge.saving') : t('providerBadge.saveAndBind') }}</button>
          <button v-if="providers.length" type="button" class="pb-cancel" @click="mode = 'pick'">{{ t('providerBadge.cancel') }}</button>
        </div>
      </template>

      <NuxtLink to="/settings?tab=provider" class="pb-settings"><i class="bi bi-gear me-1" />{{ t('providerBadge.manageAll') }}</NuxtLink>
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const { t } = useI18n()
const props = defineProps({ capability: { type: String, required: true } })
const prov = useProviders()
const { providers, bindings, PROVIDER_KINDS } = prov
prov.load()

const MODEL_NOTE = { 'gemini-2.5-flash-image': 'Nano Banana', 'gemini-3-pro-image-preview': 'Nano Banana Pro', 'fal-ai/nano-banana': 'Nano Banana (fal)' }

const open = ref(false)
const mode = ref('pick')         // 'pick' | 'new'
const saving = ref(false)
const form = reactive({ kind: 'openai', name: '', baseUrl: '', apiKey: '' })

const capLabel = computed(() => t(`cap.${props.capability}.label`))
const binding = computed(() => bindings.value?.[props.capability] || null)
const bound = computed(() => binding.value ? providers.value.find((p) => p.id === binding.value.providerId) || null : null)
const curModel = computed(() => binding.value?.model || bound.value?.models?.[props.capability] || '')

// Chỉ hiện provider có model cho NHÓM này (vd group video → chỉ Gemini/Together…).
const providerOptions = computed(() => providers.value
  .filter((p) => (prov.suggestedModels(p.kind, props.capability).length) || (p.models && p.models[props.capability]) || p.kind === 'custom')
  .map((p) => ({ value: p.id, label: p.name })))
const allModels = computed(() => bound.value ? prov.suggestedModels(bound.value.kind, props.capability) : [])

// Model = dropdown (nhãn thân thiện vd "Nano Banana Pro") + tuỳ chọn "Tự nhập…".
const customMode = ref(false)
const modelOptions = computed(() => {
  const opts = allModels.value.map((m) => ({ value: m, label: MODEL_NOTE[m] || m }))
  if (curModel.value && !allModels.value.includes(curModel.value)) opts.unshift({ value: curModel.value, label: t('providerBadge.customModelOption', { model: MODEL_NOTE[curModel.value] || curModel.value }) })
  opts.push({ value: '__custom__', label: t('providerBadge.enterCustomModel') })
  return opts
})
const modelDropdownValue = computed(() => customMode.value ? '__custom__' : (curModel.value || ''))
function onPickModel(v) {
  if (v === '__custom__') { customMode.value = true; return }
  customMode.value = false
  setModel(v)
}

const kindOptions = PROVIDER_KINDS.map((k) => ({ value: k.id, label: k.label }))
const formModelsHint = computed(() => (PROVIDER_KINDS.find((k) => k.id === form.kind)?.models?.[props.capability] || []).slice(0, 4).join(', '))

function bindProvider(providerId) {
  const p = providers.value.find((x) => x.id === providerId)
  const model = p ? (p.models?.[props.capability] || prov.suggestedModels(p.kind, props.capability)[0] || '') : ''
  prov.setBinding(props.capability, providerId, model)
}
function setModel(m) { if (binding.value?.providerId) prov.setBinding(props.capability, binding.value.providerId, m) }

function startNew() {
  const def = PROVIDER_KINDS[0]
  Object.assign(form, { kind: def.id, name: def.label, baseUrl: def.baseUrl, apiKey: '' })
  mode.value = 'new'
}
function onKind(kindId) {
  form.kind = kindId
  const def = PROVIDER_KINDS.find((k) => k.id === kindId)
  if (def) { form.baseUrl = def.baseUrl || ''; form.name = def.label }
}
async function saveNew() {
  saving.value = true
  try {
    const id = await prov.saveProvider({ name: form.name, kind: form.kind, baseUrl: form.baseUrl, plainApiKey: form.apiKey })
    const model = prov.suggestedModels(form.kind, props.capability)[0] || ''
    prov.setBinding(props.capability, id, model)   // tự tạo binding nhóm = cấu hình Settings
    mode.value = 'pick'
  } finally {
    saving.value = false
  }
}

// Lần đầu chưa có provider nào → mở sẵn form thêm mới.
if (!providers.value.length) { mode.value = 'new'; Object.assign(form, { kind: 'openai', name: 'OpenAI (ChatGPT)', baseUrl: 'https://api.openai.com/v1' }) }
</script>

<style scoped>
.pb-wrap { border: 1px solid; border-radius: 14px; overflow: hidden; }
.pb-wrap { border-color: rgba(60,60,67,0.12); }
.pb-head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 11px; text-align: left; cursor: pointer; background: rgba(255,255,255,0.6); }
.pb-head.is-on { background: rgba(16,185,129,0.07); }
.pb-head.is-off { background: rgba(245,158,11,0.08); }
.pb-ico { display: inline-flex; height: 28px; width: 28px; align-items: center; justify-content: center; border-radius: 9px; flex-shrink: 0; font-size: 13px; }
.pb-ico.on { background: #d1fae5; color: #047857; }
.pb-ico.off { background: #fef3c7; color: #b45309; }
.pb-txt { min-width: 0; flex: 1; line-height: 1.25; }
.pb-title { font-size: 12.5px; font-weight: 700; color: #1f2937; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pb-cap { color: #9ca3af; font-weight: 600; }
.pb-model { color: #9ca3af; font-weight: 500; }
.pb-sub { font-size: 10.5px; color: #9ca3af; }
.pb-chev { color: #cbd5e1; font-size: 12px; }
.pb-body { padding: 10px 11px; background: rgba(255,255,255,0.5); border-top: 1px solid rgba(60,60,67,0.08); }
.pb-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; color: #6b7280; display: block; }
.pb-input { width: 100%; border: 1px solid rgba(60,60,67,0.16); border-radius: 10px; padding: 0 11px; height: 34px; background: white; outline: none; font-size: 13px; }
.pb-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
.pb-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.pb-chip { padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; background: white; border: 1px solid rgba(60,60,67,0.16); color: #3c3c43; cursor: pointer; }
.pb-chip.is-active { background: #2563eb; color: white; border-color: #2563eb; }
.pb-add { margin-top: 10px; font-size: 12px; font-weight: 600; color: #2563eb; cursor: pointer; }
.pb-save { flex: 1; height: 36px; border-radius: 999px; background: #2563eb; color: white; font-size: 13px; font-weight: 700; cursor: pointer; }
.pb-save:disabled { opacity: .55; }
.pb-cancel { height: 36px; padding: 0 14px; border-radius: 999px; background: white; border: 1px solid rgba(60,60,67,0.16); font-size: 13px; font-weight: 600; color: #4b5563; cursor: pointer; }
.pb-hint { font-size: 10.5px; color: #9ca3af; margin-top: 6px; }
.pb-settings { display: block; margin-top: 10px; font-size: 11px; color: #9ca3af; }
.pb-settings:hover { color: #2563eb; }
</style>
