/**
 * Project SEAF - Unified Content Script
 * 1. 빠른 참여 버튼 (목록 페이지)
 * 2. 툴바 버튼 및 자동 완성 (작성 페이지)
 * 3. 본문 내 링크 이미지화 (조회 페이지)
 * 4. 독립적 알림 UI (모든 페이지)
 */

const SEAF_CONTENT = {
  isWritePage: () => window.location.href.includes('board/write'),
  isListPage: () => window.location.href.includes('board/lists'),
  isViewPage: () => window.location.href.includes('board/view'),

  // --- 알림 UI (Toast) ---
  createToast: function(title, link, postId) {
    let container = document.getElementById('seaf-notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'seaf-notification-container';
      Object.assign(container.style, {
        position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
        display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none'
      });
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const duration = (typeof SEAF_CONFIG !== 'undefined') ? SEAF_CONFIG.NOTI_DURATION : 7000;
    const postUrl = `https://gall.dcinside.com/mgallery/board/view/?id=helldiversseries&no=${postId}`;

    Object.assign(toast.style, {
      width: '320px', backgroundColor: '#1a1a1a', color: '#fff', padding: '15px',
      borderRadius: '8px', boxShadow: '0 8px 16px rgba(0,0,0,0.4)', fontFamily: 'sans-serif',
      fontSize: '14px', borderLeft: '5px solid #41639C', pointerEvents: 'auto',
      opacity: '0', transform: 'translateX(20px)', transition: 'all 0.4s ease'
    });

    toast.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px; color: #41639C;">☄️ 신규 망호 감지</div>
      <a href="${postUrl}" target="_blank" style="display: block; color: #eee; text-decoration: none; font-size: 13px; margin-bottom: 12px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="게시글로 이동">
        ${title} <span style="font-size: 10px; color: #888;">[이동]</span>
      </a>
      <div style="display: flex; gap: 8px;">
        <a href="${link}" style="flex: 1; background: #41639C; color: white; text-decoration: none; padding: 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-align: center;">⚡ 즉시 참가</a>
        <button class="seaf-close-btn" style="background: #333; color: #ccc; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">닫기</button>
      </div>
    `;

    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; }, 10);

    const close = () => {
      if (!toast.parentNode) return;
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 400);
    };
    
    toast.querySelector('.seaf-close-btn').onclick = close;
    setTimeout(close, duration);
  },

  // --- 게시글 목록 버튼 주입 ---
  enhanceListPage: function() {
    const posts = document.querySelectorAll('.ub-content');
    posts.forEach(post => {
      if (post.hasAttribute('data-seaf-processed')) return;
      const subjectTd = post.querySelector('.gall_subject');
      const titleTd = post.querySelector('.gall_tit.ub-word');
      
      if (subjectTd && subjectTd.innerText.trim() === '헬망호' && titleTd) {
        const postLink = titleTd.querySelector('a')?.href;
        if (!postLink) return;
        post.setAttribute('data-seaf-processed', 'true');

        chrome.runtime.sendMessage({ type: "GET_LOBBY_LINK", url: postLink }, (response) => {
          if (response?.link) {
            const btn = document.createElement('button');
            btn.innerText = '☄️참여';
            Object.assign(btn.style, {
              marginLeft: '8px', padding: '1px 6px', backgroundColor: '#41639C',
              color: '#fff', fontSize: '11px', fontWeight: 'bold', borderRadius: '3px',
              border: 'none', cursor: 'pointer', verticalAlign: 'middle'
            });
            btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); window.location.href = response.link; };
            titleTd.querySelector('a').after(btn);
          }
        });
      }
    });
  },

  // --- 본문 링크 버튼화 ---
  convertLobbyLinks: function() {
    const contentView = document.querySelector('.writing_view_box');
    if (!contentView || contentView.hasAttribute('data-seaf-converted')) return;
    const lobbyRegex = /steam:\/\/joinlobby\/\d+\/\d+\/\d+/g;
    if (lobbyRegex.test(contentView.innerHTML)) {
      contentView.innerHTML = contentView.innerHTML.replace(lobbyRegex, (match) => {
        return `<div style="text-align: center; margin: 20px 0;"><a href="${match}" style="display: inline-block; padding: 12px 30px; background-color: #41639C; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 16px;">☄️ 즉시 참가하기 ☄️</a></div>`;
      });
      contentView.setAttribute('data-seaf-converted', 'true');
    }
  },

  // --- 글쓰기 자동 완성 ---
  injectWriteAssistant: function() {
    const toolbar = document.querySelector('.note-toolbar');
    if (!toolbar || document.getElementById('seaf-auto-btn')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'note-btn-group';
    wrapper.innerHTML = `<button type="button" id="seaf-auto-btn" class="note-btn" style="padding: 0 5px;"><b style="color:#41639C; font-size: 11px;">☄️망호 자동 완성</b></button>`;
    toolbar.appendChild(wrapper);
    document.getElementById('seaf-auto-btn').onclick = () => this.handleAutoFill();
  },

  handleAutoFill: async function() {
    const { seaf_settings: s } = await chrome.storage.local.get(['seaf_settings']);
    const manghoLi = document.querySelector('li[data-val="헬망호"]');
    if (manghoLi) manghoLi.click();
    const titleInput = document.querySelector('input[name="subject"]');
    if (titleInput) titleInput.value = s?.customTitle || "☄️ 민주주의 망호";
    const editor = document.querySelector('.note-editable');
    if (editor && s?.steamUrl) {
      chrome.runtime.sendMessage({ type: "GET_LOBBY_LINK", url: s.steamUrl }, (response) => {
        const lobbyLink = response?.link;
        const lobbyHtml = lobbyLink ? `<div style="text-align:center; margin:20px 0;"><a href="${lobbyLink}" style="background:#41639C; color:white; padding:12px 30px; border-radius:5px; text-decoration:none; font-weight:bold;">☄️즉시 참가하기☄️</a></div>` : "";
        editor.innerHTML = `<div style="text-align:center;">${lobbyHtml}<p>${(s?.customContent || "민주주의 전파에 동참하십시오.").replace(/\n/g, '<br>')}</p></div>`;
      });
    }
  },

  init: function() {
    if (this.isListPage() || this.isViewPage()) {
      this.enhanceListPage();
      new MutationObserver(() => this.enhanceListPage()).observe(document.body, { childList: true, subtree: true });
    }
    if (this.isWritePage()) setInterval(() => this.injectWriteAssistant(), 1000);
    if (this.isViewPage()) this.convertLobbyLinks();
    chrome.runtime.onMessage.addListener((m) => {
      if (m.type === "SEAF_NEW_LOBBY") this.createToast(m.title, m.link, m.postId);
    });
  }
};

SEAF_CONTENT.init();