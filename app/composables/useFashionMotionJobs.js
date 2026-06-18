// #region ALD 28/05/2026 - Composable fashion-motion-jobs.
// Pipeline 2 stage: Qwen-Image-Edit-2509 try-on (model + product → person mặc product) → Wan 2.2 Animate.
// Endpoints (BE proxy):
//   POST   /fashion-motion-jobs
//   GET    /fashion-motion-jobs/:id
//   DELETE /fashion-motion-jobs/:id
//   GET    /fashion-motion-jobs?...
export function useFashionMotionJobs() {
  const auth = useAuth()
  const base = '/fashion-motion-jobs'

  /**
   * Tạo job mới — 3 file inputs.
   * @param {object} opts
   * @param {File}   opts.modelImage   - ảnh người mẫu (jpg/png/webp)
   * @param {File}   opts.productImage - ảnh sản phẩm (áo/quần/váy/phụ kiện)
   * @param {File}   opts.motionVideo  - video motion (mp4/mov)
   * @param {string} opts.garmentType  - 'auto'|'upper'|'lower'|'skirt'|'dress'|'set'|'bikini'|'bra'|'lingerie'|'shoes'|'accessory'
   * @param {string} opts.preset       - '30s-720p' | '30s-1080p' | '30s-hq'
   * @param {object} opts.params       - { save_intermediate, stop_after_tryon, lora_relight, ... }
   */
  async function create({ modelImage, productImage, motionVideo, garmentType = 'auto', preset = '15s-720p', params = {} } = {}) {
    if (!modelImage)   throw new Error('modelImage là bắt buộc')
    if (!productImage) throw new Error('productImage là bắt buộc')
    if (!motionVideo)  throw new Error('motionVideo là bắt buộc')

    const fd = new FormData()
    fd.append('model_image', modelImage)
    fd.append('product_image', productImage)
    fd.append('motion_video', motionVideo)
    fd.append('garment_type', garmentType)
    fd.append('preset', preset)
    if (params && Object.keys(params).length) fd.append('params', JSON.stringify(params))
    return await auth.beFetch(base, { method: 'POST', body: fd })
  }

  async function get(id) {
    return await auth.beFetch(`${base}/${encodeURIComponent(id)}`)
  }

  async function cancel(id) {
    return await auth.beFetch(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  async function list({ page = 1, limit = 20, status = '', userId = '' } = {}) {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    if (status) p.set('status', status)
    if (userId) p.set('userId', userId)
    return await auth.beFetch(`${base}?${p.toString()}`)
  }

  function poll(id, { onUpdate, onDone, intervalMs = 2000 } = {}) {
    let stopped = false
    let timer = null
    async function tick() {
      if (stopped) return
      try {
        const snap = await get(id)
        if (stopped) return
        onUpdate?.(snap)
        if (snap?.status && snap.status !== 'queued' && snap.status !== 'running') {
          stopped = true
          onDone?.(snap)
          return
        }
      } catch (err) {
        if (stopped) return
        console.warn('[fashion-motion-jobs] poll error:', err)
      }
      timer = setTimeout(tick, intervalMs)
    }
    tick()
    return { stop: () => { stopped = true; if (timer) { clearTimeout(timer); timer = null } } }
  }

  // Garment types — quyết định prompt Qwen-Image-Edit ở worker (build_qwen_tryon_workflow).
  // ALD 01/06/2026 - 10 loại + Auto. Trùng GARMENT_TYPES_VALID (worker.py) + InspectorTryon.vue.
  // 'auto' = vision (Ollama) tự nhận loại đồ; các loại khác = ép thủ công.
  const GARMENT_TYPES = [
    { id: 'auto',      label: 'Auto ✨',          icon: 'bi-magic',            hint: 'Để vision (Ollama) tự nhận loại đồ từ ảnh sản phẩm' },
    { id: 'upper',     label: 'Áo / Top',          icon: 'bi-person-fill',      hint: 'Áo sơ mi, t-shirt, áo khoác (chỉ phần trên)' },
    { id: 'lower',     label: 'Quần',              icon: 'bi-person-walking',   hint: 'Quần dài, short, jeans' },
    { id: 'skirt',     label: 'Chân váy',          icon: 'bi-triangle',         hint: 'Chân váy rời (chỉ phần dưới, không liền áo)' },
    { id: 'dress',     label: 'Váy / Đầm liền',    icon: 'bi-person-arms-up',   hint: 'Váy liền, đầm, jumpsuit (1 mảnh trên+dưới)' },
    { id: 'set',       label: 'Set / Đồ bộ',       icon: 'bi-bag-check',        hint: 'Bộ phối 2 mảnh mặc ngoài (áo + quần/chân váy)' },
    { id: 'bikini',    label: 'Bikini / Đồ bơi',   icon: 'bi-water',            hint: 'Bộ 2 mảnh đồ bơi — thay CẢ áo lẫn quần' },
    { id: 'bra',       label: 'Bra / Áo lót',      icon: 'bi-suit-heart',       hint: 'Áo lót/bra lẻ (1 mảnh phần trên)' },
    { id: 'lingerie',  label: 'Đồ lót bộ',         icon: 'bi-suit-heart-fill',  hint: 'Đồ lót bộ 2 mảnh (áo lót + quần lót)' },
    { id: 'shoes',     label: 'Giày / Dép',        icon: 'bi-disc',             hint: 'Giày, dép, sandal, cao gót, boot — chỉ thay phần chân' },
    { id: 'accessory', label: 'Phụ kiện',          icon: 'bi-bag-heart-fill',   hint: 'Mũ, túi, khăn, kính, thắt lưng, trang sức' }
  ]

  // Preset — match worker MOTION_PRESETS (linux.py). ALD 11/06/2026 - dọn còn 5 lựa chọn (480p nhẹ RAM/nhanh).
  const PRESETS = [
    { id: '10s-480p',  label: '10s · 480p (nhanh)', resolution: '480x848',  frames: 161, steps: 4, eta: '2-3 min',  note: 'Nhẹ nhất — nhanh, ít RAM' },
    { id: '15s-720p',  label: '15s · 720p',         resolution: '720x1280', frames: 241, steps: 4, eta: '3-4 min',  note: 'Recommended' },
    { id: '15s-1080p', label: '15s · 1080p',        resolution: '720x1280', frames: 241, steps: 6, eta: '6-9 min',  note: 'Chất lượng cao' },
    { id: '30s-480p',  label: '30s · 480p',         resolution: '480x848',  frames: 481, steps: 4, eta: '5-8 min',  note: '30s nhẹ — 480p, ít RAM' },
    { id: '30s-720p',  label: '30s · 720p',         resolution: '720x1280', frames: 481, steps: 4, eta: '8-12 min', note: '30s — nặng, render lâu' }
  ]

  return { create, get, cancel, list, poll, GARMENT_TYPES, PRESETS }
}
// #endregion
