/**
 * Project SEAF - Background Service Worker
 * [통합 및 강화 버전] 상세 본문 검사 및 고도화된 로그 시스템
 */

let lastCheckedPostId = null;
const MANGHO_LIST_URL = "https://gall.dcinside.com/mgallery/board/lists/?id=helldiversseries&sort_type=N&search_head=60";

// --- TEST & LOG SYSTEM ---
/**
 * 타임스탬프를 포함한 로그 기록
 */
async function addLog(message) {
    try {
        const data = await chrome.storage.local.get(['systemLogs']);
        const logs = data.systemLogs || [];
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR', { hour12: false });
        
        const newLogs = [`[${timeStr}] ${message}`, ...logs].slice(0, 100); 
        await chrome.storage.local.set({ systemLogs: newLogs });
        console.log(`[SEAF LOG ${timeStr}] ${message}`);
    } catch (e) {
        console.error("Log Error:", e);
    }
}

/**
 * 감지된 링크 저장 (리다이렉션 확인용 링크 포함)
 */
async function saveLink(link, title, postId) {
    const data = await chrome.storage.local.get(['testLobbyLinks']);
    let list = data.testLobbyLinks || [];
    
    // 중복 체크
    if (!list.some(item => item.link === link)) {
        list.unshift({
            time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
            title: title,
            link: link, // 실제 steam:// 링크
            postUrl: `https://gall.dcinside.com/mgallery/board/view/?id=helldiversseries&no=${postId}`
        });
        if (list.length > 20) list.pop();
        await chrome.storage.local.set({ testLobbyLinks: list });
    }
}

/**
 * UI 테스트용 발송
 */
async function sendTestNotification() {
    const testTitle = "[TEST] 샘플 망호 테스트 알림";
    const testLink = "steam://joinlobby/553850/1234567890/1234567890";
    const testPostId = "12345"; // 가상 ID
    
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
            type: "SEAF_NEW_LOBBY",
            title: testTitle,
            link: testLink,
            postId: testPostId
        }).catch(() => {});
        addLog("🚀 테스트 UI 신호 송신 완료");
    }
}

/**
 * 게시글 상세 프로세싱
 */
async function processPost(postId, title) {
    try {
        const viewUrl = `https://gall.dcinside.com/mgallery/board/view/?id=helldiversseries&no=${postId}`;
        const detailRes = await fetch(viewUrl);
        const detailHtml = await detailRes.text();
        
        const lobbyMatch = detailHtml.match(/steam:\/\/joinlobby\/\d+\/\d+\/\d+/);
        
        if (lobbyMatch) {
            const lobbyLink = lobbyMatch[0];
            await addLog(`✅ [발견] ${title.substring(0, 15)}... (로비: ${lobbyLink})`);
            
            await saveLink(lobbyLink, title, postId);

            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                    type: "SEAF_NEW_LOBBY",
                    title: title,
                    link: lobbyLink,
                    postId: postId // 게시글 이동용 ID 추가
                }).catch(() => {});
            }
            return true;
        }
        return false;
    } catch (e) {
        await addLog(`❌ 상세 페이지 오류 (${postId}): ${e.message}`);
        return false;
    }
}

/**
 * 감지 루프
 */
async function performDetection() {
    try {
        const { seaf_settings: s } = await chrome.storage.local.get(['seaf_settings']);
        if (!s?.isDetectionActive) return;

        const tabs = await chrome.tabs.query({ url: "*://gall.dcinside.com/mgallery/board/*id=helldiversseries*" });
        if (tabs.length === 0) return;

        const res = await fetch(MANGHO_LIST_URL);
        const html = await res.text();
        
        const postRegex = /<tr[^>]*data-no="(\d+)"[^>]*>[\s\S]*?<td class="gall_tit[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g;
        const matches = [...html.matchAll(postRegex)];
        
        const currentPosts = matches
            .filter(m => !m[0].includes('icon_notice'))
            .map(m => ({
                id: parseInt(m[1]),
                title: m[2].replace(/<[^>]*>?/gm, '').trim()
            }));

        if (currentPosts.length === 0) return;

        if (lastCheckedPostId === null) {
            lastCheckedPostId = currentPosts[0].id;
            return;
        }

        const newPosts = currentPosts.filter(p => p.id > lastCheckedPostId);
        if (newPosts.length > 0) {
            for (const post of [...newPosts].reverse()) {
                await processPost(post.id, post.title);
            }
            lastCheckedPostId = currentPosts[0].id;
        }
    } catch (e) {
        addLog(`❌ 엔진 에러: ${e.message}`);
    }
}

async function setupAlarm() {
    const { seaf_settings: s } = await chrome.storage.local.get(['seaf_settings']);
    await chrome.alarms.clear("MANGHO_DETECTION");
    if (s?.isDetectionActive) {
        const periodInMinutes = Math.max(0.1, (s.pollingInterval || 5) / 60); 
        chrome.alarms.create("MANGHO_DETECTION", { periodInMinutes });
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "MANGHO_DETECTION") performDetection();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SETTINGS_UPDATED") setupAlarm();
    if (request.type === "TEST_NOTIFICATION_UI") sendTestNotification();
    if (request.type === "GET_LOBBY_LINK") {
        fetch(request.url).then(r => r.text()).then(html => {
            const match = html.match(/steam:\/\/joinlobby\/\d+\/\d+\/\d+/);
            sendResponse({ link: match ? match[0] : null });
        });
        return true; 
    }
});

setupAlarm();