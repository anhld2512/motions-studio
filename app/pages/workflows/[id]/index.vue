<template>
  <!-- #region ALD 22/05/2026 - Apple HIG workflow editor
       Frosted glass sidebars, System Blue accent, SF Pro typography. -->
  <div
    class="apl-editor"
    @keydown.meta.s.prevent="isOwned && onSave()"
    @keydown.ctrl.s.prevent="isOwned && onSave()"
    @keydown.meta.a="selectAllNodes"
    @keydown.ctrl.a="selectAllNodes"
    @keydown.esc="clearSelection"
    tabindex="-1"
  >
    <!-- LEFT — node palette -->
    <aside class="apl-sidebar apl-sidebar-left">
      <div class="apl-sidebar-header">
        <NuxtLink to="/" class="apl-back">
          <i class="bi bi-chevron-left" />
          <span>Workflows</span>
        </NuxtLink>
      </div>
      <div class="apl-search-wrap">
        <i class="bi bi-search apl-search-icon" />
        <input v-model="paletteSearch" type="text" :placeholder="t('editor.searchNode')" class="apl-search-input" />
      </div>
      <div class="apl-palette">
        <div v-for="cat in filteredCategories" :key="cat.id" class="apl-cat">
          <p class="apl-cat-label">{{ cat.label }}</p>
          <div class="apl-cat-list">
            <div
              v-for="t in cat.nodes"
              :key="t.id"
              :draggable="!isViewingHistory"
              :class="['apl-palette-item', isViewingHistory && 'is-disabled']"
              @dragstart="onDragStart($event, t.id)"
            >
              <span class="apl-palette-icon" :style="{ background: t.soft, color: t.color }">
                <i :class="['bi', t.icon]" />
              </span>
              <div class="apl-palette-text">
                <span class="apl-palette-label">{{ uiLang === 'en' ? t.label : (NODE_VI[t.id] || t.label) }}<span v-if="NODE_VI[t.id] && NODE_VI[t.id] !== t.label" class="apl-palette-en">{{ uiLang === 'en' ? NODE_VI[t.id] : t.label }}</span></span>
                <span class="apl-palette-hint">{{ t.hint }}</span>
              </div>
            </div>
          </div>
        </div>
        <p v-if="filteredCategories.length === 0" class="apl-empty">{{ t('editor.noNodeMatch') }}</p>
      </div>
      <div class="apl-sidebar-footer">
        <template v-if="isOwned">
          <kbd class="apl-kbd">⌘S</kbd> {{ t('editor.save') }}
          <span class="mx-1.5 text-slate-300">·</span>
        </template>
        <kbd class="apl-kbd">⌘A</kbd> {{ t('editor.selectAll') }}
        <span class="mx-1.5 text-slate-300">·</span>
        <kbd class="apl-kbd">⌫</kbd> {{ t('editor.delete') }}
      </div>
    </aside>

    <!-- CENTER — canvas -->
    <main class="apl-canvas-area">
      <!-- ALD 24/05/2026 - Topbar redesigned Apple Island: title left, action capsule right
           grouping secondary (Lịch sử / Runs) vs primary (Chạy workflow + Lưu). -->
      <div class="apl-topbar">
        <div class="min-w-0 flex items-center gap-3">
          <div class="min-w-0">
            <h1 class="apl-title">{{ workflow?.name || '...' }}</h1>
            <p class="apl-subtitle">/{{ workflow?.slug }}</p>
          </div>
        </div>

        <div class="apl-actions">
          <!-- Secondary group: Lịch sử + Runs drawer -->
          <div class="apl-action-group">
            <NuxtLink :to="`/workflows/${route.params.id}/runs`" class="apl-icon-btn" :title="t('editor.runHistory')">
              <i class="bi bi-clock-history" />
            </NuxtLink>
            <button
              v-if="testHistory.length > 0 || testRunning"
              type="button"
              :class="['apl-icon-btn', drawerVisible && 'is-active']"
              :title="drawerVisible ? t('editor.hideRuns') : t('editor.showRuns')"
              @click="drawerVisible = !drawerVisible"
            >
              <i class="bi bi-list-ul" />
              <span v-if="runCounts.running > 0" class="apl-icon-btn-badge apl-badge-running">
                <i class="bi bi-arrow-repeat animate-spin" />
              </span>
              <span v-else-if="testHistory.length > 0" class="apl-icon-btn-badge">{{ testHistory.length }}</span>
            </button>
            <!-- ALD 17/06/2026 - Dựng pipeline Time-lapse BĐS: chọn số công đoạn + lồng tiếng → tự sinh chuỗi node -->
            <button
              v-if="isOwned && !isViewingHistory"
              type="button"
              class="apl-icon-btn"
              :title="t('editor.buildBdsPipelineTooltip')"
              @click="bdsGenOpen = true"
            >
              <i class="bi bi-buildings" />
            </button>
          </div>

          <!-- Primary: Save + Run capsules (Apple Island style) -->
          <!-- ALD 27/05/2026 - Ẩn nút Lưu nếu workflow không phải của user (public viewer) -->
          <!-- ALD 28/05/2026 - Khi viewing history: ẩn Save + Run, show "New Session" button.
               Lịch sử = READ-ONLY view (preview kết quả run cũ). Muốn run mới = New Session
               để clear canvas → user upload lại + edit → Chạy workflow xuất hiện trở lại. -->
          <button
            v-if="isOwned && !isViewingHistory"
            type="button"
            :disabled="!dirty || saving"
            :class="['apl-cta apl-cta-secondary', (!dirty || saving) && 'is-disabled']"
            :title="dirty ? t('editor.saveChanges') : t('editor.noChanges')"
            @click="onSave"
          >
            <i :class="['bi', saving ? 'bi-arrow-repeat animate-spin' : 'bi-cloud-arrow-up']" />
            <span>{{ t('editor.save') }}</span>
          </button>
          <!-- ALD 12/06/2026 - HAI nút TÁCH BIỆT (chốt theo feedback):
               (1) "Phiên mới" = về trang soạn thảo trống để nhập prompt mới, TUYỆT ĐỐI KHÔNG tự chạy.
               (2) "Chạy workflow" = chạy; đang có run thì hiện "Đang xử lý (N)" nhưng vẫn bấm được (song song). -->
          <button
            type="button"
            class="apl-cta apl-cta-secondary"
            :title="t('editor.newSessionTooltip')"
            @click="newBlankSession"
          >
            <i class="bi bi-plus-lg" />
            <span>{{ t('editor.newSession') }}</span>
          </button>
          <!-- ALD 12/06/2026 - nút LUÔN là hành động "Chạy workflow" (KHÔNG hiện "Đang xử lý" của job cũ —
               processing là của TAB run riêng, không phải của nút này). Đang có run khác vẫn bấm chạy thêm
               (song song); chỉ chặn khi đụng trần. -->
          <button
            type="button"
            class="apl-cta apl-cta-primary"
            :title="t('editor.runWorkflowTooltip')"
            @click="openTestRun"
          >
            <i class="bi bi-play-fill" />
            <span>{{ t('editor.runWorkflow') }}</span>
          </button>
        </div>
      </div>

      <!-- ALD 12/06/2026 - MULTI-RUN TAB kiểu VS Code: tab "Soạn thảo" (trang canvas, luôn có khi đã có run)
           + 1 tab/run. Nút "Phiên mới" trên toolbar = về & active tab Soạn thảo này (để THẤY rõ trang canvas).
           Run đang chạy = spinner; xong giữ tab tới khi ✕. -->
      <div v-if="runTabs.length" class="apl-runtabs">
        <button
          type="button"
          :class="['apl-runtab', !selectedRunId && 'is-active']"
          :title="t('editor.editorTabTooltip')"
          @click="focusEditTab()"
        >
          <i class="bi bi-pencil-square" />
          <span>New workflow</span>
        </button>
        <button
          v-for="rt in runTabs"
          :key="rt.id"
          type="button"
          :class="['apl-runtab', selectedRunId === rt.id && 'is-active', `is-${rt.status}`]"
          :title="rt.status === 'running' ? t('editor.runTabRunning') : `Run ${rt.status}`"
          @click="focusRunTab(rt.id)"
        >
          <i :class="['bi', rt.status === 'running' ? 'bi-arrow-repeat apl-runtab-spin'
            : rt.status === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill']" />
          <span>Run {{ tabTime(rt) }}</span>
          <i
            v-if="rt.status !== 'running'"
            class="bi bi-x apl-runtab-x"
            :title="t('editor.closeTabTooltip')"
            @click.stop="closeRunTab(rt.id)"
          />
        </button>
      </div>
      <div class="apl-canvas" @drop="onDrop" @dragover.prevent>
        <ClientOnly>
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            :node-types="customNodeTypes"
            :default-edge-options="{ type: 'step', animated: false, style: { strokeWidth: 2, stroke: '#94a3b8' }, pathOptions: { borderRadius: 20, offset: 24 } }"
            fit-view-on-init
            :min-zoom="0.3"
            :max-zoom="2"
            :snap-to-grid="true"
            :snap-grid="[16, 16]"
            :nodes-draggable="!isViewingHistory"
            :nodes-connectable="!isViewingHistory"
            :edges-updatable="!isViewingHistory"
            :delete-key-code="isViewingHistory ? null : ['Delete', 'Backspace']"
            @node-click="onNodeClick"
            @pane-click="selectedNodeId = null"
            @connect="onConnect"
            @nodes-change="onNodesChange"
          >
            <Background pattern-color="#E5E5EA" :gap="24" :size="1" />
            <Controls position="bottom-left" />
          </VueFlow>
          <div v-if="nodes.length === 0" class="apl-empty-state">
            <span class="apl-empty-icon">
              <i class="bi bi-stars" />
            </span>
            <p class="apl-empty-title">{{ t('editor.canvasEmpty') }}</p>
            <p class="apl-empty-hint">{{ t('editor.canvasEmptyHint') }}</p>
          </div>
        </ClientOnly>
      </div>

      <!-- Test history drawer — 2 cột: list bên trái, detail bên phải -->
      <Transition enter-active-class="transition duration-250 ease-out" leave-active-class="transition duration-200 ease-in" enter-from-class="translate-y-full opacity-0" leave-to-class="translate-y-full opacity-0">
        <div v-if="drawerVisible && (testHistory.length > 0 || testRunning)" class="apl-run-drawer" :style="{ height: drawerHeight + 'px' }">
          <!-- ALD 27/05/2026 - Drag-to-resize: kéo handle top edge để tăng/giảm chiều cao.
               Persist localStorage để giữ qua reload. Pattern mượn từ pebsteel-ai. -->
          <div class="apl-drawer-resize" @mousedown.prevent="startDrawerResize" :title="t('editor.dragToResize')">
            <div class="apl-drawer-resize-line" />
          </div>
          <!-- Header với filter chips + actions -->
          <div class="apl-drawer-header">
            <span class="apl-drawer-title">
              <i class="bi bi-clock-history mr-1" />
              {{ t('editor.history') }}
            </span>
            <!-- Filter chips -->
            <div class="apl-filter-chips ml-3">
              <button type="button" :class="['apl-chip', runFilter === 'all' && 'is-active']" @click="runFilter = 'all'">
                All <span class="apl-chip-count">{{ runCounts.all }}</span>
              </button>
              <button type="button" :class="['apl-chip', 'apl-chip-success', runFilter === 'success' && 'is-active']" @click="runFilter = 'success'">
                OK <span class="apl-chip-count">{{ runCounts.success }}</span>
              </button>
              <button type="button" :class="['apl-chip', 'apl-chip-error', runFilter === 'error' && 'is-active']" @click="runFilter = 'error'">
                Fail <span class="apl-chip-count">{{ runCounts.error }}</span>
              </button>
            </div>
            <div class="ml-auto flex items-center gap-1">
              <button v-if="testHistory.length" type="button" class="apl-text-btn" @click="clearTestHistory" :title="t('editor.clearAllHistory')">
                <i class="bi bi-trash mr-1" />Clear
              </button>
              <button type="button" class="apl-close" :title="t('editor.hideKeepHistory')" @click="drawerVisible = false">
                <i class="bi bi-chevron-down" />
              </button>
            </div>
          </div>

          <div class="apl-drawer-body">
            <!-- LEFT — Run list -->
            <div class="apl-history-list">
              <!-- History items: row hover lộ nút xoá riêng từng entry. -->
              <div
                v-for="r in filteredHistory"
                :key="r.id"
                :class="['apl-history-item', selectedRunId === r.id && 'is-selected', r.status === 'running' && 'is-running']"
              >
                <button type="button" class="apl-history-main" @click="focusRunTab(r.id)">
                  <span :class="[
                    'apl-status-pill',
                    r.status === 'success' ? 'apl-pill-success'
                    : r.status === 'running' ? 'apl-pill-running'
                    : 'apl-pill-error'
                  ]">
                    <i :class="[
                      'bi',
                      r.status === 'success' ? 'bi-check-lg'
                      : r.status === 'running' ? 'bi-arrow-repeat animate-spin'
                      : 'bi-x-lg'
                    ]" />
                    {{ r.status === 'success' ? t('editor.statusOk') : r.status === 'running' ? t('editor.statusRunning') : t('editor.statusFail') }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="apl-history-title">
                      {{ fmtTime(r.ts) }} ·
                      <template v-if="r.status === 'running'">{{ fmtMs(Date.now() - r.ts) }}</template>
                      <template v-else>{{ fmtMs(r.durationMs) }}</template>
                    </div>
                    <div class="apl-history-meta">
                      {{ r.snapshot?.nodeCount || '?' }} nodes
                      <template v-if="r.status === 'running'">
                        · <span class="apl-history-running-text">{{ (r.events?.[r.events.length-1]?.msg) || t('editor.waitingResult') }}</span>
                      </template>
                      <template v-else-if="r.status === 'error' && r.error"> · <span class="apl-history-err">{{ errorPreview(r.error) }}</span></template>
                      <template v-else-if="r.output?.text"> · <span class="apl-history-out">{{ outputPreview(r.output.text) }}</span></template>
                    </div>
                  </div>
                </button>
                <button
                  v-if="r.status !== 'running'"
                  type="button"
                  class="apl-history-delete"
                  :title="t('editor.deleteThisRun')"
                  @click.stop="deleteSingleRun(r)"
                >
                  <i class="bi bi-x" />
                </button>
              </div>

              <!-- Empty state khi filter ra 0 result -->
              <div v-if="filteredHistory.length === 0 && !testRunning" class="apl-history-empty-list">
                <i class="bi bi-funnel text-slate-300 text-xl" />
                <p class="text-[11px] text-slate-400 mt-1">{{ t('editor.noRunMatchFilter') }}</p>
                <button type="button" class="apl-text-btn mt-1" @click="runFilter = 'all'">{{ t('editor.viewAll') }}</button>
              </div>
            </div>

            <!-- RIGHT — Detail panel -->
            <div v-if="selectedTestRun" class="apl-history-detail">
              <!-- Detail header: status + timestamps + retry -->
              <div class="apl-detail-header">
                <span :class="[
                  'apl-status-pill',
                  selectedTestRun.status === 'success' ? 'apl-pill-success'
                  : selectedTestRun.status === 'running' ? 'apl-pill-running'
                  : 'apl-pill-error'
                ]">
                  <i :class="[
                    'bi',
                    selectedTestRun.status === 'success' ? 'bi-check-lg'
                    : selectedTestRun.status === 'running' ? 'bi-arrow-repeat animate-spin'
                    : 'bi-x-lg'
                  ]" />
                  {{ selectedTestRun.status === 'success' ? 'Success' : selectedTestRun.status === 'running' ? 'Running' : 'Failed' }}
                </span>
                <span class="apl-detail-meta">
                  <i class="bi bi-clock mr-1" />{{ new Date(selectedTestRun.ts).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }) }}
                </span>
                <span class="apl-detail-meta">
                  <i class="bi bi-stopwatch mr-1" />
                  <template v-if="selectedTestRun.status === 'running'">{{ fmtMs(Date.now() - selectedTestRun.ts) }} elapsed</template>
                  <template v-else>{{ fmtMs(selectedTestRun.durationMs) }}</template>
                </span>
                <span class="apl-detail-meta">
                  <i class="bi bi-diagram-3 mr-1" />{{ selectedTestRun.snapshot?.nodeCount || '?' }} nodes
                </span>
                <button v-if="selectedTestRun.status === 'running'" type="button" class="apl-detail-action apl-detail-cancel ml-auto" @click="cancelRun(selectedTestRun)" :title="t('editor.stopPollCancel')">
                  <i class="bi bi-stop-circle mr-1" />Cancel
                </button>
                <template v-else>
                  <!-- ALD 17/06/2026 - Run lỗi: "Tiếp tục" = dùng lại bước đã render xong, chỉ render node lỗi + sau (cache theo nội dung). -->
                  <button v-if="selectedTestRun.status === 'error'" type="button" class="apl-detail-action apl-detail-resume ml-auto" :disabled="hasActiveRun" @click="resumeFromHistory(selectedTestRun)" :title="t('editor.resumeTooltip')">
                    <i class="bi bi-skip-forward-fill mr-1" />{{ t('editor.resume') }}
                  </button>
                  <button type="button" class="apl-detail-action" :class="{ 'ml-auto': selectedTestRun.status !== 'error' }" :disabled="hasActiveRun" @click="rerunFromHistory(selectedTestRun)" :title="t('editor.rerunTooltip')">
                    <i class="bi bi-arrow-clockwise mr-1" />Re-run
                  </button>
                </template>
              </div>

              <!-- Detail body -->
              <div class="apl-detail-body">
                <!-- ALD 24/05/2026 - Job state panel: 4 layouts riêng (running / cancelled / error / done).
                     Tách hẳn để UX rõ ràng, không reuse layout running cho cancelled. -->
                <!-- RUNNING — amber, progress bar + cancel button -->
                <section v-if="pendingJobInfo?.state === 'running'" class="px-4 py-2 apl-detail-section apl-section-pending">
                  <div class="apl-section-head apl-pending-head">
                    <i class="bi bi-arrow-repeat animate-spin text-amber-500" />
                    <span class="apl-section-title">{{ t('editor.jobRunning') }}</span>
                    <span class="apl-pending-kind">{{ pendingJobInfo.kind }}</span>
                    <button type="button" class="apl-pending-cancel" :title="t('editor.cancelJob')" @click="onCancelFashionJob(pendingJobInfo.job_id)">
                      <i class="bi bi-x-circle" /> {{ t('editor.cancel') }}
                    </button>
                  </div>
                  <div class="apl-pending-body">
                    <div class="apl-pending-step">{{ pendingJobInfo.current_step || t('editor.processing') }}</div>
                    <div class="apl-pending-bar">
                      <div class="apl-pending-fill" :style="{ width: `${Math.round(pendingJobInfo.progress * 100)}%` }" />
                    </div>
                    <div class="apl-pending-meta">
                      <span class="font-mono">{{ pendingJobInfo.job_id?.slice(0, 8) }}</span>
                      <span>·</span>
                      <span class="apl-pending-pct">{{ Math.round(pendingJobInfo.progress * 100) }}%</span>
                      <span v-if="pendingJobInfo.eta">· ETA {{ pendingJobInfo.eta }}</span>
                    </div>
                  </div>
                </section>

                <!-- CANCELLED — gray, simple message + re-run hint -->
                <section v-else-if="pendingJobInfo?.state === 'cancelled'" class="px-4 py-2 apl-detail-section apl-section-cancelled">
                  <div class="apl-section-head">
                    <i class="bi bi-slash-circle text-gray-500" />
                    <span class="apl-section-title text-gray-700">{{ t('editor.jobCancelled') }}</span>
                    <span class="apl-pending-kind">{{ pendingJobInfo.kind }}</span>
                  </div>
                  <div class="apl-pending-body">
                    <div class="apl-pending-step text-gray-500 italic">{{ t('editor.jobCancelledHint') }}</div>
                    <div class="apl-pending-meta">
                      <span class="font-mono text-gray-500">{{ pendingJobInfo.job_id?.slice(0, 8) }}</span>
                    </div>
                  </div>
                </section>

                <!-- ERROR — red, error details + retry hint -->
                <section v-else-if="pendingJobInfo?.state === 'error'" class="px-4 py-2 apl-detail-section apl-section-job-error">
                  <div class="apl-section-head">
                    <i class="bi bi-exclamation-octagon-fill text-rose-500" />
                    <span class="apl-section-title text-rose-700">{{ t('editor.jobError') }}</span>
                    <span class="apl-pending-kind">{{ pendingJobInfo.kind }}</span>
                  </div>
                  <div class="apl-pending-body">
                    <pre v-if="pendingJobInfo.error" class="text-[11px] text-rose-700 bg-rose-50/60 border border-rose-200 rounded-md px-2 py-1.5 whitespace-pre-wrap font-mono">{{ pendingJobInfo.error.split('\n')[0].slice(0, 200) }}</pre>
                    <div class="apl-pending-meta">
                      <span class="font-mono text-rose-700">{{ pendingJobInfo.job_id?.slice(0, 8) }}</span>
                    </div>
                  </div>
                </section>

                <!-- DONE — emerald, inline video preview + link copy/download -->
                <section v-else-if="pendingJobInfo?.state === 'done'" class="px-4 py-2 apl-detail-section apl-section-done">
                  <div class="apl-section-head">
                    <i class="bi bi-check-circle-fill text-emerald-500" />
                    <span class="apl-section-title text-emerald-700">{{ t('editor.jobDone') }}</span>
                    <span class="apl-pending-kind">{{ pendingJobInfo.kind }}</span>
                  </div>
                  <div class="apl-pending-body">
                    <!-- ALD 25/05/2026 - Inline media preview trong detail panel để user xem
                         ngay video/ảnh kết quả mà không cần mở canvas Output node hoặc
                         tab mới. video_url cho motion, image_url cho tryon-only. -->
                    <video
                      v-if="pendingJobInfo.video_url && !pendingJobInfo.is_image"
                      :src="pendingJobInfo.video_url"
                      controls
                      playsinline
                      preload="metadata"
                      class="w-full max-h-[420px] rounded-lg bg-black mb-2"
                    />
                    <img
                      v-else-if="pendingJobInfo.video_url && pendingJobInfo.is_image && pendingJobInfo.images.length <= 1"
                      :src="pendingJobInfo.video_url"
                      alt="Job output"
                      class="w-full max-h-[420px] object-contain rounded-lg bg-slate-50 mb-2"
                    />
                    <div v-else-if="pendingJobInfo.images.length > 1" class="grid grid-cols-2 gap-2 mb-2">
                      <a
                        v-for="(img, idx) in pendingJobInfo.images"
                        :key="img.url || idx"
                        :href="img.url"
                        target="_blank"
                        class="block rounded-lg overflow-hidden bg-slate-50 border border-slate-200 hover:border-primary/60 transition"
                        :title="img.label || t('editor.imageN', { n: idx + 1 })"
                      >
                        <img :src="img.url" alt="Job output" class="w-full aspect-square object-cover" />
                        <span class="block px-2 py-1 text-[10px] text-slate-600 truncate">{{ img.label || t('editor.imageN', { n: idx + 1 }) }}</span>
                      </a>
                    </div>
                    <div class="apl-pending-meta">
                      <span class="font-mono text-emerald-700">{{ pendingJobInfo.job_id?.slice(0, 8) }}</span>
                      <button
                        v-if="pendingJobInfo.video_url"
                        type="button"
                        class="ml-auto text-primary hover:underline text-xs"
                        @click="copyToClipboard(pendingJobInfo.video_url, t('editor.toastCopiedUrl'))"
                      >
                        <i class="bi bi-clipboard me-1" /> Copy URL
                      </button>
                      <a v-if="pendingJobInfo.video_url" :href="pendingJobInfo.video_url" target="_blank" download class="text-primary hover:underline text-xs">
                        <i class="bi bi-download me-1" /> {{ t('editor.download') }}
                      </a>
                    </div>
                  </div>
                </section>

                <!-- Error (priority — show first if failed) -->
                <section v-if="selectedTestRun.error" class="apl-detail-section apl-section-error">
                  <div class="apl-section-head">
                    <i class="bi bi-exclamation-triangle-fill text-rose-500" />
                    <span class="apl-section-title text-rose-700">Error</span>
                  </div>
                  <pre class="apl-detail-pre apl-pre-error">{{ selectedTestRun.error }}</pre>
                </section>

                <!-- Output: ẩn raw "[pending] fashion-motion job ..." khi entry đang running.
                     Drawer pending tracker phía dưới hiện progress đầy đủ rồi. -->
                <section v-if="selectedTestRun.output?.text && selectedTestRun.status !== 'running'" class="apl-detail-section">
                  <div class="apl-section-head">
                    <i class="bi bi-arrow-return-right text-emerald-500" />
                    <span class="apl-section-title">Output</span>
                    <span class="apl-section-badge">{{ selectedTestRun.output.text.length.toLocaleString() }} chars</span>
                    <button type="button" class="apl-icon-btn-copy ml-auto" @click="copyToClipboard(selectedTestRun.output.text, t('editor.toastCopiedOutput'))" :title="t('editor.copyAllOutput')">
                      <i class="bi bi-clipboard" />
                    </button>
                    <button type="button" class="apl-icon-btn-copy" @click="downloadOutput(selectedTestRun)" :title="t('editor.downloadTxt')">
                      <i class="bi bi-download" />
                    </button>
                    <button v-if="selectedTestRun.output.text.length > 5000" type="button" class="apl-icon-btn-copy" @click="outputExpanded = !outputExpanded" :title="outputExpanded ? t('editor.collapse') : t('editor.expandFull')">
                      <i :class="['bi', outputExpanded ? 'bi-arrows-collapse' : 'bi-arrows-expand']" />
                    </button>
                  </div>
                  <pre class="apl-detail-pre">{{ outputExpanded || selectedTestRun.output.text.length <= 5000
                    ? selectedTestRun.output.text
                    : selectedTestRun.output.text.slice(0, 5000) + '\n\n' + t('editor.outputTruncated', { n: (selectedTestRun.output.text.length - 5000).toLocaleString() }) }}</pre>
                </section>

                <!-- Triggers (input config snapshot) -->
                <section v-if="selectedTestRun.triggers?.length" class="apl-detail-section">
                  <div class="apl-section-head">
                    <i class="bi bi-box-arrow-in-right text-emerald-500" />
                    <span class="apl-section-title">Inputs</span>
                  </div>
                  <div class="apl-triggers">
                    <div v-for="t in selectedTestRun.triggers" :key="t.nodeId" class="apl-trigger-row">
                      <span :class="['apl-trigger-source', `src-${t.source}`]">{{ t.source }}</span>
                      <span class="apl-trigger-type">{{ t.contentType }}</span>
                      <span class="apl-trigger-detail" :title="t.detail">{{ t.detail }}</span>
                    </div>
                  </div>
                  <pre v-if="selectedTestRun.input?.text" class="apl-detail-pre mt-2">{{ selectedTestRun.input.text }}</pre>
                </section>

                <!-- Log events -->
                <section class="apl-detail-section">
                  <div class="apl-section-head">
                    <i class="bi bi-list-ul text-slate-500" />
                    <span class="apl-section-title">Log</span>
                    <span class="apl-section-badge">{{ selectedTestRun.events?.length || 0 }} events</span>
                  </div>
                  <ul v-if="selectedTestRun.events?.length" class="apl-events">
                    <li v-for="(ev, idx) in selectedTestRun.events" :key="idx" class="apl-event">
                      <span :class="['apl-event-dot', `dot-${ev.level}`]">
                        <i v-if="ev.level === 'success'" class="bi bi-check-lg" />
                        <i v-else-if="ev.level === 'error'" class="bi bi-x-lg" />
                        <i v-else-if="ev.level === 'warn'" class="bi bi-exclamation" />
                        <i v-else class="bi bi-dot" />
                      </span>
                      <span class="apl-event-msg">{{ ev.msg }}</span>
                      <span class="apl-event-ts">{{ fmtRelTime(ev.ts, selectedTestRun.ts) }}</span>
                    </li>
                  </ul>
                  <p v-else class="apl-empty-text">{{ t('editor.noEvent') }}</p>
                </section>
              </div>
            </div>
            <div v-else-if="testRunning" class="apl-history-empty">
              <div class="apl-loader-ring" />
              <p class="apl-empty-title mt-3">{{ t('editor.runningWorkflow') }}</p>
              <p class="apl-empty-hint">{{ fmtMs(runningElapsedMs) }} {{ t('editor.elapsedCap3min') }}</p>
            </div>
            <div v-else class="apl-history-empty">
              <i class="bi bi-clock-history text-3xl text-slate-300" />
              <p class="apl-empty-title mt-2">No Processing</p>
              <p class="apl-empty-hint">{{ t('editor.pressRunHintPre') }}<kbd class="apl-kbd-mini"><i class="bi bi-play-fill" /> Run</kbd>{{ t('editor.pressRunHintPost') }}</p>
            </div>
          </div>
        </div>
      </Transition>
    </main>

    <!-- RIGHT — inspector. Animate width 0 → 360 khi click node. -->
    <aside :class="['apl-sidebar', 'apl-sidebar-right', selectedNode ? 'is-open' : '']">
      <Transition name="apl-inspector" mode="out-in">
        <div v-if="selectedNode" :key="selectedNode.id" class="apl-inspector-content">
          <div class="apl-inspector-header">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <span class="apl-inspector-icon" :style="{ background: currentNodeStyle.soft, color: currentNodeStyle.color }">
                <i :class="['bi text-lg', currentNodeStyle.icon]" />
              </span>
              <div class="min-w-0">
                <p class="apl-inspector-overline">Node</p>
                <p class="apl-inspector-title">{{ currentNodeStyle.label }}</p>
              </div>
            </div>
            <button type="button" class="apl-icon-btn apl-icon-btn-danger" @click="onDeleteNode" :title="t('editor.deleteNodeTooltip')">
              <i class="bi bi-trash" />
            </button>
          </div>

          <div class="apl-inspector-body">
            <!-- #region ALD 14/06/2026 - Banner READ-ONLY khi xem run cũ (History snapshot): config đang xem là LÚC
                 RUN ĐÓ chạy, không phải bản đang sửa. Bấm "New workflow" (newBlankSession) để mở phiên soạn mới. -->
            <div v-if="isViewingHistory" class="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
              <i class="bi bi-clock-history shrink-0 text-amber-500" />
              <span class="flex-1 leading-snug">{{ t('editor.viewingOldRunPre') }}<b>{{ t('editor.viewingOldRunBold') }}</b>{{ t('editor.viewingOldRunPost') }}</span>
              <button type="button" class="shrink-0 px-2 py-1 rounded-md bg-amber-500 text-white font-semibold hover:bg-amber-600 transition" @click="newBlankSession">New workflow</button>
            </div>
            <!-- #endregion -->
            <div class="apl-id-chip">
              <span class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Node ID</span>
              <code class="apl-id-code">{{ selectedNode.id }}</code>
            </div>

            <!-- ALD 14/06/2026 - Xem history = READ-ONLY: `inert` khoá HẲN tương tác (chuột + BÀN PHÍM + focus) toàn
                 bộ subtree config snapshot; pointer-events-none + mờ là fallback cho trình duyệt cũ. Banner + nút
                 "New workflow" ở trên KHÔNG nằm trong wrapper này nên vẫn bấm được. -->
            <div :inert="isViewingHistory" :class="isViewingHistory ? 'pointer-events-none opacity-60 select-none' : ''">
            <component
              :is="inspectorComponent(selectedNode.data.type)"
              v-if="inspectorComponent(selectedNode.data.type)"
              :config="selectedNode.data.config"
              :node-type="selectedNode.data.type"
              :run-output="selectedNode.data._runOutput || {}"
              :runtime="nodeRuntime"
              @update:config="updateNodeConfig"
            />
            <p v-else class="text-xs text-slate-400 italic pt-2">{{ t('editor.nodeNoConfig') }}</p>

            <!-- On Failure — common config cho mọi node trừ input/output/condition. -->
            <div v-if="canHaveErrorRoute(selectedNode.data.type)" class="apl-on-failure" :class="isViewingHistory ? 'pointer-events-none opacity-60' : ''">
              <label class="apl-of-label">
                <i class="bi bi-exclamation-triangle mr-1" />
                On Failure
              </label>
              <select :value="selectedNode.data.config?.onError || 'stop'" :disabled="isViewingHistory" class="apl-of-select mt-1.5" @change="onOnErrorChange($event.target.value)">
                <option value="stop">Stop workflow (default)</option>
                <option value="continue">{{ t('editor.onErrorContinue') }}</option>
                <option value="route">Route to error branch</option>
              </select>
              <p v-if="(selectedNode.data.config?.onError || 'stop') === 'stop'" class="apl-of-hint">{{ t('editor.onErrorStopHint') }}</p>
              <p v-else-if="selectedNode.data.config?.onError === 'continue'" class="apl-of-hint">{{ t('editor.onErrorContinueHint') }}</p>
              <p v-else class="apl-of-hint">{{ t('editor.onErrorRouteHintPre') }}<b class="text-amber-700">ERR</b>{{ t('editor.onErrorRouteHintPost') }}</p>
            </div>
            </div>
          </div>
        </div>
      </Transition>
    </aside>


    <!-- #region ALD 22/05/2026 - API modal: Sync cURL + Async config + Async cURL/Callback preview -->
    <Transition enter-active-class="transition duration-200" leave-active-class="transition duration-150" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="asyncModalOpen" class="apl-modal-backdrop" @click.self="asyncModalOpen = false">
        <div class="apl-modal apl-modal-xl max-h-11/12">
          <div class="apl-modal-header">
            <div class="flex items-center gap-2.5">
              <span class="apl-modal-icon"><i class="bi bi-terminal" /></span>
              <div>
                <p class="apl-modal-overline">API</p>
                <p class="apl-modal-title">/{{ workflow?.slug }}</p>
              </div>
            </div>
            <button type="button" class="apl-icon-btn-modal" @click="asyncModalOpen = false"><i class="bi bi-x-lg" /></button>
          </div>

          <div class="apl-modal-body apl-api-body">
            <!-- ── Section: Sync API (luôn hiện) ────────────────────────── -->
            <section class="apl-api-section">
              <header class="apl-api-section-head">
                <div>
                  <p class="apl-api-section-title">Sync API</p>
                  <p class="apl-api-section-sub">{{ t('editor.syncApiSub') }}</p>
                </div>
                <button type="button" class="apl-icon-btn-copy" @click="copyToClipboard(syncCurlPreview, t('editor.toastCopiedSyncCurl'))" :title="t('editor.copyCurl')">
                  <i class="bi bi-clipboard" />
                </button>
              </header>
              <pre class="apl-curl-pre">{{ syncCurlPreview }}</pre>
            </section>

            <!-- ── Section: Async API (toggle) ───────────────────────────── -->
            <section class="apl-api-section apl-api-section-async">
              <label class="apl-async-toggle">
                <input v-model="asyncConfig.async_enabled" type="checkbox" class="apl-checkbox" />
                <span class="min-w-0 flex-1">
                  <span class="apl-async-toggle-label">Async Mode</span>
                  <span class="apl-async-toggle-hint">{{ t('editor.asyncToggleHintA') }}<code>/invoke-async</code>{{ t('editor.asyncToggleHintB') }}<code>job_id</code>{{ t('editor.asyncToggleHintC') }}</span>
                </span>
              </label>

              <div v-if="asyncConfig.async_enabled" class="apl-async-body">
                <!-- Cấu hình -->
                <div class="apl-api-subhead">{{ t('editor.callbackConfig') }}</div>
                <div class="space-y-3">
                  <div>
                    <label class="apl-modal-label">{{ t('editor.callbackUrl') }} <span class="text-rose-500">*</span></label>
                    <input
                      v-model="asyncConfig.callback_url"
                      type="text"
                      placeholder="https://app-b.pebsteel.com/api/ai-callback"
                      class="apl-modal-input mt-1.5 font-mono text-[12px]"
                    />
                    <p class="apl-modal-hint mt-1">{{ t('editor.callbackUrlHintPre') }}<code>https://</code>.</p>
                  </div>

                  <div>
                    <label class="apl-modal-label">{{ t('editor.customHeaders') }}</label>
                    <div class="apl-header-list mt-1.5">
                      <div v-for="(h, idx) in asyncConfig.callback_headers_list" :key="idx" class="apl-header-row">
                        <input
                          v-model="h.key"
                          type="text"
                          placeholder="Authorization"
                          class="apl-modal-input apl-header-key font-mono text-[12px]"
                        />
                        <input
                          v-model="h.value"
                          type="text"
                          placeholder="Bearer xxx"
                          class="apl-modal-input apl-header-val font-mono text-[12px]"
                        />
                        <button type="button" class="apl-icon-btn-mini" @click="removeHeader(idx)" :title="t('editor.removeHeader')">
                          <i class="bi bi-x-lg" />
                        </button>
                      </div>
                      <button type="button" class="apl-btn apl-btn-ghost apl-btn-mini mt-1" @click="addHeader">
                        <i class="bi bi-plus-lg" /> {{ t('editor.addHeader') }}
                      </button>
                    </div>
                    <p class="apl-modal-hint mt-1">{{ t('editor.headersHintPre') }} <code>Authorization: Bearer xxx</code> {{ t('editor.headersHintOr') }} <code>X-API-Key: yyy</code> {{ t('editor.headersHintPost') }}</p>
                  </div>
                </div>

                <!-- Preview 2 cột -->
                <div class="apl-api-subhead mt-4">Preview</div>
                <div class="apl-preview-grid mt-1.5">
                  <div class="apl-preview-block">
                    <div class="apl-preview-head">
                      <p class="apl-preview-title">{{ t('editor.curlAppBSends') }}</p>
                      <button type="button" class="apl-icon-btn-copy" @click="copyToClipboard(asyncCurlPreview, t('editor.toastCopiedAsyncCurl'))" :title="t('editor.copy')">
                        <i class="bi bi-clipboard" />
                      </button>
                    </div>
                    <pre class="apl-curl-pre">{{ asyncCurlPreview }}</pre>
                  </div>
                  <div class="apl-preview-block">
                    <div class="apl-preview-head">
                      <p class="apl-preview-title">{{ t('editor.callbackAppBReceives') }}</p>
                      <button type="button" class="apl-icon-btn-copy" @click="copyToClipboard(asyncCallbackPreview, t('editor.toastCopiedCallback'))" :title="t('editor.copy')">
                        <i class="bi bi-clipboard" />
                      </button>
                    </div>
                    <pre class="apl-curl-pre">{{ asyncCallbackPreview }}</pre>
                  </div>
                </div>
                <p class="apl-modal-hint mt-2">{{ t('editor.webhookHeadersHintPre') }} <code>X-Webhook-Job-Id</code>, <code>X-Webhook-Attempt</code> {{ t('editor.webhookHeadersHintPost') }}</p>
              </div>
            </section>
          </div>
          <div class="apl-modal-footer">
            <button type="button" class="apl-btn apl-btn-ghost" @click="asyncModalOpen = false">{{ t('editor.close') }}</button>
            <button
              type="button"
              :disabled="asyncSaving"
              :class="['apl-btn', asyncSaving ? 'apl-btn-disabled' : 'apl-btn-primary']"
              @click="saveAsyncConfig"
            >
              <i :class="['bi', asyncSaving ? 'bi-arrow-repeat animate-spin' : 'bi-check2']" /> {{ t('editor.saveConfig') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
    <!-- #endregion -->

    <!-- Test Run Modal -->
    <Transition enter-active-class="transition duration-200" leave-active-class="transition duration-150" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="testRunOpen" class="apl-modal-backdrop" @click.self="testRunOpen = false">
        <div class="apl-modal">
          <div class="apl-modal-header">
            <div class="flex items-center gap-2.5">
              <span class="apl-modal-icon"><i class="bi bi-play-fill" /></span>
              <div>
                <p class="apl-modal-overline">Test workflow</p>
                <p class="apl-modal-title">/{{ workflow?.slug }}</p>
              </div>
            </div>
            <button type="button" class="apl-icon-btn-modal" @click="testRunOpen = false"><i class="bi bi-x-lg" /></button>
          </div>
          <div class="apl-modal-body">
            <label class="apl-modal-label">
              Session payload
              <span class="text-slate-400 font-normal normal-case">— {{ t('editor.nodesNeedInput', { n: sessionInputs.length }) }}</span>
            </label>
            <div class="apl-input-list mt-2">
              <div v-for="input in sessionInputs" :key="input.id" class="apl-input-row">
                <span class="apl-input-badge">session.{{ input.field }}</span>
                <span class="apl-input-type">{{ input.contentType }}</span>
              </div>
            </div>
            <textarea
              v-model="testInput"
              rows="4"
              :placeholder="t('editor.testInputPlaceholder')"
              class="apl-modal-input mt-3"
              autofocus
              @keydown.meta.enter.prevent="doTestRun"
              @keydown.ctrl.enter.prevent="doTestRun"
            />
            <p class="apl-modal-hint">{{ t('editor.testInputHintPre') }} <code>session.text</code>. {{ t('editor.testInputHintPost') }} <kbd class="apl-kbd-mini">⌘↵</kbd></p>
          </div>
          <div class="apl-modal-footer">
            <button type="button" class="apl-btn apl-btn-ghost" @click="testRunOpen = false">{{ t('editor.cancel') }}</button>
            <button type="button" class="apl-btn apl-btn-primary" @click="doTestRun">
              <i class="bi bi-play-fill" /> {{ t('editor.run') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- #region ALD 17/06/2026 - Generator pipeline Time-lapse Xây dựng BĐS: chọn số công đoạn + lồng tiếng → tự sinh chuỗi node -->
    <Transition enter-active-class="transition duration-200" leave-active-class="transition duration-150" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="bdsGenOpen" class="apl-modal-backdrop" @click.self="bdsGenOpen = false">
        <div class="apl-modal apl-modal-wide">
          <div class="apl-modal-header">
            <div class="flex items-center gap-2.5">
              <span class="apl-modal-icon"><i class="bi bi-buildings" /></span>
              <div>
                <p class="apl-modal-overline">{{ t('editor.bdsOverline') }}</p>
                <p class="apl-modal-title">{{ t('editor.bdsTitle') }}</p>
              </div>
            </div>
            <button type="button" class="apl-icon-btn-modal" @click="bdsGenOpen = false"><i class="bi bi-x-lg" /></button>
          </div>
          <div class="apl-modal-body">
            <p class="apl-modal-hint mb-3">
              <b>{{ t('editor.bdsIntroB1') }}</b> {{ t('editor.bdsIntroT1') }} <b>{{ t('editor.bdsIntroB2') }}<template v-if="bdsGen.voiceover"> {{ t('editor.bdsIntroVoiceover') }}</template></b>{{ t('editor.bdsIntroT2') }} <b>{{ t('editor.bdsIntroB3') }}</b> {{ t('editor.bdsIntroArrow') }} <b>{{ t('editor.bdsIntroB4') }}</b>{{ t('editor.bdsIntroT3') }}
            </p>

            <label class="apl-modal-label">{{ t('editor.bdsStageCount') }}</label>
            <div class="grid grid-cols-5 gap-1.5 mt-2">
              <button
                v-for="n in [2,3,4,5,6]"
                :key="n"
                type="button"
                class="h-10 rounded-xl border text-sm font-bold transition"
                :class="bdsGen.sceneCount === n ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'"
                @click="bdsGen.sceneCount = n"
              >{{ n }}</button>
            </div>

            <div class="flex items-center justify-between mt-4">
              <div class="min-w-0">
                <label class="apl-modal-label">{{ t('editor.bdsVoiceover') }}</label>
                <p class="apl-modal-hint">{{ t('editor.bdsVoiceoverHint') }}</p>
              </div>
              <button
                type="button"
                class="relative w-12 h-7 rounded-full transition shrink-0"
                :class="bdsGen.voiceover ? 'bg-emerald-500' : 'bg-gray-300'"
                @click="bdsGen.voiceover = !bdsGen.voiceover"
              >
                <span class="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform" :class="bdsGen.voiceover && 'translate-x-5'" />
              </button>
            </div>

            <!-- ALD 17/06/2026 - Cảnh đêm (tuỳ chọn): thêm 1 công đoạn CUỐI là nhà hoàn thiện về đêm + flycam đêm. -->
            <div class="flex items-center justify-between mt-4">
              <div class="min-w-0">
                <label class="apl-modal-label">{{ t('editor.bdsNightScene') }}</label>
                <p class="apl-modal-hint">{{ t('editor.bdsNightSceneHint') }}</p>
              </div>
              <button
                type="button"
                class="relative w-12 h-7 rounded-full transition shrink-0"
                :class="bdsGen.nightScene ? 'bg-indigo-500' : 'bg-gray-300'"
                @click="bdsGen.nightScene = !bdsGen.nightScene"
              >
                <span class="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform" :class="bdsGen.nightScene && 'translate-x-5'" />
              </button>
            </div>

            <div v-if="bdsGen.voiceover" class="mt-3">
              <label class="apl-modal-label">{{ t('editor.bdsVoice') }}</label>
              <div class="grid grid-cols-3 gap-1.5 mt-2">
                <button
                  v-for="v in BDS_VOICES"
                  :key="v.id"
                  type="button"
                  class="h-11 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition"
                  :class="bdsGen.voice === v.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'"
                  @click="bdsGen.voice = v.id"
                ><i :class="`bi ${v.icon}`" /><span>{{ v.label }}</span></button>
              </div>
            </div>

            <label class="apl-modal-label mt-4 block">{{ t('editor.bdsStageDescriptions') }}</label>
            <div class="space-y-2.5 mt-2">
              <div v-for="(st, i) in bdsGen.stages" :key="i" class="rounded-xl border border-gray-200 bg-gray-50/60 p-2.5">
                <p class="text-[11px] font-bold text-emerald-700 mb-1.5">{{ t('editor.bdsStageN', { n: i + 1 }) }}</p>
                <textarea v-model="st.image" rows="2" class="apl-modal-input text-[12px]" style="height:auto;padding:6px 8px;resize:vertical;font-family:inherit" :placeholder="t('editor.bdsStageImagePlaceholder')" />
                <textarea v-model="st.motion" rows="1" class="apl-modal-input text-[12px] mt-1.5" style="height:auto;padding:6px 8px;resize:vertical;font-family:inherit" :placeholder="t('editor.bdsStageMotionPlaceholder')" />
                <textarea v-if="bdsGen.voiceover" v-model="st.narration" rows="1" class="apl-modal-input text-[12px] mt-1.5" style="height:auto;padding:6px 8px;resize:vertical;font-family:inherit" :placeholder="t('editor.bdsStageNarrationPlaceholder')" />
              </div>
            </div>
          </div>
          <div class="apl-modal-footer">
            <button type="button" class="apl-btn apl-btn-ghost" @click="bdsGenOpen = false">{{ t('editor.cancel') }}</button>
            <button type="button" class="apl-btn apl-btn-primary" @click="buildBdsPipeline">
              <i class="bi bi-magic" /> {{ t('editor.buildPipeline') }}
            </button>
          </div>
        </div>
      </div>
      <!-- #endregion -->
    </Transition>
  </div>
  <!-- #endregion -->
</template>

<script setup>
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { markRaw } from 'vue'
import { isEqual } from 'lodash-es'
import FlowNode from '~/components/workflow/FlowNode.vue'

definePageMeta({ middleware: 'auth', layout: 'default' })

const route = useRoute()
const wf = useWorkflows()
const db = useLocalDb()
const fileStore = useFileStore(); fileStore.load()
const toast = useToast()
const noti = useNotifications()
const confirmDialog = useConfirm()
const { t } = useI18n()

const workflow = ref(null)
// ALD 27/05/2026 - Public workflow của user khác: ẩn nút Lưu + badge "Chưa lưu",
// chỉ cho phép Chạy. BE trả `owned` flag từ GET /workflows/:id (so user_id với session).
// Strict check === true → loading state và non-owner đều fall vào false → ẩn UI sửa đổi.
// Owner thấy nút Lưu sau khi fetch xong (vài chục ms), không flash UX đáng kể.
const isOwned = computed(() => workflow.value?.owned === true)
const nodes = ref([])
const edges = ref([])
const selectedNodeId = ref(null)
const saving = ref(false)
// Saved baseline — deep snapshot. dirty = !isEqual(currentDefinition(), savedDefinition).
// Tránh flag-based "đã thay đổi" sai (vd select node, scroll Vue Flow trigger watch).
const savedDefinition = ref(null)
// ALD 18/06/2026 - Đổi ngôn ngữ palette theo nút VI/EN trên thanh nav.
const { lang: uiLang } = useLang()
// Nhãn tiếng Việt cho palette (khớp NODE_BIL trong FlowNode); EN lấy từ t.label của catalog.
const NODE_VI = {
  'input-text': 'Nhập văn bản', 'input-image': 'Nhập ảnh', 'input-video': 'Nhập video', 'input-audio': 'Nhập âm thanh', 'input-file': 'Nhập file',
  output: 'Kết quả', 'create-image': 'Tạo ảnh', tryon: 'Thử đồ', compose: 'Ghép vào mẫu',
  motion: 'Điều khiển chuyển động', 'fashion-motion': 'Thời trang chuyển động', ss: 'Ảnh → Video', 'wan-i2v': 'Ảnh đầu → cuối',
  'text-to-video': 'Văn bản → Video', teaser: 'Teaser', bds: 'Tua nhanh xây dựng',
  talk: 'Nói (lip-sync)', voiceover: 'Lồng tiếng', concat: 'Ghép cảnh', subtitle: 'Phụ đề / Dịch'
}
const paletteSearch = ref('')
const testRunOpen = ref(false)
const testInput = ref('')
const testRunning = ref(false)
// Test history per workflow — localStorage. Mỗi entry: { id, ts, input, status, output, events, snapshot, triggers }
const testHistory = ref([])
const selectedRunId = ref(null)
const drawerVisible = ref(false)   // mặc định ẩn — toggle qua nút "Runs" trên topbar
// ALD 27/05/2026 - Drag-to-resize drawer (port từ pebsteel-ai). Persist localStorage,
// min 200px, max 80% viewport. Cursor ns-resize trên top edge.
const DRAWER_HEIGHT_KEY = 'pebsteel.motions.workflowDrawerHeight'
const drawerHeight = ref(360)
if (import.meta.client) {
  const saved = Number(localStorage.getItem(DRAWER_HEIGHT_KEY))
  if (saved >= 200 && saved <= 1200) drawerHeight.value = saved
}
function startDrawerResize(e) {
  const startY = e.clientY
  const startH = drawerHeight.value
  function onMove(ev) {
    const maxH = Math.floor(window.innerHeight * 0.8)
    drawerHeight.value = Math.min(maxH, Math.max(200, startH + (startY - ev.clientY)))
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.userSelect = ''
    localStorage.setItem(DRAWER_HEIGHT_KEY, String(drawerHeight.value))
  }
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
// #region ALD 22/05/2026 - Test runs: filter + auto-select + current-running event
const runFilter = ref('all')   // 'all' | 'success' | 'error'
const outputExpanded = ref(false)  // false = hiển thị 5000 chars đầu; true = full
const filteredHistory = computed(() => {
  if (runFilter.value === 'all') return testHistory.value
  return testHistory.value.filter((r) => r.status === runFilter.value)
})
const runCounts = computed(() => ({
  all: testHistory.value.length,
  success: testHistory.value.filter((r) => r.status === 'success').length,
  error: testHistory.value.filter((r) => r.status === 'error').length,
  running: testHistory.value.filter((r) => r.status === 'running').length
}))
const selectedTestRun = computed(() => testHistory.value.find((r) => r.id === selectedRunId.value))
// ALD 24/05/2026 - Bug fix: trước có { immediate: true } → load workflow là tự bind
// run cũ vào canvas. User chỉ muốn canvas clean khi mở; vào Lịch sử mới chọn manual.
// Vẫn auto-select khi run đang select bị xoá (selectedRunId không tồn tại nữa).
watch(testHistory, (val) => {
  if (val.length === 0) { selectedRunId.value = null; return }
  // Chỉ re-select nếu selectedRunId hiện tại invalid — không tự chọn từ null
  if (selectedRunId.value && !val.find((r) => r.id === selectedRunId.value)) {
    selectedRunId.value = val[0].id
  }
})
// Filter chip change: chỉ re-select khi đang có entry selected nhưng bị filter loại bỏ
watch(filteredHistory, (val) => {
  if (selectedRunId.value && val.length > 0 && !val.find((r) => r.id === selectedRunId.value)) {
    selectedRunId.value = val[0].id
  }
})
// Reset outputExpanded mỗi khi chọn run khác (file lớn mặc định thu gọn)
watch(selectedRunId, () => { outputExpanded.value = false })

// ALD 27/05/2026 - Lazy-load events/output khi click run đã done. /workflows/:id/runs
// endpoint trả lightweight (chỉ status + dates) để tránh 25MB payload với 50 runs ×
// 500KB events. Khi user click 1 entry trong drawer, fetch detail qua /runs/:id rồi
// merge events + output + input. Tránh fetch lại nếu entry đã có events.
// Cuối cùng trigger reconcile cho entry này nếu output còn pending — cover case user
// click vào entry async (motion / fashion-motion) đã xong ở BE nhưng workflow_runs
// frozen ở pending state. Reconcile sẽ fetch motion_jobs / fashion_motion_jobs status
// thật + patch output.metadata.video URL.
watch(selectedRunId, async (runId) => {
  if (!runId) return
  const entry = testHistory.value.find((r) => r.id === runId)
  if (!entry || !entry._runId) return
  // ALD 18/06/2026 - Entry running: list endpoint KHÔNG trả events/definition, nên TRƯỚC
  // đây chỉ trông vào poll loop để bind. Nhưng loop có thể chưa attach (run start ở tab
  // khác / sau mount / reload mà resume miss) → click vào job đang chạy ra "0 events / ?
  // nodes". Fix: fetch detail NGAY để bind, rồi đảm bảo poll loop chạy tiếp (guard double).
  if (entry.status === 'running' || entry._live) {
    try {
      const detail = await wf.getRun(entry._runId)
      if (detail) {
        patchEntry(runId, {
          events: detail.events || entry.events || [],
          output: detail.output ?? entry.output,
          input:  detail.input  ?? entry.input,
          definition: detail.definition ?? entry.definition,   // để dựng snapshot graph + đếm node
          status: detail.status || entry.status,
        })
      }
    } catch (e) {
      console.warn('[history] running fetch fail:', e?.message)
    }
    if (entry._runId && !_activePolls.has(runId)) pollRunUntilDone(runId, entry._runId, entry.ts)
    return
  }
  // Lazy load events/definition nếu chưa có (definition cần để dựng snapshot graph read-only)
  if (!Array.isArray(entry.events) || entry.events.length === 0 || !entry.definition) {
    try {
      const detail = await wf.getRun(entry._runId)
      if (detail) {
        patchEntry(runId, {
          events: detail.events || [],
          output: detail.output ?? entry.output,
          input:  detail.input  ?? entry.input,
          error:  detail.error_msg ?? entry.error,
          definition: detail.definition ?? entry.definition,   // snapshot graph để xem read-only
        })
      }
    } catch (e) {
      console.warn('[history] lazy fetch detail fail:', e?.message)
    }
  }
  // Re-reconcile nếu entry vẫn còn pending sau lazy load (motion/fashion-motion async)
  const cur = testHistory.value.find((r) => r.id === runId)
  const m = cur?.output?.metadata
  if (m && m.job_id && (m.kind === 'motion' || m.kind === 'fashion-motion') && (m.pending || !m.video) && !m.image) {
    reconcileStalePendingJobs().catch((e) => console.warn('[history] reconcile fail:', e?.message))
  }
})

// #region ALD 31/05/2026 - History snapshot: xem run cũ → dựng lại ĐÚNG graph lúc đó (read-only).
// Trước đây chiếu kết quả lên canvas SỐNG → sai (canvas thêm node sau khi chạy → run cũ "mọc"
// node thừa). Chọn run done có definition → swap canvas sang snapshot của run; thoát → khôi phục.
const _liveDef = ref(null)         // backup canvas đang sửa (chỉ lưu khi lần đầu vào history)
const _snapshotRunId = ref(null)   // run đang được dựng snapshot lên canvas
function _runDefToNodes(def) {
  return (def?.nodes || []).map((n) => {
    const config = { ...(n.data?.config || {}) }
    if (n.data?.label && !config.label) config.label = n.data.label
    if (n.data?.purpose && !config.purpose) config.purpose = n.data.purpose
    return { id: n.id, type: 'step', position: n.position || { x: 100, y: 100 }, data: { type: n.type, config } }
  })
}
function _runDefToEdges(def) {
  return (def?.edges || []).map((e) => ({ ...e, label: e.data?.label || undefined, class: edgeClassFromLabel(e.data?.label), type: 'step' }))
}
function _enterSnapshot(run) {
  if (_snapshotRunId.value === run.id) return       // đã dựng rồi → bỏ qua (watcher fire nhiều lần)
  if (!_liveDef.value) _liveDef.value = currentDefinition()  // lưu canvas sống lần đầu
  nodes.value = _runDefToNodes(run.definition)
  edges.value = _runDefToEdges(run.definition)
  _snapshotRunId.value = run.id
}
function _exitSnapshot() {
  if (!_liveDef.value) return
  nodes.value = _runDefToNodes(_liveDef.value)
  edges.value = _runDefToEdges(_liveDef.value)
  _liveDef.value = null
  _snapshotRunId.value = null
}
// #endregion

// ALD 24/05/2026 - Khi user click chọn run khác trong drawer history, project state
// của run đó vào canvas: output node hiện video/metadata của run, mỗi node lấy
// _runState theo events node_id (success/warn/error), fashion-motion node lấy progress.
// Dep gồm cả output + events + status của run đã chọn → re-fire khi reconcileStalePendingJobs
// hoặc pollPendingFashionMotion patch entry (output.metadata.video flip từ null → URL).
watch([
  selectedRunId,
  () => testHistory.value.length,
  () => selectedTestRun.value?.output,
  () => selectedTestRun.value?.events,
  () => selectedTestRun.value?.status,
  () => selectedTestRun.value?.definition,
], () => {
  const run = selectedTestRun.value
  if (!run) {
    _exitSnapshot()   // thoát history → khôi phục canvas đang sửa
    // Không có run nào — reset tất cả node về idle
    for (const n of nodes.value) {
      if (n.data._runState || n.data._runOutput) {
        n.data = { ...n.data, _runState: null, _runOutput: null }
      }
    }
    return
  }
  // Read-only history: run đã xong + có snapshot definition → dựng lại ĐÚNG graph lúc đó.
  // Run đang chạy / không có definition → giữ canvas sống (khôi phục nếu đang ở snapshot).
  const _isDone = !['running', 'queued'].includes(String(run.status)) && !run._live
  if (_isDone && run.definition && (run.definition.nodes || []).length) _enterSnapshot(run)
  else _exitSnapshot()
  // Map node_id → outcome based on events trong run
  const eventsByNode = new Map()
  for (const ev of (run.events || [])) {
    if (!ev.node_id) continue
    const arr = eventsByNode.get(ev.node_id) || []
    arr.push(ev)
    eventsByNode.set(ev.node_id, arr)
  }
  // ALD 27/05/2026 - Inputs upload URL extraction: worker emits "Uploaded model → URL"
  // ở handler tryon/motion. Parse events của node consumer (tryon/motion) tìm các URL
  // này, map theo handle name (model/product/motion/audio) → tìm input node upstream
  // qua edges → set _runOutput URL để FlowNode render preview. Workflow_runs strip
  // staticData (base64 → empty) khi save nên cần URL từ worker upload.
  const inputUrlsByNodeId = new Map()
  // Build edge map: consumer_node_id → { handle → upstream_node_id }
  const upstreamByHandle = new Map()
  for (const e of (edges.value || [])) {
    if (!e.targetHandle) continue
    const m = upstreamByHandle.get(e.target) || {}
    m[e.targetHandle] = e.source
    upstreamByHandle.set(e.target, m)
  }
  // Parse "Uploaded <field> → <url>" from event messages on consumer nodes
  const uploadRe = /Uploaded\s+(\w+)\s+→\s+(https?:\/\/\S+)/
  // ALD 28/05/2026 - Input nodes tự emit URL với 2 pattern khác (không qua consumer):
  //   "Static image/video/audio: <filename> → URL"  (handleInput source=static path)
  //   "Library /audio: <filename> → URL"            (handleInput source=library path)
  // Match cho cả 2 → set vào inputUrlsByNodeId cho chính input node (KHÔNG cần upstream
  // lookup). Trước đây bị bỏ sót → input-motion (video MP4) + input-audio không hiện
  // preview khi click history dù events có URL.
  const inputSelfRe = /(?:Static\s+(?:image|video|audio|file)|Library\s+\/\w+):.+?(https?:\/\/\S+)/
  const publicHostForRewrite = (typeof window !== 'undefined' && window.location?.origin?.includes('localhost'))
    ? '' : (useRuntimeConfig?.()?.public?.motionBackendUrl || '')
  const rewriteUrl = (raw) => (publicHostForRewrite ? raw.replace(/https?:\/\/kong(?::\d+)?/i, publicHostForRewrite.replace(/\/$/, '')) : raw)
  for (const [consumerId, evs] of eventsByNode) {
    // (A) Consumer parse: "Uploaded model/product → URL" → set upstream input node URL
    const handles = upstreamByHandle.get(consumerId)
    if (handles) {
      for (const ev of evs) {
        const match = uploadRe.exec(ev.msg || '')
        if (!match) continue
        const [, field, rawUrl] = match
        const upstreamId = handles[field]
        if (!upstreamId) continue
        inputUrlsByNodeId.set(upstreamId, rewriteUrl(rawUrl))
      }
    }
    // (B) Input self-emit parse: input node's own events có URL → set cho chính nó
    for (const ev of evs) {
      const match = inputSelfRe.exec(ev.msg || '')
      if (!match) continue
      if (inputUrlsByNodeId.has(consumerId)) continue  // ưu tiên URL từ consumer (A)
      inputUrlsByNodeId.set(consumerId, rewriteUrl(match[1]))
    }
  }
  // (C) ALD 30/05/2026 - Nguồn TIN CẬY nhất: output.metadata chứa sẵn {handle}_url
  // (model_url/product_url/motion_url/audio_url) — KHÔNG phụ thuộc parse chuỗi log (vốn
  // hay miss). Map qua handle → upstream input node. Fix bug: click history input
  // image/video không fill / fill sai khi switch run.
  const outMetaForInputs = run.output?.metadata || {}
  for (const [consumerId, handleMap] of upstreamByHandle) {
    void consumerId
    for (const handle in handleMap) {
      const upId = handleMap[handle]
      if (inputUrlsByNodeId.has(upId)) continue
      const u = outMetaForInputs[`${handle}_url`]
      if (u && /^https?:\/\//.test(String(u))) inputUrlsByNodeId.set(upId, rewriteUrl(String(u)))
    }
  }
  for (const n of nodes.value) {
    const events = eventsByNode.get(n.id) || []
    const lastLevel = events.length ? events[events.length - 1].level : null
    let runState = null
    if (run.status === 'running' || run.status === 'queued') {
      runState = events.length ? 'running' : null
    } else if (lastLevel === 'error') runState = 'error'
    else if (lastLevel === 'warn') runState = 'warn'
    else if (events.some((e) => e.level === 'success')) runState = 'success'
    let runOutput = null
    // ALD 27/05/2026 - Input nodes: lấy URL upload đã extract từ events (workflow def
    // mất staticData khi save). Map type (image/video/audio) đúng key cho FlowNode preview.
    const inputType = n.data?.type
    const isInputNode = inputType === 'input' || inputType === 'inputText' || inputType === 'inputImage' || inputType === 'inputFile' || inputType === 'inputHistory'
    if (isInputNode && inputUrlsByNodeId.has(n.id)) {
      const url = inputUrlsByNodeId.get(n.id)
      const ct = n.data?.config?.contentType || 'image'
      const key = ct === 'video' ? 'video' : ct === 'audio' ? 'audio' : 'image'
      runOutput = { ...(runOutput || {}), [key]: url, _restoredFromRun: true }
    }
    // Output node lấy final run.output
    if (n.data.type === 'output' && run.output) {
      const m = run.output.metadata || {}
      runOutput = {
        video: m.video || null,
        videos: Array.isArray(m.videos) ? m.videos : (m.video ? [{ url: m.video }] : []),  // ALD 03/06/2026 - đa preset
        image: m.image || null,
        images: Array.isArray(m.images) ? m.images : (m.image ? [{ url: m.image }] : []),
        pending: !!m.pending,
        progress: m.progress || 0,
        current_step: m.current_step || '',
        job_status: m.job_status || run.status,
        job_id: m.job_id || null,
        aspect_ratio: m.aspect_ratio || null,
        quality: m.quality || null,
      }
      // ALD 30/05/2026 - Chỉ coi là 'running' khi pending VÀ CHƯA có output. Trước đây
      // job done (đã có video/image) nhưng metadata.pending còn stale (reconcile chưa kịp
      // flip) → vẫn hiện processing. Có output = done, bất kể pending flag.
      if (m.pending && !m.video && !m.image && !m.images?.length) runState = 'running'
    }
    // Fashion-motion + Debug node: lấy extra từ last info event (engine summary)
    if ((n.data.type === 'fashion-motion' || n.data.type === 'debug') && events.length) {
      const last = events[events.length - 1]
      if (last.extra) runOutput = { ...(runOutput || {}), ...last.extra }
    }
    // ALD 27/05/2026 - Tryon / Motion / Fashion-motion intermediate nodes: scan events
    // tìm event "giàu" nhất chứa previewUrl (engine mới) hoặc metadata.{image,video,tryon_url}
    // (engine cũ qua handleDebug summary). Trước đây không apply → canvas idle khi click
    // history entry cũ, dù events array có đầy đủ thông tin. Cover cả 2 shape.
    if ((n.data.type === 'tryon' || n.data.type === 'create-image' || n.data.type === 'compose' || n.data.type === 'motion' || n.data.type === 'fashion-motion') && events.length) {
      let found = null
      for (let i = events.length - 1; i >= 0; i--) {
        const ex = events[i].extra
        if (!ex) continue
        // ALD 27/05/2026 - Skip events có uploadedFor: đó là upload event cho upstream
        // input node (model/product/motion), không phải output của consumer. Trước đây
        // pick last event với previewUrl → ăn URL product → Tryon node hiện thumbnail
        // product trong lúc chưa chạy xong.
        if (ex.uploadedFor) continue
        if (ex.previewUrl) {
          const kind = ex.previewKind === 'video' ? 'video' : 'image'
          found = {
            [kind]: ex.previewUrl,
            metadata: ex.outputMeta || {},
          }
          break
        }
        if (ex.metadata && (ex.metadata.image || ex.metadata.video || ex.metadata.tryon_url || ex.metadata.images?.length)) {
          found = {
            image: ex.metadata.image || ex.metadata.tryon_url || ex.metadata.images?.[0]?.url || null,
            video: ex.metadata.video || null,
            images: Array.isArray(ex.metadata.images) ? ex.metadata.images : [],
            metadata: ex.metadata,
          }
          break
        }
      }
      if (found) runOutput = { ...(runOutput || {}), ...found }
    }
    n.data = { ...n.data, _runState: runState, _runOutput: runOutput }
  }
})
// Hiển thị 1-line error preview trong list item
function errorPreview(err) {
  if (!err) return ''
  return String(err).split('\n')[0].slice(0, 80)
}
// Hiển thị 1-line output preview
function outputPreview(text) {
  if (!text) return ''
  const s = String(text).replace(/\s+/g, ' ')
  // ALD 24/05/2026 - Friendly format cho fashion-motion pending text. Trước: hiển thị raw
  // "[pending] fashion-motion job abc..." gây cấn. Giờ: "Fashion Motion · đang xử lý…"
  const m = s.match(/^\[(\w+)\][\s]+fashion-motion\b/i)
  if (m) {
    const st = m[1].toLowerCase()
    if (st === 'pending' || st === 'queued') return t('editor.fmWaitingWorker')
    if (st === 'running') return t('editor.fmProcessing')
  }
  return s.slice(0, 80)
}
// Re-run với cùng input đã test (nhưng definition latest từ canvas).
// ALD 24/05/2026 - Confirm trước khi re-run vì job nặng (6-22 phút) + tốn GPU. Tránh
// accidental click (focus stuck trên button + Enter → kick job ngoài ý muốn).
async function rerunFromHistory(run) {
  const ok = await confirmDialog.ask({
    title: t('editor.rerunConfirmTitle'),
    message: t('editor.rerunConfirmMsg'),
    confirmText: t('editor.rerun'),
    cancelText: t('editor.cancel'),
    variant: 'primary',
  })
  if (!ok) return
  testInput.value = run?.input?.text || ''
  doTestRun()
}
// ALD 17/06/2026 - "Tiếp tục từ chỗ lỗi": chạy lại nhưng DÙNG LẠI node đã render xong (cache theo nội dung) →
// chỉ render node lỗi + phía sau. pendingResume gửi resume=true cho /test; doTestRun đọc rồi reset (mặc định = chạy mới).
const pendingResume = ref(false)
async function resumeFromHistory(run) {
  const ok = await confirmDialog.ask({
    title: t('editor.resumeConfirmTitle'),
    message: t('editor.resumeConfirmMsg'),
    confirmText: t('editor.resume'),
    cancelText: t('editor.cancel'),
    variant: 'primary',
  })
  if (!ok) return
  pendingResume.value = true
  testInput.value = run?.input?.text || ''
  doTestRun()
}
// Elapsed time của running test (re-eval mỗi giây qua reactive ref)
const _now = ref(Date.now())
let _nowTimer
watch(testRunning, (running) => {
  if (running) {
    _now.value = Date.now()
    _nowTimer = setInterval(() => { _now.value = Date.now() }, 1000)
  } else {
    clearInterval(_nowTimer); _nowTimer = null
  }
})
onBeforeUnmount(() => {
  clearInterval(_nowTimer)
  if (fmStreamInstance) fmStreamInstance.unsubscribeAll()
})
const runningStartTs = ref(0)
const runningElapsedMs = computed(() => testRunning.value && runningStartTs.value ? _now.value - runningStartTs.value : 0)
// #endregion

// Computed dirty — deep-equal current vs saved. KHÔNG dùng flag-based vì
// Vue Flow trigger nodes.value mutations (selection, drag end) → false positive.
// ALD 24/05/2026 - Strip staticData (base64) khỏi cả 2 vế khi compare dirty. staticData
// chỉ là session-local preview, không persist BE → không nên ảnh hưởng dirty flag.
function _normForDirty(def) {
  if (!def) return def
  // ALD 24/05/2026 - JSON deep clone (not structuredClone) vì definition có thể chứa
  // Vue reactive proxy / File ref → DataCloneError. JSON.stringify strip non-serializable.
  const clone = JSON.parse(JSON.stringify(def))
  for (const n of clone.nodes || []) {
    const c = n.data?.config
    if (c && c.staticData) c.staticData = ''
  }
  return clone
}
const dirty = computed(() => {
  if (!savedDefinition.value) return false
  return !isEqual(_normForDirty(currentDefinition()), _normForDirty(savedDefinition.value))
})

const { addNodes, addEdges, project, addSelectedNodes, removeSelectedNodes, getNodes } = useVueFlow()

// ALD 02/06/2026 - FIX "dây nối lệch khỏi cổng": khi giảm số cổng động (vd Teaser: Ảnh sản phẩm 4→1),
// các edge cũ trỏ tới cổng đã biến mất (product3/product4) → Vue Flow neo vào GIỮA node → dây 1 nơi,
// cổng 1 nơi. → Tự cắt edge trỏ tới cổng KHÔNG còn tồn tại. Cổng hợp lệ tính TỪ CONFIG (không phụ thuộc render).
function _validTeaserHandles(c) {
  const pc = Math.max(1, Math.min(6, Number(c?.productCount) || 1))
  const mc = Math.max(0, Math.min(3, Number(c?.modelCount) || 0))
  const sc = c?.sceneMode === 'reference' ? Math.max(0, Math.min(8, Number(c?.sceneCount) || 0)) : 0
  const ids = ['product']
  for (let i = 2; i <= pc; i++) ids.push('product' + i)
  if (mc >= 1) ids.push('model')
  for (let i = 2; i <= mc; i++) ids.push('model' + i)
  if (sc >= 1) ids.push('scene')
  for (let i = 2; i <= sc; i++) ids.push('scene' + i)
  return new Set(ids)
}
// ALD 15/06/2026 - SS cổng động: valid handle = N cổng đầu của [input, image2, image3] theo config.inputCount.
function _validSsHandles(c) {
  const n = Math.max(1, Math.min(3, Number(c?.inputCount) || 1))
  return new Set(['input', 'image2', 'image3'].slice(0, n))
}
function pruneDanglingEdges() {
  const byId = new Map(nodes.value.map((n) => [n.id, n]))
  const kept = edges.value.filter((e) => {
    if (!e.targetHandle) return true
    const tn = byId.get(e.target)
    const tt = tn?.data?.type
    if (tt === 'teaser') return _validTeaserHandles(tn.data.config).has(e.targetHandle)
    if (tt === 'ss') return _validSsHandles(tn.data.config).has(e.targetHandle)
    return true   // node khác: không prune
  })
  if (kept.length !== edges.value.length) edges.value = kept
}
let _pruneT = null
watch(nodes, () => { clearTimeout(_pruneT); _pruneT = setTimeout(pruneDanglingEdges, 250) }, { deep: true })

// ALD 28/05/2026 - History view = READ-ONLY. Khi user click 1 history entry, canvas
// auto-fill data của run đó (qua projection watcher). Lúc này KHÔNG cho phép Save (vì
// data trên canvas là snapshot run cũ, save sẽ overwrite workflow def với data đó) và
// KHÔNG cho phép Run (input đã pre-filled từ history, không phải session mới).
// "New Session" button: deselect history → projection reset → user upload lại + edit.
const isViewingHistory = computed(() => Boolean(selectedRunId.value))



// ALD 24/05/2026 - Cmd/Ctrl+A select all nodes. Esc bỏ chọn. Vue Flow chỉ cung cấp
// rubber-band selection mặc định — keyboard shortcut tự implement.
function selectAllNodes(e) {
  // Đang focus input/textarea → KHÔNG preventDefault, để Cmd+A chọn chữ native.
  const ae = typeof document !== 'undefined' ? document.activeElement : null
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return
  // Chỉ chặn default + chọn tất cả node khi đang ở canvas (không ở ô nhập liệu).
  e?.preventDefault()
  const all = getNodes.value
  if (!all.length) return
  addSelectedNodes(all)
}
function clearSelection() {
  const sel = getNodes.value.filter((n) => n.selected)
  if (sel.length) removeSelectedNodes(sel)
  selectedNodeId.value = null
}
const customNodeTypes = { step: markRaw(FlowNode) }

// Apple system colors per node
// ALD 15/06/2026 - Gom lại 7 nhóm theo CHỨC NĂNG cho gọn (trước: nhóm "Motion" phình 12 node trộn lẫn).
// `hidden:true` = ẩn khỏi palette (không kéo mới được) NHƯNG vẫn nằm trong ALL_TYPES + còn handler/inspector
// → workflow đã lưu dùng node đó vẫn hiển thị & chạy. 'compose' ẩn vì cùng backend Create Image (preset trùng).
const CATEGORIES = [
  {
    id: 'io', label: t('editor.catIo'),
    nodes: [
      { id: 'input',       label: 'Input Text',  hint: t('editor.hintInputText'),    icon: 'bi-chat-left-text', color: '#34C759', soft: '#E8F8EC' },
      { id: 'input-image', label: 'Input Image', hint: t('editor.hintInputImage'),           icon: 'bi-image',          color: '#34C759', soft: '#E8F8EC' },
      { id: 'input-video', label: 'Input Video', hint: t('editor.hintInputVideo'),         icon: 'bi-film',           color: '#34C759', soft: '#E8F8EC' },
      { id: 'input-audio', label: 'Input Audio', hint: t('editor.hintInputAudio'), icon: 'bi-music-note-beamed', color: '#34C759', soft: '#E8F8EC' },
      { id: 'input-file',  label: 'Input File',  hint: t('editor.hintInputFile'),            icon: 'bi-file-earmark',   color: '#34C759', soft: '#E8F8EC' },
      { id: 'output',      label: 'Output',      hint: t('editor.hintOutput'),                icon: 'bi-box-arrow-right', color: '#8E8E93', soft: '#EFEFF4' }
    ]
  },
  {
    id: 'image', label: t('editor.catImage'),
    nodes: [
      { id: 'create-image', label: 'Create Image', hint: t('editor.hintCreateImage'), icon: 'bi-images', color: '#AF52DE', soft: '#F4E9FB' },
      { id: 'tryon',        label: 'Thử đồ',       hint: t('editor.hintTryon'), icon: 'bi-person-vcard', color: '#FF9500', soft: '#FFF1DE' },
      { id: 'compose', label: 'Ghép vào mẫu', hint: t('editor.hintCompose'), icon: 'bi-person-bounding-box', color: '#5856D6', soft: '#ECECFB' }
    ]
  },
  {
    id: 'video', label: t('editor.catVideo'),
    nodes: [
      { id: 'motion',         label: 'Motion Control',  hint: t('editor.hintMotion'), icon: 'bi-film',         color: '#FF2D55', soft: '#FCE5EB' },
      { id: 'fashion-motion', label: 'Fashion Motion',  hint: t('editor.hintFashionMotion'), icon: 'bi-magic',        color: '#AF52DE', soft: '#F4E9FB' },
      { id: 'ss',             label: 'Ảnh → Video',     hint: t('editor.hintSs'), icon: 'bi-film', color: '#5856D6', soft: '#ECECFB' },
      { id: 'wan-i2v',        label: 'Ảnh đầu → cuối',  hint: t('editor.hintWanI2v'), icon: 'bi-camera-reels', color: '#FF2D55', soft: '#FCE5EB' },
      { id: 'text-to-video',  label: 'Text → Video',    hint: t('editor.hintTextToVideo'), icon: 'bi-camera-reels', color: '#FF2D55', soft: '#FCE5EB' },
      { id: 'bds',            label: 'Time-lapse xây dựng', hint: t('editor.hintBds'), icon: 'bi-buildings', color: '#FF9500', soft: '#FFF1DD' }
    ]
  },
  {
    id: 'talk', label: t('editor.catTalk'),
    nodes: [
      { id: 'talk',        label: 'Nói (lip-sync)',  hint: t('editor.hintTalk'), icon: 'bi-mic-fill', color: '#34C759', soft: '#E3F9E9' },
      { id: 'voiceover',   label: 'Lồng tiếng',      hint: t('editor.hintVoiceover'), icon: 'bi-soundwave', color: '#34C759', soft: '#E3F9E9' }
    ]
  },
  {
    id: 'film', label: t('editor.catFilm'),
    nodes: [
      { id: 'teaser',     label: 'Teaser',        hint: t('editor.hintTeaser'), icon: 'bi-camera-reels', color: '#FF2D55', soft: '#FCE5EB' },
      { id: 'concat',     label: 'Ghép cảnh',     hint: t('editor.hintConcat'), icon: 'bi-collection-play-fill', color: '#5856D6', soft: '#E8E8FB' },
      { id: 'subtitle',   label: 'Phụ đề + Dịch', hint: t('editor.hintSubtitle'), icon: 'bi-badge-cc', color: '#FF9500', soft: '#FFF1DD' }
    ]
  },
  {
    id: 'tools', label: t('editor.catTools'),
    nodes: [
      { id: 'http',        label: 'HTTP',        hint: t('editor.hintHttp'),              icon: 'bi-cloud-arrow-up-fill',    color: '#5856D6', soft: '#ECEBFB' },
      { id: 'condition',   label: 'Condition',   hint: t('editor.hintCondition'),         icon: 'bi-shuffle',                color: '#FF9500', soft: '#FFEFD9' },
      { id: 'validate',    label: 'Validate',    hint: t('editor.hintValidate'),      icon: 'bi-check2-square',          color: '#1F7D38', soft: '#DCF4E2' },
      { id: 'debug',       label: 'Debug',       hint: t('editor.hintDebug'), icon: 'bi-bug-fill',         color: '#FF9500', soft: '#FFEFD9' },
      { id: 'workflow',    label: 'Workflow',    hint: t('editor.hintWorkflow'),      icon: 'bi-diagram-3-fill',         color: '#FF2D55', soft: '#FCE5EB' }
    ]
  }
]
const ALL_TYPES = CATEGORIES.flatMap((c) => c.nodes)

const filteredCategories = computed(() => {
  const q = paletteSearch.value.trim().toLowerCase()
  // ALD 15/06/2026 - ẩn node có hidden:true khỏi palette (vẫn còn trong ALL_TYPES + handler cho workflow cũ).
  return CATEGORIES
    .map((c) => ({ ...c, nodes: c.nodes.filter((n) => !n.hidden && (!q || n.label.toLowerCase().includes(q) || n.hint.toLowerCase().includes(q))) }))
    .filter((c) => c.nodes.length > 0)
})

const selectedNode = computed(() => nodes.value.find((n) => n.id === selectedNodeId.value))

// ALD 24/05/2026 - Runtime data prop cho inspectors (vd InspectorDebug). Combine
// events từ selectedTestRun + output cuối + duration của node hiện tại.
const nodeRuntime = computed(() => {
  if (!selectedNode.value) return {}
  const run = selectedTestRun.value
  const nodeId = selectedNode.value.id
  const nodeEvents = (run?.events || []).filter((e) => e.node_id === nodeId)
  // ALD 25/05/2026 - Chỉ output của NODE NÀY. KHÔNG fallback run.output (= final workflow
  // output = Motion Transfer pending) — Debug node ở giữa chain sẽ show Motion Transfer
  // pending thay vì Tryon URL.
  // ALD 27/05/2026 - Robust fallback: tìm event "giàu" nhất (có previewUrl / outputMeta
  // từ engine mới, hoặc metadata.{model,product,tryon}_url từ handleDebug summary cũ).
  // Engine cũ emit success không có extra → last event = success → null. Engine mới
  // emit success kèm extra. Cả 2 shape đều được map về { metadata } để InspectorDebug
  // render previewGrid.
  let fallback = null
  for (let i = nodeEvents.length - 1; i >= 0; i--) {
    const ex = nodeEvents[i].extra
    if (!ex) continue
    if (ex.outputMeta || ex.previewUrl) {
      fallback = { metadata: ex.outputMeta || {}, image: ex.previewKind !== 'video' ? ex.previewUrl : undefined, video: ex.previewKind === 'video' ? ex.previewUrl : undefined }
      break
    }
    if (ex.metadata && (ex.metadata.tryon_url || ex.metadata.model_url || ex.metadata.image || ex.metadata.video)) {
      fallback = { metadata: ex.metadata, text: ex.text }
      break
    }
  }
  const nodeOutput = selectedNode.value.data._runOutput || fallback || null
  return {
    output: nodeOutput,
    events: nodeEvents,
    durationMs: run?.durationMs,
  }
})

// ALD 24/05/2026 - Pending job info extract từ selectedTestRun.output.metadata
// để render Pending Job tracker section trong drawer detail. Live progress qua poll.
// ALD 24/05/2026 - Job info luôn return có state field. Template branch state để render
// layout riêng cho running / cancelled / error / done thay vì reuse 1 layout + chỉ đổi
// status flag.
const pendingJobInfo = computed(() => {
  const m = selectedTestRun.value?.output?.metadata
  if (!m || !m.job_id) return null
  const runStatus = selectedTestRun.value?.status
  let state = 'running'
  if (m.job_status === 'cancelled' || runStatus === 'cancelled') state = 'cancelled'
  else if (m.job_status === 'error' || (runStatus === 'error' && m.pending !== true)) state = 'error'
  // ALD 30/05/2026 - done khi CÓ output (video HOẶC image — tryon trả image), hoặc
  // job_status='done', hoặc workflow run success mà không còn pending async. Trước đây
  // chỉ xét m.video → tryon (image) kẹt mãi 'running' dù đã có output.png.
  else if (m.video || m.image || m.images?.length || m.job_status === 'done' || (runStatus === 'success' && !m.pending)) state = 'done'
  const images = Array.isArray(m.images) ? m.images : (m.image ? [{ url: m.image }] : [])
  return {
    state,
    job_id: m.job_id,
    kind: m.kind || 'fashion-motion',
    progress: m.progress || 0,
    current_step: m.current_step || '',
    video_url: m.video || m.image || images[0]?.url || null,
    images,
    // ALD 25/05/2026 - is_image cho tryon-only path (Stage 1 stop_after_tryon) → render
    // <img> thay vì <video> trong detail panel. metadata.image set khi extension là PNG/JPG.
    is_image: (!!m.image || images.length > 0) && !m.video,
    eta: state === 'running' && m.progress ? estimateEta(m.progress) : '',
    error: selectedTestRun.value?.error || '',
  }
})
function estimateEta(progress) {
  if (!progress || progress >= 1) return ''
  // Giả định tổng ~12 phút cho 30s-720p preset
  const totalMin = 12
  const remainMin = totalMin * (1 - progress)
  return remainMin < 1 ? t('editor.etaUnder1Min') : t('editor.etaMinutes', { n: Math.ceil(remainMin) })
}

// ALD 24/05/2026 - Cancel fashion-motion job theo y/c user.
async function onCancelFashionJob(jobId) {
  if (!jobId) return
  const ok = await useConfirm().ask({
    title: t('editor.cancelJobConfirmTitle'),
    message: t('editor.cancelJobConfirmMsg'),
    confirmText: t('editor.cancelJob'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    const auth = useAuth()
    // ALD 25/05/2026 - Dispatch endpoint theo kind của entry
    const entry = testHistory.value.find((r) => r.output?.metadata?.job_id === jobId)
    const kind = entry?.output?.metadata?.kind || 'fashion-motion'
    const endpoint = kind === 'motion' ? 'motion-jobs' : 'fashion-motion-jobs'
    await auth.apiFetch(`/functions/v1/${endpoint}/${jobId}`, { method: 'DELETE' })
    toast.success(t('editor.toastJobCancelRequested'), { duration: 3000 })
    if (fmStreamInstance) fmStreamInstance.unsubscribe(jobId)
    // Mark entry locally
    if (entry) {
      patchEntry(entry.id, {
        status: 'error',
        error: t('editor.errCancelledByUser'),
        output: { ...entry.output, metadata: { ...entry.output.metadata, pending: false, job_status: 'cancelled' } },
      })
    }
  } catch (e) {
    toast.error(t('editor.toastCancelFailed', { err: e?.message || e }), { duration: 5000 })
  }
}
const currentNodeStyle = computed(() => ALL_TYPES.find((t) => t.id === selectedNode.value?.data?.type) || { color: '#8E8E93', soft: '#EFEFF4', icon: 'bi-circle', label: '?' })

function miniMapColor(node) {
  return ALL_TYPES.find((t) => t.id === node.data?.type)?.color || '#8E8E93'
}

function edgeClassFromLabel(label) {
  return {
    true: 'edge-true', false: 'edge-false',
    success: 'edge-success', error: 'edge-error'
  }[label] || ''
}

onMounted(async () => {
  // ALD 24/05/2026 - Bug fix order: load workflow def TRƯỚC rồi mới load test history.
  // Trước đó: loadTestHistory chạy song song với wf.get → testHistory watcher fire khi
  // nodes.value vẫn empty → projection watcher iterate 0 nodes → output node không nhận
  // _runState='running'/_runOutput → reload bị mất binding yellow border + video preview.
  const wfData = await wf.get(route.params.id)
  workflow.value = wfData
  if (!wfData) return
  const def = wfData.definition || { nodes: [], edges: [] }
  nodes.value = (def.nodes || []).map((n) => {
    // ALD 27/05/2026 - Migration seed (021-023) lưu label/purpose ở `data.label` và
    // `data.purpose` (ngoài config). Inspector đọc từ `config.label` → empty UI.
    // Normalize ngược vào config nếu chưa có. New nodes (drag-drop) lưu trong config
    // từ đầu nên không bị ảnh hưởng. Đảm bảo source-of-truth duy nhất = config.
    const config = { ...(n.data?.config || {}) }
    if (n.data?.label && !config.label) config.label = n.data.label
    if (n.data?.purpose && !config.purpose) config.purpose = n.data.purpose
    return {
      id: n.id,
      type: 'step',
      position: n.position || { x: 100, y: 100 },
      data: { type: n.type, config }
    }
  })
  edges.value = (def.edges || []).map((e) => ({
    ...e,
    label: e.data?.label || undefined,
    class: edgeClassFromLabel(e.data?.label),
    type: 'step'
  }))
  await nextTick()
  pruneDanglingEdges()   // cắt edge trỏ cổng đã biến mất (teaser giảm count) → dây không neo vào giữa node
  savedDefinition.value = currentDefinition()
  // Sau khi nodes populated: load history (projection watcher sẽ bind đúng) + resume polls
  await loadTestHistory()
  resumeLivePolls()
})

// (dirty là computed deep-equal, không cần watch trigger flag)

function onDragStart(ev, type) {
  ev.dataTransfer.setData('application/vueflow', type)
  ev.dataTransfer.effectAllowed = 'move'
}

function onDrop(ev) {
  ev.preventDefault()
  if (isViewingHistory.value) return // xem lại history = read-only, không thêm node
  const paletteId = ev.dataTransfer.getData('application/vueflow')
  if (!paletteId) return
  // ALD 24/05/2026 - Palette variants input-image / -video / -audio / -file đều map về type='input',
  // chỉ khác default contentType. Audio + File mặc định source='library' (pick từ /audio /storage),
  // Image + Video mặc định source='static' (upload device).
  const variantMap = { 'input-image': 'image', 'input-video': 'video', 'input-audio': 'audio', 'input-file': 'file' }
  const type = variantMap[paletteId] ? 'input' : paletteId
  const bounds = ev.currentTarget.getBoundingClientRect()
  const position = project({ x: ev.clientX - bounds.left, y: ev.clientY - bounds.top })
  const id = `${paletteId}-${Date.now().toString(36)}`
  let config
  if (variantMap[paletteId]) {
    const ct = variantMap[paletteId]
    const libraryDefault = ct === 'audio' || ct === 'file'
    config = libraryDefault
      ? { contentType: ct, source: 'library', field: ct, libraryId: '' }
      : { contentType: ct, source: 'static',  field: ct, staticData: '', staticMime: '', staticName: '' }
  } else {
    config = defaultConfig(type)
  }
  addNodes([{ id, type: 'step', position, data: { type, config } }])
  selectedNodeId.value = id
}

// #region ALD 17/06/2026 - Generator pipeline "Time-lapse Xây dựng BĐS": chọn số công đoạn (2–6) + lồng tiếng → tự sinh
// chuỗi node, nối sẵn. Engine duyệt tuyến tính (1 node 1 cổng ra) nên KHÔNG fan-out 1 ảnh ra N node: mỗi công đoạn có
// 1 input-root RIÊNG (cùng field=image → 1 lần upload dùng chung) → create-image(edit) → ss(i2v) → [voiceover] → concat.
const BDS_VOICES = [
  { id: 'alloy', label: 'alloy', icon: 'bi-soundwave' },
  { id: 'nova', label: 'nova', icon: 'bi-gender-female' },
  { id: 'Puck', label: 'Puck', icon: 'bi-gender-male' },
]
// 6 công đoạn chuẩn (đầu = mặt bằng trống, cuối = hoàn thiện); chọn N mốc rải đều giữa 2 đầu.
// ALD 17/06/2026 - image+motion prompt PHẢI tiếng ANH (provider).
// narration GIỮ tiếng Việt (đó là giọng đọc TTS). image = lệnh BIẾN ĐỔI mạnh + giữ nguyên góc máy/bối cảnh.
// ALD 17/06/2026 - GÓC QUAY: công đoạn đang-xây (mọi entry TRỪ cuối) = camera ĐỨNG YÊN, góc rộng CHÍNH DIỆN (cùng
// góc ảnh gốc) → 3 clip liền mạch/khớp nhau; CHỈ entry CUỐI (hoàn thiện) mới FLYCAM. image tả máy móc/công nhân đang xây.
const BDS_CANON = [
  {
    image: 'Completely demolish and remove the finished house. Show an early construction site on the same plot: a bare leveled dirt lot with survey stakes and string lines, an excavator digging the foundation pit, a few workers in hard hats. NO house, NO walls. Keep the EXACT same WIDE FRONTAL camera angle as the original photo, same street and neighboring houses. Photorealistic daytime.',
    motion: 'Static wide frontal locked shot, the camera does NOT move at all: an excavator digs the foundation and workers in hard hats walk around the bare construction site, light dust, realistic daytime activity.',
    narration: 'Khởi đầu từ mặt bằng đất trống, máy móc và đội ngũ bắt đầu đào móng, đặt nền cho ngôi nhà tương lai.',
  },
  {
    image: 'An active early construction site on the same plot: a bulldozer and excavator leveling dirt, stacked building materials, a concrete mixer truck, workers in hard hats; bare ground, NO house structure yet. Keep the EXACT same WIDE FRONTAL camera angle and surroundings. Photorealistic daytime.',
    motion: 'Static wide frontal locked camera, NO camera movement: a bulldozer levels the soil and workers carry materials around the site, busy realistic construction, daytime.',
    narration: 'Mặt bằng được san gạt, máy móc và vật liệu tập kết, sẵn sàng cho thi công.',
  },
  {
    image: 'A construction site on the same plot: poured concrete foundation slab with exposed steel rebar and partly-built brick ground-floor walls, scaffolding, a concrete mixer, workers laying bricks. NO roof, NO finished walls, NO paint. Keep the EXACT same WIDE FRONTAL camera angle and surroundings. Photorealistic daytime.',
    motion: 'Static wide frontal locked camera, NO camera movement: workers lay bricks and operate a concrete mixer building the ground floor, scaffolding, busy construction activity, daytime.',
    narration: 'Móng vững chắc hoàn thành, tường tầng một dần hình thành qua bàn tay người thợ.',
  },
  {
    image: 'A construction site on the same plot: second-floor concrete frame with columns and beams, full scaffolding around the structure, a tower crane lifting materials, workers building on the upper floor, unfinished bare walls. Keep the EXACT same WIDE FRONTAL camera angle and surroundings. Photorealistic daytime.',
    motion: 'Static wide frontal locked camera, NO camera movement: a tower crane lifts materials and workers build the upper-floor frame, scaffolding everywhere, active construction, daytime.',
    narration: 'Ngôi nhà vươn cao với khung tầng hai và giàn giáo, từng bước định hình công trình.',
  },
  {
    image: 'A near-complete construction site on the same plot: all floors built, rooftop poured, walls being plastered and primed, some scaffolding remaining, workers finishing the facade. Keep the EXACT same WIDE FRONTAL camera angle and surroundings. Photorealistic daytime.',
    motion: 'Static wide frontal locked camera, NO camera movement: workers plaster and paint the facade and take down scaffolding, finishing touches, daytime.',
    narration: 'Phần thô hoàn tất, công nhân tô trát và sơn hoàn thiện những công đoạn cuối.',
  },
  {
    image: 'The fully finished, freshly painted house with glass windows, tiled roof, clean landscaping and a green garden, no scaffolding, no construction, no workers. Keep the EXACT same plot and surroundings. Photorealistic, warm daylight.',
    motion: 'Cinematic aerial flycam drone shot slowly rising and pulling back to reveal the completed house and its surroundings from above, smooth gentle elegant camera motion, warm daylight.',
    narration: 'Và đây là thành quả cuối cùng: ngôi nhà hoàn thiện khang trang, sẵn sàng chào đón gia đình của bạn.',
  },
]
// ALD 17/06/2026 - Cảnh đêm TUỲ CHỌN (luôn là cảnh CUỐI khi bật): nhà hoàn thiện về đêm + flycam đêm.
const BDS_NIGHT = {
  image: 'The same fully finished house at NIGHT: warm interior lights glowing through the windows, exterior facade and garden lights on, deep blue evening sky, softly lit landscaping, no construction. Keep the EXACT same plot and surroundings. Photorealistic cinematic night scene.',
  motion: 'Cinematic aerial flycam at night slowly revealing the beautifully lit house, warm glowing windows, deep blue sky, smooth elegant camera motion.',
  narration: 'Khi màn đêm buông xuống, ngôi nhà bừng sáng ấm áp — một tổ ấm trọn vẹn cho gia đình bạn.',
}
function bdsPickStages(n) {
  const N = Math.max(2, Math.min(6, Number(n) || 2))
  const last = BDS_CANON.length - 1
  // rải đều N mốc trên [0..last], đầu=0 (mặt bằng), cuối=last (hoàn thiện)
  return Array.from({ length: N }, (_, k) => {
    const idx = Math.round((k * last) / (N - 1))
    return { ...BDS_CANON[idx] }
  })
}
const bdsGenOpen = ref(false)
const bdsGen = reactive({ sceneCount: 4, voiceover: true, voice: 'alloy', nightScene: false, stages: bdsPickStages(4) })
// Đổi số công đoạn → dựng lại danh sách prompt mặc định (chưa lưu lên canvas nên reset thoải mái).
watch(() => bdsGen.sceneCount, (n) => { bdsGen.stages = bdsPickStages(n) })

async function buildBdsPipeline() {
  if (!isOwned.value || isViewingHistory.value) return
  // Regenerate: nếu canvas đã có node tự sinh (_gen==='bds') → xác nhận xoá & dựng lại (mất prompt đã sửa tay).
  const existing = nodes.value.filter((n) => n.data?.config?._gen === 'bds')
  if (existing.length) {
    const ok = await confirmDialog.ask({
      title: t('editor.bdsRebuildTitle'),
      message: t('editor.bdsRebuildMsg'),
      confirmText: t('editor.rebuild'), cancelText: t('editor.cancel'), variant: 'danger',
    })
    if (!ok) return
    const gid = new Set(existing.map((n) => n.id))
    nodes.value = nodes.value.filter((n) => !gid.has(n.id))
    edges.value = edges.value.filter((e) => !gid.has(e.source) && !gid.has(e.target))
  }
  const stamp = Date.now().toString(36)
  const nid = (p, i) => `bds-${p}-${stamp}-${i}`
  let ec = 0
  const eid = () => `bdsedge-${stamp}-${ec++}`
  const COL = 320, ROW = 200, X0 = 80, Y0 = 80
  const lastCol = bdsGen.voiceover ? 4 : 3
  // ALD 17/06/2026 - Cảnh đêm tuỳ chọn = APPEND làm công đoạn CUỐI cùng (sau "hoàn thiện"). total = N (+1 nếu đêm).
  const allStages = bdsGen.nightScene ? [...bdsGen.stages, BDS_NIGHT] : [...bdsGen.stages]
  const total = allStages.length
  const midY = Y0 + ((total - 1) * ROW) / 2
  const newNodes = [], newEdges = [], tails = []
  // 1 ẢNH ĐẦU VÀO DUY NHẤT (nhà hoàn thiện) → tỏa vào các công đoạn (engine hỗ trợ fan-out vào node đa-input).
  const inId = nid('in', 0)
  newNodes.push({ id: inId, type: 'step', position: { x: X0, y: midY }, data: { type: 'input', config: { contentType: 'image', source: 'session', field: 'image', label: t('editor.bdsInputLabel'), staticData: '', staticMime: '', staticName: '', _gen: 'bds' } } })
  for (let i = 1; i <= total; i++) {
    const st = allStages[i - 1] || {}
    const y = Y0 + (i - 1) * ROW
    const ciId = nid('ci', i)
    newNodes.push({ id: ciId, type: 'step', position: { x: X0 + COL, y }, data: { type: 'create-image', config: { ...defaultConfig('create-image'), imageMode: 'edit', inputCount: 1, aspectRatio: '9:16', prompt: st.image || '', _gen: 'bds', _stage: i } } })
    newEdges.push({ id: eid(), source: inId, target: ciId, sourceHandle: undefined, targetHandle: 'image1', data: {} })
    const ssId = nid('wi2v', i)
    newNodes.push({ id: ssId, type: 'step', position: { x: X0 + COL * 2, y }, data: { type: 'wan-i2v', config: { ...defaultConfig('wan-i2v'), aspectRatio: '9:16', prompt: st.motion || '', _gen: 'bds', _stage: i } } })
    newEdges.push({ id: eid(), source: ciId, target: ssId, sourceHandle: undefined, targetHandle: undefined, data: {} })
    let tail = ssId
    if (bdsGen.voiceover) {
      const voId = nid('vo', i)
      newNodes.push({ id: voId, type: 'step', position: { x: X0 + COL * 3, y }, data: { type: 'voiceover', config: { ...defaultConfig('voiceover'), voice: bdsGen.voice || 'alloy', script: st.narration || '', _gen: 'bds', _stage: i } } })
      newEdges.push({ id: eid(), source: ssId, target: voId, sourceHandle: undefined, targetHandle: undefined, data: {} })
      tail = voId
    }
    tails.push(tail)
  }
  const cnId = nid('concat', 0)
  newNodes.push({ id: cnId, type: 'step', position: { x: X0 + COL * lastCol, y: midY }, data: { type: 'concat', config: { ...defaultConfig('concat'), clipCount: total, _gen: 'bds' } } })
  tails.forEach((t, k) => newEdges.push({ id: eid(), source: t, target: cnId, sourceHandle: undefined, targetHandle: `clip${k + 1}`, data: {} }))
  const outId = nid('out', 0)
  newNodes.push({ id: outId, type: 'step', position: { x: X0 + COL * (lastCol + 1), y: midY }, data: { type: 'output', config: { format: 'video', _gen: 'bds' } } })
  newEdges.push({ id: eid(), source: cnId, target: outId, sourceHandle: undefined, targetHandle: undefined, data: {} })
  addNodes(newNodes)
  addEdges(newEdges)
  bdsGenOpen.value = false
  selectedNodeId.value = cnId
}
// #endregion

function defaultConfig(type) {
  switch (type) {
    case 'input':     return { contentType: 'text', source: 'session', field: 'text' }
    case 'output':    return { format: 'image' }
    // ALD 18/06/2026 - default config provider-based (engine/model do provider quyết định ở Cài đặt → Provider).
    case 'motion':    return { prompt: '', aspectRatio: '9:16' }
    case 'fashion-motion': return { prompt: '', garmentType: 'upper', productCount: 1, aspectRatio: '9:16' }
    case 'tryon':     return { garmentType: 'auto', productCount: 1, prompt: '' }
    case 'create-image': return { prompt: '', negativePrompt: '', inputCount: 0, aspectRatio: 'auto' }
    case 'compose':   return { prompt: '', subjectKind: 'person', personCount: 1 }
    case 'text-to-video': return { prompt: '', aspectRatio: '16:9' }
    case 'ss':        return { prompt: '', inputCount: 1, aspectRatio: '9:16' }
    case 'wan-i2v':   return { prompt: '', aspectRatio: '9:16' }
    case 'talk':      return { line: '', voice: 'alloy' }
    case 'voiceover': return { script: '', voice: 'alloy', mix: 'replace' }
    case 'concat':    return { clipCount: 2, transition: 'cut', fps: 25 }
    case 'subtitle':  return { mode: 'translate', targetLang: 'vi' }
    case 'workflow':  return { slug: '' }
    case 'condition': return { expression: 'text.length > 100' }
    case 'http':      return { method: 'POST', url: '', headers: {}, body: '', timeout: 30000 }
    case 'validate':    return { required_fields: [], math_checks: [], strict: false }
    case 'debug':       return { label: 'Debug step', captureImage: true, captureVideo: true, captureAudio: false, captureText: true }
    default:            return {}
  }
}

function onNodeClick({ node }) { selectedNodeId.value = node.id }

function onNodesChange(changes) {
  for (const c of changes) {
    if (c.type === 'remove' && c.id === selectedNodeId.value) selectedNodeId.value = null
  }
}

function onConnect(connection) {
  if (isViewingHistory.value) return // read-only khi xem history
  const sourceNode = nodes.value.find((n) => n.id === connection.source)
  let label = null
  let className = ''
  // Condition node: true/false branches
  if (sourceNode?.data?.type === 'condition') {
    label = connection.sourceHandle || 'true'
    className = label === 'true' ? 'edge-true' : 'edge-false'
    const dup = edges.value.find((e) => e.source === connection.source && e.sourceHandle === label)
    if (dup) {
      toast.error(t('editor.toastBranchHasEdge', { label }))
      return
    }
  }
  // onError='route' node: success/error branches
  else if ((sourceNode?.data?.config?.onError) === 'route' && connection.sourceHandle) {
    label = connection.sourceHandle  // 'success' | 'error'
    className = label === 'error' ? 'edge-error' : 'edge-success'
    const dup = edges.value.find((e) => e.source === connection.source && e.sourceHandle === label)
    if (dup) {
      toast.error(t('editor.toastBranchHasEdge', { label }))
      return
    }
  }
  addEdges([{
    id: `${connection.source}-${connection.target}-${Date.now().toString(36)}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    label,
    data: label ? { label } : undefined,
    class: className,
    type: 'step'
  }])
}

function updateNodeConfig(newConfig) {
  if (!selectedNode.value) return
  // Giữ field onError (common config) khi inspector update — inspector chỉ care type-specific keys.
  const prevOnError = selectedNode.value.data.config?.onError
  selectedNode.value.data = {
    ...selectedNode.value.data,
    config: { ...newConfig, ...(prevOnError ? { onError: prevOnError } : {}) }
  }
  dirty.value = true
}

function canHaveErrorRoute(type) {
  // input*, output, condition không có error branch (logic không phù hợp); api-key là node config (không chạy)
  return !['input', 'inputText', 'inputImage', 'inputFile', 'inputHistory', 'output', 'condition'].includes(type)
}

function onOnErrorChange(value) {
  if (!selectedNode.value) return
  selectedNode.value.data = {
    ...selectedNode.value.data,
    config: { ...(selectedNode.value.data.config || {}), onError: value }
  }
  // Khi switch từ 'route' về stop/continue, xoá edges sourceHandle='error' để dọn dangling
  if (value !== 'route') {
    edges.value = edges.value.filter((e) => !(e.source === selectedNode.value.id && e.sourceHandle === 'error'))
  }
  dirty.value = true
}

function onDeleteNode() {
  if (!selectedNode.value) return
  const id = selectedNode.value.id
  nodes.value = nodes.value.filter((n) => n.id !== id)
  edges.value = edges.value.filter((e) => e.source !== id && e.target !== id)
  selectedNodeId.value = null
}

async function onSave() {
  // Đang xem history (canvas đang là snapshot read-only) → KHÔNG lưu (tránh đè canvas sống).
  if (isViewingHistory.value) return
  if (!dirty.value || saving.value) return
  saving.value = true
  try {
    // ALD 27/05/2026 - Static source giờ upload thẳng lên bucket khi user pick file
    // (Inspector onFileSelected → staticUrl persistent). DB lưu URL nhẹ, không cần strip.
    // Vẫn strip staticData nếu có (fallback base64 từ workflow legacy hoặc upload fail)
    // để tránh bloat payload — nhưng count nhỏ + cảnh báo nhẹ hơn vì staticUrl đã giữ data.
    const definition = currentDefinition()
    const toSave = JSON.parse(JSON.stringify(definition))
    let strippedLegacy = 0
    for (const n of toSave.nodes || []) {
      const c = n.data?.config
      if (!c || typeof c !== 'object') continue
      if (c.staticData && c.staticData.length > 1024) {
        c.staticData = ''
        if (c.source === 'static' && !c.staticUrl) strippedLegacy++
      }
    }
    await wf.update(route.params.id, { definition: toSave })
    savedDefinition.value = toSave
    if (strippedLegacy > 0) {
      toast.warning(t('editor.toastStaticLegacy', { n: strippedLegacy }), { duration: 6000 })
    } else {
      toast.success(t('editor.toastSaved'))
    }
  } catch (err) {
    toast.error(err.data?.error || err.message || t('editor.toastSaveFailed'))
  } finally {
    saving.value = false
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }
}

// Scan input nodes — nếu có node nào source=session, cần ask user; nếu không, run thẳng.
const sessionInputs = computed(() =>
  nodes.value
    .filter((n) => {
      const t = n.data?.type
      const isInputType = t === 'input' || t === 'inputText' || t === 'inputImage' || t === 'inputFile' || t === 'inputHistory'
      if (!isInputType) return false
      const source = n.data.config?.source || 'session'
      return source === 'session'
    })
    .map((n) => ({
      id: n.id,
      contentType: n.data.config?.contentType || ({ inputText: 'text', inputImage: 'image', inputFile: 'file', inputHistory: 'history' }[n.data.type] || 'text'),
      field: n.data.config?.field || (n.data.config?.contentType || 'text')
    }))
)

// Có job đang active polling (sống sót qua reload nhờ _live flag trong localStorage)
const hasActiveRun = computed(() => testHistory.value.some((r) => r.status === 'running'))

// #region ALD 12/06/2026 - MULTI-RUN TAB (kiểu VS Code): backend đã chạy song song (WF_CONCURRENCY +
// WORKER_CONCURRENCY) → FE cho phép nhiều run cùng lúc trong 1 workflow. Mỗi run đang chạy TỰ có 1 tab
// phía trên canvas; run xong giữ tab tới khi user bấm ✕ (entry vẫn nằm trong history drawer). Tab
// "Soạn thảo" = về chế độ edit (selectedRunId=null). Poll nền đã sẵn: chỉ run đang chọn mới chiếu lên
// canvas (projection watcher key theo selectedRunId), các run khác poll ngầm.
const openTabIds = ref([])
const runTabs = computed(() => {
  const ids = []
  for (const r of testHistory.value) if (r.status === 'running' && !ids.includes(r.id)) ids.push(r.id)
  for (const id of openTabIds.value) if (!ids.includes(id)) ids.push(id)
  return ids.map((id) => testHistory.value.find((r) => r.id === id)).filter(Boolean)
})
function focusRunTab(id) {
  if (!openTabIds.value.includes(id)) openTabIds.value.push(id)
  selectedRunId.value = id
  selectedNodeId.value = null
}
// Về tab Workflow (trang soạn thảo): bỏ chọn run → projection watcher khôi phục canvas sống. Chuyển qua
// lại tự do kể cả khi run đang chạy nền (run vẫn poll bình thường).
function focusEditTab() {
  selectedRunId.value = null
  selectedNodeId.value = null
}
// ALD 12/06/2026 - "Phiên mới": về canvas SỐNG để soạn prompt mới. TUYỆT ĐỐI KHÔNG chạy job (tách hẳn khỏi
// nút "Chạy workflow"). Run đang chạy vẫn poll nền, tab của nó vẫn còn.
function newBlankSession() {
  _exitSnapshot()            // khôi phục canvas đang sửa nếu đang xem snapshot 1 run
  selectedRunId.value = null
  selectedNodeId.value = null
  toast.info(t('editor.toastNewSession'), { duration: 3000 })
}
function closeRunTab(id) {
  openTabIds.value = openTabIds.value.filter((x) => x !== id)
  if (selectedRunId.value === id) focusEditTab()
}
function tabTime(r) {
  try { return new Date(r.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return String(r.id).slice(0, 6) }
}
// #endregion

// ALD 26/05/2026 - Pre-validate input nodes source=library trước khi submit run.
// Sau khi duplicate workflow, libraryId có thể rỗng / trỏ tới item của user gốc →
// engine throw lỗi sau khi job đã start. Validate FE → toast rõ node nào, user
// mở inspector pick lại không tốn 1 chu kỳ submit-fail.
function validateLibraryInputs() {
  const missing = nodes.value.filter((n) => {
    const t = n.data?.type
    const isInputType = t === 'input' || t === 'inputText' || t === 'inputImage' || t === 'inputFile' || t === 'inputHistory'
    if (!isInputType) return false
    const c = n.data.config || {}
    return c.source === 'library' && !c.libraryId
  })
  if (missing.length === 0) return true
  const names = missing.map((n) => `"${n.data.config?.label || n.data?.type || n.id}"`).join(', ')
  toast.error(t('editor.toastLibraryInputMissing', { names }), { duration: 6000 })
  return false
}

async function openTestRun() {
  // ALD 12/06/2026 - nút "Chạy workflow" LUÔN hiện. Nếu đang xem 1 run (canvas = snapshot read-only) thì về
  // trang Workflow + khôi phục canvas SỐNG trước khi chạy (tránh chạy nhầm definition của run đang xem).
  if (isViewingHistory.value) {
    _exitSnapshot()
    selectedRunId.value = null
    await nextTick()
  }
  // ALD 18/06/2026 - FE-only: KHÔNG giới hạn số run song song (chạy bao nhiêu luồng cũng được).
  if (!validateLibraryInputs()) return
  // ALD 24/05/2026 - Workflow không có session input → confirm trước khi run thay vì
  // chạy thẳng. Tránh accidental Enter trên focused CTA button kick job nặng.
  if (sessionInputs.value.length === 0) {
    // Detect heavy workflow (có fashion-motion / motion node) → confirm dialog
    const hasHeavyNode = nodes.value.some((n) => n.data?.type === 'fashion-motion' || n.data?.type === 'motion')
    if (hasHeavyNode) {
      const ok = await confirmDialog.ask({
        title: t('editor.runConfirmTitle'),
        message: t('editor.runConfirmHeavyMsg'),
        confirmText: t('editor.run'),
        cancelText: t('editor.cancel'),
        variant: 'primary',
      })
      if (!ok) return
    }
    doTestRun()
    return
  }
  testRunOpen.value = true
}

// Cancel: mark entry as error locally, dừng poll loop (server job vẫn finish
// nhưng FE không care nữa). Người dùng có thể chạy test mới.
// ALD 28/05/2026 - REAL cancel: gọi BE POST /workflows/runs/:id/cancel để cascade
// cancel xuống motion_jobs + fashion_motion_jobs. Worker poll DB mỗi 2s detect →
// huỷ tiến trình. Trước đây chỉ patch FE local entry → server không
// biết → job vẫn chạy nốt 8-22 phút → user spam Cancel + Run mới → 3 jobs
// concurrent → server load 297 + sshd starve.
// ALD 18/06/2026 - FE-only: cancel = ghi status='cancelled' vào run record cục bộ + dừng poll.
// Engine đọc cờ này (hoặc đơn giản là FE không còn theo dõi). KHÔNG gọi backend.
async function cancelRun(entry) {
  if (!entry || (entry.status !== 'running' && entry.status !== 'queued')) return
  const runId = entry._runId || entry.id
  patchEntry(entry.id, { status: 'cancelled', error: t('editor.errCancelled'), _live: false, durationMs: Date.now() - entry.ts })
  testRunning.value = false
  runningStartTs.value = 0
  try {
    const run = await wf.getRun(runId)
    if (run) await db.put('workflow_runs', { ...run, status: 'cancelled' })
    toast.success(t('editor.toastRunCancelled'), { duration: 2500 })
  } catch (e) {
    toast.error(t('editor.toastCancelError', { err: e?.message || e }), { duration: 4000 })
  }
}

// Apply run state vào nodes trên canvas từ events array.
// Priority: error > warn > success > idle (error không bị override).
function applyRunStateFromEvents(events) {
  for (const ev of events || []) {
    if (!ev.node_id) continue
    const node = nodes.value.find((n) => n.id === ev.node_id)
    if (!node) continue
    const cur = node.data._runState
    if (ev.level === 'error') node.data._runState = 'error'
    else if (ev.level === 'warn' && cur !== 'error') node.data._runState = 'warn'
    else if (ev.level === 'success' && cur !== 'error' && cur !== 'warn') node.data._runState = 'success'
    // ALD 27/05/2026 - extra.uploadedFor: engine emit URL với uploadedFor = source input
    // node ID khi upload base64 lên storage cho tryon/fashion-motion. Project URL lên
    // input node để Inspector dùng làm fallback preview (sau khi staticData strip).
    if (ev.extra?.uploadedFor && ev.extra?.previewUrl) {
      const srcNode = nodes.value.find((n) => n.id === ev.extra.uploadedFor)
      if (srcNode) {
        const kind = ev.extra.previewKind === 'video' ? 'video'
                   : ev.extra.previewKind === 'audio' ? 'audio' : 'image'
        srcNode.data = {
          ...srcNode.data,
          _runOutput: { ...(srcNode.data._runOutput || {}), [kind]: ev.extra.previewUrl }
        }
      }
    }
    // ALD 27/05/2026 - Engine đính kèm previewUrl trong event.extra khi node xong →
    // populate _runOutput để FlowNode render preview ngay tại intermediate node
    // (tryon hiển thị ảnh kết quả, motion/fashion-motion hiển thị video).
    if (ev.extra?.previewUrl && !ev.extra?.uploadedFor) {
      const kind = ev.extra.previewKind === 'video' ? 'video' : 'image'
      node.data = {
        ...node.data,
        _runOutput: {
          ...(node.data._runOutput || {}),
          [kind]: ev.extra.previewUrl,
          metadata: ev.extra.outputMeta || node.data._runOutput?.metadata || {}
        }
      }
    }
  }
}

// Patch existing history entry by id (immutable replace)
function patchEntry(entryId, patch) {
  const idx = testHistory.value.findIndex((r) => r.id === entryId)
  if (idx < 0) return
  testHistory.value = [
    ...testHistory.value.slice(0, idx),
    { ...testHistory.value[idx], ...patch },
    ...testHistory.value.slice(idx + 1)
  ]
  persistTestHistory()
}

// Poll loop cho 1 run — lookup entry theo entryId, update events/output live.
// Có thể được gọi từ doTestRun (lần đầu) hoặc resume khi mount (đã có entry).
// ALD 18/06/2026 - Track entry đang có poll loop chạy → tránh 2 loop cùng poll 1 entry
// (resumeLivePolls lúc mount + click watcher khởi động lại khi loop cũ đã thoát/cross-tab).
const _activePolls = new Set()

async function pollRunUntilDone(entryId, runId, startTs) {
  if (_activePolls.has(entryId)) return   // đã có loop khác poll entry này rồi
  _activePolls.add(entryId)
  const POLL_INTERVAL = 1500
  // ALD 24/05/2026 - Bỏ cap 15 phút (quá hẹp — fashion-motion legit 6-22p, marketing
  // pipeline 5-15p). Engine tự set workflow_runs.status='error' khi fail, FE chỉ
  // dừng poll khi: (a) user cancel entry, (b) status terminal. Tab đóng → poll dừng.
  let lastEventCount = -1
  testRunning.value = true
  runningStartTs.value = startTs

  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))
    // Check user đã cancel entry này chưa (status đổi sang error trong localStorage)
    const cur = testHistory.value.find((r) => r.id === entryId)
    if (!cur || cur.status !== 'running') {
      testRunning.value = false
      runningStartTs.value = 0
      _activePolls.delete(entryId)
      return
    }
    let run
    try {
      run = await wf.getRun(runId)
    } catch (err) {
      console.warn('[poll] getRun fail, retry next:', err?.message)
      continue
    }
    if (!run) continue
    const events = run.events || []
    if (events.length !== lastEventCount) {
      lastEventCount = events.length
      // ALD 28/05/2026 - Bug fix: chỉ apply state vào canvas KHI user đang xem ENTRY này.
      // Trước đây resumeLivePolls (chạy onMounted) gọi applyRunStateFromEvents bất kể
      // selectedRunId → mở page mà có job nền đang chạy → canvas tự fill state run đó
      // dù user chưa click history → trông như "data cũ persist". Giữ patchEntry để
      // testHistory entry vẫn update events mới, nhưng node mutation skip.
      if (selectedRunId.value === entryId) {
        applyRunStateFromEvents(events)
      }
      patchEntry(entryId, { events, durationMs: Date.now() - startTs })
    }
    if (run.status === 'success' || run.status === 'error') {
      patchEntry(entryId, {
        status: run.status,
        output: run.output,
        events,
        error: run.error_msg || null,
        durationMs: Date.now() - startTs,
        _live: false,
        _runId: runId   // giữ lại cho debug
      })
      // ALD 24/05/2026 - Set _runOutput cho output node để FlowNode render preview video.
      // Nếu output metadata có pending=true (fashion-motion async) → start polling.
      // ALD 28/05/2026 - Chỉ mutate canvas output node KHI user đang xem entry này. Trước
      // đây resumeLivePolls (background) override canvas dù selectedRunId khác → user
      // reload page thấy preview của job background tự fill vào canvas.
      if (run.status === 'success' && run.output) {
        const isViewing = selectedRunId.value === entryId
        const outputNode = isViewing ? nodes.value.find((n) => n.data.type === 'output') : null
        if (outputNode) {
          outputNode.data = { ...outputNode.data, _runOutput: run.output.metadata || {}, _runState: 'success' }
        }
        const meta = run.output.metadata || {}
        if (meta.pending && (meta.kind === 'fashion-motion' || meta.kind === 'motion') && meta.job_id) {
          if (outputNode) outputNode.data = { ...outputNode.data, _runState: 'running' }
          // pollPendingFashionMotion tự check selectedRunId trong applySnapshot — pass outputNode.id
          // chỉ khi đang viewing để guard rõ hơn. Nếu user click vào sau, watcher projection
          // sẽ re-populate từ entry.output (đã patch ở patchEntry trên).
          const outputNodeRaw = nodes.value.find((n) => n.data.type === 'output')
          pollPendingFashionMotion(entryId, meta.job_id, outputNodeRaw?.id, { kind: meta.kind })
        }
      }
      if (run.status === 'error' && selectedRunId.value === entryId) toast.error(run.error_msg || t('editor.toastWorkflowError'), { duration: 5000 })
      testRunning.value = false
      runningStartTs.value = 0
      _activePolls.delete(entryId)
      return
    }
  }
}

// ALD 24/05/2026 - Poll fashion-motion job async (handler returns pending sau khi submit).
// 5s/lần, 30 phút deadline. Update output node._runOutput khi done.
// ALD 24/05/2026 - Synthetic progress: worker chỉ emit ở coarse milestone (0.10, 0.30, 0.95)
// nên giữa các mốc đó FE tự nội suy + xoay caption để UX không bị stuck "30%" 10 phút.
// Tổng ETA expected ~12 phút cho 30s-720p (sampler ~10 phút).
const FM_STAGES = [
  { p: 0.05, label: t('editor.fmStageSending') },
  { p: 0.25, label: t('editor.fmStageProcessingImage') },
  { p: 0.55, label: t('editor.fmStageBuildingVideo') },
  { p: 0.85, label: t('editor.fmStageFinishing') },
  { p: 0.99, label: t('editor.fmStageAlmostDone') }
]
function fmStageFor(elapsed, totalMs = 12 * 60 * 1000) {
  const r = Math.min(0.99, elapsed / totalMs)
  for (let i = FM_STAGES.length - 1; i >= 0; i--) {
    if (r >= FM_STAGES[i].p) return { ...FM_STAGES[i], synthetic: r }
  }
  return { ...FM_STAGES[0], synthetic: r }
}

// ALD 24/05/2026 - Lazy-init SSE stream singleton (auto reconnect, no FE polling).
let fmStreamInstance = null
function getFmStream() {
  if (!fmStreamInstance) fmStreamInstance = useFashionMotionStream()
  return fmStreamInstance
}

async function pollPendingFashionMotion(entryId, jobId, outputNodeId, opts = {}) {
  // ALD 24/05/2026 - SSE subscriber. opts.isResume=true khi gọi từ resumeLivePolls →
  // skip mọi toast (đang xử lý / hoàn tất / lỗi) vì user reload mới và job có thể đã xong
  // từ phiên trước → không cần spam toast. Toast chỉ fire cho transitions thật trong phiên.
  const HEARTBEAT_MS = 8000
  const start = Date.now()
  let lastSyntheticMsg = ''
  let lastSyntheticTs = 0
  let sawRunning = false  // chỉ toast terminal khi đã thấy job running ít nhất 1 lần trong phiên
  if (!opts.isResume) {
    toast.info(t('editor.toastFmProcessing'), { duration: 4000 })
  }
  // Apply một snapshot data (từ SSE status event) lên node + entry
  function applySnapshot(data) {
    if (!data) return false
    // ALD 24/05/2026 - Chỉ patch canvas khi user đang xem ĐÚNG entry này. Background
    // SSE từ resumeLivePolls KHÔNG override canvas của user (vd reload page, entry chưa
    // được click → canvas phải clean, không hiện progress/video từ job background).
    const isViewing = selectedRunId.value === entryId
    const node = (isViewing && outputNodeId) ? nodes.value.find((n) => n.id === outputNodeId) : null
    const elapsed = Date.now() - start
    const stage = fmStageFor(elapsed)
    const beProgress = Number(data.progress) || 0
    const effectiveProgress = Math.max(beProgress, stage.synthetic)
    const pct = Math.round(effectiveProgress * 100)
    const stepLabel = (data.current_step && data.current_step !== 'queued') ? data.current_step : stage.label
      if (node) {
        node.data = {
          ...node.data,
          _runState: data.status === 'done' ? 'success' : data.status === 'error' ? 'error' : 'running',
          _runOutput: {
            ...(node.data._runOutput || {}),
            progress: effectiveProgress,
            current_step: stepLabel,
            job_status: data.status,
          },
        }
      }
      // Update run entry + emit progress events
      const entry = testHistory.value.find((r) => r.id === entryId)
      if (entry) {
        const newMsg = `${stepLabel} (${pct}%)`
        const shouldEmit =
          newMsg !== lastSyntheticMsg ||
          Date.now() - lastSyntheticTs > HEARTBEAT_MS
        const newEvents = entry.events || []
        if (shouldEmit) {
          newEvents.push({ ts: Date.now(), level: 'info', msg: newMsg, node_id: outputNodeId })
          lastSyntheticMsg = newMsg
          lastSyntheticTs = Date.now()
        }
        patchEntry(entryId, {
          events: newEvents,
          output: {
            ...(entry.output || {}),
            text: `[${data.status}] ${stepLabel} — ${pct}% · job ${jobId.slice(0, 8)}`,
            metadata: {
              ...(entry.output?.metadata || {}),
              progress: effectiveProgress,
              current_step: stepLabel,
              job_status: data.status,
            },
          },
          durationMs: elapsed,
        })
      }
    // Track running → terminal transition để chỉ toast cho job đang chạy chuyển done/error/cancel
    if (data.status === 'running' || data.status === 'queued') sawRunning = true
    const shouldToast = !opts.isResume && sawRunning
    if (data.status === 'done') {
      const url = data.output_url || ''
      // ALD 24/05/2026 - stop_after_tryon → output PNG → set image. Else video.
      const isImage = /\.(png|jpe?g|webp)(\?|$)/i.test(data.output_path || url)
      const mediaKey = isImage ? 'image' : 'video'
      if (node) {
        node.data = {
          ...node.data,
          _runOutput: { ...(node.data._runOutput || {}), [mediaKey]: url, output_path: data.output_path, pending: false },
          _runState: 'success',
        }
      }
      // ALD 27/05/2026 - Patch luôn producer node (Motion Transfer / Tryon / Fashion Motion)
      // bằng URL output → user thấy video/ảnh preview tại chính node generate, không
      // chỉ ở Output. Engine emit producerJobId trong event.extra khi queue job.
      const entryRef = testHistory.value.find((r) => r.id === entryId)
      const producerEvent = (entryRef?.events || []).find((e) => e.extra?.producerJobId === jobId)
      if (producerEvent?.node_id) {
        const producerNode = nodes.value.find((n) => n.id === producerEvent.node_id)
        if (producerNode && producerNode.id !== outputNodeId) {
          producerNode.data = {
            ...producerNode.data,
            _runOutput: { ...(producerNode.data._runOutput || {}), [mediaKey]: url, output_path: data.output_path, pending: false },
            _runState: 'success',
          }
        }
      }
      const entryDone = testHistory.value.find((r) => r.id === entryId)
      if (entryDone) {
        patchEntry(entryId, {
          output: {
            ...(entryDone.output || {}),
            text: url,
            metadata: { ...(entryDone.output?.metadata || {}), pending: false, [mediaKey]: url, progress: 1 },
          },
        })
      }
      if (shouldToast) toast.success(t('editor.toastFmDone'), { duration: 5000 })
      // ALD 25/05/2026 - Push notification cho job done. Persist qua localStorage,
      // hiện ở bell icon trên top bar layout (mọi page). Click noti → navigate workflow.
      if (sawRunning) noti.push({
        kind: 'done',
        title: t('editor.notiFmDoneTitle'),
        body: t('editor.notiFmDoneBody', { job: jobId.slice(0, 8), kind: isImage ? t('editor.kindTryonImage') : t('editor.kindVideo') }),
        jobId,
        workflowId: route.params.id,
      })
      getFmStream().unsubscribe(jobId)
      return true
    }
    if (data.status === 'error') {
      if (node) node.data = { ...node.data, _runState: 'error' }
      const entryErr = testHistory.value.find((r) => r.id === entryId)
      if (entryErr) patchEntry(entryId, {
        status: 'error',
        error: data.error || t('editor.errFmJob'),
        // ALD 24/05/2026 - Clear pending flag để drawer "Job đang chạy" ẩn đi.
        output: {
          ...(entryErr.output || {}),
          metadata: { ...(entryErr.output?.metadata || {}), pending: false, job_status: 'error' },
        },
      })
      if (shouldToast) toast.error(t('editor.toastFmError', { err: data.error || '' }), { duration: 6000 })
      if (sawRunning) noti.push({
        kind: 'error',
        title: t('editor.notiFmErrorTitle'),
        body: (data.error || t('editor.jobFailed')).split('\n')[0].slice(0, 120),
        jobId,
        workflowId: route.params.id,
      })
      getFmStream().unsubscribe(jobId)
      return true
    }
    if (data.status === 'cancelled') {
      if (node) node.data = { ...node.data, _runState: 'warn' }
      const entryCanc = testHistory.value.find((r) => r.id === entryId)
      if (entryCanc) patchEntry(entryId, {
        status: 'error',
        error: t('editor.errJobCancelled'),
        output: {
          ...(entryCanc.output || {}),
          metadata: { ...(entryCanc.output?.metadata || {}), pending: false, job_status: 'cancelled' },
        },
      })
      if (shouldToast) toast.info(t('editor.toastFmCancelled'), { duration: 4000 })
      if (sawRunning) noti.push({
        kind: 'cancel',
        title: t('editor.notiFmCancelledTitle'),
        body: t('editor.notiFmCancelledBody', { job: jobId.slice(0, 8) }),
        jobId,
        workflowId: route.params.id,
      })
      getFmStream().unsubscribe(jobId)
      return true
    }
    return false
  }

  // SSE subscribe — kind=motion → /motion-jobs SSE, default fashion-motion-jobs.
  getFmStream().subscribe(jobId, {
    kind: opts.kind || 'fashion-motion',
    onStatus: (s) => { applySnapshot({
      // ALD 24/05/2026 - BE giờ include output_url + tryon_output_url (signed) khi
      // status terminal, FE bind video preview ngay không phải reload.
      status: s.status, progress: s.progress, current_step: s.current_step,
      output_url: s.output_url || null, output_path: s.output_path,
      tryon_output_url: s.tryon_output_url || null, error: s.error,
    })},
    onEnd: () => { /* unsubscribe đã handle trong applySnapshot khi terminal */ },
    onWarn: (w) => console.warn('[fm-stream] warn:', w),
  })
}

// Test async — push entry với _live:true NGAY khi kick xong, poll loop update.
// Reload vẫn giữ entry trong localStorage, mount sẽ resume poll.
async function doTestRun() {
  // ALD 17/06/2026 - đọc cờ resume ("Tiếp tục") rồi RESET ngay → các run sau mặc định = chạy mới (fresh).
  const resumeFlag = pendingResume.value
  pendingResume.value = false
  // ALD 26/05/2026 - Re-check ở doTestRun vì còn 2 path khác bypass openTestRun:
  // (1) modal "Chạy với input" submit, (2) keyboard shortcut Cmd+Enter trong textarea.
  if (!validateLibraryInputs()) return
  testRunOpen.value = false
  drawerVisible.value = true
  for (const n of nodes.value) if (n.data) n.data._runState = 'idle'

  // ALD 28/05/2026 - Auto-save workflow nếu dirty trước khi run. Lý do: input nodes
  // có thể đã upload file thành công (staticUrl set trong FE memory) nhưng chưa save
  // vào DB. Run với _testDef snapshot OK nhưng next reload mất URL → click history
  // entry thấy input empty. Auto-save đảm bảo state input persist vào DB workflow
  // definition, kể cả khi user quên click "Lưu".
  // ALD 01/06/2026 - CHỈ auto-save khi là chủ workflow. Non-owner chạy workflow public:
  // bỏ qua save (PUT owner-only → 403 "Không có quyền"); definition vẫn gửi nguyên qua
  // /test bên dưới nên run vẫn đủ input. Trước đây save vô điều kiện → non-owner dính 403.
  if (dirty.value && !saving.value && isOwned.value) {
    try {
      await onSave()
    } catch (e) {
      console.warn('[doTestRun] auto-save fail (continue run anyway):', e?.message || e)
    }
  }

  const definition = currentDefinition()
  const input = { text: testInput.value }

  // ALD 26/05/2026 - Total static file ≤ 25MB OK (raw bytes). Tính raw size từ
  // base64 (length × 0.75). User upload nhiều file static cùng workflow vẫn chạy
  // nếu tổng dưới ngưỡng. Quá ngưỡng → bảo user dùng Library source (/storage).
  const sendDef = JSON.parse(JSON.stringify(definition))
  let totalBytes = 0
  for (const n of sendDef.nodes || []) {
    const c = n.data?.config
    if (c?.source === 'static' && c.staticData) totalBytes += Math.floor(c.staticData.length * 0.75)
  }
  const STATIC_TOTAL_LIMIT = 25 * 1024 * 1024
  if (totalBytes > STATIC_TOTAL_LIMIT) {
    const mb = (totalBytes / 1024 / 1024).toFixed(1)
    toast.error(
      t('editor.toastStaticTooBig', { mb }),
      { duration: 8000 }
    )
    testRunning.value = false
    runningStartTs.value = 0
    return
  }
  const startTs = Date.now()
  const entryId = `${startTs}-${Math.random().toString(36).slice(2, 6)}`

  // Push entry ngay với status='running' để UI thấy job + persist localStorage
  const entry = {
    id: entryId,
    ts: startTs,
    durationMs: 0,
    input,
    triggers: getInputTriggers(definition),
    status: 'running',
    error: null,
    output: null,
    events: [],
    snapshot: { nodeCount: definition.nodes.length, edgeCount: definition.edges.length },
    _live: true,
    _runId: null
  }
  testHistory.value = [entry, ...testHistory.value].slice(0, 20)
  selectedRunId.value = entryId
  if (!openTabIds.value.includes(entryId)) openTabIds.value.push(entryId)  // pin tab multi-run
  persistTestHistory()
  testRunning.value = true
  runningStartTs.value = startTs

  // Kick async
  let runId
  try {
    const kick = await wf.test(route.params.id, sendDef, input, { resume: resumeFlag })
    runId = kick?.run_id
    if (!runId) throw new Error(t('editor.errNoRunId'))
    patchEntry(entryId, { _runId: runId })
  } catch (err) {
    const errMsg = (err?.name === 'AbortError' || err?.name === 'TimeoutError')
      ? t('editor.errKickTimeout')
      : (err?.message?.includes('Failed to fetch') ? t('editor.errLostConnection', { msg: err.message }) : (err?.data?.error || err?.message || t('editor.errKickUnknown')))
    patchEntry(entryId, { status: 'error', error: errMsg, durationMs: Date.now() - startTs, _live: false })
    toast.error(errMsg, { duration: 6000 })
    testRunning.value = false
    runningStartTs.value = 0
    return
  }

  // Poll cho đến khi xong
  await pollRunUntilDone(entryId, runId, startTs)
}

// Resume polling khi user reload page mà có entry còn _live=true
// ALD 24/05/2026 - Bỏ cap 30 phút stale (quá hẹp — job render lâu).
// reconcileStalePendingJobs đã sync trạng thái thật từ fashion_motion_jobs.status nên
// FE không cần đoán "stale" bằng wall clock — BE là source of truth.
function resumeLivePolls() {
  const live = (testHistory.value || []).filter((r) => r._live && r._runId)
  for (const entry of live) {
    console.log('[resume] resume poll for', entry._runId)
    pollRunUntilDone(entry.id, entry._runId, entry.ts)   // fire-and-forget, parallel safe
  }

  // Resume SSE cho fashion-motion HOẶC motion async jobs (job_id trong metadata).
  const pendingFashion = (testHistory.value || []).filter((r) => {
    const m = r.output?.metadata
    const isAsync = m && m.job_id && (m.kind === 'fashion-motion' || m.kind === 'motion')
    return isAsync && !m.video && r.status !== 'error' && r.status !== 'cancelled'
  })
  for (const entry of pendingFashion) {
    const jobId = entry.output.metadata.job_id
    const kind = entry.output.metadata.kind
    const outputNode = nodes.value.find((n) => n.data?.type === 'output')
    console.log('[resume] resume', kind, 'poll for', jobId)
    pollPendingFashionMotion(entry.id, jobId, outputNode?.id, { isResume: true, kind })
  }
}

// Mô tả các Input node thực tế (source + nguồn data) cho test history.
// Replace "(empty)" cho user UX rõ hơn.
function getInputTriggers(def) {
  const inputs = (def.nodes || []).filter((n) => {
    const t = n.type
    return t === 'input' || t === 'inputText' || t === 'inputImage' || t === 'inputFile' || t === 'inputHistory'
  })
  return inputs.map((n) => {
    const c = n.data?.config || {}
    const ct = c.contentType || ({ inputText: 'text', inputImage: 'image', inputFile: 'file', inputHistory: 'history' }[n.type] || 'text')
    const source = c.source || 'session'
    let detail = ''
    if (source === 'session') detail = `session.${c.field || ct}`
    else if (source === 'url') {
      try { detail = new URL(c.url || '').hostname + new URL(c.url || '').pathname.slice(0, 40) } catch { detail = c.url?.slice(0, 50) || '(no url)' }
    }
    else if (source === 'static') {
      if (ct === 'text') detail = c.staticText?.slice(0, 60) || '(empty)'
      else detail = c.staticName || '(no upload)'
    }
    return { nodeId: n.id, contentType: ct, source, detail }
  })
}

// Build definition từ in-memory state — giống logic onSave nhưng KHÔNG save BE
function currentDefinition() {
  return {
    nodes: nodes.value.map((n) => ({
      id: n.id, type: n.data.type, position: n.position,
      data: { config: n.data.config || {} }
    })),
    edges: edges.value.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      sourceHandle: e.sourceHandle,
      // ALD 24/05/2026 - targetHandle required cho multi-input nodes (fashion-motion)
      // để engine map đúng input slot. Bug trước: bỏ field này → engine không phân biệt
      // được model/product/motion → handler báo "thiếu input 'model'".
      targetHandle: e.targetHandle,
      data: e.data || (e.label ? { label: e.label } : undefined)
    }))
  }
}

// Test history persistence
// ALD 24/05/2026 - Test history giờ source of truth là BE workflow_runs.
// loadTestHistory() fetch list từ /workflows/:id/runs (đã include output + events).
// persistTestHistory() KHÔNG còn lưu localStorage — engine tự update workflow_runs khi
// emit events. Chỉ giữ localStorage làm offline fallback (legacy compat).
// ALD 18/06/2026 - FE-only: nạp run từ local db ([[useWorkflows]].listRuns), KHÔNG gọi backend.
async function loadTestHistory() {
  try {
    const rows = await wf.listRuns(route.params.id)
    testHistory.value = (rows || [])
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .map((row) => {
        const status = ['success', 'error', 'cancelled', 'running', 'queued'].includes(row.status) ? row.status : 'error'
        const derivedStatus = status === 'queued' ? 'running' : status === 'cancelled' ? 'error' : status
        const ts = new Date(row.created_at || Date.now()).getTime()
        return {
          id: row.id,
          _runId: row.id,
          _live: status === 'running' || status === 'queued',
          status: derivedStatus,
          ts,
          durationMs: null,
          input: row.input || {},
          output: row.output || null,
          events: row.events || [],
          error: null,
        }
      })
  } catch (e) {
    console.warn('[testHistory] load local fail:', e?.message)
    testHistory.value = []
  }
}

// ALD 18/06/2026 - FE-only: không còn job async backend để reconcile. Engine chạy đồng bộ
// trong browser; pollRunUntilDone đọc local db là đủ. Giữ hàm (no-op) để call-site không vỡ.
async function reconcileStalePendingJobs() { return }
// Local-only patch (đợi sync round-trip BE thì lag) — engine cũng tự lưu BE qua emit.
function persistTestHistory() {
  try {
    localStorage.setItem(`wf:test:${route.params.id}`, JSON.stringify(testHistory.value))
  } catch { /* quota exceeded — silent */ }
}
// ALD 24/05/2026 - Xoá 1 run riêng lẻ. Confirm trước khi delete BE + remove khỏi list.
// ALD 27/05/2026 - Chỉ gọi BE khi entry có _runId (UUID workflow_runs.id).
// Entries chỉ có id local (`Date.now()-rand`, kick /test fail trước khi nhận run_id)
// thì remove thẳng local — tránh DELETE 404 do BE regex /[a-f0-9-]{36}/ reject.
async function deleteSingleRun(run) {
  if (!run) return
  const ok = await confirmDialog.ask({
    title: t('editor.deleteRunTitle'),
    message: t('editor.deleteRunMsg', { time: fmtTime(run.ts), status: run.status }),
    confirmText: t('editor.delete'),
    cancelText: t('editor.cancel'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    if (run._runId) await db.remove('workflow_runs', run._runId)
    testHistory.value = testHistory.value.filter((r) => r.id !== run.id)
    if (selectedRunId.value === run.id) selectedRunId.value = testHistory.value[0]?.id || null
    persistTestHistory()
    toast.success(t('editor.toastRunDeleted'))
  } catch (e) {
    toast.error(t('editor.toastDeleteFail', { err: e?.message || e }))
  }
}

// ALD 24/05/2026 - Clear giờ delete cả workflow_runs ở BE (trước đó chỉ xoá local +
// localStorage → reload bị khôi phục từ BE). BE chỉ delete row terminal (success/error/
// cancelled) — runs còn queued/running giữ lại để FE vẫn theo dõi job đang chạy.
async function clearTestHistory() {
  const ok = await confirmDialog.ask({
    title: t('editor.clearHistoryTitle'),
    message: t('editor.clearHistoryMsg', { n: testHistory.value.length }),
    confirmText: t('editor.delete'),
    cancelText: t('editor.cancel'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    // FE-only: xoá run terminal khỏi local db; giữ run đang chạy.
    const rows = await wf.listRuns(route.params.id)
    let deleted = 0
    for (const r of rows || []) {
      if (r.status === 'running' || r.status === 'queued') continue
      await db.remove('workflow_runs', r.id); deleted++
    }
    testHistory.value = (testHistory.value || []).filter((r) => r.status === 'running' || r.status === 'queued')
    if (!testHistory.value.find((r) => r.id === selectedRunId.value)) selectedRunId.value = null
    toast.success(t('editor.toastRunsDeleted', { n: deleted }))
  } catch (e) {
    toast.error(t('editor.toastDeleteFailed', { err: e?.message || e }))
  }
}

const config = useRuntimeConfig()

// #region ALD 22/05/2026 - API modal: Sync + Async config + cURL previews
// Một modal duy nhất gộp cả Sync & Async API. Async toggle OFF → chỉ hiện
// Sync cURL. Toggle ON → hiện thêm callback URL + headers + Async cURL + payload.
const asyncModalOpen = ref(false)
const asyncSaving = ref(false)
const asyncConfig = reactive({
  async_enabled: false,
  callback_url: '',
  // List dạng [{ key, value }] cho UI add/remove — convert sang object khi save
  callback_headers_list: []
})

function openAsyncModal() {
  if (!workflow.value) return
  asyncConfig.async_enabled = !!workflow.value.async_enabled
  asyncConfig.callback_url = workflow.value.callback_url || ''
  const headers = workflow.value.callback_headers || {}
  asyncConfig.callback_headers_list = Object.entries(headers).map(([key, value]) => ({ key, value: String(value) }))
  if (asyncConfig.callback_headers_list.length === 0) {
    asyncConfig.callback_headers_list.push({ key: '', value: '' })  // start với 1 row trống
  }
  asyncModalOpen.value = true
}
function addHeader() {
  asyncConfig.callback_headers_list.push({ key: '', value: '' })
}
function removeHeader(idx) {
  asyncConfig.callback_headers_list.splice(idx, 1)
  if (asyncConfig.callback_headers_list.length === 0) {
    asyncConfig.callback_headers_list.push({ key: '', value: '' })
  }
}

// Headers object đã sanitize (bỏ row trống) — dùng cho cả preview lẫn save
const asyncHeadersObj = computed(() => {
  const obj = {}
  for (const { key, value } of asyncConfig.callback_headers_list) {
    const k = String(key || '').trim()
    if (k && typeof value === 'string') obj[k] = value
  }
  return obj
})

// Sample payload từ Input nodes (dùng cho cả Sync + Async cURL preview).
// Output: { payloadStr: <json-pretty>, notes: <string[]> }
//   - Session inputs → fields trong payload với example theo content type
//   - URL/static inputs → KHÔNG cần truyền payload; thêm vào notes
//   - Nếu workflow chưa có input node nào → fallback shape mẫu (text/image/file)
//     để API consumer hình dung shape upload base64 từ device
function sampleValueFor(contentType) {
  if (contentType === 'text') return 'Nội dung user message'
  if (contentType === 'history') return [{ role: 'user', content: 'Câu hỏi trước' }, { role: 'assistant', content: 'Trả lời trước' }]
  if (contentType === 'image') return { name: 'image.png', mimeType: 'image/png', data: '<base64-encoded-image>' }
  // file (default)
  return { name: 'document.pdf', mimeType: 'application/pdf', data: '<base64-encoded-file>' }
}

const samplePayload = computed(() => {
  const def = currentDefinition()
  const inputNodes = (def.nodes || []).filter((n) => /^input/.test(n.type))
  const fields = []
  const notes = []

  if (inputNodes.length === 0) {
    // Workflow chưa có input node → show generic shape mẫu để dev biết shape upload
    return {
      payloadStr: JSON.stringify({
        text: 'Nội dung user message',
        image: sampleValueFor('image'),
        file: sampleValueFor('file')
      }, null, 2),
      notes: [
        'Workflow chưa có Input node — payload trên chỉ là shape mẫu.',
        'File/image upload từ device: read → base64 → đặt vào field "data".'
      ]
    }
  }

  for (const n of inputNodes) {
    const c = n.data?.config || {}
    const ct = c.contentType || ({ inputText: 'text', inputImage: 'image', inputFile: 'file', inputHistory: 'history' }[n.type] || 'text')
    const field = c.field || ct
    const source = c.source || 'session'
    if (source === 'session') {
      fields.push([field, sampleValueFor(ct)])
    } else if (source === 'url') {
      const u = c.url ? `"${c.url.slice(0, 60)}${c.url.length > 60 ? '…' : ''}"` : '(chưa set)'
      notes.push(`Input "${field}" (${ct}) → source=url ${u} — App AI tự fetch khi chạy, KHÔNG cần đưa vào payload.`)
    } else if (source === 'static') {
      notes.push(`Input "${field}" (${ct}) → source=static (embed trong workflow) — KHÔNG cần đưa vào payload.`)
    }
  }
  return {
    payloadStr: fields.length === 0 ? '{}' : JSON.stringify(Object.fromEntries(fields), null, 2),
    notes
  }
})

function curlWithPayload(url, responseComment) {
  const { payloadStr, notes } = samplePayload.value
  const notesBlock = notes.length === 0 ? '' : '\n\n' + notes.map((n) => `# - ${n}`).join('\n')
  return `curl -X POST '${url}' \\
  -H 'x-api-key: <YOUR_API_KEY>' \\
  -H 'Content-Type: application/json' \\
  -d '${payloadStr}'

${responseComment}${notesBlock}`
}

const syncCurlPreview = computed(() => {
  if (!workflow.value) return ''
  const url = `${config.public.motionBackendUrl}/workflows/${workflow.value.slug}/invoke`
  return curlWithPayload(
    url,
    `# Response chứa output luôn (block đến khi workflow xong):
# { "run_id": "<uuid>", "status": "success", "output": { ... }, "events": [ ... ] }`
  )
})

const asyncCurlPreview = computed(() => {
  if (!workflow.value) return ''
  const url = `${config.public.motionBackendUrl}/workflows/${workflow.value.slug}/invoke-async`
  return curlWithPayload(
    url,
    `# Response 202 ngay (không chờ):
# { "job_id": "<uuid>", "status": "queued", "poll_url": "/workflows/runs/<uuid>" }`
  )
})

const asyncCallbackPreview = computed(() => {
  if (!workflow.value) return ''
  const headers = { 'Content-Type': 'application/json', 'X-Webhook-Job-Id': '<uuid>', 'X-Webhook-Attempt': '1', ...asyncHeadersObj.value }
  const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n')
  const sample = {
    job_id: '<uuid>',
    workflow_slug: workflow.value.slug,
    status: 'success',
    output: { text: 'Kết quả workflow', metadata: {} },
    error_msg: null,
    started_at: '2026-05-22T09:00:00Z',
    finished_at: '2026-05-22T09:00:42Z'
  }
  return `POST ${asyncConfig.callback_url || '<callback_url>'}
${headerLines}

${JSON.stringify(sample, null, 2)}`
})

function copyToClipboard(text, successMsg) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(successMsg || t('editor.toastCopied')),
    () => toast.error(t('editor.toastCopyFailed'))
  )
}

// Download output dưới dạng .txt — tránh khi text quá lớn render UI chậm
function downloadOutput(run) {
  if (!run?.output?.text) return
  const blob = new Blob([run.output.text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `workflow-output-${run.id}.txt`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 100)
  toast.success(t('editor.toastDownloadedChars', { n: run.output.text.length.toLocaleString() }))
}

async function saveAsyncConfig() {
  if (asyncSaving.value) return
  // Validate
  if (asyncConfig.async_enabled) {
    const u = String(asyncConfig.callback_url || '').trim()
    if (!u) {
      toast.error(t('editor.toastCallbackUrlRequired'))
      return
    }
    if (!/^https?:\/\//i.test(u)) {
      toast.error(t('editor.toastCallbackUrlScheme'))
      return
    }
  }
  asyncSaving.value = true
  try {
    const patch = {
      async_enabled: asyncConfig.async_enabled,
      callback_url: asyncConfig.async_enabled ? asyncConfig.callback_url.trim() : null,
      callback_headers: asyncHeadersObj.value
    }
    const updated = await wf.update(route.params.id, patch)
    if (updated) workflow.value = { ...workflow.value, ...updated }
    toast.success(t('editor.toastAsyncConfigSaved'))
    asyncModalOpen.value = false
  } catch (err) {
    toast.error(err.data?.error || err.message || t('editor.toastSaveFailed'))
  } finally {
    asyncSaving.value = false
  }
}
// #endregion

function fmtTime(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}
// Tiêu đề row history — ưu tiên session text user gõ, fallback trigger detail đầu tiên
function historyItemTitle(r) {
  if (r.input?.text) return r.input.text.slice(0, 42)
  const firstTrigger = r.triggers?.[0]
  if (firstTrigger) return `${firstTrigger.source}: ${firstTrigger.detail.slice(0, 32)}`
  return '(empty)'
}

// Time relative to run start — vd "+0.3s" giúp đọc timeline dễ
function fmtRelTime(ts, runStart) {
  const ms = ts - runStart
  if (ms < 1000) return `+${ms}ms`
  return `+${(ms / 1000).toFixed(1)}s`
}

function fmtMs(ms) {
  if (!ms || ms < 1000) return `${ms || 0}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`
}

const InspectorValidate = defineAsyncComponent(() => import('~/components/workflow/InspectorValidate.vue'))
const InspectorInput = defineAsyncComponent(() => import('~/components/workflow/InspectorInput.vue'))
const InspectorOutput = defineAsyncComponent(() => import('~/components/workflow/InspectorOutput.vue'))
const InspectorWorkflow = defineAsyncComponent(() => import('~/components/workflow/InspectorWorkflow.vue'))
const InspectorCondition = defineAsyncComponent(() => import('~/components/workflow/InspectorCondition.vue'))
const InspectorHttp = defineAsyncComponent(() => import('~/components/workflow/InspectorHttp.vue'))
const InspectorMotionTransfer = defineAsyncComponent(() => import('~/components/workflow/InspectorMotionTransfer.vue'))
const InspectorFashionMotion = defineAsyncComponent(() => import('~/components/workflow/InspectorFashionMotion.vue'))
const InspectorTryon = defineAsyncComponent(() => import('~/components/workflow/InspectorTryon.vue'))
const InspectorCreateImage = defineAsyncComponent(() => import('~/components/workflow/InspectorCreateImage.vue'))
const InspectorDebug = defineAsyncComponent(() => import('~/components/workflow/InspectorDebug.vue'))
const InspectorTeaser = defineAsyncComponent(() => import('~/components/workflow/InspectorTeaser.vue'))
const InspectorCompose = defineAsyncComponent(() => import('~/components/workflow/InspectorCompose.vue'))
const InspectorTextToVideo = defineAsyncComponent(() => import('~/components/workflow/InspectorTextToVideo.vue')) // ALD 14/06/2026
const InspectorSs = defineAsyncComponent(() => import('~/components/workflow/InspectorSs.vue'))
const InspectorTalk = defineAsyncComponent(() => import('~/components/workflow/InspectorTalk.vue'))
const InspectorVoiceover = defineAsyncComponent(() => import('~/components/workflow/InspectorVoiceover.vue')) // ALD 17/06/2026 - Lồng tiếng đọc mô tả lên clip
const InspectorWanI2v = defineAsyncComponent(() => import('~/components/workflow/InspectorWanI2v.vue'))
const InspectorConcat = defineAsyncComponent(() => import('~/components/workflow/InspectorConcat.vue'))
const InspectorBds = defineAsyncComponent(() => import('~/components/workflow/InspectorBds.vue'))
const InspectorSubtitle = defineAsyncComponent(() => import('~/components/workflow/InspectorSubtitle.vue')) // ALD 15/06/2026 - Phụ đề + Dịch
function inspectorComponent(type) {
  return {
    validate: InspectorValidate,
    // Legacy input* alias → InspectorInput (tự infer contentType từ nodeType prop)
    input: InspectorInput, inputText: InspectorInput, inputImage: InspectorInput,
    inputFile: InspectorInput, inputHistory: InspectorInput,
    output: InspectorOutput,
    workflow: InspectorWorkflow, condition: InspectorCondition,
    http: InspectorHttp,
    motion: InspectorMotionTransfer,
    'fashion-motion': InspectorFashionMotion,
    tryon: InspectorTryon,
    'create-image': InspectorCreateImage,
    compose: InspectorCompose,
    teaser: InspectorTeaser,
    'text-to-video': InspectorTextToVideo, // ALD 14/06/2026
    ss: InspectorSs,
    subtitle: InspectorSubtitle, // ALD 15/06/2026 - Phụ đề + Dịch
    talk: InspectorTalk,
    voiceover: InspectorVoiceover, // ALD 17/06/2026 - Lồng tiếng đọc mô tả lên clip
    'wan-i2v': InspectorWanI2v,
    concat: InspectorConcat,
    bds: InspectorBds,
    debug: InspectorDebug
  }[type] || null
}
</script>

<style>
/* #region ALD 22/05/2026 - Apple HIG editor */
:root {
  --apl-bg:           #F2F2F7;   /* iOS systemGroupedBackground */
  --apl-bg-secondary: #FFFFFF;
  --apl-separator:    rgba(60, 60, 67, 0.12);
  --apl-label:        #1c1c1e;
  --apl-label-2:      rgba(60, 60, 67, 0.6);
  --apl-label-3:      rgba(60, 60, 67, 0.3);
  --apl-blue:         #007AFF;
  --apl-blue-dark:    #0040DD;
}

.apl-editor {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--apl-bg);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}

/* Sidebars — frosted glass */
.apl-sidebar {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  display: flex;
  flex-direction: column;
}
.apl-sidebar-left  { width: 220px; border-right: 0.5px solid var(--apl-separator); }

/* Right inspector — animate width khi node click/unselect.
   Spring easing Apple HIG (matches sidebar animations trong macOS). */
.apl-sidebar-right {
  width: 0;
  border-left: 0 solid transparent;
  overflow: hidden;
  transition: width 0.34s cubic-bezier(0.32, 0.72, 0, 1),
              border-left-width 0.34s cubic-bezier(0.32, 0.72, 0, 1);
}
.apl-sidebar-right.is-open {
  width: 360px;
  border-left: 0.5px solid var(--apl-separator);
}
.apl-inspector-content {
  width: 360px;
  height: 100%;
  overflow-y: auto;
}

/* ALD 24/05/2026 - Drawer slide transition: enter from RIGHT (slide left), leave to RIGHT.
   Switching nodes triggers leave-then-enter cycle (mode="out-in") nên drawer "đóng" rồi
   "mở lại" rõ ràng. */
.apl-inspector-enter-active {
  transition: opacity 0.26s cubic-bezier(0.32, 0.72, 0, 1),
              transform 0.34s cubic-bezier(0.32, 0.72, 0, 1);
}
.apl-inspector-leave-active {
  transition: opacity 0.18s cubic-bezier(0.32, 0.72, 0, 1),
              transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}
.apl-inspector-enter-from {
  opacity: 0;
  transform: translateX(80px);
}
.apl-inspector-leave-to {
  opacity: 0;
  transform: translateX(80px);
}

.apl-sidebar-header {
  padding: 14px 16px 6px;
  flex-shrink: 0;
}
.apl-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--apl-blue);
  font-size: 15px;
  font-weight: 400;
  text-decoration: none;
  transition: opacity 0.15s;
}
.apl-back:hover { opacity: 0.7; }
.apl-back .bi { font-size: 17px; margin-top: 1px; }

.apl-search-wrap {
  position: relative;
  padding: 4px 12px 10px;
  flex-shrink: 0;
}
.apl-search-icon {
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-25%);
  color: var(--apl-label-3);
  font-size: 13px;
  pointer-events: none;
}
.apl-search-input {
  width: 100%;
  height: 32px;
  padding: 0 10px 0 30px;
  background: rgba(118, 118, 128, 0.12);
  border: none;
  border-radius: 10px;
  font-size: 13px;
  color: var(--apl-label);
  outline: none;
  font-family: inherit;
}
.apl-search-input::placeholder { color: var(--apl-label-3); }
.apl-search-input:focus { background: rgba(255, 255, 255, 0.95); box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2); }

.apl-palette {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 12px;
}
.apl-cat { margin-bottom: 14px; }
.apl-cat-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--apl-label-2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0 4px 4px;
}
.apl-cat-list { display: flex; flex-direction: column; gap: 4px; }

.apl-palette-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px;
  background: white; border-radius: 8px;
  border: 0.5px solid var(--apl-separator);
  cursor: grab; transition: background 0.15s ease, border-color 0.15s ease;
}
.apl-palette-item:hover {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(60, 60, 67, 0.18);
}
.apl-palette-item:active { cursor: grabbing; }
/* ALD 15/06/2026 - Xem lại history = read-only: palette không kéo được */
.apl-palette-item.is-disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
.apl-palette-icon {
  flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border-radius: 6px;
  font-size: 12px;
}
.apl-palette-text { min-width: 0; flex: 1; line-height: 1.1; }
.apl-palette-label { display: block; font-size: 12px; font-weight: 600; color: var(--apl-label); letter-spacing: -0.01em; }
.apl-palette-en { margin-left: 5px; font-size: 10px; font-weight: 500; font-style: italic; color: rgba(60,60,67,0.45); letter-spacing: 0; }
.apl-palette-hint  { display: block; font-size: 10.5px; color: var(--apl-label-2); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.apl-empty { font-size: 12px; color: var(--apl-label-3); text-align: center; padding: 12px; font-style: italic; }

.apl-sidebar-footer {
  padding: 8px 16px 12px;
  font-size: 11px;
  color: var(--apl-label-2);
  border-top: 0.5px solid var(--apl-separator);
  flex-shrink: 0;
}
.apl-kbd {
  display: inline-block;
  padding: 1px 5px;
  background: white;
  border: 0.5px solid var(--apl-separator);
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  font-weight: 600;
  color: var(--apl-label);
}

/* Canvas area */
.apl-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.apl-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border-bottom: 0.5px solid var(--apl-separator);
  flex-shrink: 0;
}
.apl-title    { font-size: 13px; font-weight: 600; color: var(--apl-label); letter-spacing: -0.02em; }
.apl-subtitle { font-size: 11px; color: var(--apl-label-2); font-family: ui-monospace, SFMono-Regular, monospace; margin-top: 0; }

.apl-actions { display: flex; align-items: center; gap: 10px; }

/* ALD 24/05/2026 - Redesigned topbar actions */
.apl-action-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: rgba(118, 118, 128, 0.08);
  border-radius: 10px;
  padding: 2px;
}
.apl-icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: rgba(60,60,67,0.7);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s cubic-bezier(0.32, 0.72, 0, 1);
  text-decoration: none;
}
.apl-icon-btn:hover  { background: rgba(255,255,255,0.8); color: var(--apl-label); }
.apl-icon-btn.is-active {
  background: white;
  color: var(--apl-blue);
  box-shadow: 0 0.5px 1px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.08);
}
.apl-icon-btn-badge {
  position: absolute;
  top: -2px; right: -2px;
  min-width: 14px; height: 14px;
  padding: 0 3px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px;
  background: var(--apl-blue);
  color: white;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0;
}
.apl-icon-btn-badge.apl-badge-running { background: #FF9500; }

.apl-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: all 0.18s cubic-bezier(0.32, 0.72, 0, 1);
}
.apl-cta:active:not(.is-disabled):not(.is-running) { transform: scale(0.96); }
.apl-cta-secondary {
  background: rgba(118, 118, 128, 0.12);
  color: var(--apl-label);
}
.apl-cta-secondary:hover:not(.is-disabled) {
  background: rgba(118, 118, 128, 0.18);
}
.apl-cta-primary {
  background: var(--apl-blue);
  color: white;
  box-shadow: 0 1px 2px rgba(0,49,167,0.18), 0 4px 14px rgba(0,49,167,0.22);
}
.apl-cta-primary:hover:not(.is-running) {
  background: var(--apl-blue-dark);
  box-shadow: 0 1px 2px rgba(0,49,167,0.22), 0 6px 18px rgba(0,49,167,0.28);
}
.apl-cta.is-disabled {
  background: rgba(118, 118, 128, 0.08);
  color: rgba(60,60,67,0.4);
  cursor: not-allowed;
  box-shadow: none;
}
.apl-cta.is-running {
  background: linear-gradient(135deg, #FF9500, #FF3B30);
  color: white;
  cursor: progress;
}

/* ALD 24/05/2026 - Pending Job tracker compact */
.apl-section-pending {
  background: linear-gradient(180deg, rgba(255,149,0,0.08), rgba(255,149,0,0.02));
  border: 0.5px solid rgba(255,149,0,0.20);
}
/* ALD 24/05/2026 - 3 trạng thái cuối: cancelled (gray), error (rose), done (emerald) */
.apl-section-cancelled {
  background: linear-gradient(180deg, rgba(120,120,128,0.08), rgba(120,120,128,0.02));
  border: 0.5px solid rgba(120,120,128,0.20);
}
.apl-section-job-error {
  background: linear-gradient(180deg, rgba(255,59,48,0.08), rgba(255,59,48,0.02));
  border: 0.5px solid rgba(255,59,48,0.22);
}
.apl-section-done {
  background: linear-gradient(180deg, rgba(52,199,89,0.08), rgba(52,199,89,0.02));
  border: 0.5px solid rgba(52,199,89,0.22);
}
.apl-pending-head { gap: 6px; }
.apl-pending-kind {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(118,118,128,0.14);
  color: rgba(60,60,67,0.7);
  text-transform: lowercase;
}
.apl-pending-cancel {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 9px;
  background: rgba(255,59,48,0.10);
  color: #B91C1C;
  border: 0.5px solid rgba(255,59,48,0.22);
  border-radius: 8px;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.apl-pending-cancel:hover { background: rgba(255,59,48,0.18); color: #991B1B; }
.apl-pending-cancel i { font-size: 11px; }
.apl-pending-body { padding: 8px 2px 2px; }
.apl-pending-step {
  font-size: 11.5px;
  font-weight: 600;
  color: rgba(60,60,67,0.85);
  letter-spacing: -0.005em;
  margin-bottom: 6px;
}
.apl-pending-bar {
  height: 4px;
  border-radius: 999px;
  background: rgba(255,149,0,0.14);
  overflow: hidden;
}
.apl-pending-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF9500, #FFB340);
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.apl-pending-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 10.5px;
  color: rgba(60,60,67,0.55);
}
.apl-pending-pct {
  font-weight: 700;
  color: #8A4B00;
  font-variant-numeric: tabular-nums;
}
.apl-dirty {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #B45309;
  font-weight: 500;
  margin-right: 4px;
}
.apl-dirty-dot { width: 5px; height: 5px; border-radius: 50%; background: #F59E0B; animation: apl-pulse-dot 1.4s infinite; }
@keyframes apl-pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.apl-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  letter-spacing: -0.01em;
  font-family: inherit;
}
.apl-btn-ghost {
  color: var(--apl-blue);
  background: transparent;
  text-decoration: none;
}
.apl-btn-ghost:hover { background: rgba(0, 122, 255, 0.08); }
.apl-btn-primary {
  color: white;
  background: var(--apl-blue);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 122, 255, 0.3);
}
.apl-btn-primary:hover { background: var(--apl-blue-dark); }
.apl-btn-primary:active { transform: scale(0.97); }
.apl-btn-disabled { color: var(--apl-label-3); background: rgba(118, 118, 128, 0.12); cursor: not-allowed; }

/* Canvas */
.apl-canvas { flex: 1; min-height: 0; position: relative; background: var(--apl-bg); }

/* ALD 12/06/2026 - multi-run tab strip (kiểu VS Code) phía trên canvas */
.apl-runtabs { display: flex; align-items: flex-end; gap: 4px; padding: 8px 12px 0; background: var(--apl-bg); overflow-x: auto; flex: none; }
.apl-runtab { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; border: 1px solid #e4e4ec; border-bottom: none; border-radius: 10px 10px 0 0; background: #f4f4f8; color: #6b6b78; cursor: pointer; white-space: nowrap; }
.apl-runtab:hover { background: #ececf2; }
.apl-runtab.is-active { background: #fff; color: #1d1d28; box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.04); }
.apl-runtab.is-success > i:first-child { color: #22c55e; }
.apl-runtab.is-error > i:first-child { color: #ef4444; }
.apl-runtab.is-running > i:first-child { color: #6366f1; }
.apl-runtab-spin { animation: apl-runtab-spin 1s linear infinite; }
@keyframes apl-runtab-spin { to { transform: rotate(360deg); } }
.apl-runtab-x { opacity: 0.45; border-radius: 4px; padding: 1px; }
.apl-runtab-x:hover { opacity: 1; background: #e2e2ea; }

.apl-empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  text-align: center;
  padding: 24px;
}
.apl-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: white;
  border: 0.5px solid var(--apl-separator);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  font-size: 22px;
  color: var(--apl-blue);
  margin-bottom: 12px;
}
.apl-empty-title { font-size: 15px; font-weight: 600; color: var(--apl-label); }
.apl-empty-hint  { font-size: 12px; color: var(--apl-label-2); margin-top: 2px; }

/* #region ALD 22/05/2026 - Run drawer redesigned */
.apl-run-drawer {
  flex-shrink: 0;
  /* ALD 27/05/2026 - height giờ controlled qua inline style từ drawerHeight ref.
     Bỏ max-height cứng để drag resize work cả 2 chiều. */
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border-top: 0.5px solid var(--apl-separator);
  display: flex; flex-direction: column;
  position: relative;
}

/* ALD 27/05/2026 - Drag handle trên top edge (ns-resize cursor). 8px hit area,
   3px visual line center. Hover/active → highlight blue. */
.apl-drawer-resize {
  position: absolute;
  top: -4px; left: 0; right: 0; height: 8px;
  cursor: ns-resize;
  z-index: 10;
  display: flex; align-items: center; justify-content: center;
}
.apl-drawer-resize:hover .apl-drawer-resize-line,
.apl-drawer-resize:active .apl-drawer-resize-line {
  background: var(--color-primary, #0031A7); height: 3px;
}
.apl-drawer-resize-line {
  width: 48px; height: 3px; border-radius: 2px;
  background: rgba(60,60,67,0.18);
  transition: background 0.12s ease, height 0.12s ease;
  pointer-events: none;
}

/* ── Drawer header (sticky) ────────────────────────────────────────── */
.apl-drawer-header {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 14px;
  border-bottom: 0.5px solid var(--apl-separator);
  flex-shrink: 0;
  background: rgba(255,255,255,0.5);
}
.apl-drawer-title { font-size: 11px; font-weight: 700; color: var(--apl-label-2); text-transform: uppercase; letter-spacing: 0.05em; }
.apl-text-btn {
  background: transparent; border: none; padding: 4px 8px;
  color: var(--apl-label-2); font-size: 11px; font-weight: 600;
  cursor: pointer; border-radius: 6px; font-family: inherit;
  display: inline-flex; align-items: center;
}
.apl-text-btn:hover { background: rgba(255,59,48,0.08); color: #FF3B30; }
.apl-close { color: var(--apl-label-2); background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 6px; }
.apl-close:hover { background: rgba(118, 118, 128, 0.12); color: var(--apl-label); }

/* ── Filter chips ──────────────────────────────────────────────────── */
.apl-filter-chips { display: inline-flex; gap: 4px; }
.apl-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 999px;
  background: rgba(118,118,128,0.08);
  border: 0.5px solid transparent;
  font-size: 11px; font-weight: 600; color: var(--apl-label-2);
  cursor: pointer; font-family: inherit;
  transition: all 0.12s;
  white-space: nowrap;
}
.apl-chip:hover { background: rgba(118,118,128,0.14); color: var(--apl-label); }
.apl-chip.is-active { background: var(--apl-blue); color: white; border-color: var(--apl-blue); }
.apl-chip-success.is-active { background: #34C759; border-color: #34C759; }
.apl-chip-error.is-active { background: #FF3B30; border-color: #FF3B30; }
.apl-chip-count {
  font-size: 10px; font-weight: 700;
  padding: 0 5px; border-radius: 999px;
  background: rgba(0,0,0,0.1);
  font-variant-numeric: tabular-nums;
}
.apl-chip.is-active .apl-chip-count { background: rgba(255,255,255,0.25); }

/* ── Drawer body (2-col) ───────────────────────────────────────────── */
.apl-drawer-body { flex: 1; min-height: 0; display: flex; }

/* ── Left: run list ────────────────────────────────────────────────── */
.apl-history-list {
  width: 280px; flex-shrink: 0;
  border-right: 0.5px solid var(--apl-separator);
  overflow-y: auto;
  padding: 6px;
  display: flex; flex-direction: column; gap: 2px;
}
/* ALD 24/05/2026 - History item = main button (chiếm full row) + delete button (hover-reveal). */
.apl-history-item {
  position: relative;
  display: flex; align-items: stretch; gap: 0;
  width: 100%; border-radius: 9px;
  transition: background 0.1s;
}
.apl-history-item:hover { background: rgba(118,118,128,0.08); }
.apl-history-item.is-selected { background: rgba(0,122,255,0.1); box-shadow: 0 0 0 0.5px rgba(0,122,255,0.2); }
.apl-history-item.is-running { background: rgba(255,149,0,0.08); }
.apl-history-main {
  flex: 1; min-width: 0;
  display: flex; align-items: flex-start; gap: 8px;
  padding: 7px 9px;
  background: transparent; border: none; border-radius: 9px 0 0 9px;
  cursor: pointer; text-align: left;
  font-family: inherit;
}
.apl-history-delete {
  width: 28px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 0 9px 9px 0;
  color: rgba(60,60,67,0.4); cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.1s, color 0.1s;
}
.apl-history-item:hover .apl-history-delete { opacity: 1; }
.apl-history-delete:hover {
  background: rgba(255,59,48,0.12);
  color: rgb(255,59,48);
}
.apl-history-title {
  font-size: 12px; font-weight: 600; color: var(--apl-label);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.apl-history-meta {
  font-size: 10.5px; color: var(--apl-label-2);
  margin-top: 2px; line-height: 1.4;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.apl-history-err { color: #9F2620; font-weight: 500; }
.apl-history-out { color: var(--apl-label-2); font-style: italic; }
.apl-history-running-text { color: #A86200; font-weight: 500; }
.apl-history-empty-list {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 20px 10px; color: var(--apl-label-3); text-align: center;
}

/* ── Status pills (compact) ────────────────────────────────────────── */
.apl-status-pill {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 8px; border-radius: 999px;
  font-size: 9.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em;
  flex-shrink: 0;
  white-space: nowrap;
}
.apl-status-pill .bi { font-size: 9px; }
.apl-pill-success { background: #E8F8EC; color: #1F7D38; }
.apl-pill-error   { background: #FCE9E8; color: #9F2620; }
.apl-pill-running { background: #FFEFD9; color: #A86200; }

/* ── Right: detail panel ───────────────────────────────────────────── */
.apl-history-detail { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.apl-detail-header {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px;
  border-bottom: 0.5px solid var(--apl-separator);
  background: rgba(255,255,255,0.5);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.apl-detail-meta {
  display: inline-flex; align-items: center;
  font-size: 11px; color: var(--apl-label-2);
  font-variant-numeric: tabular-nums;
}
.apl-detail-meta .bi { font-size: 10px; }
.apl-detail-action {
  display: inline-flex; align-items: center;
  padding: 4px 10px; border-radius: 7px;
  background: var(--apl-blue); color: white;
  border: none; font-size: 11px; font-weight: 600;
  cursor: pointer; font-family: inherit;
  transition: all 0.12s;
}
.apl-detail-action:hover:not(:disabled) { background: #0050B5; }
.apl-detail-action:disabled { background: rgba(118,118,128,0.3); cursor: not-allowed; }
.apl-detail-cancel { background: #FF3B30; }
/* ALD 17/06/2026 - "Tiếp tục từ chỗ lỗi": xanh lá để nổi bật là hành động nên dùng khi run lỗi */
.apl-detail-resume { background: #34C759; margin-right: 6px; }
.apl-detail-resume:hover:not(:disabled) { background: #28A745; }
.apl-detail-cancel:hover:not(:disabled) { background: #C92F26; }

.apl-detail-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 16px; }
.apl-detail-section { margin-bottom: 14px; }
.apl-detail-section:last-child { margin-bottom: 0; }
.apl-section-error {
  margin: -4px -4px 14px -4px;
  padding: 10px 12px;
  background: rgba(255,59,48,0.05);
  border: 0.5px solid rgba(255,59,48,0.18);
  border-radius: 10px;
}
.apl-section-head {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 6px;
}
.apl-section-title {
  font-size: 10.5px; font-weight: 700;
  color: var(--apl-label-2);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.apl-section-badge {
  font-size: 10px; font-weight: 600;
  padding: 1px 6px; border-radius: 999px;
  background: rgba(118,118,128,0.12);
  color: var(--apl-label-2);
  font-variant-numeric: tabular-nums;
}

.apl-detail-pre {
  white-space: pre-wrap; word-break: break-word;
  background: white; padding: 9px 11px; border-radius: 8px;
  font-size: 11.5px; border: 0.5px solid var(--apl-separator);
  font-family: ui-monospace, SFMono-Regular, monospace; color: var(--apl-label);
  margin: 0; line-height: 1.5;
  /* Không set max-height/overflow → để .apl-detail-body lo scroll (1 scroll only) */
}
.apl-pre-error { color: #9F2620; background: #FCE9E8; border-color: rgba(255,59,48,0.2); }

/* ── Empty states ──────────────────────────────────────────────────── */
.apl-history-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: var(--apl-label-3); padding: 20px;
  text-align: center;
}
.apl-empty-title { font-size: 13px; font-weight: 600; color: var(--apl-label-2); }
.apl-empty-hint { font-size: 11px; color: var(--apl-label-3); margin-top: 4px; line-height: 1.5; }
.apl-empty-text { font-size: 11.5px; color: var(--apl-label-3); font-style: italic; }

/* ── Loader ring (for running state right panel) ──────────────────── */
.apl-loader-ring {
  width: 36px; height: 36px;
  border: 3px solid rgba(0,122,255,0.15);
  border-top-color: var(--apl-blue);
  border-radius: 50%;
  animation: apl-spin 0.9s linear infinite;
}
@keyframes apl-spin { to { transform: rotate(360deg); } }
/* #endregion */

/* Topbar button active state (drawer Runs toggle) */
.apl-btn-active {
  background: rgba(0, 122, 255, 0.12);
  color: var(--apl-blue);
  border: 0.5px solid rgba(0, 122, 255, 0.3);
}
.apl-btn-active:hover { background: rgba(0, 122, 255, 0.18); }

/* Badge count bên trong topbar button */
.apl-btn-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 18px;
  height: 18px;
  margin-left: 4px;
  padding: 0 5px;
  background: rgba(118, 118, 128, 0.18);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.apl-btn-active .apl-btn-badge { background: rgba(0, 122, 255, 0.2); color: var(--apl-blue); }
.apl-badge-running {
  background: #FFEFD9 !important;
  color: #A86200 !important;
}
.apl-badge-running .bi { font-size: 8px; }

/* Triggers list */
.apl-triggers { display: flex; flex-direction: column; gap: 4px; }
.apl-trigger-row {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px;
  background: white;
  border: 0.5px solid var(--apl-separator);
  border-radius: 6px;
  font-size: 11px;
}
.apl-trigger-source {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.apl-trigger-source.src-session { background: #E8F8EC; color: #1F7D38; }
.apl-trigger-source.src-url     { background: #E5F1FF; color: #0050B5; }
.apl-trigger-source.src-static  { background: #F4E9FB; color: #702A98; }
.apl-trigger-type {
  flex-shrink: 0;
  font-size: 9.5px;
  color: var(--apl-label-2);
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.apl-trigger-detail {
  flex: 1; min-width: 0;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: var(--apl-label);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-size: 10.5px;
}
/* Event log — Apple timeline style: dot + msg + relative time */
.apl-event-count {
  display: inline-flex; align-items: center;
  padding: 1px 6px;
  background: rgba(118, 118, 128, 0.16);
  color: var(--apl-label-2);
  border-radius: 999px;
  font-size: 9.5px; font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.apl-events {
  display: flex; flex-direction: column;
  background: white;
  border: 0.5px solid var(--apl-separator);
  border-radius: 8px;
  overflow: hidden;
  /* Không set max-height → để .apl-detail-body lo scroll (1 scroll only) */
}
.apl-event {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.06);
  font-size: 11px;
  transition: background 0.12s;
}
.apl-event:last-child { border-bottom: none; }
.apl-event:hover { background: rgba(118, 118, 128, 0.04); }
.apl-event-dot {
  flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: rgba(0, 122, 255, 0.15);
  color: var(--apl-blue);
  font-size: 8px;
}
.dot-info    { background: rgba(0, 122, 255, 0.15);  color: #007AFF; }
.dot-success { background: rgba(52, 199, 89, 0.18);  color: #1F7D38; }
.dot-warn    { background: rgba(255, 149, 0, 0.18);  color: #A86200; }
.dot-error   { background: rgba(255, 59, 48, 0.18);  color: #9F2620; }
.apl-event-msg {
  flex: 1; min-width: 0;
  color: var(--apl-label);
  word-break: break-word;
  line-height: 1.4;
}
.apl-event-ts {
  flex-shrink: 0;
  font-size: 9.5px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: var(--apl-label-3);
  font-variant-numeric: tabular-nums;
}

/* Inspector */
.apl-inspector-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 10px;
  border-bottom: 0.5px solid var(--apl-separator);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  position: sticky;
  top: 0;
  z-index: 10;
}
.apl-inspector-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
}
.apl-inspector-overline { font-size: 10px; font-weight: 700; color: var(--apl-label-2); text-transform: uppercase; letter-spacing: 0.06em; }
.apl-inspector-title    { font-size: 15px; font-weight: 600; color: var(--apl-label); letter-spacing: -0.02em; }

.apl-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--apl-label-2);
  cursor: pointer;
  transition: all 0.15s;
}
.apl-icon-btn:hover { background: rgba(118, 118, 128, 0.12); }
.apl-icon-btn-danger { color: #FF3B30; }
.apl-icon-btn-danger:hover { background: #FCE9E8; }

.apl-inspector-body { padding: 14px 18px 24px; display: flex; flex-direction: column; gap: 14px; }

.apl-id-chip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: rgba(118, 118, 128, 0.08);
  border-radius: 8px;
}
.apl-id-code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; color: var(--apl-label); word-break: break-all; }

/* Test Run modal */
.apl-modal-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.apl-modal {
  width: 100%; max-width: 480px;
  /* Flex column để body scroll bên trong; max-height set qua Tailwind
     utility (vd max-h-11/12) trên markup mỗi modal cho phù hợp content. */
  display: flex; flex-direction: column;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 18px;
  border: 0.5px solid rgba(60, 60, 67, 0.12);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}
.apl-modal-wide { max-width: 680px; }
.apl-modal-header, .apl-modal-footer { flex-shrink: 0; }
.apl-curl-pre {
  background: #1c1c1e;
  color: #f5f5f7;
  padding: 14px 16px;
  border-radius: 10px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 320px;
  overflow-y: auto;
  margin: 0;
}
.apl-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 0.5px solid var(--apl-separator);
}
.apl-modal-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 10px;
  background: rgba(0, 122, 255, 0.12); color: var(--apl-blue);
  font-size: 16px;
}
.apl-modal-overline { font-size: 10px; font-weight: 700; color: var(--apl-label-2); text-transform: uppercase; letter-spacing: 0.06em; }
.apl-modal-title    { font-size: 15px; font-weight: 600; color: var(--apl-label); letter-spacing: -0.01em; font-family: ui-monospace, SFMono-Regular, monospace; }
.apl-icon-btn-modal {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  background: transparent; border: none; border-radius: 8px;
  color: var(--apl-label-2); cursor: pointer; transition: all 0.15s;
}
.apl-icon-btn-modal:hover { background: rgba(118, 118, 128, 0.12); color: var(--apl-label); }

.apl-modal-body {
  padding: 16px 18px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.apl-modal-label { font-size: 11px; font-weight: 700; color: var(--apl-label-2); text-transform: uppercase; letter-spacing: 0.04em; }
.apl-modal-input {
  display: block; width: 100%;
  padding: 10px 12px;
  background: white;
  border: 0.5px solid var(--apl-separator);
  border-radius: 10px;
  font-size: 14px; color: var(--apl-label);
  outline: none; transition: all 0.15s;
  font-family: inherit; resize: vertical;
}
.apl-input-list { display: flex; flex-direction: column; gap: 4px; }
.apl-input-row {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px;
  background: rgba(118,118,128,0.08);
  border-radius: 6px;
  font-size: 11px;
}
.apl-input-badge {
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: var(--apl-blue); font-weight: 600;
}
.apl-input-type {
  margin-left: auto;
  padding: 1px 6px;
  background: white;
  border: 0.5px solid var(--apl-separator);
  border-radius: 4px;
  font-size: 9.5px; font-weight: 700;
  text-transform: uppercase;
  color: var(--apl-label-2);
}
.apl-modal-input:focus { border-color: var(--apl-blue); box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2); }
.apl-modal-hint { font-size: 11px; color: var(--apl-label-2); margin-top: 8px; line-height: 1.4; }
.apl-kbd-mini {
  display: inline-block; padding: 0 4px;
  background: white; border: 0.5px solid var(--apl-separator);
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px; font-weight: 600; color: var(--apl-label);
}
.apl-modal-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 14px 18px;
  background: rgba(118, 118, 128, 0.06);
  border-top: 0.5px solid var(--apl-separator);
}

/* #region ALD 22/05/2026 - API modal (Sync + Async) styles */
.apl-modal-xl { max-width: 880px; }

.apl-api-body {
  display: flex; flex-direction: column; gap: 14px;
}
.apl-api-section {
  border: 0.5px solid var(--apl-separator);
  border-radius: 12px;
  background: white;
  padding: 14px;
}
.apl-api-section-async {
  background: rgba(0, 49, 167, 0.025);
  border-color: rgba(0, 49, 167, 0.14);
}
.apl-api-section-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
  margin-bottom: 8px;
}
.apl-api-section-title {
  font-size: 13px; font-weight: 700; color: #1c1c1e; letter-spacing: -0.01em;
}
.apl-api-section-sub {
  margin-top: 2px;
  font-size: 11px; color: var(--apl-label-2); line-height: 1.4;
}
.apl-api-subhead {
  font-size: 10px; font-weight: 700;
  color: rgba(60, 60, 67, 0.6);
  text-transform: uppercase; letter-spacing: 0.06em;
  margin-top: 14px; margin-bottom: 8px;
  padding-top: 10px;
  border-top: 0.5px dashed rgba(60, 60, 67, 0.12);
}
.apl-api-subhead:first-child {
  margin-top: 12px; padding-top: 0; border-top: none;
}

.apl-async-toggle {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  cursor: pointer;
}
.apl-checkbox {
  width: 16px; height: 16px;
  margin-top: 2px;
  accent-color: #0031A7;
  cursor: pointer;
  flex-shrink: 0;
}
.apl-async-toggle-label { display: block; font-size: 13px; font-weight: 700; color: #1c1c1e; letter-spacing: -0.01em; }
.apl-async-toggle-hint { display: block; margin-top: 2px; font-size: 11.5px; color: var(--apl-label-2); line-height: 1.45; }
.apl-async-toggle-hint code {
  background: rgba(0,49,167,0.08); color: #0031A7;
  padding: 1px 5px; border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace; font-size: 10.5px;
  font-weight: 600;
}
.apl-async-body { padding-top: 4px; }

.apl-header-list { display: flex; flex-direction: column; gap: 6px; }
.apl-header-row {
  display: flex; align-items: center; gap: 6px;
}
.apl-header-key { flex: 0 0 200px; }
.apl-header-val { flex: 1 1 auto; min-width: 0; }
.apl-btn-mini {
  padding: 5px 10px !important;
  font-size: 11.5px !important;
}

/* Preview grid: 2-col trên desktop, 1-col mobile */
.apl-preview-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
@media (min-width: 820px) {
  .apl-preview-grid { grid-template-columns: 1fr 1fr; }
}
.apl-preview-block {
  display: flex; flex-direction: column;
  min-width: 0;  /* allow pre to shrink for overflow */
}
.apl-preview-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 6px;
  margin-bottom: 4px;
}
.apl-preview-title {
  font-size: 10px; font-weight: 700;
  color: rgba(60, 60, 67, 0.7);
  text-transform: uppercase; letter-spacing: 0.04em;
}

.apl-icon-btn-copy {
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  background: white;
  border: 0.5px solid var(--apl-separator);
  border-radius: 6px;
  color: var(--apl-label-2);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
  flex-shrink: 0;
}
.apl-icon-btn-copy:hover {
  border-color: var(--apl-blue);
  color: var(--apl-blue);
  background: rgba(0, 122, 255, 0.05);
}
/* #endregion */

/* On Failure section */
.apl-on-failure {
  margin-top: 4px;
  padding: 12px;
  background: rgba(255, 149, 0, 0.06);
  border: 0.5px solid rgba(255, 149, 0, 0.2);
  border-radius: 10px;
}
.apl-of-label { display: block; font-size: 11px; font-weight: 700; color: #A86200; text-transform: uppercase; letter-spacing: 0.04em; }
.apl-of-select {
  display: block; width: 100%;
  padding: 7px 10px; background: white;
  border: 0.5px solid rgba(60, 60, 67, 0.18); border-radius: 8px;
  font-size: 13px; color: var(--apl-label); outline: none;
  font-family: inherit; cursor: pointer;
}
.apl-of-select:focus { border-color: #FF9500; box-shadow: 0 0 0 3px rgba(255, 149, 0, 0.2); }
.apl-of-hint { margin-top: 6px; font-size: 11px; color: rgba(60, 60, 67, 0.6); line-height: 1.4; }

/* Vue Flow overrides */
.vue-flow__node { padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; }
.vue-flow__node-step { color: inherit; }
/* ALD 24/05/2026 - Selected node: ring System Blue mềm + tăng nhẹ scale. Trước default
   Vue Flow outline dashed gray vuông góc khá xấu — thay bằng glow tròn theo Apple HIG. */
.vue-flow__node.selected {
  outline: none !important;
  box-shadow: none !important;
}
.vue-flow__node.selected > * {
  box-shadow:
    0 0 0 2px rgba(0,122,255,0.55),
    0 0 0 6px rgba(0,122,255,0.16),
    0 12px 32px rgba(0,122,255,0.18) !important;
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
/* Multi-select indicator (rubber band drag) */
.vue-flow__selection {
  background: rgba(0,122,255,0.07) !important;
  border: 1.5px dashed rgba(0,122,255,0.55) !important;
  border-radius: 12px !important;
}
/* Bounding box quanh group nodes đã select (Vue Flow render nodesselection-rect) */
.vue-flow__nodesselection-rect {
  background: transparent !important;
  border: 1.5px dashed rgba(0,122,255,0.45) !important;
  border-radius: 14px !important;
  box-shadow: 0 0 0 4px rgba(0,122,255,0.08) inset !important;
}

.vue-flow__edge-text { font-size: 10px !important; font-weight: 700 !important; }
.vue-flow__edge-textbg { fill: white; }
/* Default edge — soft slate, slightly thicker, smooth bezier */
.vue-flow__edge-path {
  stroke: #94a3b8;
  stroke-width: 2;
  transition: stroke 0.18s ease, stroke-width 0.18s ease;
}
.vue-flow__edge:hover .vue-flow__edge-path {
  stroke: #475569;
  stroke-width: 2.5;
}
.vue-flow__edge.selected .vue-flow__edge-path {
  stroke: #007AFF !important;
  stroke-width: 2.5 !important;
}
/* Connection-line (dragging from handle) */
.vue-flow__connectionline { stroke: #007AFF; stroke-width: 2.5; stroke-dasharray: 5 5; }

/* Special edges */
.vue-flow__edge.edge-true    .vue-flow__edge-path,
.vue-flow__edge.edge-success .vue-flow__edge-path { stroke: #34C759 !important; stroke-width: 2 !important; }
.vue-flow__edge.edge-false   .vue-flow__edge-path { stroke: #FF3B30 !important; stroke-width: 2 !important; }
.vue-flow__edge.edge-error   .vue-flow__edge-path { stroke: #FF9500 !important; stroke-width: 2 !important; stroke-dasharray: 6 4; }
.vue-flow__edge.edge-true    .vue-flow__edge-text,
.vue-flow__edge.edge-success .vue-flow__edge-text { fill: #1F7D38 !important; }
.vue-flow__edge.edge-false   .vue-flow__edge-text { fill: #9F2620 !important; }
.vue-flow__edge.edge-error   .vue-flow__edge-text { fill: #A86200 !important; }

.vue-flow__controls {
  background: rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 12px !important;
  border: 0.5px solid var(--apl-separator) !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
  margin: 16px !important;
  overflow: hidden;
}
.vue-flow__controls button {
  background: transparent !important;
  border: none !important;
  border-bottom: 0.5px solid var(--apl-separator) !important;
  color: var(--apl-label) !important;
}
.vue-flow__controls button:last-child { border-bottom: none !important; }
.vue-flow__controls button:hover { background: rgba(118, 118, 128, 0.08) !important; }

.vue-flow__minimap {
  background: rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 0.5px solid var(--apl-separator) !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
  margin: 16px !important;
}
/* #endregion */
</style>
