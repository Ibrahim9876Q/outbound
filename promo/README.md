# Outbound promo video

| File | What it is |
| --- | --- |
| `outbound-promo-v4.mp4` | Current cut: v3 with on-screen wording corrected by the source audit, 40.6 s, 1920×1080 |
| `outbound-promo-v3.mp4` | Black-and-white cut before the wording audit |
| `outbound-promo-v2.mp4` | Previous cut with colour and a dense logo field |
| `outbound-promo.mp4` | First cut |

## How it was made

Frames are drawn with Python (Pillow + NumPy) and piped to ffmpeg. Scene changes follow the beat and lyric timings measured from the reference clip (`tools/analyze.py`, faster-whisper word timestamps).

- `tools/render4.py` renders v4. `tools/patch4.py` builds it from `tools/render3.py` and lists every wording change.
- `tools/render3.py` renders v3. Run it from a folder that contains `assets/` content at the paths the script expects (`logos/`, `cap/`, `shots/`, `globe_dots.npz`) and the reference clip as `ref.mp4`.
- `tools/logos.mjs` renders white logos from [simple-icons](https://simpleicons.org) (CC0). Brand names and logos belong to their owners. They are used here only to identify the apps discussed.
- `tools/cap.mjs` captures the real Outbound views with headless Chrome. It injects a slim scrollbar style for the capture only.
- `tools/globe_pre.py` turns the app's `public/data/countries.geojson` into the globe's land dots.

The reference clip and its song are not in this repository. The music in the rendered videos is a commercial track, so platforms may mute or flag uploads.

Every fine, case, quote and collection category on screen comes from Outbound's research data or a primary source re-fetched on 2026-11-22: FTC, Irish DPC, CNIL, Meta, Google and TikTok newsrooms or policies, Discord's policy, and Apple App Store privacy labels. [research/PROMO-SOURCES.md](../research/PROMO-SOURCES.md) traces each claim. v4 applies its suggested edits: allegations are labelled as allegations, paraphrases and translations are not quoted, and the laptop scan numbers say what the scan measured. The globe arcs and the laptop links are illustrative animations, and each scene's footer says so.
