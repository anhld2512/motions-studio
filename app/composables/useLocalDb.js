// #region ALD 18/06/2026 - Lớp lưu trữ motions-studio (FE-only, KHÔNG backend riêng).
// 2 backend, chọn ở Settings → Dữ liệu:
//   • 'local' (mặc định): JSON trong localStorage — chạy ngay, không cần cấu hình gì.
//   • 'neon' : Postgres-over-HTTP (driver @neondatabase/serverless chạy thẳng trong browser).
//             User dán 1 URL postgres:// của Neon → bấm "Đồng bộ" → tạo bảng (CREATE TABLE IF NOT EXISTS)
//             + đẩy dữ liệu local hiện có lên → từ đó đọc/ghi trực tiếp DB.
// (Trình duyệt KHÔNG mở được Postgres TCP thường; Neon expose SQL-over-HTTP nên browser gọi được.)
//
// Collections: workflows, workflow_runs, app_settings. API chung: list/get/put/remove — tự dispatch theo mode.

const CFG_KEY = 'ms.db.config.v1'
const LS_COLL = 'ms.coll.'           // localStorage: 1 mảng JSON / collection

// Schema cho Neon (idempotent). Mọi bảng dùng id text (uuid do FE sinh) + jsonb cho dữ liệu lồng.
const SCHEMA = {
  workflows: `CREATE TABLE IF NOT EXISTS workflows (
    id text PRIMARY KEY, slug text, name text, description text,
    definition jsonb DEFAULT '{}'::jsonb, is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
  )`,
  workflow_runs: `CREATE TABLE IF NOT EXISTS workflow_runs (
    id text PRIMARY KEY, workflow_id text, status text,
    input jsonb DEFAULT '{}'::jsonb, output jsonb DEFAULT '{}'::jsonb, events jsonb DEFAULT '[]'::jsonb,
    definition jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now()
  )`,
  app_settings: `CREATE TABLE IF NOT EXISTS app_settings (
    key text PRIMARY KEY, value jsonb
  )`
}
const COLLECTIONS = Object.keys(SCHEMA)

let _sqlPromise = null   // cache neon sql() theo url

async function _getSql(url) {
  if (!url) throw new Error('Chưa có URL database')
  if (_sqlPromise && _sqlPromise._url === url) return _sqlPromise
  // dynamic import: chỉ nạp driver khi thật sự dùng neon (không ảnh hưởng build/SSR).
  const mod = await import('@neondatabase/serverless')
  const sql = mod.neon(url)
  const p = Promise.resolve(sql)
  p._url = url
  _sqlPromise = p
  return p
}

