# Responsive Mockup Studio

<p align="center"><img src="docs/logo.png" width="256" alt="Responsive Mockup Studio logo: a flat double-outline frame on black"></p>

[English](README.md) · [Türkçe](README.tr.md)

Responsive Mockup Studio is a YCSWU Tools creative application for turning live websites into polished device presentations. It combines a responsive browser viewport, configurable device frames, composition controls, and production-ready export in one workspace.

![Responsive Mockup Studio interface](docs/responsive-mockup-studio.png)

## The problem it solves

Creating a website mockup usually means switching between a browser, screenshot utility, image editor, and separate device assets. The result can become inaccurate when the website changes size, the screenshot no longer matches the frame, or a high-resolution export stretches or repeats the page.

Responsive Mockup Studio keeps the website, viewport, device geometry, and final composition connected. A designer can test a real URL at desktop, tablet, and phone sizes, position it inside a device, adjust the visual treatment, and export the same composition shown in the preview.

## Who it is for

- Designers preparing portfolio, case-study, pitch, and social presentation images.
- Developers checking responsive behavior while creating presentation-ready output.
- Agencies producing consistent device visuals for several clients or pages.
- Product teams documenting websites across multiple viewport sizes.
- Creators who need reusable mockups without rebuilding them in an image editor.

## Live responsive website workflow

Enter a URL and open it inside the selected screen. The website follows the actual screen area when the device or viewport changes, so responsive breakpoints remain synchronized with the mockup instead of leaving gaps or using a fixed screenshot size.

The Windows edition uses an embedded Chromium browser for live external websites, navigation, sessions, and capture. The web edition uses the same editor, device controls, page-appearance controls, bookmarks, history, and export workflow. Browser security still determines whether a third-party website permits iframe display and DOM access; unrestricted cross-origin capture remains available in the Windows edition.

The browser workspace includes:

- Desktop, tablet, and phone shortcuts.
- Automatic responsive sizing or manual width and height.
- Dimension swap and reset controls.
- Editable address bar with back, forward, and reload actions.
- Recent URLs and persistent bookmarks.
- Optional scrollbar, cursor, animation, and page-background controls.
- Custom CSS and safe visibility controls for discovered page elements.
- Browser-native live preview with the same viewport, frame, material, page-appearance, and export controls as the Windows editor.

## Device mockups

Choose a custom computer, tablet, or phone frame, or start from a ready-made aspect ratio. Ready frames preserve their technical proportions while still allowing supported appearance changes.

Device controls include:

- Frame color with color picker and direct HEX input.
- Material, roughness, reflectivity, and surface reflection.
- Frame thickness, screen size, and corner geometry on custom devices.
- Matte-screen and glass-reflection treatment.
- Adjustable part-gradient direction, size, and softness.
- Device-only wireframe mode with independent contour color and thickness.
- Removable and restorable monitor stems, bases, details, laptop lips, and phone side controls where supported.
- Saved custom devices with thumbnails and persistent favorites for ready frames.

The website remains visible when wireframe mode is enabled, and the outline grows outside the screen glass instead of covering the content.

## Composition and camera

Arrange the device directly in the preview instead of correcting placement after export.

- Pan with the middle mouse button.
- Zoom with the mouse wheel.
- Adjust camera X/Y, rotation, vertical tilt, and horizontal tilt.
- Reset individual controls or double-click a slider to restore its default.
- Recenter the device with a dedicated center action.
- Use optional 1:1, 4:5, or 16:9 composition frames.
- Switch the composition between landscape and portrait.
- Drag the Device Settings panel to keep controls away from the artwork.
- Collapse the Frames panel to create more preview space while keeping the device centered.

## Background design

Build the surrounding composition without leaving the application:

- Black, white, transparent, or custom-color backgrounds.
- Uploaded background images.
- Linear and radial gradients.
- Any number of gradient colors with HEX and position controls.
- Adjustable gradient angle and transition behavior.
- Dark and light application themes.

## Export

Export the active preview or the selected composition frame as:

- PNG
- Transparent PNG
- JPG
- WebP
- SVG

Raster output supports adjustable long-edge size, DPI, and JPEG/WebP quality. Transparent PNG preserves transparent pixels outside the device.

SVG output keeps the device geometry and compatible website graphics as vectors. Website text is converted to font-independent vector paths so its appearance does not change when the file is opened on another computer. Photographic content remains embedded as bitmap imagery where necessary.

Saved devices can also be exported as transparent PNG frames with an empty screen, ready for reuse in another design workflow.

## Local workspace and privacy

Bookmarks, recent URLs, favorites, saved devices, and editor preferences are stored in the local browser or application profile. The static web edition does not require a database, account, or server-side application runtime.

## Editions

- **Windows Setup:** installed desktop application with the complete Chromium capture workflow.
- **Windows Portable:** the same desktop workflow without installation.
- **Web:** static browser edition for hosting on a normal web server or cPanel account.

Responsive Mockup Studio is part of **YCSWU Tools**.

MIT licensed. Created by Ali Guzel / YCSWU.
