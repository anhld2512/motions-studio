<template>
  <!-- #region ALD 18/06/2026 - Thử đồ (provider-based). Engine do PROVIDER nhóm "Tạo/sửa ảnh" (Cài đặt → Provider).
       Giữ tham số cấu trúc: loại đồ + số ảnh sản phẩm (quyết định cổng vào). -->
  <div class="space-y-4">
    <ProviderBadge capability="image" />

    <div>
      <label class="ins-label">Loại sản phẩm</label>
      <div class="flex flex-wrap gap-1.5 mt-1.5">
        <button v-for="g in GARMENTS" :key="g.id" type="button"
          :class="['ins-chip', local.garmentType === g.id && 'is-active']" @click="local.garmentType = g.id">
          <i :class="['bi me-1', g.icon]" />{{ g.label }}
        </button>
      </div>
    </div>

    <div>
      <label class="ins-label">Số ảnh sản phẩm (cổng vào)</label>
      <div class="flex gap-1.5 mt-1.5">
        <button v-for="n in [1,2]" :key="n" type="button"
          :class="['ins-chip', (Number(local.productCount)||1) === n && 'is-active']" @click="local.productCount = n">
          {{ n }} ảnh
        </button>
      </div>
      <p class="ins-hint">2 ảnh = thêm góc mặt sau / bên hông cho khớp khi xoay người.</p>
    </div>

    <div>
      <label class="ins-label">Yêu cầu thêm (prompt — tuỳ chọn)</label>
      <textarea v-model="local.prompt" rows="3" class="ins-input mt-1.5 w-full resize-y"
        placeholder="VD: giữ nguyên khuôn mặt và dáng người, ánh sáng studio, nền sạch" />
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const props = defineProps({
  config: { type: Object, default: () => ({}) },
  nodeType: { type: String, default: 'tryon' }
})
const emit = defineEmits(['update:config'])

const GARMENTS = [
  { id: 'auto', label: 'Tự nhận', icon: 'bi-magic' },
  { id: 'upper', label: 'Áo', icon: 'bi-person-fill' },
  { id: 'lower', label: 'Quần', icon: 'bi-person-walking' },
  { id: 'dress', label: 'Váy', icon: 'bi-person-arms-up' },
  { id: 'set', label: 'Bộ', icon: 'bi-bag' },
  { id: 'accessory', label: 'Phụ kiện', icon: 'bi-bag-heart' }
]

const local = ref({ garmentType: 'auto', productCount: 1, prompt: '', ...props.config })
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
