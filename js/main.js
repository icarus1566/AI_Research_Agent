import { 
    saveProposal, savePlan, saveIssue, saveSettings,
    listenToProposals, listenToPlans, listenToIssues, listenToDataCollections,
    FIREBASE_COLLECTIONS
} from './api-service.js';

// Cloud Function HTTP URL (deploy 후 실제 URL로 교체)
const FUNCTION_BASE_URL = "https://us-central1-ai-research-agent-3cc69.cloudfunctions.net";

document.addEventListener('DOMContentLoaded', () => {
    
    // ─── 1. 날짜 포맷 ───────────────────────────────────────────
    const formatDate = (isoString) => {
        if (!isoString) return '-';
        const d = new Date(isoString);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };

    // ─── 2. 네비게이션 ──────────────────────────────────────────
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('page-title');

    const navigateTo = (targetId) => {
        navItems.forEach(n => n.classList.remove('active'));
        viewSections.forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });

        const navItem = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if (navItem) navItem.classList.add('active');
        
        const section = document.getElementById(`view-${targetId}`);
        if (section) { section.classList.remove('hidden'); section.classList.add('active'); }
        
        if (navItem) pageTitle.textContent = navItem.querySelector('span:last-child').textContent;
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.getAttribute('data-target'));
        });
    });

    // ─── 3. 공용 모달 ───────────────────────────────────────────
    const writeModal = document.getElementById('write-modal');
    const writeForm = document.getElementById('write-form');
    const modalTitle = document.getElementById('modal-title');
    const modalBoardType = document.getElementById('modal-board-type');

    const openModal = (boardType, title) => {
        modalBoardType.value = boardType;
        modalTitle.textContent = title;
        writeModal.classList.remove('hidden');
    };
    const closeModal = () => {
        writeModal.classList.add('hidden');
        writeForm.reset();
    };

    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);

    // 버튼 연결
    document.getElementById('btn-write-proposal').addEventListener('click', () => openModal('proposals', '새 연구제의서 작성'));
    document.getElementById('btn-write-issue').addEventListener('click', () => openModal('issues', '과제 이슈 등록'));
    document.getElementById('btn-write-plan').addEventListener('click', () => openModal('plans', '연구시행계획서 작성'));
    document.getElementById('btn-new-proposal').addEventListener('click', () => { navigateTo('board-proposals'); openModal('proposals', '새 연구제의서 작성'); });
    document.getElementById('btn-new-issue').addEventListener('click', () => { navigateTo('board-issues'); openModal('issues', '과제 이슈 등록'); });
    document.getElementById('btn-new-plan').addEventListener('click', () => { navigateTo('board-plans'); openModal('plans', '연구시행계획서 작성'); });

    // 모달 외부 클릭 닫기
    writeModal.addEventListener('click', (e) => { if (e.target === writeModal) closeModal(); });

    // ─── 4. 글 등록 폼 ──────────────────────────────────────────
    writeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-post');
        const title = document.getElementById('post-title').value;
        const content = document.getElementById('post-content').value;
        const boardType = modalBoardType.value;

        submitBtn.textContent = 'AI 분석 중...';
        submitBtn.disabled = true;

        try {
            if (boardType === 'proposals') await saveProposal(title, content);
            else if (boardType === 'issues') await saveIssue(title, content);
            else if (boardType === 'plans') await savePlan(title, content);

            submitBtn.textContent = '등록 완료 ✔️';
            submitBtn.style.backgroundColor = '#10b981';
            setTimeout(() => {
                closeModal();
                submitBtn.textContent = '등록 및 AI 분석 요청';
                submitBtn.style.backgroundColor = '';
                submitBtn.disabled = false;
            }, 1500);
        } catch (err) {
            console.error(err);
            submitBtn.textContent = '등록 실패 ❌';
            submitBtn.style.backgroundColor = '#ef4444';
            setTimeout(() => {
                submitBtn.textContent = '등록 및 AI 분석 요청';
                submitBtn.style.backgroundColor = '';
                submitBtn.disabled = false;
            }, 3000);
        }
    });

    // ─── 5. 즉시 수집 버튼 ──────────────────────────────────────
    const btnManual = document.getElementById('btn-manual-collect');
    btnManual.addEventListener('click', async () => {
        btnManual.innerHTML = '<span class="icon">🔄</span> 수집 중...';
        btnManual.disabled = true;
        try {
            const res = await fetch(`${FUNCTION_BASE_URL}/triggerResearchNow`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                btnManual.innerHTML = '<span class="icon">✅</span> 수집 완료!';
                btnManual.style.backgroundColor = '#10b981';
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            console.error(err);
            btnManual.innerHTML = '<span class="icon">❌</span> 수집 실패 (함수 미배포 상태일 수 있음)';
            btnManual.style.backgroundColor = '#ef4444';
        }
        setTimeout(() => {
            btnManual.innerHTML = '<span class="icon">⚡</span> AI 즉시 수집 시작';
            btnManual.style.backgroundColor = '';
            btnManual.disabled = false;
        }, 4000);
    });

    // ─── 6. 설정 저장 ───────────────────────────────────────────
    const settingsForm = document.getElementById('settings-form');
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = settingsForm.querySelector('button[type="submit"]');
        btn.textContent = '저장 중...';
        try {
            await saveSettings(
                document.getElementById('ai-interval').value,
                document.getElementById('date-range').value
            );
            btn.textContent = '저장되었습니다 ✔️';
            btn.style.backgroundColor = '#10b981';
        } catch {
            btn.textContent = '저장 실패 ❌';
            btn.style.backgroundColor = '#ef4444';
        }
        setTimeout(() => { btn.textContent = '변경사항 저장'; btn.style.backgroundColor = ''; }, 3000);
    });

    // ─── 7. 게시판 렌더링 함수 ──────────────────────────────────
    const renderPost = (item, type) => {
        const div = document.createElement('div');
        div.className = 'post-item card-style';

        const statusBadge = item.status === 'analyzed'
            ? `<span class="badge badge-analyzed">AI 분석 완료</span>`
            : `<span class="badge badge-pending">분석 대기</span>`;

        const feedbackHtml = item.status === 'analyzed' && item.aiFeedback
            ? `<div class="ai-feedback"><h4>✨ AI 분석 결과</h4><p>${item.aiFeedback}</p></div>`
            : item.status === 'pending_review'
            ? `<div class="ai-feedback pending"><span>⏳ AI가 분석 중입니다...</span></div>`
            : '';

        div.innerHTML = `
            <div class="post-header">
                <h4>${item.title}</h4>
                <div class="post-meta">
                    ${statusBadge}
                    <span class="post-date">${formatDate(item.createdAt)}</span>
                </div>
            </div>
            <p class="post-preview">${item.content}</p>
            <div class="post-author">작성자: ${item.author || '연구원'}</div>
            ${feedbackHtml}
        `;
        return div;
    };

    const renderDataCollection = (item) => {
        const div = document.createElement('div');
        div.className = 'post-item card-style data-collection-item';
        div.innerHTML = `
            <div class="post-header">
                <h4>${item.linkedTitle || '수집된 자료'}</h4>
                <span class="post-date">${formatDate(item.date)}</span>
            </div>
            <div class="data-collection-meta">
                <span class="source-tag">📌 출처: ${item.source || '-'}</span>
                <span class="collector-tag">🤖 ${item.collectedBy || 'AI 에이전트'}</span>
            </div>
            <div class="data-collection-content">
                <strong>수집 내용:</strong>
                <p>${item.collectedContent || '-'}</p>
            </div>
        `;
        return div;
    };

    const setupList = (listId, loader, renderer, emptyMsg) => {
        const listEl = document.getElementById(listId);
        let statEl = null;
        if (listId === 'list-proposals') statEl = document.getElementById('stat-proposals');
        if (listId === 'list-data') statEl = document.getElementById('stat-collections');
        if (listId === 'list-issues') statEl = document.getElementById('stat-issues');
        if (listId === 'list-plans') statEl = document.getElementById('stat-plans');

        loader((items) => {
            if (statEl) statEl.textContent = `${items.length}건`;
            if (items.length === 0) {
                listEl.innerHTML = `<div class="post-item placeholder">${emptyMsg}</div>`;
                return;
            }
            listEl.innerHTML = '';
            items.forEach(item => listEl.appendChild(renderer(item)));
        });
    };

    // ─── 8. 4개 게시판 실시간 데이터 연결 ───────────────────────
    setupList('list-data', listenToDataCollections, renderDataCollection, '수집된 자료가 없습니다.');
    setupList('list-issues', listenToIssues, (item) => renderPost(item, 'issues'), '등록된 이슈가 없습니다.');
    setupList('list-proposals', listenToProposals, (item) => renderPost(item, 'proposals'), '등록된 제의서가 없습니다.');
    setupList('list-plans', listenToPlans, (item) => renderPost(item, 'plans'), '등록된 계획서가 없습니다.');

    // 대시보드 최근 수집 자료 미리보기
    listenToDataCollections((items) => {
        const topicList = document.getElementById('ai-topic-list');
        if (items.length === 0) {
            topicList.innerHTML = '<div class="topic-item placeholder">아직 수집된 자료가 없습니다. AI 즉시 수집을 눌러보세요.</div>';
            return;
        }
        topicList.innerHTML = '';
        items.slice(0, 5).forEach(item => {
            const el = document.createElement('div');
            el.className = 'topic-item';
            el.innerHTML = `
                <div class="topic-title">${item.linkedTitle || '수집 자료'}</div>
                <div class="topic-meta">
                    <span>📌 ${item.source || '-'}</span>
                    <span>${formatDate(item.date)}</span>
                </div>
            `;
            topicList.appendChild(el);
        });
    });
});
