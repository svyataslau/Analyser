#!/usr/bin/env node
'use strict';

var fs   = require('fs');
var path = require('path');

var MUSIC_DIR   = path.join(__dirname, 'music');
var ASSETS_DIR  = path.join(__dirname, 'assets');
var ALBUMS_DIR  = path.join(ASSETS_DIR, 'albums');
var MUSIC_OUT   = path.join(MUSIC_DIR, 'manifest.json');

/** Same basename as mp3; try in order (first hit wins). */
var COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

function findAlbumCoverFile(baseName) {
  var i;
  for (i = 0; i < COVER_EXTENSIONS.length; i++) {
    var fileName = baseName + COVER_EXTENSIONS[i];
    if (fs.existsSync(path.join(ALBUMS_DIR, fileName))) {
      return fileName;
    }
  }
  return null;
}

// --- music manifest ---
var mp3Files = fs.readdirSync(MUSIC_DIR)
  .filter(function (f) { return path.extname(f).toLowerCase() === '.mp3'; });

var entries = mp3Files.map(function (file) {
  var name      = path.basename(file, '.mp3');
  var coverFile = findAlbumCoverFile(name);
  return {
    label:    name,
    file:     file,
    coverArt: coverFile ? 'albums/' + coverFile : null,
  };
});

var missingCovers = entries.filter(function (e) { return !e.coverArt; });
if (missingCovers.length) {
  console.error('Missing album art in assets/albums/ for:');
  missingCovers.forEach(function (e) {
    console.error('  ' + e.file + ' (expected same basename as mp3 + .jpg|.jpeg|.png)');
  });
  process.exit(1);
}

fs.writeFileSync(MUSIC_OUT, JSON.stringify(entries, null, 2), 'utf8');
console.log('Written ' + entries.length + ' track(s) to ' + MUSIC_OUT);
entries.forEach(function (e) {
  console.log('  ' + e.file + (e.coverArt ? ' (' + e.coverArt + ')' : ' (no cover)'));
});

// --- preset manifests ---
var PRESETS_ROOT = path.join(__dirname, 'assets', 'presets');
var PRESET_DIRS  = ['fun-preset', 'cat-preset', 'hot-preset', 'sad-preset'];

PRESET_DIRS.forEach(function (dirName) {
  var dirPath = path.join(PRESETS_ROOT, dirName);
  if (!fs.existsSync(dirPath)) return;

  var gifs = fs.readdirSync(dirPath)
    .filter(function (f) { return path.extname(f).toLowerCase() === '.gif'; })
    .map(function (f) { return 'assets/presets/' + dirName + '/' + f; });

  var outPath = path.join(dirPath, 'manifest.json');
  fs.writeFileSync(outPath, JSON.stringify(gifs, null, 2), 'utf8');
  console.log('\nWritten ' + gifs.length + ' gif(s) to ' + outPath);
  gifs.forEach(function (g) { console.log('  ' + g); });
});

// --- extra manifest ---
var EXTRA_DIR = path.join(__dirname, 'assets', 'extra');
if (fs.existsSync(EXTRA_DIR)) {
  var extraGifs = fs.readdirSync(EXTRA_DIR)
    .filter(function (f) { return path.extname(f).toLowerCase() === '.gif'; })
    .map(function (f) { return 'assets/extra/' + f; });

  var extraOut = path.join(EXTRA_DIR, 'manifest.json');
  fs.writeFileSync(extraOut, JSON.stringify(extraGifs, null, 2), 'utf8');
  console.log('\nWritten ' + extraGifs.length + ' extra gif(s) to ' + extraOut);
  extraGifs.forEach(function (g) { console.log('  ' + g); });
}
