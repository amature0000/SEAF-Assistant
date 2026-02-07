/**
 * Project SEAF - Popup Controller
 * popup.html과 settings.html의 모든 이벤트를 통합 관리
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 버전 정보 설정
  const manifestData = chrome.runtime.getManifest();
  const versionDisplay = document.getElementById('seaf-version-display');
  if (versionDisplay) {
    versionDisplay.innerText = `SEAF Assistant v${manifestData.version}`;
  }

  // 워터마크 아이콘 URL 설정
  const iconUrl = chrome.runtime.getURL('icons/icon128.png');
  document.documentElement.style.setProperty('--seaf-icon-url', `url("${iconUrl}")`);

  // 페이지 구분
  const isPopupPage = document.getElementById('seaf-category-grid') !== null;
  const isSettingsPage = document.getElementById('seaf-detection-toggle') !== null;

  // ========================================
  // POPUP.HTML 로직
  // ========================================
  if (isPopupPage) {
    await initPopupPage();
  }

  // ========================================
  // SETTINGS.HTML 로직
  // ========================================
  if (isSettingsPage) {
    await initSettingsPage();
  }
});

/**
 * popup.html 초기화
 */
async function initPopupPage() {
  const steamInput = document.getElementById('seaf-steam-url');
  const categoryGrid = document.getElementById('seaf-category-grid');
  const difficultyGroup = document.getElementById('seaf-difficulty-group');
  const difficultyGrid = document.getElementById('seaf-difficulty-grid');
  const subtagGroup = document.getElementById('seaf-subtag-group');
  const subtagGrid = document.getElementById('seaf-subtag-grid');
  const customTitleInput = document.getElementById('seaf-custom-title');
  const customContentInput = document.getElementById('seaf-custom-content');
  const saveBtn = document.getElementById('seaf-save-btn');
  const settingsBtn = document.getElementById('seaf-settings-btn');

  // 기본 설정값
  let currentSettings = {
    steamUrl: '',
    category: '',
    difficulty: '',
    subTag: '',
    customTitle: '',
    customContent: ''
  };

  // 저장된 설정 불러오기
  const saved = await chrome.storage.local.get(['seaf_settings']);
  if (saved.seaf_settings) {
    currentSettings = { ...currentSettings, ...saved.seaf_settings };
  }

  // UI 반영
  steamInput.value = currentSettings.steamUrl || '';
  customTitleInput.value = currentSettings.customTitle || '';
  customContentInput.value = currentSettings.customContent || '';

  // 카테고리 렌더링
  if (typeof SEAF_TAGS !== 'undefined') {
    Object.keys(SEAF_TAGS.CATEGORIES).forEach(key => {
      const category = SEAF_TAGS.CATEGORIES[key];
      const btn = document.createElement('div');
      btn.className = `seaf-category-btn ${currentSettings.category === key ? 'seaf-active' : ''}`;
      btn.innerHTML = `<span>${category.name}</span><br><span>${category.emoji}</span>`;
      btn.onclick = () => selectCategory(key);
      categoryGrid.appendChild(btn);
    });

    // 초기 카테고리 선택 상태 복원
    if (currentSettings.category) {
      const categoryData = SEAF_TAGS.CATEGORIES[currentSettings.category];
      
      // 1. 카테고리 버튼 active 표시
      Array.from(categoryGrid.children).forEach((btn, idx) => {
        btn.classList.toggle('seaf-active', Object.keys(SEAF_TAGS.CATEGORIES)[idx] === currentSettings.category);
      });
      
      // 2. 난이도 그룹 표시 및 복원
      if (categoryData.hasDifficulty) {
        difficultyGroup.style.display = 'block';
        renderDifficulty();
      }
      
      // 3. 서브태그 복원
      renderSubTags(currentSettings.category);
    }
    
    // 4. 저장된 제목으로 다시 덮어쓰기 (자동생성 제목이 덮어쓴 것을 복원)
    customTitleInput.value = currentSettings.customTitle || '';
  }

  /**
   * 카테고리 선택
   */
  function selectCategory(key) {
    // 같은 카테고리 클릭 시 토글(취소)
    if (currentSettings.category === key) {
      currentSettings.category = '';
      currentSettings.difficulty = '';
      currentSettings.subTag = '';
      
      // 모든 카테고리 버튼 비활성화
      Array.from(categoryGrid.children).forEach(btn => {
        btn.classList.remove('seaf-active');
      });
      
      // 난이도/서브태그 그룹 숨김
      difficultyGroup.style.display = 'none';
      subtagGroup.style.display = 'none';
      
      updateTitlePreview();
      return;
    }

    // 카테고리 변경 시 서브태그 초기화
    if (currentSettings.category !== key) {
      currentSettings.subTag = '';
    }
    
    currentSettings.category = key;
    const categoryData = SEAF_TAGS.CATEGORIES[key];

    // 카테고리 버튼 active 상태 변경
    Array.from(categoryGrid.children).forEach((btn, idx) => {
      btn.classList.toggle('seaf-active', Object.keys(SEAF_TAGS.CATEGORIES)[idx] === key);
    });

    // 난이도 그룹 표시/숨김
    if (categoryData.hasDifficulty) {
      difficultyGroup.style.display = 'block';
      renderDifficulty();
    } else {
      difficultyGroup.style.display = 'none';
      currentSettings.difficulty = '';
    }

    // 특수작전 태그 렌더링
    renderSubTags(key);

    // 제목 미리보기 업데이트
    updateTitlePreview();
  }

  /**
   * 난이도 렌더링
   */
  function renderDifficulty() {
    difficultyGrid.innerHTML = '';
    SEAF_TAGS.DIFFICULTIES.forEach(level => {
      const btn = document.createElement('div');
      btn.className = `seaf-tag-btn ${currentSettings.difficulty == level ? 'seaf-active' : ''}`;
      btn.innerText = level;
      btn.onclick = () => {
        // 같은 난이도 클릭 시 토글(취소)
        if (currentSettings.difficulty == level) {
          currentSettings.difficulty = '';
        } else {
          currentSettings.difficulty = level;
        }
        renderDifficulty();
        updateTitlePreview();
      };
      difficultyGrid.appendChild(btn);
    });
  }

  /**
   * 특수작전 태그 렌더링
   */
  function renderSubTags(key) {
    subtagGrid.innerHTML = '';
    const tags = SEAF_TAGS.CATEGORIES[key].tags || [];

    if (tags.length === 0) {
      subtagGroup.style.display = 'none';
      return;
    }

    subtagGroup.style.display = 'block';
    tags.forEach(tag => {
      const btn = document.createElement('div');
      btn.className = `seaf-tag-btn ${currentSettings.subTag === tag ? 'seaf-active' : ''}`;
      btn.innerText = tag;
      btn.onclick = () => {
        currentSettings.subTag = (currentSettings.subTag === tag) ? '' : tag;
        renderSubTags(key);
        updateTitlePreview();
      };
      subtagGrid.appendChild(btn);
    });
  }

  /**
   * 제목 미리보기 업데이트
   */
  function updateTitlePreview() {
    let title = '';
    
    if (!currentSettings.category) {
      // 카테고리 없을 때: 빈 문자열
      title = '';
    } else {
      const category = SEAF_TAGS.CATEGORIES[currentSettings.category];
      const target = currentSettings.subTag || category.name;
      const diffText = currentSettings.difficulty ? `${currentSettings.difficulty}단` : '';
      
      // {카테고리} {타겟} {난이도} 망호
      title = `${category.emoji} ${target} ${diffText} 망호`.replace(/\s+/g, ' ').trim();
    }

    customTitleInput.value = title;
    currentSettings.customTitle = title;
  }

  /**
   * 저장 버튼
   */
  saveBtn.onclick = async () => {
    // Steam URL 검증
    if (steamInput.value.trim() !== "" && !steamInput.value.includes('steamcommunity.com')) {
      showStatus("Steam URL을 확인해주세요", "error");
      return;
    }

    currentSettings.steamUrl = steamInput.value;
    currentSettings.customTitle = customTitleInput.value;
    currentSettings.customContent = customContentInput.value;
    // 태그 선택 상태도 저장
    // currentSettings.category, difficulty, subTag는 이미 선택 시 업데이트됨

    await chrome.storage.local.set({ seaf_settings: currentSettings });
    showStatus("저장 완료!", "success");
  };

  /**
   * 설정 버튼
   */
  settingsBtn.onclick = () => {
    window.location.href = 'settings.html';
  };

  /**
   * 상태 메시지 표시
   */
  function showStatus(msg, type) {
    const statusEl = document.createElement('div');
    statusEl.className = 'seaf-save-status';
    statusEl.innerText = msg;
    statusEl.style.color = type === 'success' ? 'var(--seaf-color-primary)' : '#ff4444';
    
    const footer = document.querySelector('.seaf-footer');
    footer.appendChild(statusEl);
    
    setTimeout(() => statusEl.remove(), 2500);
  }
}

