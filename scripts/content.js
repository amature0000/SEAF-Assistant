/**
 * Project SEAF - Content Script (Unified)
 * 스타일 제거 및 클래스 기반 로직 통합
 */

const SEAF_CONTENT = {
  isWritePage: () => window.location.href.includes('board/write'),
  isListPage: () => window.location.href.includes('board/lists'),

  showToast: function(title, postId) {
    let container = document.getElementById('seaf-notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'seaf-notification-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'seaf-toast';
    toast.innerHTML = `
      <div style="font-size:10px; color:var(--color-primary); font-weight:bold; margin-bottom:5px;">NEW MISSION</div>
      <div style="font-size:13px; font-weight:bold; margin-bottom:10px;">${title}</div>
      <button id="btn-join-${postId}" class="seaf-join-btn">즉시 참여</button>
    `;
    container.appendChild(toast);

    toast.querySelector('button').onclick = () => {
      window.location.href = `https://gall.dcinside.com/mgallery/board/view/?id=helldiversseries&no=${postId}`;
    };

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  },

  enhanceListPage: async () => {
    const rows = document.querySelectorAll('.ub-content.us-post');
    rows.forEach(row => {
      const head = row.querySelector('.td_imgicon');
      if (head?.innerText.trim() === '망호' && !row.dataset.seafProcessed) {
        row.dataset.seafProcessed = "true";
        row.classList.add('seaf-highlight-row');
        
        const btn = document.createElement('button');
        btn.innerText = 'JOIN';
        btn.className = 'seaf-join-btn';
        btn.style.marginLeft = '10px';
        btn.onclick = () => window.location.href = row.querySelector('.td_subject a').href;
        row.querySelector('.td_subject').appendChild(btn);
      }
    });
  },

  injectToolbarButton: function() {
    const toolbar = document.querySelector('.note-toolbar');
    if (toolbar && !document.getElementById('seaf-auto-btn')) {
      const btn = document.createElement('button');
      btn.id = 'seaf-auto-btn';
      btn.className = 'seaf-join-btn seaf-inject-btn';
      btn.innerText = '☄️ 망호 자동 완성';
      btn.onclick = () => this.handleAutoFill();
      toolbar.appendChild(btn);
    }
  },

  handleAutoFill: async function() {
    const { seaf_settings: s } = await chrome.storage.local.get(['seaf_settings']);
    if (!s) return;
    document.querySelector('input[name="subject"]').value = s.customTitle || "";
    const editor = document.querySelector('.note-editable') || document.querySelector('textarea[name="memo"]');
    if (editor) {
      const html = `<div style="text-align:center;">[STEAM LOBBY LINK]<br>${s.customContent}</div>`;
      editor.innerHTML ? editor.innerHTML = html : editor.value = html;
    }
  },

  init: function() {
    chrome.runtime.onMessage.addListener(m => m.type === "SHOW_SEAF_NOTIFICATION" && this.showToast(m.title, m.postId));
    if (this.isListPage()) {
      this.enhanceListPage();
      new MutationObserver(() => this.enhanceListPage()).observe(document.body, {childList:true, subtree:true});
    }
    if (this.isWritePage()) {
      new MutationObserver(() => this.injectToolbarButton()).observe(document.body, {childList:true, subtree:true});
    }
  }
};
SEAF_CONTENT.init();