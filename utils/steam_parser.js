/**
 * Project SEAF - Steam Lobby Parser
 * 스팀 프로필 페이지에서 로비 참여 링크를 추출하는 유틸리티입니다.
 * (필요 시 외부 탭 스크립팅용으로 유지하되 정규식 로직은 통일)
 */

const SteamParser = {
  extractLobbyLink: (html) => {
    // 이제 background.js와 동일한 정규식을 사용합니다.
    const lobbyRegex = /steam:\/\/joinlobby\/\d+\/\d+\/\d+/;
    const match = html.match(lobbyRegex);
    return match ? match[0] : null;
  }
};

if (typeof module !== 'undefined') {
  module.exports = SteamParser;
}