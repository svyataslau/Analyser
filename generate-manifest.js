#!/usr/bin/env node
'use strict';

var fs   = require('fs');
var path = require('path');

var MUSIC_DIR     = path.join(__dirname, 'music');
var ASSETS_DIR    = path.join(__dirname, 'assets');
var DANCE_DIR     = path.join(__dirname, 'assets', 'dance-girl');
var MUSIC_OUT     = path.join(MUSIC_DIR, 'manifest.json');
var DANCE_OUT     = path.join(DANCE_DIR, 'manifest.json');

// --- music manifest ---
var mp3Files = fs.readdirSync(MUSIC_DIR)
  .filter(function (f) { return path.extname(f).toLowerCase() === '.mp3'; })
  .sort();

var entries = mp3Files.map(function (file) {
  var name     = path.basename(file, '.mp3');
  var coverArt = name + '.jpg';
  var hasCover = fs.existsSync(path.join(ASSETS_DIR, coverArt));
  return {
    label:    name,
    file:     file,
    coverArt: hasCover ? coverArt : null,
  };
});

fs.writeFileSync(MUSIC_OUT, JSON.stringify(entries, null, 2), 'utf8');
console.log('Written ' + entries.length + ' track(s) to ' + MUSIC_OUT);
entries.forEach(function (e) {
  console.log('  ' + e.file + (e.coverArt ? ' (' + e.coverArt + ')' : ' (no cover)'));
});

// --- dance-girl manifest ---
var danceGifs = fs.readdirSync(DANCE_DIR)
  .filter(function (f) {
    return path.extname(f).toLowerCase() === '.gif' && f !== 'twerk.gif' && f !== 'manifest.json';
  })
  .sort()
  .map(function (f) { return 'assets/dance-girl/' + f; });

fs.writeFileSync(DANCE_OUT, JSON.stringify(danceGifs, null, 2), 'utf8');
console.log('\nWritten ' + danceGifs.length + ' gif(s) to ' + DANCE_OUT);
danceGifs.forEach(function (g) { console.log('  ' + g); });
