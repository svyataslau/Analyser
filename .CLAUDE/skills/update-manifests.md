---
name: update-manifests
description: >-
  Analyser (CYBER PARTY): regenerate ALL JSON manifests (music + preset GIFs +
  extra GIFs) via generate-manifest.js, normalize GIF names under
  assets/presets and assets/extra, and enforce music/albums naming
  ("Artist - Track"). Use when adding/removing MP3s, cover art, or GIFs, or
  when the user says "update manifests".
---

# update-manifests

**Project-local skill** — lives in `.CLAUDE/skills/update-manifests.md`. **Repo root** = directory containing `generate-manifest.js`, `music/`, `assets/`, `js/analyser.js` (run commands from here).

## Single command (always updates everything)

```bash
node generate-manifest.js
```

This **one script** overwrites **all** of the following (do not hand-edit for routine updates):

| Output | Source |
|--------|--------|
| `music/manifest.json` | Every `*.mp3` in `music/` |
| `assets/presets/fun-preset/manifest.json` | GIFs in that folder |
| `assets/presets/cat-preset/manifest.json` | same |
| `assets/presets/hot-preset/manifest.json` | same |
| `assets/presets/sad-preset/manifest.json` | same |
| `assets/extra/manifest.json` | GIFs in `assets/extra/` |

After new **tracks** or **covers**: drop files on disk, then run the command. No separate "music-only" step.

### Music + album art naming (human convention)

- **Pattern:** `Some Artist - Some Track` — same **basename** (without extension) for the mp3 in `music/` and the cover in `assets/albums/`.
- **Avoid** in filenames: underscores used as word separators, downloader suffixes, site names (e.g. `(SkySound.cc)`), or other clutter. Use spaces, hyphen around ` - ` between artist and title, and parentheses only for mix details (e.g. `(Ultra Slowed)`, `(feat. …)`).
- **Covers:** `assets/albums/<same basename as mp3>.jpg` (preferred). The generator also accepts `.jpeg` and `.png` if present; manifest stores `albums/<file>` with the actual extension.
- **Exception:** `assets/albums/unknown_album.png` is the **placeholder only** (no matching mp3). The app uses it for the “Uploaded file” library option and other UI fallbacks. Library tracks from `manifest.json` should all list real `coverArt` paths so the generator’s pairing check passes.
- **Pairing rule:** Every `*.mp3` in `music/` **must** have a matching album file in `assets/albums/`. If any track is missing art, `node generate-manifest.js` **exits with code 1** and lists the offending files.

### Music manifest rules (`generate-manifest.js`)

- Scans `music/` for `.mp3` files (order = `readdirSync`, not sorted).
- For each `Some Artist - Some Track.mp3`, entry is `{ label, file, coverArt }`.
- `label` equals the basename without `.mp3`; `file` is the on-disk mp3 name.
- `coverArt` is `albums/<basename>.<ext>` where `<ext>` is the first found among `.jpg`, `.jpeg`, `.png`. If none exist, the script fails (see pairing rule above).

### GIF naming (before or after manifest run)

| Directory | Filename pattern |
|-----------|------------------|
| `assets/presets/fun-preset/` | `fun-1.gif`, `fun-2.gif`, … |
| `assets/presets/cat-preset/` | `cat-1.gif`, … |
| `assets/presets/hot-preset/` | `hot-1.gif`, … |
| `assets/presets/sad-preset/` | `sad-1.gif`, … |
| `assets/extra/` | `extra-1.gif`, … |

Prefix for a `*-preset` folder = the part before `-preset`. For `assets/extra/`, prefix is always `extra`.

### Rename strategies (GIFs)

**A — Messy folder (e.g. all of `assets/extra/`):** list `*.gif`, pick deterministic order (`Array.sort()` in Node), two-phase rename via `_ren_0.gif` … then `extra-1.gif`, …

**B — Strays in an otherwise good preset folder:** max `K` from `^prefix-(\d+)\.gif$`; rename non-matching files to `prefix-(K+1).gif`, incrementing.

**C — Full preset renumber:** same as A with prefix `fun`, `cat`, `hot`, or `sad`.

### Generator note

- GIF lists use `readdirSync` + filter; **no sort** in the script (order follows filesystem).

## Checklist

- [ ] New/changed MP3s in `music/` use `Artist - Track` naming; matching `assets/albums/<same basename>.jpg` (or `.jpeg` / `.png`).
- [ ] GIFs follow `prefix-N.gif` where needed.
- [ ] `node generate-manifest.js` exits 0; console shows track count and each manifest write.
- [ ] Spot-check `music/manifest.json` (entries + `coverArt`) and one GIF manifest path shape (`assets/...`).

## App code

- `js/analyser.js` fetches `music/manifest.json` and preset/extra manifests at runtime. Cover URLs use `assets/` + manifest `coverArt` (under `assets/albums/`). Placeholder art: `assets/albums/unknown_album.png`. Change code only if URLs or fallbacks change (search `music/` and `assets/extra/`).
