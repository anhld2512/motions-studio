# Motions Studio

**AI Workflow Studio chạy hoàn toàn trên trình duyệt (FE-only).** Kéo–thả node để dựng pipeline sáng tạo: tạo ảnh, ảnh→video, điều khiển chuyển động, thử đồ, lồng tiếng, phụ đề… Mọi lệnh AI gọi **thẳng tới API provider đám mây** bằng key của chính bạn — **không có backend riêng, không server trung gian**.

> EN: A 100% front-end AI workflow studio. Drag-and-drop nodes to build creative pipelines (image / video / motion / try-on / voice / subtitle). All AI calls go directly from the browser to your cloud provider using your own API keys — no backend.

---

## Nhiệm vụ & Vấn đề giải quyết

### Vấn đề
Các pipeline sáng tạo AI (tạo ảnh, ảnh→video, motion control, lip-sync…) thường đòi hỏi **hạ tầng nặng**: GPU riêng, ComfyUI/Wan, hàng đợi job, Supabase, worker… Hệ quả:

- **Khó triển khai & bảo trì** — phải có DevOps, server, GPU; một GPU phải gánh nhiều tác vụ → **tranh chấp tài nguyên, cold-start, độ trễ**.
- **Khó dùng cho người không kỹ thuật** — muốn thử 1 ý tưởng cũng phải dựng cả backend.
- **Khoá cứng vào 1 mô hình/nhà cung cấp**, khó đổi qua lại giữa các model mới (Nano Banana, Kling, Veo…).
- **Lo ngại dữ liệu** — ảnh/video/khoá API đi qua server trung gian.

### Nhiệm vụ
Motions Studio **tách rời phần sáng tạo khỏi hạ tầng**: đưa toàn bộ pipeline về **một ứng dụng chạy thẳng trên trình duyệt**, ai cũng dùng được ngay mà **không cần backend, không cần GPU, không cần DevOps**.

### Cách giải quyết
- **FE-only + Bring-your-own-key**: gọi thẳng API provider đám mây bằng key của bạn → triển khai chỉ là **host file tĩnh**; không vận hành server.
- **Trung lập nhà cung cấp**: gắn provider/model theo nhóm năng lực, đổi giữa OpenAI / Gemini / fal.ai (Kling/Runway/Luma) / Replicate… trong vài giây.
- **Dữ liệu thuộc về bạn**: workflow & file nằm trong **trình duyệt** (localStorage / IndexedDB), khoá API **mã hoá** cục bộ; chỉ đẩy lên Neon/Supabase **khi bạn chủ động cấu hình**.
- **Hạ rào cản**: kéo–thả node, template sẵn, song ngữ VI/EN — người không kỹ thuật vẫn dựng được pipeline.
- **Đường nâng cấp rõ ràng**: cần dùng **không giới hạn / riêng tư tuyệt đối** thì chuyển sang **bản self-host** (xem mục Self-host bên dưới).

### Đối tượng
Marketing, studio nội dung, nhà bán hàng, designer… cần **ra ảnh/video sản phẩm nhanh** mà không muốn dựng hạ tầng AI.

---

## Tính năng chính

- **Canvas workflow** kéo–thả (Vue Flow): nối node thành pipeline, chạy ngay trong trình duyệt.
- **Provider đám mây theo NHÓM năng lực** — gắn 1 lần cho cả nhóm (Tạo ảnh / Tạo video / Giọng nói / Nhận dạng / Văn bản), hoặc gắn riêng trên từng node.
- **Nhiều nhà cung cấp dựng sẵn** (điền sẵn base URL + model): OpenAI · Claude · **Google Gemini (Nano Banana / Nano Banana Pro)** · Grok (xAI) · DeepSeek · Mistral · Groq · OpenRouter · Together · **fal.ai (Kling / Runway / Luma / Minimax / Flux / Veo)** · Replicate · ElevenLabs · Custom.
- **Model: chọn dropdown hoặc tự gõ** — đổi provider & model ngay trên node.
- **API key mã hoá** (AES-GCM, khoá không trích xuất nằm trong IndexedDB) — không lộ ra localStorage dạng thô.
- **Lưu trữ linh hoạt (FE-only):**
  - Workflow/run: **localStorage** (mặc định) hoặc **Neon** (Postgres-over-HTTP) — bấm "Đồng bộ" tự tạo bảng.
  - File output (ảnh/video/audio): **IndexedDB** (mặc định) hoặc **Supabase Storage** (nếu cấu hình → URL công khai, share được).
