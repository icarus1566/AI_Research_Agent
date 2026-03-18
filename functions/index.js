const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();

const apiKey = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";
const genAI = new GoogleGenerativeAI(apiKey);

// 보안: GitHub Actions에서 전달하는 비밀 토큰 검증
const CRON_SECRET = process.env.CRON_SECRET || "YOUR_CRON_SECRET";

/**
 * 1. 주기적 자료 수집 및 연구 주제 제안 에이전트 (HTTP 트리거)
 * GitHub Actions Cron이 이 엔드포인트를 6시간마다 호출합니다.
 * Spark(무료) 플랜에서 사용 가능.
 */
exports.scheduledResearchAgent = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    // 비밀 토큰 검증
    const secret = req.headers['x-cron-secret'] || req.query.secret;
    if (secret !== CRON_SECRET) {
        console.warn("[AI Agent] Unauthorized cron call attempt.");
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    console.log("[AI Agent] Starting scheduled research cycle...");

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 자료 수집 및 연구 주제 생성
        const prompt = `
당신은 훌륭한 연구 주제를 발굴해내는 AI 에이전트입니다.
현재 가장 핫한 AI 및 오픈 라이선스 관련 최신 연구 트렌드 1가지를 선정하여,
새로운 연구과제를 제안하는 게시글과 함께 수집된 원본 자료 요약을 작성해주세요.

반드시 다음 JSON 형식으로만 반환하세요:
{
  "title": "[AI 제안] (연구 주제 제목)",
  "content": "상세한 연구 제안 배경 및 연구 목표",
  "source": "참고한 자료의 출처 (예: arXiv, Google Scholar, IEEE 등)",
  "collectedContent": "수집된 원본 자료 핵심 내용 요약 (2-3문장)"
}
`;
        const result = await model.generateContent(prompt);
        const jsonText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const suggestion = JSON.parse(jsonText);
        const now = new Date().toISOString();

        // 1) 자료수집 게시판에 수집 기록 저장 (날짜, 출처, 수집내용)
        await db.collection("data_collections").add({
            date: now,
            source: suggestion.source || "Gemini AI Knowledge Base",
            collectedContent: suggestion.collectedContent || suggestion.content,
            linkedTitle: suggestion.title,
            collectedBy: "🤖 자동 수집 에이전트",
        });

        // 2) 연구제의서 게시판에 AI 제안 등록
        await db.collection("proposals").add({
            title: suggestion.title,
            content: suggestion.content,
            author: "🤖 AI 수집 자동화 에이전트",
            createdAt: now,
            status: "analyzed",
            aiFeedback: "이 글은 관리자가 설정한 주기에 따라 백그라운드 AI 에이전트가 자동 생성한 발굴 주제입니다.",
        });

        console.log(`[AI Agent] Collected and created topic: ${suggestion.title}`);
        res.status(200).json({ success: true, message: "Research cycle complete.", title: suggestion.title });
    } catch (error) {
        console.error("[AI Agent] Scheduled task failed:", error);
        res.status(500).json({ success: false, error: error.toString() });
    }
});

/**
 * 2. 수동 즉시 수집 HTTP 트리거
 * 대시보드에서 '즉시 수집' 버튼을 눌렀을 때 실행됩니다.
 */
exports.triggerResearchNow = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    try {
        console.log("[AI Agent] Manual trigger activated");

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `인공지능 연구 분야 중 오늘 이슈가 될만한 연구 아이디어와 수집 자료를 JSON으로 제안하세요.
{"title": "...", "content": "...", "source": "출처명", "collectedContent": "수집내용 요약 2-3문장"}`;

        const result = await model.generateContent(prompt);
        const jsonText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const suggestion = JSON.parse(jsonText);
        const now = new Date().toISOString();

        // 자료수집 게시판에 기록
        await db.collection("data_collections").add({
            date: now,
            source: suggestion.source || "Gemini AI",
            collectedContent: suggestion.collectedContent || suggestion.content,
            linkedTitle: `[즉시수집] ${suggestion.title}`,
            collectedBy: "🤖 AI 빠른 수집 에이전트",
        });

        // 연구제의서 게시판에 등록
        await db.collection("proposals").add({
            title: `[즉시수집] ${suggestion.title}`,
            content: suggestion.content,
            author: "🤖 AI 빠른 수집 에이전트",
            createdAt: now,
            status: "analyzed",
            aiFeedback: "관리자의 수동 수집 명령으로 즉시 작성된 결과입니다.",
        });

        res.status(200).json({ success: true, message: "Manual collection completed.", title: suggestion.title });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.toString() });
    }
});
