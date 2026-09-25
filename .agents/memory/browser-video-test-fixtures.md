---
name: Browser video test fixtures
description: Codec compatibility of browser-driven tests in this workspace
---

The automated Chromium browser used for UI testing can reject H.264 MP4 files with `DEMUXER_ERROR_NO_SUPPORTED_STREAMS`, even if they are re-encoded to baseline H.264/yuv420p. A VP8 WebM transcoding of the same source was decoded successfully.

**Why:** Two H.264 variants failed before the analysis workflow could be tested, while VP8 enabled the full captured-frame interaction. A failed fixture should not be mistaken for an app regression.

**How to apply:** For browser-driven video workflow tests, prefer a small VP8 WebM fixture; check the video element's duration and readyState before diagnosing the app's capture flow.