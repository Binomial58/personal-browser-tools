(function () {
  "use strict";

  const MESSAGE_TYPE = "atcoder-difficulty-display:fetch";

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TYPE || !message.url) {
      return false;
    }

    fetch(message.url, { credentials: "omit" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`GET ${message.url} failed: ${response.status}`);
        }

        return response.json();
      })
      .then((data) => sendResponse({ data }))
      .catch((error) => sendResponse({ error: error.message }));

    return true;
  });
})();
