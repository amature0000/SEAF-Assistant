/**
 * Project SEAF - Popup Logic (Restored Controls)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const versionDisplay = document.getElementById('version-display');
  const steamInput = document.getElementById('steam-url');
  const detectionToggle = document.getElementById('detection-toggle');
  const pollingSlider = document.getElementById('polling-slider');
  const pollingValue = document.getElementById('polling-value');
  
  const categoryGrid = document.getElementById('category-grid');
  const dynamicArea = document.getElementById('dynamic-area');
  const diffGrid = document.getElementById('difficulty-grid');
  const subtagGrid = document.getElementById('subtag-grid');
  const diffGroup = diffGrid.parentElement;
  
  const customTitleInput = document.getElementById('custom-title');
  const customContentInput = document.getElementById('custom-content');
  const saveBtn = document.getElementById('save-settings-btn');
  const statusEl = document.getElementById('save-status');

  // 버전 표시
  const manifestData = chrome.runtime.getManifest();
  versionDisplay.innerText = `SYSTEM v${manifestData.version}`;

  let currentSettings = {
    steamUrl: '',
    pollingInterval: 5,
    isDetectionActive: true,
    category: '',
    difficulty: '',
    subTag: '',
    customTitle: '',
    customContent: ''
  };

  // 기존 설정 로드
  const saved = await chrome.storage.local.get(['seaf_settings']);
  if (saved.seaf_settings) {
    currentSettings = { ...currentSettings, ...saved.seaf_settings };
    steamInput.value = currentSettings.steamUrl || '';
    detectionToggle.checked = currentSettings.isDetectionActive !== false;
    pollingSlider.value = currentSettings.pollingInterval || 5;
    pollingValue.innerText = `${pollingSlider.value}s`;
    customContentInput.value = currentSettings.customContent || '';
  }

  // 폴링 슬라이더 이벤트
  pollingSlider.addEventListener('input', (e) => {
    pollingValue.innerText = `${e.target.value}s`;
    currentSettings.pollingInterval = parseInt(e.target.value);
  });

  // 토글 이벤트
  detectionToggle.addEventListener('change', (e) => {
    currentSettings.isDetectionActive = e.target.checked;
  });

  // 카테고리 버튼 생성
  Object.keys(SEAF_CONFIG.CATEGORIES).forEach(key => {
    const c = SEAF_CONFIG.CATEGORIES[key];
    const btn = document.createElement('div');
    btn.className = `category-btn ${currentSettings.category === key ? 'active' : ''}`;
    btn.innerHTML = `<span>${c.emoji}</span><span>${c.name}</span>`;
    btn.onclick = () => selectCategory(key);
    categoryGrid.appendChild(btn);
  });

  if (currentSettings.category) selectCategory(currentSettings.category);

  function selectCategory(key) {
    currentSettings.category = key;
    const categoryData = SEAF_CONFIG.CATEGORIES[key];

    Array.from(categoryGrid.children).forEach((btn, idx) => {
      btn.classList.toggle('active', Object.keys(SEAF_CONFIG.CATEGORIES)[idx] === key);
    });

    dynamicArea.style.display = 'block';

    if (categoryData.hasDifficulty) {
      diffGroup.style.display = 'block';
      renderDifficulty();
    } else {
      diffGroup.style.display = 'none';
      currentSettings.difficulty = '';
    }

    renderSubTags(key);
    updateLivePreview();
  }

  function renderDifficulty() {
    diffGrid.innerHTML = '';
    SEAF_CONFIG.DIFFICULTIES.forEach(d => {
      const btn = document.createElement('div');
      btn.className = `tag-btn ${currentSettings.difficulty == d ? 'active' : ''}`;
      btn.innerText = `${d}단`;
      btn.onclick = () => {
        currentSettings.difficulty = d;
        renderDifficulty();
        updateLivePreview();
      };
      diffGrid.appendChild(btn);
    });
  }

  function renderSubTags(key) {
    subtagGrid.innerHTML = '';
    const tags = SEAF_CONFIG.CATEGORIES[key].tags || [];
    if (tags.length === 0) {
      subtagGrid.parentElement.style.display = 'none';
      currentSettings.subTag = '';
      return;
    }
    subtagGrid.parentElement.style.display = 'block';
    tags.forEach(t => {
      const btn = document.createElement('div');
      btn.className = `tag-btn ${currentSettings.subTag === t ? 'active' : ''}`;
      btn.innerText = t;
      btn.onclick = () => {
        currentSettings.subTag = (currentSettings.subTag === t) ? '' : t;
        renderSubTags(key);
        updateLivePreview();
      };
      subtagGrid.appendChild(btn);
    });
  }

  function updateLivePreview() {
    if (!currentSettings.category) return;
    const c = SEAF_CONFIG.CATEGORIES[currentSettings.category];
    const target = currentSettings.subTag || c.name;
    const diffText = currentSettings.difficulty ? `${currentSettings.difficulty}단` : '';
    const title = SEAF_CONFIG.TEMPLATES.title
      .replace('{emoji}', c.emoji).replace('{target}', target).replace('{diff}', diffText)
      .replace(/\s+/g, ' ').trim();
    customTitleInput.value = title;
    currentSettings.customTitle = title;
  }

  saveBtn.addEventListener('click', () => {
    currentSettings.steamUrl = steamInput.value;
    currentSettings.customContent = customContentInput.value;
    chrome.storage.local.set({ seaf_settings: currentSettings }, () => {
      statusEl.innerText = 'DEPLOYED';
      setTimeout(() => { statusEl.innerText = ''; }, 2000);
    });
  });
});