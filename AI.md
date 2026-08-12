# Responsive Mockup Studio

Responsive Mockup Studio is a YCSWU creative tool for rendering real websites at exact CSS viewport sizes and placing those captures inside calibrated device frames. The Windows build uses Electron/Chromium for signed-in navigation and high-density capture. The static web build supports the full editor and embeddable-site preview; unrestricted cross-origin capture is intentionally a desktop-only capability because browsers enforce iframe and canvas security.

Core rules: never stretch a website capture, zoom the complete monitor rather than its inner content, keep matte treatment restrained, render at target density before compositing, and preserve true alpha on transparent exports.
