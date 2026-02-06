document.addEventListener('DOMContentLoaded', async () => {
  const logContainer = document.getElementById('system-logs');
  const linkContainer = document.getElementById('link-list');
  const testBtn = document.getElementById('test-ui-btn');

  // 테스트 버튼 클릭 이벤트: 백그라운드로 알림 요청 전송
  testBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: "TEST_NOTIFICATION_UI" });
  });

  async function updateDisplay() {
    const data = await chrome.storage.local.get(['systemLogs', 'testLobbyLinks']);
    
    // 1. 시스템 로그 업데이트
    const logs = data.systemLogs || [];
    logContainer.innerHTML = logs.map(log => `<div>${log}</div>`).join('');

    // 2. 발견된 링크 업데이트
    const links = data.testLobbyLinks || [];
    if (links.length === 0) {
      linkContainer.innerHTML = '<p style="color:#888; font-size:11px;">수신된 링크 없음</p>';
    } else {
      linkContainer.innerHTML = links.map(item => `
        <div style="border-bottom:1px solid #ddd; padding:5px 0;">
          <strong style="font-size:12px; color:#41639C;">${item.title}</strong><br>
          <span style="font-size:10px; color:#666;">${item.link}</span>
        </div>
      `).join('');
    }
  }

  // 초기 실행 및 2초마다 화면 갱신
  updateDisplay();
  setInterval(updateDisplay, 2000);
});