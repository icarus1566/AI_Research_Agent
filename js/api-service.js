import { db, collection, addDoc, getDocs, onSnapshot, query, orderBy } from './firebase-config.js';

export const FIREBASE_COLLECTIONS = {
    PROPOSALS: 'proposals',           // 연구제의서
    PLANS: 'plans',                   // 연구시행계획서
    ISSUES: 'issues',                 // 과제 이슈
    DATA_COLLECTIONS: 'data_collections', // 자료수집
    SETTINGS: 'settings'
};

export const GEMINI_CONFIG = {
    API_KEY: "YOUR_GEMINI_API_KEY",
    MODEL_NAME: "gemini-1.5-flash",
};

// 연구제의서 저장 + 클라이언트 사이드 AI 분석
export async function saveProposal(title, content, author = "연구원") {
    const docRef = await addDoc(collection(db, FIREBASE_COLLECTIONS.PROPOSALS), {
        title, content, author,
        createdAt: new Date().toISOString(),
        status: "pending_review",
        aiFeedback: null
    });

    // 클라이언트 사이드에서 즉시 Gemini API 분석
    analyzeWithGemini(docRef.id, title, content, FIREBASE_COLLECTIONS.PROPOSALS);
    return docRef.id;
}

// 연구시행계획서 저장 + AI 분석
export async function savePlan(title, content, author = "연구원") {
    const docRef = await addDoc(collection(db, FIREBASE_COLLECTIONS.PLANS), {
        title, content, author,
        createdAt: new Date().toISOString(),
        status: "pending_review",
        aiFeedback: null
    });
    analyzeWithGemini(docRef.id, title, content, FIREBASE_COLLECTIONS.PLANS);
    return docRef.id;
}

// 과제 이슈 저장 + AI 분석
export async function saveIssue(title, content, author = "연구원") {
    const docRef = await addDoc(collection(db, FIREBASE_COLLECTIONS.ISSUES), {
        title, content, author,
        createdAt: new Date().toISOString(),
        status: "pending_review",
        aiFeedback: null
    });
    analyzeWithGemini(docRef.id, title, content, FIREBASE_COLLECTIONS.ISSUES);
    return docRef.id;
}

// 클라이언트 사이드 Gemini API 분석 (Cloud Functions 없이 무료 운영)
async function analyzeWithGemini(docId, title, content, collectionName) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.MODEL_NAME}:generateContent?key=${GEMINI_CONFIG.API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `당신은 최고 수준의 연구원들을 돕는 'AI 연구 비서'입니다.
다음 문서를 비판적으로 분석하여 답글을 작성해주세요.
[제목]: ${title}
[내용]: ${content}

분석 항목:
1. 긍정적인 평가 및 기대효과 (1-2문장)
2. 보완이 필요한 논리적 허점이나 한계 (2-3문장)
3. 관련 최신 트렌드나 참고 자료 추천`
                        }]
                    }]
                })
            }
        );
        const data = await response.json();
        const aiFeedback = data?.candidates?.[0]?.content?.parts?.[0]?.text || "분석 결과를 가져오지 못했습니다.";

        const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        const { db: firestoreDb } = await import('./firebase-config.js');
        await updateDoc(doc(firestoreDb, collectionName, docId), {
            aiFeedback,
            status: "analyzed",
            analyzedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("[AI Analysis] Failed:", error);
    }
}

// 환경설정 저장
export async function saveSettings(interval, dateRange) {
    await addDoc(collection(db, FIREBASE_COLLECTIONS.SETTINGS), {
        interval, dateRange,
        updatedAt: new Date().toISOString()
    });
    return true;
}

// 실시간 리스너 (제네릭)
export function listenToCollection(collectionName, callback) {
    const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
        callback(items);
    });
}

// 자료수집 게시판 리스너
export function listenToDataCollections(callback) {
    return listenToCollection(FIREBASE_COLLECTIONS.DATA_COLLECTIONS, callback);
}

// 연구제의서 리스너
export function listenToProposals(callback) {
    return listenToCollection(FIREBASE_COLLECTIONS.PROPOSALS, callback);
}

// 연구시행계획서 리스너
export function listenToPlans(callback) {
    return listenToCollection(FIREBASE_COLLECTIONS.PLANS, callback);
}

// 과제 이슈 리스너
export function listenToIssues(callback) {
    return listenToCollection(FIREBASE_COLLECTIONS.ISSUES, callback);
}
