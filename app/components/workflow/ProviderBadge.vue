<template>
  <!-- #region ALD 18/06/2026 - Badge hiện node này dùng AI PROVIDER nào (theo nhóm năng lực), thay cho engine self-host.
       Provider + model cấu hình 1 chỗ ở Cài đặt → Provider. Bấm để mở. -->
  <NuxtLink
    to="/settings?tab=provider"
    :class="['flex items-center gap-2 rounded-xl px-2.5 py-2 border text-[12px] transition-colors',
      bound ? 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-50' : 'bg-amber-50/70 border-amber-200 hover:bg-amber-50']"
  >
    <span :class="['inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0', bound ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700']">
      <i :class="['bi', bound ? 'bi-plug-fill' : 'bi-plug']" />
    </span>
    <div class="min-w-0 flex-1 leading-tight">
      <div class="font-bold text-gray-800 truncate">
        <span class="text-gray-400 font-semibold">{{ capLabel }}:</span>
        {{ bound ? bound.name : 'chưa gắn provider' }}
        <span v-if="bound && model" class="text-gray-400 font-normal">· {{ model }}</span>
      </div>
      <div class="text-[10.5px] text-gray-400 truncate">{{ bound ? 'Đổi ở Cài đặt → Provider' : 'Bấm để gắn ở Cài đặt → Provider' }}</div>
    </div>
    <i class="bi bi-chevron-right text-gray-300 flex-shrink-0" />
  </NuxtLink>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({ capability: { type: String, required: true } })
const prov = useProviders()
prov.load()

const capLabel = computed(() => prov.CAPABILITIES.find((c) => c.id === props.capability)?.label || props.capability)
const binding = computed(() => prov.bindings.value?.[props.capability] || null)
const bound = computed(() => binding.value ? prov.providers.value.find((p) => p.id === binding.value.providerId) || null : null)
const model = computed(() => binding.value?.model || bound.value?.models?.[props.capability] || '')
</script>
