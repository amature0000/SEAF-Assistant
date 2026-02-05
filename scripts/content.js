/**
 * Project SEAF - Content Script
 * 갤러리 목록 내 망호 시각화, 참여 버튼 주입 및 커스텀 알림 UI를 담당합니다.
 */

const SEAF_CONTENT = {
  // 현재 페이지 타입 및 헬다이버즈 갤러리 여부 판별
  isWritePage: () => window.location.href.includes('board/write') && window.location.href.includes('id=helldiversseries'),
  isListPage: () => window.location.href.includes('board/lists') && window.location.href.includes('id=helldiversseries'),

  /**
   * 1. 커스텀 알림(Toast) UI 생성 및 관리
   * 팝업 UI의 디자인 시스템을 반영하며, 즉시 참여 기능을 포함합니다.
   */
  showToast: function(title, postId) {
    let container = document.getElementById('seaf-notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'seaf-notification-container';
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        flex-direction: column-reverse;
        gap: 12px;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'seaf-toast fade-in';
    // popup.html의 --bg-card(#e9e9f0) 및 --color-primary(#41639C) 반영
    toast.style.cssText = `
      background: #e9e9f0;
      color: #1e1f21;
      padding: 14px;
      border-radius: 4px;
      border-left: 5px solid #41639C;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
      width: 280px;
      pointer-events: auto;
      transition: all 0.3s ease;
      font-family: "Segoe UI", "Roboto", sans-serif;
    `;

    toast.innerHTML = `
      <div style="font-size: 11px; color: #41639C; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between;">
        <span>New Mission</span>
        <span style="cursor:pointer; color: #888;" onclick="this.parentElement.parentElement.remove()">✕</span>
      </div>
      <div style="font-size: 13px; font-weight: bold; line-height: 1.4; margin-bottom: 10px; word-break: break-all;">
        ${title}
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="btn-join-${postId}" style="flex: 1; padding: 6px; background: #41639C; color: white; border: none; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">
          즉시 참여
        </button>
        <button id="btn-view-${postId}" style="flex: 1; padding: 6px; background: #d0d0d0; color: #1e1f21; border: none; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">
          게시글 보기
        </button>
      </div>
    `;

    container.appendChild(toast);

    // 즉시 참여 버튼 로직: 본문에서 링크 추출 후 리다이렉트
    const joinBtn = toast.querySelector(`#btn-join-${postId}`);
    joinBtn.onclick = () => {
      joinBtn.innerText = "연결 중...";
      const postUrl = `https://gall.dcinside.com/mgallery/board/view/?id=helldiversseries&no=${postId}`;
      
      chrome.runtime.sendMessage({ type: "GET_LOBBY_FROM_POST", url: postUrl }, (response) => {
        if (response?.link) {
          window.location.href = response.link;
        } else {
          joinBtn.innerText = "링크 없음";
          joinBtn.style.background = "#d9534f";
        }
      });
    };

    // 게시글 보기 버튼 로직
    const viewBtn = toast.querySelector(`#btn-view-${postId}`);
    viewBtn.onclick = () => {
      window.location.href = `https://gall.dcinside.com/mgallery/board/view/?id=helldiversseries&no=${postId}`;
    };

    // 5.5초 후 제거 (사용자가 읽을 시간을 고려하여 소폭 연장)
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 5500);
  },

  /**
   * 2. [작성 페이지] 데이터 자동 주입
   */
  injectWriteData: async () => {
    const saved = await chrome.storage.local.get(['seaf_settings']);
    const settings = saved.seaf_settings;
    if (!settings) return;

    const subjectInput = document.querySelector('input[name="subject"]');
    if (subjectInput && settings.customTitle) {
      subjectInput.value = settings.customTitle;
    }

    const editor = document.querySelector('#mw_content_txt') || document.querySelector('textarea[name="memo"]');
    if (editor) {
      chrome.runtime.sendMessage({ type: "FETCH_STEAM_LOBBY", steamUrl: settings.steamUrl }, (response) => {
        const lobbyLink = response?.link || settings.steamUrl || "#";
        
        const lobbyImageHtml = `
          <div style="text-align:center; margin: 20px 0;">
            <a href="${lobbyLink}" target="_blank" style="text-decoration:none;">
              <div style="display:inline-block; background:#41639C; color:white; padding:15px 30px; border-radius:8px; font-weight:bold; border:2px solid #5a87d1; box-shadow:0 4px 15px rgba(65,99,156,0.4); font-family: sans-serif;">
                ☄️ JOIN MISSION ☄️
              </div>
            </a>
          </div>`.trim();

        const finalContent = `
          ${lobbyImageHtml}
          <p style="text-align:center; font-family: sans-serif;">${settings.customContent || "민주주의를 위해 함께 싸우십시오!"}<br>본 망호는 SEAF Assistant로 생성되었습니다.</p>
        `.trim();

        if (editor.tagName === 'TEXTAREA') {
          editor.value = finalContent.replace(/<[^>]*>?/gm, "");
        } else {
          editor.innerHTML = finalContent;
        }
      });
    }
  },

  /**
   * 3. [목록 페이지] 망호 감지 및 버튼 주입
   */
  enhanceListPage: async () => {
    const rows = document.querySelectorAll('.ub-content.us-post');
    const saved = await chrome.storage.local.get(['seaf_settings']);
    if (saved.seaf_settings?.isDetectionActive === false) return;

    rows.forEach(async (row) => {
      const headEl = row.querySelector('.td_imgicon');
      const titleLink = row.querySelector('.td_subject a');
      if (!titleLink || row.dataset.seafProcessed) return;

      const isManghoHead = headEl && headEl.innerText.trim() === '망호';
      if (!isManghoHead) return;

      row.dataset.seafProcessed = "pending";

      chrome.runtime.sendMessage({ type: "GET_LOBBY_FROM_POST", url: titleLink.href }, (response) => {
        if (response?.link) {
          row.dataset.seafProcessed = "true";
          row.dataset.lobbyLink = response.link;

          row.style.background = 'linear-gradient(90deg, rgba(65, 99, 156, 0.1) 0%, transparent 100%)';
          row.style.borderLeft = '4px solid #41639C';

          const joinBtn = document.createElement('button');
          joinBtn.innerHTML = 'JOIN ☄️';
          joinBtn.style.cssText = `
            margin-left: 10px; padding: 3px 10px; background: #41639C; color: white;
            border: none; border-radius: 4px; font-size: 11px; font-weight: bold;
            cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          `;

          joinBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            window.location.href = row.dataset.lobbyLink;
          };

          const titleWrapper = row.querySelector('.td_subject');
          if (titleWrapper) titleWrapper.appendChild(joinBtn);
        } else {
          row.dataset.seafProcessed = "no-link";
        }
      });
    });
  },

  /**
   * 초기화
   */
  init: function() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "SHOW_SEAF_NOTIFICATION") {
        this.showToast(message.title, message.postId);
      }
    });

    if (this.isWritePage()) {
      setTimeout(() => this.injectWriteData(), 1000);
    }
    if (this.isListPage()) {
      this.enhanceListPage();
      const observer = new MutationObserver(() => this.enhanceListPage());
      const listContainer = document.querySelector('.gall_list') || document.body;
      observer.observe(listContainer, { childList: true, subtree: true });
    }
  }
};

SEAF_CONTENT.init();