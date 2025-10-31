// Validation utilities
function isAllowedProfileUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return ['x.com', 'twitter.com', 'www.twitter.com', 'www.x.com'].includes(u.hostname);
  } catch {
    return false;
  }
}

module.exports = {
  isAllowedProfileUrl
};