- **Giám sát** job đang chạy + trang **Báo cáo** (donut trạng thái, 7 ngày, top workflow…).
- **Song ngữ VI ⇄ EN** — 1 nút trên header (i18n, nhớ qua cookie).
- **Chạy song song không giới hạn số luồng.**

---

## Khởi chạy (dev)

```bash
npm install
npm run dev        # http://localhost:2031
npm run build      # build production (SPA tĩnh, deploy Cloudflare Pages / Netlify / bất kỳ static host)
npm run preview
```

Không cần `.env`, không cần backend. Mở app → vào **Cài đặt** để gắn provider là dùng được.

---

## Hướng dẫn sử dụng

### 1. Chọn ngôn ngữ
Bấm nút **VI / EN** trên thanh header để đổi toàn bộ giao diện.

### 2. Gắn Provider (Cài đặt → **Provider**)
1. Bấm 1 **preset** (OpenAI / Gemini / Claude / fal.ai…) → tự điền base URL + model.
2. **Dán API key** (được mã hoá khi lưu).
3. Ở mỗi **nhóm năng lực** (Tạo ảnh / Tạo video / Giọng nói / Nhận dạng / Văn bản) chọn provider + **model** (dropdown hoặc tự gõ).
   - Ảnh đẹp của Google: chọn Gemini → model **Nano Banana** (`gemini-2.5-flash-image`) hoặc **Nano Banana Pro**.
   - Video chuyển động (Kling/Runway/Luma): chọn **fal.ai** → model tương ứng.

> Có thể gắn provider/model **ngay trên node** (panel Props). Nếu chưa map ở Cài đặt, lưu trên node sẽ tự tạo cấu hình trong Cài đặt.

### 3. Chọn nơi lưu (Cài đặt → **Dữ liệu**)
- **Workflow:** để trống = localStorage. Dán URL **Neon** + "Đồng bộ" để lưu cloud, đồng bộ nhiều máy.
- **File output:** để trống = IndexedDB (máy này). Điền **Supabase** (URL + bucket + key) để upload, lấy URL công khai.
- Khu **File output cục bộ** cho xem/xoá file đã tạo.

### 4. Dựng & chạy workflow
1. Mở **Workflows** → tạo mới (hoặc dùng template có sẵn).
2. Kéo node từ palette trái, nối cổng.
3. Cấu hình từng node (prompt, tỉ lệ khung, provider/model…).
4. Bấm **Chạy workflow** → xem tiến trình & kết quả trên canvas.

### 5. Theo dõi
- **Giám sát**: job đang chạy/đã xong, preview kết quả.
- **Báo cáo**: thống kê run, tỉ lệ thành công, output theo loại.

---

## Giới hạn của bản Cloud (FE-only)

Bản này gọi **API provider đám mây bằng key của bạn** → chi phí và **giới hạn (rate limit, quota, kiểm duyệt nội dung)** phụ thuộc gói cước & chính sách của từng nhà cung cấp. Mỗi tác vụ tạo ảnh/video tiêu tốn credit của bạn.

---

## 🔓 Bản Self-host — **Unlimited**

Muốn dùng **không giới hạn**, **không phụ thuộc credit/quota của bên thứ ba**:

- ♾️ **Unlimited Create Image** — tạo ảnh không giới hạn
- ♾️ **Unlimited Create Video** — tạo video không giới hạn
- ♾️ **Unlimited Motion Control** — điều khiển chuyển động không giới hạn

Triển khai self-host (GPU riêng + pipeline ComfyUI/Wan 2.2…) để chạy thoải mái, riêng tư, không kiểm duyệt nội dung, không tính phí theo lượt.

**Vui lòng liên hệ:**

> **Lê Đức Anh**
> 📞 Call: **0931866698**
> ✉️ Email: **anh.leduc2512@gmail.com**

---

## Công nghệ

- **Nuxt 4** (Vue 3, Nitro) · Tailwind v4 · Vue Flow (canvas) · Pinia · VueUse
- **i18n**: `@nuxtjs/i18n` (vi/en, no URL prefix, cookie)
- **Bảo mật key**: Web Crypto AES-GCM + IndexedDB
- **Lưu trữ**: localStorage / IndexedDB / Neon (`@neondatabase/serverless`) / Supabase Storage REST
- Deploy: static host bất kỳ (mặc định **Cloudflare Pages**)
