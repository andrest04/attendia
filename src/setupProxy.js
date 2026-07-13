// Chrome's default Cross-Origin-Opener-Policy blocks the postMessage/window.close
// handshake signInWithPopup relies on, so the Google popup closes without the SDK
// ever resolving. This header must reach every response (not just proxied API
// calls), so it's set here rather than in the "proxy" field in package.json.
module.exports = function (app) {
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });
};
