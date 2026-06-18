<template>
  <!-- #region ALD 18/06/2026 - Ghép vào mẫu (provider-based, nhóm Tạo/sửa ảnh). -->
  <div class="space-y-4">
    <ProviderBadge capability="image" />
    <div>
      <label class="ins-label">Mô tả ghép (prompt)</label>
      <textarea v-model="local.prompt" rows="4" class="ins-input mt-1.5 w-full resize-y"
        placeholder="VD: ghép người vào ảnh mẫu, giữ khuôn mặt và bối cảnh tự nhiên, ánh sáng đồng nhất" />
      <p class="ins-hint"><b>Ảnh 1 = ảnh mẫu</b> (nền), Ảnh 2… = đối tượng ghép vào.</p>
    </div>
    <div>
      <label class="ins-label">Loại đối tượng ghép</label>
      <div class="flex gap-1.5 mt-1.5">
        <button v-for="k in [{id:'person',l:'Người'},{id:'product',l:'Sản phẩm'}]" :key="k.id" type="button" :class="['ins-chip', (local.subjectKind||'person') === k.id && 'is-active']" @click="local.subjectKind = k.id">{{ k.l }}</button>
      </div>
    </div>
    <div>
      <label class="ins-label">Số đối tượng (cổng)</label>
      <div class="flex gap-1.5 mt-1.5">
        <button v-for="n in [1,2]" :key="n" type="button" :class="['ins-chip', (Number(local.personCount)||1) === n && 'is-active']" @click="local.personCount = n">{{ n }}</button>
      </div>
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({ config: { type: Object, default: () => ({}) }, nodeType: { type: String, default: 'compose' } })
const emit = defineEmits(['update:config'])
const local = ref({ prompt: '', subjectKind: 'person', personCount: 1, ...props.config })
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