export function useLocalDb() {
  const cfg = useState('ms-db-config', () => ({ mode: 'local', url: '', synced: false }))
  const loaded = useState('ms-db-config-loaded', () => false)

  function _load() {
    if (loaded.value || !import.meta.client) return
    try { cfg.value = { mode: 'local', url: '', synced: false, ...(JSON.parse(localStorage.getItem(CFG_KEY) || '{}')) } } catch {}
    loaded.value = true
  }
  function _saveCfg() { if (import.meta.client) localStorage.setItem(CFG_KEY, JSON.stringify(cfg.value)) }

  const isNeon = () => { _load(); return cfg.value.mode === 'neon' && !!cfg.value.url && cfg.value.synced }

  // ── localStorage backend ──
  const MAX_RUNS = 30   // chỉ giữ N run gần nhất trong localStorage (tránh phình quota)
  function _lsAll(coll) {
    try { return JSON.parse(localStorage.getItem(LS_COLL + coll) || '[]') } catch { return [] }
  }
  const _byNewest = (a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
  // Bỏ field nặng khỏi run (giữ lại preview ref nhẹ idb://… / URL) để cứu quota.
  function _slimRun(r) {
    const meta = r.output?.metadata || {}
    const slimMeta = { image: meta.image, images: meta.images, video: meta.video, audio: meta.audio, text: typeof meta.text === 'string' ? meta.text.slice(0, 2000) : meta.text }
    return { ...r, definition: undefined, events: (r.events || []).slice(-8).map((e) => ({ ts: e.ts, level: e.level, msg: e.msg })), output: { ...(r.output || {}), metadata: slimMeta } }
  }
  function _lsWrite(coll, rows) {
    // Cap số run mới nhất trước khi ghi.
    let data = rows
    if (coll === 'workflow_runs') data = rows.slice().sort(_byNewest).slice(0, MAX_RUNS)
    try {
      localStorage.setItem(LS_COLL + coll, JSON.stringify(data))
      return
    } catch (err) {
      if (coll !== 'workflow_runs') throw err
      // Quota: thử các mức cứu dần — slim run cũ → cắt còn ít run → slim hết.
      const sorted = data.slice().sort(_byNewest)
      const attempts = [
        sorted.map((r, i) => (i < 5 ? r : _slimRun(r))),
        sorted.slice(0, 12).map((r, i) => (i < 3 ? r : _slimRun(r))),
        sorted.slice(0, 6).map(_slimRun),
        sorted.slice(0, 3).map(_slimRun)
      ]
      for (const att of attempts) {
        try { localStorage.setItem(LS_COLL + coll, JSON.stringify(att)); return } catch { /* thử mức nhỏ hơn */ }
      }
      // Bó tay: xoá sạch run để app không kẹt (file output vẫn nằm IndexedDB).
      try { localStorage.setItem(LS_COLL + coll, '[]') } catch {}
    }
  }

  // ── public API (async, dispatch theo mode) ──
  async function list(coll) {
    _load()
    if (isNeon()) {
      const sql = await _getSql(cfg.value.url)
      return await sql(`SELECT * FROM ${coll} ORDER BY created_at DESC`)
    }
    return _lsAll(coll)
  }

  async function get(coll, id) {
    _load()
    if (isNeon()) {
      const sql = await _getSql(cfg.value.url)
      const rows = await sql(`SELECT * FROM ${coll} WHERE id = $1`, [id])
      return rows[0] || null
    }
    return _lsAll(coll).find((r) => r.id === id) || null
  }

  // Upsert theo id. row.id bắt buộc.
  async function put(coll, row) {
    _load()
    if (isNeon()) {
      const sql = await _getSql(cfg.value.url)
      await _neonUpsert(sql, coll, row)
      return row
    }
    const rows = _lsAll(coll)
    const idx = rows.findIndex((r) => r.id === row.id)
    if (idx >= 0) rows[idx] = { ...rows[idx], ...row }
    else rows.unshift(row)
    _lsWrite(coll, rows)
    return row
  }

  async function remove(coll, id) {
    _load()
    if (isNeon()) {
      const sql = await _getSql(cfg.value.url)
      await sql(`DELETE FROM ${coll} WHERE id = $1`, [id])
      return
    }
    _lsWrite(coll, _lsAll(coll).filter((r) => r.id !== id))
  }

  // Upsert tường minh theo từng bảng (cột cố định → tránh SQL injection từ key động).
  async function _neonUpsert(sql, coll, r) {
    if (coll === 'workflows') {
      await sql(
        `INSERT INTO workflows (id, slug, name, description, definition, is_active, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6, now())
         ON CONFLICT (id) DO UPDATE SET slug=$2, name=$3, description=$4, definition=$5, is_active=$6, updated_at=now()`,
        [r.id, r.slug || '', r.name || '', r.description || '', JSON.stringify(r.definition || {}), r.is_active !== false]
      )
    } else if (coll === 'workflow_runs') {
      await sql(
        `INSERT INTO workflow_runs (id, workflow_id, status, input, output, events, definition)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET status=$3, input=$4, output=$5, events=$6, definition=$7`,
        [r.id, r.workflow_id || '', r.status || 'success', JSON.stringify(r.input || {}), JSON.stringify(r.output || {}), JSON.stringify(r.events || []), JSON.stringify(r.definition || {})]
      )
    } else if (coll === 'app_settings') {
      await sql(
        `INSERT INTO app_settings (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value=$2`,
        [r.id, JSON.stringify(r.value ?? {})]
      )
    }
  }

  // ── cấu hình + đồng bộ ──
  // Kiểm tra kết nối: chạy 1 query nhẹ.
  async function testConnection(url) {
    const sql = await _getSql(url)
    await sql('SELECT 1 AS ok')
    return true
  }

  // "Đồng bộ": tạo schema trong DB rỗng + đẩy toàn bộ dữ liệu local hiện có lên, rồi chuyển sang mode neon.
  async function sync(url) {
    _load()
    const sql = await _getSql(url)
    for (const coll of COLLECTIONS) await sql(SCHEMA[coll])      // CREATE TABLE IF NOT EXISTS
    // push dữ liệu local → remote (idempotent upsert)
    let pushed = 0
    for (const coll of COLLECTIONS) {
      for (const row of _lsAll(coll)) { await _neonUpsert(sql, coll, row); pushed++ }
    }
    cfg.value = { mode: 'neon', url, synced: true }
    _saveCfg()
    return { pushed }
  }

  function useLocalMode() {
    _load()
    cfg.value = { ...cfg.value, mode: 'local', synced: false }
    _saveCfg()
  }

  function setUrl(url) { _load(); cfg.value = { ...cfg.value, url } ; _saveCfg() }

  return { cfg, COLLECTIONS, isNeon, list, get, put, remove, testConnection, sync, useLocalMode, setUrl, load: _load }
}
// #endregion
