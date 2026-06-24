// #region ALD 18/06/2026 - motions-studio: workflow CRUD chạy HOÀN TOÀN FE (localStorage / Neon qua [[useLocalDb]]).
// Bỏ mọi gọi motion-backend. Giữ NGUYÊN surface cũ để các page/component không phải sửa:
//   items, loading, load(), get(id), create(payload), update(id,patch), remove(id),
//   invoke(slug,input), test(id,def,input,opts), listRuns(id), getRun(runId), getAsset()
// Thực thi workflow (invoke/test gọi provider thẳng từ browser) = phase "decouple" kế tiếp — tạm ghi 1 run rồi báo.
export function useWorkflows() {
  const db = useLocalDb()
  const auth = useAuth()
  const items = useState('workflows.items', () => [])
  const loading = useState('workflows.loading', () => false)

  const _uuid = () => (import.meta.client && crypto.randomUUID ? crypto.randomUUID() : 'wf_' + Math.random().toString(36).slice(2))
  const _slugify = (s) => String(s || 'workflow').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'workflow'
  function _ownerEmail() {
    const fromState = auth.user.value?.email
    const fromToken = decodeJwtPayload(auth.token.value)?.email
    return String(fromState || fromToken || 'local').trim().toLowerCase()
  }
  function _workflowRow(row) {
    if (!row) return null
    const owner = String(row.owner_email || '').trim().toLowerCase()
    return { ...row, owned: !owner || owner === _ownerEmail() }
  }
  const _visibleForMe = (row) => !row?.owner_email || String(row.owner_email).trim().toLowerCase() === _ownerEmail()

  function _singerDefinition() {
    const cleanPrompt = 'Clean and normalize this model image before motion transfer: keep the same person, face, outfit, pose and full-body framing; remove artifacts, improve lighting, keep a realistic studio/fashion look.'
    const motionPrompt = 'Apply the provided driving motion segment to the cleaned model image. Keep identity, outfit, and framing stable. Smooth realistic fashion motion, vertical 9:16.'
    const nodes = [
      { id: 'singer-model-1', type: 'input', position: { x: 60, y: 40 }, data: { config: { contentType: 'image', source: 'session', field: 'model1', label: 'Model 1' } } },
      { id: 'singer-model-2', type: 'input', position: { x: 60, y: 260 }, data: { config: { contentType: 'image', source: 'session', field: 'model2', label: 'Model 2' } } },
      { id: 'singer-model-3', type: 'input', position: { x: 60, y: 480 }, data: { config: { contentType: 'image', source: 'session', field: 'model3', label: 'Model 3' } } },
      { id: 'singer-driver', type: 'input', position: { x: 60, y: 700 }, data: { config: { contentType: 'video', source: 'session', field: 'motion', label: 'Video motion 15s' } } },
      { id: 'singer-tryon-1', type: 'tryon', position: { x: 390, y: 40 }, data: { config: { garmentType: 'auto', productCount: 1, prompt: cleanPrompt, _gen: 'singer', _stage: 1 } } },
      { id: 'singer-tryon-2', type: 'tryon', position: { x: 390, y: 260 }, data: { config: { garmentType: 'auto', productCount: 1, prompt: cleanPrompt, _gen: 'singer', _stage: 2 } } },
      { id: 'singer-tryon-3', type: 'tryon', position: { x: 390, y: 480 }, data: { config: { garmentType: 'auto', productCount: 1, prompt: cleanPrompt, _gen: 'singer', _stage: 3 } } },
      { id: 'singer-motion-1', type: 'motion', position: { x: 720, y: 40 }, data: { config: { prompt: motionPrompt, preset: '5s-720p', aspectRatio: '9:16', duration: 5, resolution: '720p', driverStartSec: 0, driverDurSec: 5, _gen: 'singer', _stage: 1 } } },
      { id: 'singer-motion-2', type: 'motion', position: { x: 720, y: 260 }, data: { config: { prompt: motionPrompt, preset: '5s-720p', aspectRatio: '9:16', duration: 5, resolution: '720p', driverStartSec: 5, driverDurSec: 5, _gen: 'singer', _stage: 2 } } },
      { id: 'singer-motion-3', type: 'motion', position: { x: 720, y: 480 }, data: { config: { prompt: motionPrompt, preset: '5s-720p', aspectRatio: '9:16', duration: 5, resolution: '720p', driverStartSec: 10, driverDurSec: 5, _gen: 'singer', _stage: 3 } } },
      { id: 'singer-concat', type: 'concat', position: { x: 1060, y: 260 }, data: { config: { clipCount: 3, transition: 'cut', fps: 25, _gen: 'singer' } } },
      { id: 'singer-output', type: 'output', position: { x: 1400, y: 260 }, data: { config: { format: 'video', _gen: 'singer' } } }
    ]
    const edges = [
      { id: 'singer-e1', source: 'singer-model-1', target: 'singer-tryon-1', targetHandle: 'model' },
      { id: 'singer-e2', source: 'singer-model-2', target: 'singer-tryon-2', targetHandle: 'model' },
      { id: 'singer-e3', source: 'singer-model-3', target: 'singer-tryon-3', targetHandle: 'model' },
      { id: 'singer-e4', source: 'singer-tryon-1', target: 'singer-motion-1', targetHandle: 'image' },
      { id: 'singer-e5', source: 'singer-tryon-2', target: 'singer-motion-2', targetHandle: 'image' },
      { id: 'singer-e6', source: 'singer-tryon-3', target: 'singer-motion-3', targetHandle: 'image' },
      { id: 'singer-e7', source: 'singer-driver', target: 'singer-motion-1', targetHandle: 'motion' },
      { id: 'singer-e8', source: 'singer-driver', target: 'singer-motion-2', targetHandle: 'motion' },
      { id: 'singer-e9', source: 'singer-driver', target: 'singer-motion-3', targetHandle: 'motion' },
      { id: 'singer-e10', source: 'singer-motion-1', target: 'singer-concat', targetHandle: 'clip1' },
      { id: 'singer-e11', source: 'singer-motion-2', target: 'singer-concat', targetHandle: 'clip2' },
      { id: 'singer-e12', source: 'singer-motion-3', target: 'singer-concat', targetHandle: 'clip3' },
      { id: 'singer-e13', source: 'singer-concat', target: 'singer-output' }
    ]
    return { nodes, edges }
  }

  function _needsSingerRepair(row) {
    if (!row || String(row.slug || '').toLowerCase() !== 'singer') return false
    const def = row.definition || {}
    const nodes = Array.isArray(def.nodes) ? def.nodes : []
    if (nodes.some((n) => n?.data?.config?._gen === 'singer')) return false
    const hasWrongVideoNode = nodes.some((n) => ['ss', 'wan-i2v'].includes(n?.type))
    const hasMotion5s = nodes.some((n) => n?.type === 'motion' && Number(n?.data?.config?.duration) === 5)
    const tryonCount = nodes.filter((n) => n?.type === 'tryon').length
    return hasWrongVideoNode || !hasMotion5s || tryonCount < 3
  }

  async function _repairSingerWorkflows(rows) {
    const targets = (rows || []).filter(_needsSingerRepair)
    if (!targets.length) return rows
    for (const row of targets) {
      await db.put('workflows', {
        ...row,
        definition: _singerDefinition(),
        updated_at: new Date().toISOString()
      })
    }
    return await db.list('workflows')
  }

  async function load() {
    loading.value = true
    try {
      let rows = await db.list('workflows')
      rows = await _repairSingerWorkflows(rows)
      items.value = (rows || []).filter(_visibleForMe).map(_workflowRow).filter((w) => w?.is_active !== false)
    } finally {
      loading.value = false
    }
  }

  async function get(id) {
    let row = await db.get('workflows', id)
    if (_needsSingerRepair(row)) {
      row = { ...row, definition: _singerDefinition(), updated_at: new Date().toISOString() }
      await db.put('workflows', row)
    }
    return _visibleForMe(row) ? _workflowRow(row) : null
  }

  // payload: { slug?, name, description?, definition?, is_active? }
  async function create(payload = {}) {
    const row = {
      id: _uuid(),
      slug: payload.slug || _slugify(payload.name),
      name: payload.name || 'Workflow mới',
      description: payload.description || '',
      definition: payload.definition || { nodes: [], edges: [] },
      is_active: payload.is_active !== false,
      owner_email: _ownerEmail(),
      owned: true,
      created_at: new Date().toISOString()
    }
    await db.put('workflows', row)
    await load()
    return row
  }

  async function update(id, patch = {}) {
    const cur = await db.get('workflows', id)
    if (!cur) throw new Error('Workflow không tồn tại')
    const row = { ...cur, ...patch, id, updated_at: new Date().toISOString() }
    await db.put('workflows', row)
    await load()
    return row
  }

  async function remove(id) {
    const runs = await db.list('workflow_runs')
    for (const r of (runs || []).filter((row) => row.workflow_id === id)) {
      await db.remove('workflow_runs', r.id)
    }
    await db.remove('workflows', id)
    await load()
  }

  // ── Thực thi: ghi 1 run record rồi KHỞI ĐỘNG engine client (browser→provider) chạy nền. ──
  // Editor poll getRun(run_id) → thấy events/status/output cập nhật dần. Không await engine ở đây.
  async function _kickRun(workflowId, definition, input) {
    const run = {
      id: _uuid(),
      workflow_id: workflowId || '',
      status: 'running',
      input: input || {},
      definition: definition || { nodes: [], edges: [] },   // engine đọc graph từ đây (cũng là snapshot read-only của editor)
      output: {},
      events: [{ ts: new Date().toISOString(), level: 'info', msg: 'Bắt đầu chạy…' }],
      created_at: new Date().toISOString()
    }
    await db.put('workflow_runs', run)
    if (import.meta.client) {
      // fire-and-forget: engine tự cập nhật run record. Lỗi engine đã được nuốt bên trong (ghi status='error').
      useWorkflowEngine().run(run.id).catch((e) => console.warn('[engine] run error:', e))
    }
    return run
  }

  async function invoke(slug, input = {}) {
    const wf = (await db.list('workflows')).find((w) => w.slug === slug)
    const run = await _kickRun(wf?.id, wf?.definition, input)
    return { run_id: run.id, status: run.status }
  }

  async function test(id, definition, input = {}, _opts = {}) {
    const run = await _kickRun(id, definition, input)
    return { run_id: run.id, status: run.status, poll_url: `local:workflow_runs/${run.id}` }
  }

  async function listRuns(id) {
    const rows = await db.list('workflow_runs')
    return (rows || []).filter((r) => r.workflow_id === id)
  }

  async function getRun(runId) {
    return await db.get('workflow_runs', runId)
  }

  // FE-only: asset = data URL / object URL nằm thẳng trong definition → không cần resolver server.
  async function getAsset() { return null }

  // #region ALD 18/06/2026 - 3 workflow MẪU sẵn để user bấm vào dùng ngay (seed 1 lần vào store).
  const STARTERS = [
    {
      slug: 'tao-anh', name: 'Tạo ảnh', description: 'Nhập mô tả → AI sinh ảnh (nhóm Tạo/sửa ảnh).',
      definition: {
        nodes: [
          { id: 'ci', type: 'create-image', position: { x: 80, y: 120 }, data: { config: { prompt: 'A clean cinematic product photo, premium studio lighting, high detail, photorealistic', inputCount: 0 } } },
          { id: 'out', type: 'output', position: { x: 480, y: 120 }, data: { config: { format: 'image' } } }
        ],
        edges: [{ id: 'e1', source: 'ci', target: 'out' }]
      }
    },
    {
      slug: 'motion-control', name: 'Motion Control', description: 'Ảnh người mẫu + video chuyển động → video (nhóm Tạo video).',
      definition: {
        nodes: [
          { id: 'in-model', type: 'input', position: { x: 60, y: 60 }, data: { config: { contentType: 'image', source: 'static', label: 'Ảnh người mẫu' } } },
          { id: 'in-motion', type: 'input', position: { x: 60, y: 280 }, data: { config: { contentType: 'video', source: 'static', label: 'Video chuyển động' } } },
          { id: 'm', type: 'motion', position: { x: 440, y: 160 }, data: { config: { preset: '15s-720p', aspectRatio: '9:16' } } },
          { id: 'out', type: 'output', position: { x: 820, y: 160 }, data: { config: { format: 'video' } } }
        ],
        edges: [
          { id: 'e1', source: 'in-model', target: 'm', targetHandle: 'image' },
          { id: 'e2', source: 'in-motion', target: 'm', targetHandle: 'motion' },
          { id: 'e3', source: 'm', target: 'out' }
        ]
      }
    },
    {
      slug: 'thay-do-motion', name: 'Thay đồ cho mẫu + Motion', description: 'Mặc sản phẩm lên người mẫu (try-on) rồi tạo video chuyển động.',
      definition: {
        nodes: [
          { id: 'in-model', type: 'input', position: { x: 40, y: 40 }, data: { config: { contentType: 'image', source: 'static', label: 'Ảnh người mẫu' } } },
          { id: 'in-product', type: 'input', position: { x: 40, y: 240 }, data: { config: { contentType: 'image', source: 'static', label: 'Ảnh sản phẩm' } } },
          { id: 'in-motion', type: 'input', position: { x: 40, y: 440 }, data: { config: { contentType: 'video', source: 'static', label: 'Video chuyển động' } } },
          { id: 't', type: 'tryon', position: { x: 400, y: 120 }, data: { config: { garmentType: 'upper', productCount: 1 } } },
          { id: 'm', type: 'motion', position: { x: 760, y: 260 }, data: { config: { preset: '15s-720p', aspectRatio: '9:16' } } },
          { id: 'out', type: 'output', position: { x: 1120, y: 260 }, data: { config: { format: 'video' } } }
        ],
        edges: [
          { id: 'e1', source: 'in-model', target: 't', targetHandle: 'model' },
          { id: 'e2', source: 'in-product', target: 't', targetHandle: 'product' },
          { id: 'e3', source: 't', target: 'm', targetHandle: 'image' },
          { id: 'e4', source: 'in-motion', target: 'm', targetHandle: 'motion' },
          { id: 'e5', source: 'm', target: 'out' }
        ]
      }
    }
  ]
  const SEED_FLAG = 'ms.seeded.starters.v1'
  async function seedStarters() {
    if (!import.meta.client) return
    if (localStorage.getItem(SEED_FLAG)) return   // seed 1 lần (xoá rồi thì không tạo lại)
    localStorage.setItem(SEED_FLAG, '1')
    const { $i18n } = useNuxtApp()
    for (const s of STARTERS) {
      await create({
        ...s,
        name: $i18n.t(`starters.${_starterKey(s.slug)}Name`),
        description: $i18n.t(`starters.${_starterKey(s.slug)}Desc`)
      })
    }
  }
  // map slug → camelCase i18n key prefix (giữ slug literal, chỉ dịch name/description)
  const _starterKey = (slug) => ({
    'tao-anh': 'taoAnh',
    'motion-control': 'motionControl',
    'thay-do-motion': 'thayDoMotion'
  })[slug] || slug
  // #endregion

  return { items, loading, load, get, create, update, remove, invoke, test, listRuns, getRun, getAsset, seedStarters }
}
// #endregion
