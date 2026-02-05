document.addEventListener('DOMContentLoaded', async () => {
  const steamInput = document.getElementById('steam-url');
  const pollingSlider = document.getElementById('polling-slider');
  const pollingValue = document.getElementById('polling-value');
  const detectionToggle = document.getElementById('detection-toggle');
  const categoryGrid = document.getElementById('category-grid');
  const dynamicArea = document.getElementById('dynamic-area');
  const diffGrid = document.getElementById('difficulty-grid');
  const subtagGrid = document.getElementById('subtag-grid');
  const customTitleInput = document.getElementById('custom-title');
  const customContentInput = document.getElementById('custom-content');
  const saveBtn = document.getElementById('save-settings-btn');
  const statusEl = document.getElementById('save-status');

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

  // 1. 초기 데이터 로드
  const saved = await chrome.storage.local.get(['seaf_settings']);
  if (saved.seaf_settings) {
    currentSettings = { ...currentSettings, ...saved.seaf_settings };
    steamInput.value = currentSettings.steamUrl || '';
    pollingSlider.value = currentSettings.pollingInterval || 5;
    pollingValue.innerText = `${pollingSlider.value}s`;
    detectionToggle.checked = currentSettings.isDetectionActive !== false;
    customTitleInput.value = currentSettings.customTitle || '';
    customContentInput.value = currentSettings.customContent || '';
  }

  // 슬라이더 변경 감지
  pollingSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    pollingValue.innerText = `${val}s`;
    currentSettings.pollingInterval = parseInt(val);
  });

  // 토글 변경 감지
  detectionToggle.addEventListener('change', (e) => {
    currentSettings.isDetectionActive = e.target.checked;
  });

  // 2. 카테고리 렌더링 (CONFIG 기반)
  Object.entries(CONFIG.CATEGORIES).forEach(([id, data]) => {
    const btn = document.createElement('div');
    btn.className = `btn ${currentSettings.category === id ? 'active' : ''}`;
    btn.innerHTML = `<span>${data.emoji}</span><span>${data.name}</span>`;
    btn.onclick = () => selectCategory(id);
    categoryGrid.appendChild(btn);
  });

  // 카테고리 선택 처리
  function selectCategory(id) {
    currentSettings.category = id;
    currentSettings.subTag = ''; 
    Array.from(categoryGrid.children).forEach((child, idx) => {
      const categoryId = Object.keys(CONFIG.CATEGORIES)[idx];
      child.classList.toggle('active', categoryId === id);
    });

    const categoryData = CONFIG.CATEGORIES[id];
    renderDynamicOptions(categoryData);
    dynamicArea.style.display = 'block';
    updateLivePreview();
  }

  function renderDynamicOptions(data) {
    diffGrid.innerHTML = '';
    if (data.hasDifficulty) {
      document.getElementById('difficulty-group').style.display = 'block';
      CONFIG.DIFFICULTIES.forEach(d => {
        const btn = document.createElement('div');
        btn.className = `tag-btn ${currentSettings.difficulty === d ? 'active' : ''}`;
        btn.innerText = `${d}단`;
        btn.onclick = () => {
          currentSettings.difficulty = d;
          Array.from(diffGrid.children).forEach(c => c.classList.toggle('active', c.innerText === `${d}단`));
          updateLivePreview();
        };
        diffGrid.appendChild(btn);
      });
    }

    subtagGrid.innerHTML = '';
    if (data.tags.length > 0) {
      document.getElementById('subtag-group').style.display = 'block';
      data.tags.forEach(t => {
        const btn = document.createElement('div');
        btn.className = `tag-btn ${currentSettings.subTag === t ? 'active' : ''}`;
        btn.innerText = t;
        btn.onclick = () => {
          currentSettings.subTag = t;
          Array.from(subtagGrid.children).forEach(c => c.classList.toggle('active', c.innerText === t));
          updateLivePreview();
        };
        subtagGrid.appendChild(btn);
      });
    } else {
      document.getElementById('subtag-group').style.display = 'none';
    }
  }

  function updateLivePreview() {
    if (!currentSettings.category) return;
    const cat = CONFIG.CATEGORIES[currentSettings.category];
    const target = currentSettings.subTag || cat.name;
    const diffText = currentSettings.difficulty ? `${currentSettings.difficulty}단` : "";
    const title = CONFIG.DEFAULT_TEMPLATE.title
      .replace('{emoji}', cat.emoji)
      .replace('{target}', target)
      .replace('{diff}', diffText).trim();
    
    customTitleInput.value = title;
    currentSettings.customTitle = title;
  }

  // 설정 저장
  saveBtn.addEventListener('click', () => {
    currentSettings.steamUrl = steamInput.value;
    currentSettings.customContent = customContentInput.value;
    
    chrome.storage.local.set({ seaf_settings: currentSettings }, () => {
      statusEl.innerText = 'SAVED';
      setTimeout(() => { statusEl.innerText = ''; }, 1500);
    });
  });

  // 초기 로드 시 카테고리가 선택되어 있다면 서브 메뉴 렌더링
  if (currentSettings.category) {
    selectCategory(currentSettings.category);
  }
});