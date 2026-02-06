/**
 * SEAF UI Injector - Content Script
 * 모든 웹페이지의 우측 하단에 알림 스택을 생성합니다.
 */

(function() {
  // 1. 알림 컨테이너 생성 (없을 경우에만)
  let container = document.getElementById('seaf-notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'seaf-notification-container';
    // 인라인 스타일로 기본 위치 고정 (외부 CSS 간섭 최소화)
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '2147483647', // 최상단 유지
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none' // 컨테이너 자체는 클릭 무시
    });
    document.body.appendChild(container);
  }

  // 2. 메시지 리스너
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "SEAF_NEW_LOBBY") {
      createToast(request.title, request.link);
    }
  });

  // 3. 토스트 생성 함수
  function createToast(title, link) {
    const toast = document.createElement('div');
    toast.className = 'seaf-notify-toast';
    
    // 스타일 주입 (인라인 스타일을 사용하여 완벽 격리)
    Object.assign(toast.style, {
      width: '300px',
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      fontFamily: 'sans-serif',
      fontSize: '14px',
      borderLeft: '5px solid #41639C',
      pointerEvents: 'auto', // 토스트 내부 클릭 허용
      opacity: '0',
      transform: 'translateX(20px)',
      transition: 'all 0.4s ease',
      position: 'relative'
    });

    toast.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px; padding-right: 20px;">☄️ 새로운 망호 발견!</div>
      <div style="font-size: 12px; color: #ccc; margin-bottom: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${title}
      </div>
      <div style="display: flex; gap: 8px;">
        <a href="${link}" style="background: #41639C; color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">즉시 참가</a>
        <button class="seaf-close-btn" style="background: #444; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">닫기</button>
      </div>
    `;

    container.appendChild(toast);

    // 애니메이션 효과 (등장)
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 10);

    // 삭제 로직 (수동/자동)
    const removeToast = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.seaf-close-btn').onclick = removeToast;
    
    // 5초 후 자동 삭제
    setTimeout(removeToast, 5000);
  }
})();