/**
 * settings.html 초기화
 */
async function initSettingsPage() {
  const detectionToggle = document.getElementById('seaf-detection-toggle');
  const pollingSlider = document.getElementById('seaf-polling-slider');
  const pollingValue = document.getElementById('seaf-polling-value');
  const toastDurationSlider = document.getElementById('seaf-toast-duration-slider');
  const toastDurationValue = document.getElementById('seaf-toast-duration-value');
  const backBtn = document.getElementById('seaf-back-btn');
  const saveStatus = document.getElementById('seaf-save-status');

  // 기본 설정값
  let currentSettings = {
    isDetectionActive: true,
    pollingInterval: 5,
    toastDuration: 6
  };

  // 저장된 설정 불러오기
  const saved = await chrome.storage.local.get(['seaf_settings']);
  if (saved.seaf_settings) {
    currentSettings = { ...currentSettings, ...saved.seaf_settings };
  }

  // UI 반영
  detectionToggle.checked = currentSettings.isDetectionActive;
  pollingSlider.value = currentSettings.pollingInterval;
  pollingValue.innerText = `${currentSettings.pollingInterval}초`;
  toastDurationSlider.value = currentSettings.toastDuration;
  toastDurationValue.innerText = `${currentSettings.toastDuration}초`;

  /**
   * 자동 저장 함수
   */
  async function autoSave() {
    await chrome.storage.local.set({ seaf_settings: currentSettings });
    chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });
    showStatus("설정 저장됨");
  }

  /**
   * 토글 변경
   */
  detectionToggle.onchange = async (e) => {
    currentSettings.isDetectionActive = e.target.checked;
    await autoSave();
  };

  /**
   * 폴링 간격 변경
   */
  pollingSlider.oninput = (e) => {
    const value = parseInt(e.target.value);
    pollingValue.innerText = `${value}초`;
    currentSettings.pollingInterval = value;
  };

  pollingSlider.onchange = async () => {
    await autoSave();
  };

  /**
   * 토스트 지속 시간 변경
   */
  toastDurationSlider.oninput = (e) => {
    const value = parseInt(e.target.value);
    toastDurationValue.innerText = `${value}초`;
    currentSettings.toastDuration = value;
  };

  toastDurationSlider.onchange = async () => {
    await autoSave();
  };

  /**
   * 뒤로가기 버튼
   */
  backBtn.onclick = () => {
    window.location.href = 'popup.html';
  };

  /**
   * 상태 메시지 표시
   */
  function showStatus(msg) {
    saveStatus.innerText = msg;
    saveStatus.style.color = 'var(--seaf-color-primary)';
    setTimeout(() => { saveStatus.innerText = ""; }, 2000);
  }
}