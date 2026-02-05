/**
 * Project SEAF - Background Service Worker
 * 실시간 감지 및 커스텀 알림 메시징 로직을 통합 관리합니다.
 */

let notifiedPosts = new Set();
let userSettings = {
  pollingInterval: 5,
  isDetectionActive: true
};

/**
 * 사용자 설정 초기화 및 동기화
 */
const initSettings = async () => {
  const saved = await chrome.storage.local.get(['seaf_settings']);
  if (saved.seaf_settings) {
    userSettings.pollingInterval = saved.seaf_settings.pollingInterval || 5;
    userSettings.isDetectionActive = saved.seaf_settings.isDetectionActive !== false;
  }
};

// 설정 변경 실시간 반영
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.seaf_settings?.newValue) {
    const newVal = changes.seaf_settings.newValue;
    userSettings.pollingInterval = newVal.pollingInterval;
    userSettings.isDetectionActive = newVal.isDetectionActive;
  }
});

/**
 * 메시지 핸들러: 팝업 및 컨텐츠 스크립트의 요청 처리
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FETCH_STEAM_LOBBY") {
    fetchLobbyLink(request.steamUrl)
      .then(link => sendResponse({ success: true, link: link }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === "GET_LOBBY_FROM_POST") {
    extractFromPost(request.url)
      .then(link => sendResponse({ success: true, link: link }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }
});

/**
 * 스팀 커뮤니티 페이지에서 로비 정보를 가져옵니다.
 */
async function fetchLobbyLink(steamUrl) {
  if (!steamUrl || !steamUrl.includes('steamcommunity.com')) return null;
  try {
    const response = await fetch(steamUrl);
    const html = await response.text();
    const lobbyMatch = html.match(/steam:\/\/joinlobby\/644830\/\d+/);
    return lobbyMatch ? lobbyMatch[0] : null;
  } catch (e) {
    return null;
  }
}

/**
 * 게시글 URL을 fetch하여 내부의 스팀 로비 링크를 탐색합니다.
 */
async function extractFromPost(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const lobbyMatch = html.match(/steam:\/\/joinlobby\/644830\/\d+/);
    if (lobbyMatch) return lobbyMatch[0];
    
    const profileMatch = html.match(/https:\/\/steamcommunity\.com\/(id|profiles)\/[^\s"<>]+/);
    if (profileMatch) {
      return await fetchLobbyLink(profileMatch[0]);
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 커스텀 버블 알림 발송 (Content Script로 메시지 전송)
 */
function sendCustomNotification(postId, title) {
  if (notifiedPosts.has(postId)) return;
  notifiedPosts.add(postId);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "SHOW_SEAF_NOTIFICATION",
        postId: postId,
        title: title
      });
    }
  });
}

/**
 * 새 게시글 감지 로직
 */
async function checkNewPosts() {
  try {
    // 헬다이버즈 갤러리 '망호' 말머리 리스트
    const listUrl = `https://gall.dcinside.com/mgallery/board/lists/?id=helldiversseries&headid=60`;
    const response = await fetch(listUrl);
    const html = await response.text();
    
    // 게시글 번호 추출 정규식
    const postMatches = html.match(/data-no="(\d+)"/g);
    if (postMatches) {
      const latestId = postMatches[0].match(/\d+/)[0];
      
      if (!notifiedPosts.has(latestId)) {
        // 실제 구현 시 제목 추출 로직을 정교화할 수 있습니다.
        sendCustomNotification(latestId, "새로운 망호가 탐지되었습니다!");
      }
    }
  } catch (e) {
    console.error("Polling Error:", e);
  }
}

/**
 * 고속 감지 루프
 */
const runPolling = async () => {
  if (userSettings.isDetectionActive) {
    await checkNewPosts();
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    let nextTick = 30000; // 기본 30초

    // 헬다이버즈 갤러리 목록 페이지를 보고 있을 때만 고속 폴링 활성화
    if (activeTab?.url?.includes("gall.dcinside.com/mgallery/board/lists/?id=helldiversseries")) {
      nextTick = userSettings.pollingInterval * 1000;
    }
    
    if (!userSettings.isDetectionActive) nextTick = 60000;
    setTimeout(runPolling, nextTick);
  });
};

// 초기 설정 로드 후 루프 시작
initSettings().then(runPolling);