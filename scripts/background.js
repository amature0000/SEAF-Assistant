/**
 * SEAF Notification Sender & Logger - Background
 * 로그 기록 기능을 유지하면서 모든 탭에 알림을 전송합니다.
 */

const TARGET_URL = "https://gall.dcinside.com/mgallery/board/lists/?id=helldiversseries&sort_type=N&search_head=60";
let lastCheckedPostId = null;

// 테스트용 알람 (5초 주기)
chrome.alarms.create("regex_parse_check", { periodInMinutes: 0.083 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "regex_parse_check") {
    runRegexParseTest();
  }
});

/**
 * [추가] 외부(Popup 등)에서 오는 테스트 요청 리스너
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "TEST_NOTIFICATION_UI") {
    addLog("🛠️ 팝업으로부터 UI 테스트 요청 수신");
    sendTestNotification();
  }
});

async function sendTestNotification() {
  const testTitle = "[TEST] 샘플 망호 테스트 알림";
  const testLink = "steam://joinlobby/553850/1234567890/1234567890";
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: "SEAF_NEW_LOBBY",
      title: testTitle,
      link: testLink
    }).catch(() => {
      addLog("❌ 테스트 알림 송신 실패 (컨텐츠 스크립트 미실행 탭)");
    });
    addLog("🚀 현재 활성 탭에 테스트 UI 신호 송신 완료");
  }
}

// 시스템 로그 기록 함수 (최대 100줄 제한 유지)
async function addLog(message) {
  const time = new Date().toLocaleTimeString();
  const logEntry = `[${time}] ${message}`;
  
  const data = await chrome.storage.local.get(['systemLogs']);
  let logs = data.systemLogs || [];
  
  logs.unshift(logEntry);
  if (logs.length > 100) logs = logs.slice(0, 100);
  
  await chrome.storage.local.set({ systemLogs: logs });
  console.log(logEntry); // 서비스 워커 콘솔에도 출력
}

async function runRegexParseTest() {
  await addLog("탐색 시도 중...");
  try {
    const res = await fetch(TARGET_URL);
    if (!res.ok) throw new Error(`HTTP 오류! 상태: ${res.status}`);
    
    const html = await res.text();
    
    // 게시글 추출 정규식
    const postRegex = /<tr[^>]*data-no="(\d+)"[^>]*>[\s\S]*?<td class="gall_tit[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g;
    const matches = [...html.matchAll(postRegex)];
    
    // 공지사항 제외 및 데이터 정제
    const currentPosts = matches
      .filter(m => !m[0].includes('icon_notice'))
      .map(m => ({
        id: parseInt(m[1]),
        title: m[2].replace(/<[^>]*>?/gm, '').trim()
      }));

    if (currentPosts.length === 0) {
      await addLog("조건에 맞는 게시글이 목록에 없습니다.");
      return;
    }

    // 1. 처음 실행 시 기준점(Seed) 설정
    if (lastCheckedPostId === null) {
      lastCheckedPostId = currentPosts[0].id;
      await addLog(`탐색 시작: 기준 ID 설정 (${lastCheckedPostId})`);
      return;
    }

    // 2. 새 글 필터링
    const newPosts = currentPosts.filter(p => p.id > lastCheckedPostId);

    if (newPosts.length === 0) {
      // 새로운 글이 없으면 로그를 남기지 않고 종료 (로그 폭주 방지)
      return;
    }

    await addLog(`새로운 게시글 ${newPosts.length}개 감지됨.`);

    // 3. 새 글 순회하며 상세 페이지 탐색
    for (const post of [...newPosts].reverse()) {
      await processPost(post.id, post.title);
    }

    // 4. 마지막 확인 ID 업데이트
    lastCheckedPostId = currentPosts[0].id;

  } catch (e) {
    await addLog(`❌ 에러 발생: ${e.message}`);
  }
}

async function processPost(postId, title) {
  try {
    const viewUrl = `https://gall.dcinside.com/mgallery/board/view/?id=helldiversseries&no=${postId}`;
    const detailRes = await fetch(viewUrl);
    const detailHtml = await detailRes.text();
    
    const lobbyMatch = detailHtml.match(/steam:\/\/joinlobby\/\d+\/\d+\/\d+/);
    
    if (lobbyMatch) {
      const lobbyLink = lobbyMatch[0];
      await addLog(`✅ [새 망호] ${title.substring(0, 10)}... | 로비 발견`);
      
      // 스토리지에 링크 저장
      await saveLink(lobbyLink, title);

      // [핵심] 브라우저 내의 모든 탭으로 알림 전송
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: "SEAF_NEW_LOBBY",
          title: title,
          link: lobbyLink
        }).catch(() => {
          // 컨텐츠 스크립트가 없는 탭(설정 페이지 등)은 무시
        });
      }
      await addLog(`🚀 모든 탭에 UI 알림 신호 송신 완료`);
    } else {
      await addLog(`ℹ️ [링크 없음] ${title.substring(0, 10)}... (ID: ${postId})`);
    }
  } catch (e) {
    await addLog(`❌ 상세 페이지 오류 (${postId}): ${e.message}`);
  }
}

async function saveLink(link, title) {
  const data = await chrome.storage.local.get(['testLobbyLinks']);
  let list = data.testLobbyLinks || [];
  if (!list.some(item => item.link === link)) {
    list.unshift({
      time: new Date().toLocaleTimeString(),
      title: title,
      link: link
    });
    if (list.length > 15) list.pop();
    await chrome.storage.local.set({ testLobbyLinks: list });
  }
}