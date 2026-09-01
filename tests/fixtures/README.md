# Unit 1.3 synthetic PDF fixtures

- `unit-1.3-korean-image.pdf` is a one-page synthetic document created for offline Korean text and embedded raster image rendering checks. It contains no user document data.
- `unit-1.3-password.pdf` is an encrypted copy of the same synthetic page. Its test password is `unit13-test`; the app deliberately does not request or use it.

The normal fixture embeds a subset of Noto Sans KR, distributed under the SIL Open Font License 1.1. PDF.js itself and its bundled rendering assets use the licenses included with `pdfjs-dist`.
