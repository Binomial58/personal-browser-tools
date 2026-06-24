(function () {
  "use strict";

  const api = globalThis.browser || globalThis.chrome;
  const NOTIFICATION_ICON =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAQAAAAAYLlVAAAAdUlEQVR4Ae3XQQ0AIAzAsIF/z0NGHjQKej07s7M7P3BuB1QKqB6gOkD1AdUHVAeoDqA6QPUA1QFqA6gOkD1AdUHVAeoDqA6QPUA1QFqA6gOkD1AdUHVAeoDqA6QPUA1QFqA6gOkD1AdUHVAeoDqA6QPUA1QFqA6j+3AFG0gF0Q3G1IgAAAABJRU5ErkJggg==";

  function createNotification(change) {
    if (globalThis.browser) {
      return api.notifications.create({
        type: "basic",
        iconUrl: NOTIFICATION_ICON,
        title: `${change.username} が ${change.label} を AC`,
        message: `${change.contestId} / ${change.title}`
      });
    }

    return new Promise((resolve, reject) => {
      api.notifications.create(
        `atcoder-favorite-standings:${Date.now()}:${Math.random()}`,
        {
          type: "basic",
          iconUrl: NOTIFICATION_ICON,
          title: `${change.username} が ${change.label} を AC`,
          message: `${change.contestId} / ${change.title}`
        },
        (notificationId) => {
          const runtimeError = api.runtime && api.runtime.lastError;

          if (runtimeError) {
            reject(new Error(runtimeError.message));
            return;
          }

          resolve(notificationId);
        }
      );
    });
  }

  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "notifyFavoriteAcs") {
      return false;
    }

    Promise.all(
      ((message.payload && message.payload.changes) || []).map((change) =>
        createNotification(change)
      )
    )
      .then(() => {
        sendResponse({
          ok: true
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  });
})();
