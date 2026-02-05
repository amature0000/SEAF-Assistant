/**
 * Project SEAF - Background Service Worker
 */

let notifiedPosts = new Set();
let userSettings = {
  pollingInterval: 5,
  isDetectionActive: true
};

const initSettings = async () => {
  const saved = await chrome.storage.local.get(['seaf_settings']);
  if (saved.seaf_settings) {
    userSettings.pollingInterval = saved.seaf_settings.pollingInterval || 5;
    userSettings.isDetectionActive = saved.seaf_settings.isDetectionActive !== false;
  }
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.seaf_settings?.newValue) {
    const newVal = changes.seaf_settings.newValue;
    userSettings.pollingInterval = newVal.pollingInterval;
    userSettings.isDetectionActive = newVal.isDetectionActive;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FETCH_STEAM_LOBBY") {
    fetchLobbyLink(request.steamUrl)
      .then(link => {
        if (link) sendResponse({ success: true, link: link });
        else sendResponse({ success: false });
      })
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (request.type === "GET_LOBBY_FROM_POST") {
    extractFromPost(request.url).then(link => sendResponse({ link }));
    return true;
  }
});

async function fetchLobbyLink(steamUrl) {
  if (!steamUrl || !steamUrl.includes('steamcommunity.com')) return null;
  try {
    const response = await fetch(steamUrl);
    const html = await response.text();
    const lobbyMatch = html.match(/steam:\/\/joinlobby\/644830\/\d+/);
    return lobbyMatch ? lobbyMatch[0] : null;
  } catch (e) { return null; }
}

async function extractFromPost(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const lobbyMatch = html.match(/steam:\/\/joinlobby\/644830\/\d+/);
    if (lobbyMatch) return lobbyMatch[0];
    const profileMatch = html.match(/https:\/\/steamcommunity\.com\/(id|profiles)\/[^\s"<>]+/);
    if (profileMatch) return await fetchLobbyLink(profileMatch[0]);
    return null;
  } catch (e) { return null; }
}

function sendCustomNotification(postId, title) {
  if (notifiedPosts.has(postId)) return;
  notifiedPosts.add(postId);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "SHOW_SEAF_NOTIFICATION", postId, title });
    }
  });
}

async function checkNewPosts() {
  try {
    const response = await fetch(`https://gall.dcinside.com/mgallery/board/lists/?id=helldiversseries&headid=60`);
    const html = await response.text();
    const postMatches = html.match(/data-no="(\d+)"/g);
    const titleMatches = html.match(/class="pe-link">([^<]+)<\/a>/g);
    if (postMatches && postMatches.length > 0) {
      const latestId = postMatches[0].match(/\d+/)[0];
      const rawTitle = titleMatches ? titleMatches[0].replace(/<[^>]*>?/gm, '').trim() : "새 망호 탐지!";
      if (!notifiedPosts.has(latestId)) sendCustomNotification(latestId, rawTitle);
    }
  } catch (e) {}
}

const runPolling = async () => {
  if (userSettings.isDetectionActive) await checkNewPosts();
  setTimeout(runPolling, userSettings.pollingInterval * 1000);
};

initSettings().then(runPolling);