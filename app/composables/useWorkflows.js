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

  return { items, loading, load, get, create, update, remove, invoke, test, listRuns, getRun, getAsset }
}
// #endregion
