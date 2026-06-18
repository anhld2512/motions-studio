// #region ALD 18/06/2026 - motions-studio: workflow CRUD chạy HOÀN TOÀN FE (localStorage / Neon qua [[useLocalDb]]).
// Bỏ mọi gọi motion-backend. Giữ NGUYÊN surface cũ để các page/component không phải sửa:
//   items, loading, load(), get(id), create(payload), update(id,patch), remove(id),
//   invoke(slug,input), test(id,def,input,opts), listRuns(id), getRun(runId), getAsset()
// Thực thi workflow (invoke/test gọi provider thẳng từ browser) = phase "decouple" kế tiếp — tạm ghi 1 run rồi báo.
export function useWorkflows() {
  const db = useLocalDb()
  const items = useState('workflows.items', () => [])
  const loading = useState('workflows.loading', () => false)

  const _uuid = () => (import.meta.client && crypto.randomUUID ? crypto.randomUUID() : 'wf_' + Math.random().toString(36).slice(2))
  const _slugify = (s) => String(s || 'workflow').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'workflow'

  async function load() {
    loading.value = true
    try {
      const rows = await db.list('workflows')
      items.value = (rows || []).filter((w) => w?.is_active !== false)
    } finally {
      loading.value = false
    }
  }

  async function get(id) {
    return await db.get('workflows', id)
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
    for (const s of STARTERS) await create(s)
  }
  // #endregion

  return { items, loading, load, get, create, update, remove, invoke, test, listRuns, getRun, getAsset, seedStarters }
}
// #endregion
