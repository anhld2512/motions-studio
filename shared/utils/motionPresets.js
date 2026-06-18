// #region ALD 31/05/2026 - Preset motion dùng chung FE (dropdown) + server proxy (đổi preset → params).
// motion-backend worker đọc params cụ thể (width/height/frames/steps/lora_relight…) chứ KHÔNG hiểu
// "preset", nên proxy phải expand preset → params trước khi POST /jobs.
// ALD 11/06/2026 - dọn còn 5 lựa chọn (khớp worker MOTION_PRESETS). 480p nhẹ RAM/nhanh (an toàn box RAM sát ngưỡng).
// ALD 16/06/2026 - ĐÃ BỎ 1080p + 60fps (theo yêu cầu). Cấu hình: 10s-480p · 10s-720p · 15s-720p (nhanh, distill)
// + 8s-720p-max (CHẤT LƯỢNG TỐI ĐA: 30fps NATIVE + 20 steps + non-distill + cfg≈1, đúng doc Wan2.2-Animate).
// maxFps = trần nội suy RIFE (≤30 sau khi bỏ 60). Preset MAX render native 30fps nên KHÔNG có toggle RIFE (maxFps:16 ẩn).
export const MOTION_PRESETS = [
  { id: '10s-480p',   label: '10s · 480p',         resolution: '480x848',  frames: 161, steps: 4,  eta: '2-3 min',  maxFps: 30, note: 'Nhẹ nhất' },
  { id: '10s-720p',   label: '10s · 720p',         resolution: '720x1280', frames: 161, steps: 4,  eta: '2-3 min',  maxFps: 30, note: 'Nhanh' },
  { id: '15s-720p',   label: '15s · 720p',         resolution: '720x1280', frames: 241, steps: 4,  eta: '3-4 min',  maxFps: 16, note: '16fps (15s)' },
  { id: '8s-720p-max', label: '8s · 720p · Tốt nhất', resolution: '720x1280', frames: 241, steps: 20, eta: '15-25 min', maxFps: 16, note: '30fps native · nét & mượt nhất (chậm)' }
]

// preset id → params cụ thể cho worker (width/height/frames/steps + lora_relight nếu preset HQ).
export function presetToParams(presetId) {
  const p = MOTION_PRESETS.find((x) => x.id === presetId) || MOTION_PRESETS[0]
  const [w, h] = String(p.resolution || '720x1280').split('x').map((n) => parseInt(n, 10) || 0)
  const out = { width: w || 720, height: h || 1280, frames: p.frames, steps: p.steps }
  if (p.lora_relight != null) out.lora_relight = p.lora_relight
  return out
}
// #endregion
