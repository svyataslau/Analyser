(function () {
  'use strict';

  var GRID_MIN = 10;
  var GRID_MAX = 100;
  var MUSIC_BASE = 'music/';
  var ASSETS_BASE = 'assets/';

  var MUSIC_LIBRARY = [];

  var CLUB_GIFS = [];
  var PRESET_ORDER = ['FUN', 'CAT', 'HOT', 'SAD'];
  var PRESETS = {
    FUN: { dir: 'assets/presets/fun-preset/', loadedGifs: [], gifs: [], enabled: true },
    CAT: { dir: 'assets/presets/cat-preset/', loadedGifs: [], gifs: [], enabled: true },
    HOT: { dir: 'assets/presets/hot-preset/', loadedGifs: [], gifs: [], enabled: true },
    SAD: { dir: 'assets/presets/sad-preset/', loadedGifs: [], gifs: [], enabled: false },
  };
  var CLUB_MAX_DANCERS        = 5;
  var CLUB_MIN_DANCERS        = 3;
  var CLUB_MIN_MS             = 3000;
  var CLUB_MAX_MS             = 5000;
  var CLUB_DANCER_SIZES       = ['33vh', '66vh', '100vh'];
  /** Portrait/narrow UI: dancer height follows viewport width (not vh). */
  var CLUB_DANCER_SIZES_MOBILE = ['33vw'];
  var CLUB_MOBILE_MAX_WIDTH   = 880;
  var CLUB_EXTRA_MIN_INTERVAL = 30000;
  var CLUB_EXTRA_MAX_INTERVAL = 50000;
  var CLUB_EXTRA_SHOW_MS      = 6000;
  var DEFAULT_EXTRA_GIFS = [];
  var EXTRA_GIFS         = [];
  var extraEnabled       = true;

  var onGradientUpdate = null;

  var audioEl = document.getElementById('spectrum-audio');
  var albumFigure = document.getElementById('track-album');
  var albumImg = document.getElementById('track-cover-art');
  var fileInput = document.getElementById('track-file-input');
  var uploadTrigger = document.getElementById('upload-trigger');
  var gridDensityRange = document.getElementById('grid-density-range');
  var trackSelect = document.getElementById('library-track-select');
  var startOverlay = document.getElementById('start-overlay');
  var startScreen = document.getElementById('experience-start');
  var startCursorImg = document.getElementById('start-cursor-img');
  var bgUploadTrigger = document.getElementById('bg-upload-trigger');
  var bgFileInput = document.getElementById('bg-file-input');
  var bgRemoveBtn = document.getElementById('bg-remove-btn');
  var queueNowInner = document.getElementById('queue-now-inner');
  var queueNextList = document.getElementById('queue-next-list');
  var queueFileInput = document.getElementById('queue-file-input');
  var queueLibraryWrap = document.getElementById('queue-library-wrap');
  var queueLibraryBtn = document.getElementById('queue-library-btn');
  var queueLibraryList = document.getElementById('queue-library-list');
  var queueRepeatBtn = document.getElementById('queue-repeat-btn');
  var uploadBusyOverlay = document.getElementById('upload-busy-overlay');

  if (albumImg) {
    albumImg.addEventListener('error', function () {
      if (albumFigure) albumFigure.classList.add('player__album--placeholder');
      albumImg.removeAttribute('src');
      albumImg.alt = '';
    });
  }

  if (audioEl) {
    audioEl.addEventListener('contextmenu', function (evt) { evt.preventDefault(); });
    audioEl.addEventListener('dragstart',   function (evt) { evt.preventDefault(); });
  }

  var audioPlayBtn    = document.getElementById('audio-play-btn');
  var audioCurrentTime = document.getElementById('audio-current-time');
  var audioTotalTime  = document.getElementById('audio-total-time');
  var audioSeek       = document.getElementById('audio-seek');
  var audioSeekFill   = document.getElementById('audio-seek-fill');
  var audioSeekThumb  = document.getElementById('audio-seek-thumb');
  var audioVolume     = document.getElementById('audio-volume');

  function fmtTime(sec) {
    sec = Math.floor(sec || 0);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function syncSeek() {
    if (!audioEl || !audioEl.duration) return;
    var pct = (audioEl.currentTime / audioEl.duration) * 100;
    if (audioSeekFill)  audioSeekFill.style.width = pct + '%';
    if (audioSeekThumb) audioSeekThumb.style.left  = pct + '%';
    if (audioCurrentTime) audioCurrentTime.textContent = fmtTime(audioEl.currentTime);
  }

  if (audioEl) {
    audioEl.addEventListener('timeupdate', syncSeek);
    audioEl.addEventListener('durationchange', function () {
      if (audioTotalTime) audioTotalTime.textContent = fmtTime(audioEl.duration);
      syncSeek();
    });
    audioEl.addEventListener('play', function () {
      if (audioPlayBtn) audioPlayBtn.textContent = 'PAUSE';
      syncFullscreenButtons();
    });
    audioEl.addEventListener('pause', function () {
      if (audioPlayBtn) audioPlayBtn.textContent = 'PLAY';
      syncFullscreenButtons();
    });
  }

  if (audioSeek && audioEl) {
    var isSeeking = false;

    function applySeek(clientX) {
      var rect = audioSeek.getBoundingClientRect();
      var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (audioEl.duration) {
        audioEl.currentTime = ratio * audioEl.duration;
        syncSeek();
      }
    }

    audioSeek.addEventListener('mousedown', function (evt) {
      isSeeking = true;
      applySeek(evt.clientX);
    });
    document.addEventListener('mousemove', function (evt) {
      if (isSeeking) applySeek(evt.clientX);
    });
    document.addEventListener('mouseup', function () { isSeeking = false; });

    audioSeek.addEventListener('touchstart', function (evt) {
      applySeek(evt.touches[0].clientX);
    }, { passive: true });
    audioSeek.addEventListener('touchmove', function (evt) {
      evt.preventDefault();
      applySeek(evt.touches[0].clientX);
    });
  }

  if (audioVolume && audioEl) {
    audioVolume.addEventListener('input', function () {
      audioEl.volume = parseFloat(audioVolume.value);
    });
  }

  var columnsN = 20;
  var rowsN = 10;

  var canvas;
  var ctx;
  var audioContext;
  var analyser;
  var sourceNode;
  var started = false;

  function clampGridValue(raw) {
    var n = parseInt(String(raw), 10);
    if (isNaN(n)) return GRID_MIN;
    return Math.min(GRID_MAX, Math.max(GRID_MIN, n));
  }

  function getCanvasLogicalSize() {
    var el = document.getElementById('spectrum-canvas');
    return { width: el.width, height: el.height };
  }

  function applyGridFromControl() {
    var size = getCanvasLogicalSize();
    var cols = clampGridValue(gridDensityRange.value);
    gridDensityRange.value = String(cols);
    var rows = Math.round((cols * size.height) / size.width);
    rows = Math.min(GRID_MAX, Math.max(GRID_MIN, rows));
    columnsN = cols;
    rowsN = rows;
  }

  if (gridDensityRange) {
    gridDensityRange.addEventListener('input', applyGridFromControl);
    gridDensityRange.addEventListener('change', applyGridFromControl);
  }

  var CUSTOM_VALUE = '__custom_upload__';
  var UNKNOWN_ALBUM_ART = 'albums/unknown_album.png';
  var UPLOAD_DEFAULT_BG = 'albums/Gorillaz - New Gold (feat. Tame Impala and Bootie Brown).jpg';
  var DEFAULT_LIBRARY_TRACK_FILE = 'Gorillaz - New Gold (feat. Tame Impala and Bootie Brown).mp3';

  var playbackQueue = [];
  var queueIdSeq = 0;
  var queueAdvanceTimer = null;
  var queueDragFrom = null;
  /** 0 = off (consume queue), 1 = repeat one, 2 = repeat all (rotate to end) */
  var queueRepeatMode = 0;

  function clearQueueAdvanceTimer() {
    if (queueAdvanceTimer) {
      clearTimeout(queueAdvanceTimer);
      queueAdvanceTimer = null;
    }
  }

  function updateQueueRepeatButtonLabel() {
    if (!queueRepeatBtn) return;
    var labels = ['Repeat \u00b7 Off', 'Repeat \u00b7 One', 'Repeat \u00b7 All'];
    queueRepeatBtn.textContent = labels[queueRepeatMode];
    queueRepeatBtn.classList.toggle('player-queue__repeat-btn--active', queueRepeatMode !== 0);
  }

  function nextQueueId() {
    queueIdSeq += 1;
    return 'q' + queueIdSeq;
  }

  function getLibraryEntryByFile(file) {
    var k;
    for (k = 0; k < MUSIC_LIBRARY.length; k++) {
      if (MUSIC_LIBRARY[k].file === file) return MUSIC_LIBRARY[k];
    }
    return null;
  }

  function splitArtistTitle(label) {
    var dash = label.indexOf(' - ');
    if (dash === -1) return { artist: '\u2014', title: label };
    return { artist: label.slice(0, dash).trim(), title: label.slice(dash + 3).trim() };
  }

  function makeLibraryQueueItem(file) {
    var ent = getLibraryEntryByFile(file);
    return {
      id: nextQueueId(),
      kind: 'library',
      file: file,
      label: ent ? ent.label : file,
    };
  }

  function makeUploadQueueItem(url, displayName) {
    return { id: nextQueueId(), kind: 'upload', url: url, label: displayName };
  }

  function buildDefaultPlaybackQueue() {
    var files = MUSIC_LIBRARY.map(function (e) { return e.file; });
    var di = files.indexOf(DEFAULT_LIBRARY_TRACK_FILE);
    if (di > 0) {
      files.splice(di, 1);
      files.unshift(DEFAULT_LIBRARY_TRACK_FILE);
    }
    return files.map(function (f) { return makeLibraryQueueItem(f); });
  }

  function revokeUploadUrlIfOrphaned(url) {
    var c = 0;
    var i;
    for (i = 0; i < playbackQueue.length; i++) {
      if (playbackQueue[i].kind === 'upload' && playbackQueue[i].url === url) c += 1;
    }
    if (c === 0) URL.revokeObjectURL(url);
  }

  function syncTrackSelectToQueueHead() {
    if (!trackSelect || !playbackQueue.length) return;
    var h = playbackQueue[0];
    if (h.kind === 'library') {
      var customOpt = trackSelect.querySelector('option[value="' + CUSTOM_VALUE + '"]');
      if (customOpt) customOpt.remove();
      if (fileInput) fileInput.value = '';
      trackSelect.value = h.file;
    } else {
      var opt = ensureCustomUploadOption();
      opt.textContent = h.label;
      opt.title = h.label;
      trackSelect.value = CUSTOM_VALUE;
    }
  }

  function loadAudioFromQueueHead(autoplay) {
    if (!audioEl || !playbackQueue.length) return;
    var h = playbackQueue[0];
    if (h.kind === 'library') {
      audioEl.src = MUSIC_BASE + encodeURIComponent(h.file);
    } else {
      audioEl.src = h.url;
    }
    syncTrackSelectToQueueHead();
    if (autoplay) audioEl.play().catch(function () {});
  }

  function moveLibraryFileToQueueFront(fileName) {
    var idx = -1;
    var i;
    for (i = 0; i < playbackQueue.length; i++) {
      if (playbackQueue[i].kind === 'library' && playbackQueue[i].file === fileName) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      playbackQueue.unshift(makeLibraryQueueItem(fileName));
    } else if (idx > 0) {
      var it = playbackQueue.splice(idx, 1)[0];
      playbackQueue.unshift(it);
    }
  }

  function rotateQueueHeadToEndAndContinue() {
    if (!playbackQueue.length || !audioEl) return;
    var first = playbackQueue.shift();
    playbackQueue.push(first);
    syncTrackSelectToQueueHead();
    loadAudioFromQueueHead(false);
    audioEl.play().catch(function () {});
    updateAlbumArt();
    applyDefaultBackground();
    renderPlaybackQueueUI();
  }

  function onQueueAudioEnded() {
    if (queueRepeatMode === 1) {
      clearQueueAdvanceTimer();
      if (audioEl && playbackQueue.length) {
        audioEl.currentTime = 0;
        audioEl.play().catch(function () {});
      }
      return;
    }
    if (queueRepeatMode === 2) {
      clearQueueAdvanceTimer();
      rotateQueueHeadToEndAndContinue();
      return;
    }
    scheduleQueueEndAnimation();
  }

  function advancePlaybackQueueAfterTrackEnd() {
    clearQueueAdvanceTimer();
    var done = playbackQueue[0];
    if (done && done.kind === 'upload') {
      var still = false;
      var j;
      for (j = 1; j < playbackQueue.length; j++) {
        if (playbackQueue[j].kind === 'upload' && playbackQueue[j].url === done.url) {
          still = true;
          break;
        }
      }
      if (!still) URL.revokeObjectURL(done.url);
    }
    playbackQueue.shift();
    syncTrackSelectToQueueHead();
    if (playbackQueue.length) {
      loadAudioFromQueueHead(false);
      audioEl.play().catch(function () {});
    } else {
      audioEl.pause();
      audioEl.removeAttribute('src');
      audioEl.load();
      if (audioPlayBtn) audioPlayBtn.textContent = 'PLAY';
      var co = trackSelect && trackSelect.querySelector('option[value="' + CUSTOM_VALUE + '"]');
      if (co) co.remove();
      if (fileInput) fileInput.value = '';
      if (MUSIC_LIBRARY.length) {
        playbackQueue = buildDefaultPlaybackQueue();
        syncTrackSelectToQueueHead();
        loadAudioFromQueueHead(false);
      } else if (trackSelect) trackSelect.value = '';
    }
    updateAlbumArt();
    applyDefaultBackground();
    renderPlaybackQueueUI();
  }

  function scheduleQueueEndAnimation() {
    if (queueAdvanceTimer) return;
    if (queueRepeatMode !== 0) return;
    var inner = queueNowInner && queueNowInner.querySelector('.player-queue__now-track-inner');
    if (inner) {
      inner.classList.add('player-queue__now-track-inner--exit');
      queueAdvanceTimer = setTimeout(function () {
        queueAdvanceTimer = null;
        advancePlaybackQueueAfterTrackEnd();
      }, 380);
    } else {
      advancePlaybackQueueAfterTrackEnd();
    }
  }

  function reorderQueueIndices(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 1 || fromIndex >= playbackQueue.length) return;
    if (toIndex < 1 || toIndex >= playbackQueue.length) return;
    var moved = playbackQueue.splice(fromIndex, 1)[0];
    playbackQueue.splice(toIndex, 0, moved);
    renderPlaybackQueueUI();
  }

  function removeQueueAtIndex(idx) {
    if (idx < 0 || idx >= playbackQueue.length) return;
    clearQueueAdvanceTimer();
    var item = playbackQueue[idx];
    var wasPlaying = audioEl && !audioEl.paused;
    playbackQueue.splice(idx, 1);
    if (item.kind === 'upload') revokeUploadUrlIfOrphaned(item.url);
    if (idx === 0) {
      if (playbackQueue.length) {
        syncTrackSelectToQueueHead();
        loadAudioFromQueueHead(wasPlaying);
      } else {
        if (audioEl) {
          audioEl.pause();
          audioEl.removeAttribute('src');
          audioEl.load();
        }
        if (audioPlayBtn) audioPlayBtn.textContent = 'PLAY';
        var cx = trackSelect && trackSelect.querySelector('option[value="' + CUSTOM_VALUE + '"]');
        if (cx) cx.remove();
        if (fileInput) fileInput.value = '';
        if (MUSIC_LIBRARY.length) {
          playbackQueue = buildDefaultPlaybackQueue();
          syncTrackSelectToQueueHead();
          loadAudioFromQueueHead(wasPlaying);
        } else if (trackSelect) trackSelect.value = '';
      }
    }
    updateAlbumArt();
    applyDefaultBackground();
    renderPlaybackQueueUI();
  }

  function renderPlaybackQueueUI() {
    if (!queueNowInner || !queueNextList) return;
    queueNextList.innerHTML = '';
    if (!playbackQueue.length) {
      queueNowInner.innerHTML = '<div class="player-queue__empty">\u2014</div>';
      return;
    }
    var head = playbackQueue[0];
    queueNowInner.innerHTML = '';
    var nowWrap = document.createElement('div');
    nowWrap.className = 'player-queue__now-track-inner';
    var titleEl = document.createElement('div');
    titleEl.className = 'player-queue__track-title';
    var albumEl = document.createElement('div');
    albumEl.className = 'player-queue__track-album';
    if (head.kind === 'library') {
      var parts = splitArtistTitle(head.label);
      titleEl.textContent = parts.title;
      albumEl.textContent = parts.artist;
    } else {
      titleEl.textContent = head.label.replace(/\.mp3$/i, '');
      albumEl.textContent = 'Upload';
    }
    var rmNow = document.createElement('button');
    rmNow.type = 'button';
    rmNow.className = 'player-queue__remove';
    rmNow.setAttribute('aria-label', 'Skip track');
    rmNow.textContent = '\u00d7';
    rmNow.addEventListener('click', function () { removeQueueAtIndex(0); });
    nowWrap.appendChild(titleEl);
    nowWrap.appendChild(albumEl);
    nowWrap.appendChild(rmNow);
    queueNowInner.appendChild(nowWrap);

    var n;
    for (n = 1; n < playbackQueue.length; n++) {
      (function (qi) {
        var item = playbackQueue[qi];
        var li = document.createElement('li');
        li.className = 'player-queue__next-item';
        li.draggable = true;
        li.dataset.queueIndex = String(qi);
        var t = document.createElement('div');
        t.className = 'player-queue__track-title';
        var a = document.createElement('div');
        a.className = 'player-queue__track-album';
        if (item.kind === 'library') {
          var p2 = splitArtistTitle(item.label);
          t.textContent = p2.title;
          a.textContent = p2.artist;
        } else {
          t.textContent = item.label.replace(/\.mp3$/i, '');
          a.textContent = 'Upload';
        }
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'player-queue__remove';
        rm.setAttribute('aria-label', 'Remove from queue');
        rm.textContent = '\u00d7';
        rm.addEventListener('click', function (e) {
          e.stopPropagation();
          removeQueueAtIndex(qi);
        });
        li.appendChild(t);
        li.appendChild(a);
        li.appendChild(rm);
        li.addEventListener('dragstart', function (e) {
          queueDragFrom = qi;
          li.classList.add('player-queue__next-item--drag');
          e.dataTransfer.effectAllowed = 'move';
          try {
            e.dataTransfer.setData('text/plain', String(qi));
          } catch (err) {}
        });
        li.addEventListener('dragend', function () {
          li.classList.remove('player-queue__next-item--drag');
          var els = queueNextList.querySelectorAll('.player-queue__next-item--over');
          for (var ei = 0; ei < els.length; ei++) els[ei].classList.remove('player-queue__next-item--over');
          queueDragFrom = null;
        });
        li.addEventListener('dragover', function (e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          li.classList.add('player-queue__next-item--over');
        });
        li.addEventListener('dragleave', function () {
          li.classList.remove('player-queue__next-item--over');
        });
        li.addEventListener('drop', function (e) {
          e.preventDefault();
          li.classList.remove('player-queue__next-item--over');
          var from = queueDragFrom;
          if (from == null) return;
          var to = parseInt(li.dataset.queueIndex, 10);
          if (isNaN(to)) return;
          reorderQueueIndices(from, to);
        });
        queueNextList.appendChild(li);
      })(n);
    }
  }

  var queueLibraryMenuOpen = false;

  function setQueueLibraryMenuOpen(open) {
    queueLibraryMenuOpen = !!open;
    if (queueLibraryList) queueLibraryList.hidden = !queueLibraryMenuOpen;
    if (queueLibraryBtn) {
      queueLibraryBtn.setAttribute('aria-expanded', queueLibraryMenuOpen ? 'true' : 'false');
      queueLibraryBtn.classList.toggle('player-queue__library-btn--open', queueLibraryMenuOpen);
    }
  }

  function populateQueueLibraryList() {
    if (!queueLibraryList) return;
    queueLibraryList.innerHTML = '';
    MUSIC_LIBRARY.forEach(function (e) {
      var li = document.createElement('li');
      li.className = 'player-queue__library-item';
      li.setAttribute('role', 'option');
      li.dataset.file = e.file;
      li.textContent = e.label;
      li.addEventListener('click', function (evt) {
        evt.stopPropagation();
        playbackQueue.push(makeLibraryQueueItem(e.file));
        renderPlaybackQueueUI();
        setQueueLibraryMenuOpen(false);
      });
      queueLibraryList.appendChild(li);
    });
  }

  function setAudioFromLibrary(fileName) {
    moveLibraryFileToQueueFront(fileName);
    var wasPlaying = !audioEl.paused;
    loadAudioFromQueueHead(wasPlaying);
    renderPlaybackQueueUI();
  }

  function updateAlbumArt() {
    if (!albumFigure || !albumImg) return;
    if (!playbackQueue.length) {
      albumFigure.classList.add('player__album--placeholder');
      albumImg.removeAttribute('src');
      albumImg.alt = '';
      applyDefaultBackground();
      return;
    }
    var h = playbackQueue[0];
    if (h.kind === 'upload') {
      albumFigure.classList.remove('player__album--placeholder');
      albumImg.alt = 'Unknown album';
      albumImg.src = ASSETS_BASE + UNKNOWN_ALBUM_ART;
      applyDefaultBackground();
      return;
    }
    var entry = getLibraryEntryByFile(h.file);
    if (!entry) {
      albumFigure.classList.add('player__album--placeholder');
      albumImg.removeAttribute('src');
      albumImg.alt = '';
      applyDefaultBackground();
      return;
    }
    if (!entry.coverArt) {
      albumFigure.classList.remove('player__album--placeholder');
      albumImg.alt = entry.label;
      albumImg.src = ASSETS_BASE + UNKNOWN_ALBUM_ART;
      applyDefaultBackground();
      return;
    }
    albumFigure.classList.remove('player__album--placeholder');
    albumImg.alt = entry.label + ' album art';
    albumImg.src = ASSETS_BASE + entry.coverArt;
    applyDefaultBackground();
  }

  function ensureCustomUploadOption() {
    var existing = trackSelect.querySelector('option[value="' + CUSTOM_VALUE + '"]');
    if (existing) return existing;
    var opt = document.createElement('option');
    opt.value = CUSTOM_VALUE;
    opt.textContent = 'Uploaded file';
    trackSelect.insertBefore(opt, trackSelect.firstChild);
    return opt;
  }

  function populateTrackSelect() {
    trackSelect.innerHTML = '';
    MUSIC_LIBRARY.forEach(function (entry) {
      var opt = document.createElement('option');
      opt.value = entry.file;
      opt.textContent = entry.label;
      trackSelect.appendChild(opt);
    });
    populateQueueLibraryList();
    if (MUSIC_LIBRARY.length) {
      playbackQueue = buildDefaultPlaybackQueue();
      syncTrackSelectToQueueHead();
      loadAudioFromQueueHead(false);
    } else {
      playbackQueue = [];
    }
    renderPlaybackQueueUI();
    updateAlbumArt();
  }

  function setUploadBusyVisible(visible) {
    if (!uploadBusyOverlay) return;
    if (visible) {
      uploadBusyOverlay.removeAttribute('hidden');
    } else {
      uploadBusyOverlay.setAttribute('hidden', '');
    }
  }

  function filterMp3FileList(fileList) {
    var out = [];
    var i;
    if (!fileList || !fileList.length) return out;
    for (i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      var nameLower = (f.name || '').toLowerCase();
      if (f.type === 'audio/mpeg' || nameLower.endsWith('.mp3')) out.push(f);
    }
    return out;
  }

  /**
   * @param {File[]} files - .mp3 / audio/mpeg only
   * @param {{ preservePlaying?: boolean, autoplay?: boolean }} opts
   */
  function addMp3UploadsToQueueFront(files, opts) {
    if (!files.length) return;
    opts = opts || {};
    var preservePlaying = !!opts.preservePlaying;
    var autoplay = !!opts.autoplay;
    var wasPlaying = audioEl && !audioEl.paused;
    setUploadBusyVisible(true);
    window.setTimeout(function () {
      try {
        var i;
        for (i = files.length - 1; i >= 0; i--) {
          var file = files[i];
          var url = URL.createObjectURL(file);
          playbackQueue.unshift(makeUploadQueueItem(url, file.name));
        }
        syncTrackSelectToQueueHead();
        if (preservePlaying) {
          loadAudioFromQueueHead(wasPlaying);
          if (wasPlaying && audioEl) audioEl.play().catch(function () {});
        } else if (autoplay) {
          loadAudioFromQueueHead(true);
          if (audioEl) audioEl.play().catch(function () {});
        } else {
          loadAudioFromQueueHead(false);
        }
        renderPlaybackQueueUI();
        updateAlbumArt();
      } finally {
        setUploadBusyVisible(false);
      }
    }, 0);
  }

  uploadTrigger.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    var files = filterMp3FileList(fileInput.files);
    fileInput.value = '';
    if (!files.length) return;
    addMp3UploadsToQueueFront(files, { preservePlaying: true });
  });

  trackSelect.addEventListener('change', function () {
    var v = trackSelect.value;
    if (!v || v === CUSTOM_VALUE) {
      updateAlbumArt();
      return;
    }
    fileInput.value = '';
    var customOpt = trackSelect.querySelector('option[value="' + CUSTOM_VALUE + '"]');
    if (customOpt) customOpt.remove();
    var ap = !audioEl.paused;
    moveLibraryFileToQueueFront(v);
    loadAudioFromQueueHead(ap);
    renderPlaybackQueueUI();
    updateAlbumArt();
  });

  if (queueFileInput) {
    queueFileInput.addEventListener('change', function () {
      var qFiles = filterMp3FileList(queueFileInput.files);
      queueFileInput.value = '';
      if (!qFiles.length) return;
      addMp3UploadsToQueueFront(qFiles, { autoplay: true });
    });
  }

  if (queueLibraryBtn) {
    queueLibraryBtn.addEventListener('click', function (evt) {
      evt.stopPropagation();
      setQueueLibraryMenuOpen(!queueLibraryMenuOpen);
    });
  }

  document.addEventListener('mousedown', function (evt) {
    if (!queueLibraryMenuOpen || !queueLibraryWrap) return;
    if (!queueLibraryWrap.contains(evt.target)) setQueueLibraryMenuOpen(false);
  });

  document.addEventListener('keydown', function (evt) {
    if (evt.key === 'Escape' && queueLibraryMenuOpen) setQueueLibraryMenuOpen(false);
  });

  var queueUploadLabel = document.querySelector('.player-queue__upload');
  if (queueUploadLabel && queueFileInput) {
    queueUploadLabel.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        queueFileInput.click();
      }
    });
  }

  if (audioEl) {
    audioEl.addEventListener('ended', function () {
      onQueueAudioEnded();
    });
  }

  if (queueRepeatBtn) {
    queueRepeatBtn.addEventListener('click', function () {
      queueRepeatMode = (queueRepeatMode + 1) % 3;
      updateQueueRepeatButtonLabel();
    });
    updateQueueRepeatButtonLabel();
  }

  var userBgActive = false;
  var currentBgObjectUrl = null;

  function setCssBg(url) {
    document.body.style.backgroundImage = 'url("' + url + '")';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.classList.add('body--custom-bg');
    document.documentElement.style.setProperty('--bg-image', 'url("' + url + '")');
  }

  function clearCssBg() {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.classList.remove('body--custom-bg');
    document.documentElement.style.removeProperty('--bg-image');
  }

  function getAutoBgUrl() {
    if (!playbackQueue.length) return null;
    var h = playbackQueue[0];
    if (h.kind === 'upload') {
      return new URL(ASSETS_BASE + UPLOAD_DEFAULT_BG, document.baseURI).href;
    }
    var ent = getLibraryEntryByFile(h.file);
    if (ent && ent.coverArt) {
      return new URL(ASSETS_BASE + ent.coverArt, document.baseURI).href;
    }
    return null;
  }

  function applyDefaultBackground() {
    if (userBgActive) return;
    var url = getAutoBgUrl();
    if (url) {
      setCssBg(url);
    } else {
      clearCssBg();
    }
  }

  function applyBackground(url) {
    if (currentBgObjectUrl) URL.revokeObjectURL(currentBgObjectUrl);
    currentBgObjectUrl = url;
    userBgActive = true;
    setCssBg(url);
    if (bgRemoveBtn) bgRemoveBtn.hidden = false;
  }

  function clearBackground() {
    if (currentBgObjectUrl) {
      URL.revokeObjectURL(currentBgObjectUrl);
      currentBgObjectUrl = null;
    }
    userBgActive = false;
    if (bgRemoveBtn) bgRemoveBtn.hidden = true;
    if (bgFileInput) bgFileInput.value = '';
    applyDefaultBackground();
  }

  if (bgUploadTrigger) {
    bgUploadTrigger.addEventListener('click', function () {
      bgFileInput.click();
    });
    bgUploadTrigger.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        bgFileInput.click();
      }
    });
  }

  if (bgFileInput) {
    bgFileInput.addEventListener('change', function () {
      if (bgFileInput.files && bgFileInput.files[0]) {
        applyBackground(URL.createObjectURL(bgFileInput.files[0]));
      }
    });
  }

  if (bgRemoveBtn) {
    bgRemoveBtn.addEventListener('click', function () {
      clearBackground();
    });
  }

  var DEFAULT_GRADIENT_COLORS = ['#ff00aa', '#00eeff', '#aaff00'];
  var gradientColors = DEFAULT_GRADIENT_COLORS.slice();

  var colorRow = document.getElementById('gradient-color-row');
  var addColorBtn = document.getElementById('gradient-add-color');

  function renderColorSwatches() {
    var existingWraps = colorRow.querySelectorAll('.player__color-swatch-wrap');
    var w;
    for (w = 0; w < existingWraps.length; w++) {
      colorRow.removeChild(existingWraps[w]);
    }
    gradientColors.forEach(function (color, idx) {
      var wrap = document.createElement('div');
      wrap.className = 'player__color-swatch-wrap';

      var label = document.createElement('label');
      label.className = 'player__color-swatch';
      label.style.background = color;
      label.title = color;

      var inp = document.createElement('input');
      inp.type = 'color';
      inp.className = 'player__color-input';
      inp.value = color;

      (function (index, labelEl, inputEl) {
        inputEl.addEventListener('input', function () {
          gradientColors[index] = inputEl.value;
          labelEl.style.background = inputEl.value;
          labelEl.title = inputEl.value;
          if (onGradientUpdate) onGradientUpdate();
        });
      }(idx, label, inp));

      label.appendChild(inp);
      wrap.appendChild(label);

      if (gradientColors.length > 2) {
        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'player__color-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove color';
        (function (index) {
          removeBtn.addEventListener('click', function () {
            gradientColors.splice(index, 1);
            renderColorSwatches();
          });
        }(idx));
        wrap.appendChild(removeBtn);
      }

      colorRow.insertBefore(wrap, addColorBtn);
    });
    addColorBtn.hidden = gradientColors.length >= 8;
    if (onGradientUpdate) onGradientUpdate();
  }

  if (addColorBtn) {
    addColorBtn.addEventListener('click', function () {
      if (gradientColors.length < 8) {
        gradientColors.push('#ffffff');
        renderColorSwatches();
        var wraps = colorRow.querySelectorAll('.player__color-swatch-wrap');
        var lastWrap = wraps[wraps.length - 1];
        if (lastWrap) {
          var lbl = lastWrap.querySelector('.player__color-swatch');
          if (lbl) lbl.click();
        }
      }
    });
  }

  renderColorSwatches();

  function buildAnimatedGradient() {
    var speed = 80;
    var scroll = ((Date.now() / 1000) * speed) % canvas.height;
    var n = gradientColors.length;
    var y0 = -scroll;
    var y1 = y0 + canvas.height * 2;
    var grad = ctx.createLinearGradient(0, y0, 0, y1);
    var cycle, i, stop;
    for (cycle = 0; cycle < 2; cycle++) {
      for (i = 0; i < n; i++) {
        stop = (cycle * n + i) / (n * 2);
        grad.addColorStop(stop, gradientColors[i]);
      }
    }
    grad.addColorStop(1.0, gradientColors[0]);
    return grad;
  }

  function drawGrid(cellW, cellH) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    var c;
    for (c = 0; c <= columnsN; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, canvas.height);
      ctx.stroke();
    }
    var r;
    for (r = 0; r <= rowsN; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(canvas.width, r * cellH);
      ctx.stroke();
    }
  }

  function frameLooper() {
    if (!started || !analyser) return;
    window.requestAnimationFrame(frameLooper);

    var binCount = analyser.frequencyBinCount;
    var data = new Uint8Array(binCount);
    analyser.getByteFrequencyData(data);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var cellW = canvas.width / columnsN;
    var cellH = canvas.height / rowsN;
    ctx.fillStyle = buildAnimatedGradient();

    var nyquist  = audioContext.sampleRate / 2;
    var minFreq  = 60;
    var maxFreq  = Math.min(16000, nyquist);
    var freqStep = nyquist / binCount;

    var i;
    for (i = 0; i < columnsN; i++) {
      var t        = columnsN > 1 ? i / (columnsN - 1) : 0;
      var freq     = minFreq * Math.pow(maxFreq / minFreq, t);
      var binIndex = Math.min(binCount - 1, Math.max(0, Math.round(freq / freqStep)));
      var gain  = 0.45 + 0.55 * t;
      var level = (data[binIndex] / 255) * gain;
      var litRows = Math.max(0, Math.ceil(level * rowsN));
      var j;
      for (j = 0; j < litRows; j++) {
        var y = canvas.height - (j + 1) * cellH;
        ctx.fillRect(i * cellW, y, cellW, cellH);
      }
    }

    var baselinePx = 5;
    for (i = 0; i < columnsN; i++) {
      ctx.fillRect(i * cellW, canvas.height - baselinePx, cellW, baselinePx);
    }

    drawGrid(cellW, cellH);
  }

  function wireAnalyser() {
    canvas = document.getElementById('spectrum-canvas');
    ctx = canvas.getContext('2d');

    var AC = window.AudioContext || window.webkitAudioContext;
    audioContext = new AC();
    analyser = audioContext.createAnalyser();
    sourceNode = audioContext.createMediaElementSource(audioEl);
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);

    started = true;
    applyGridFromControl();
    audioContext.resume().then(function () {
      frameLooper();
    });
  }

  if (startCursorImg) {
    if (window.innerWidth > 480) {
      document.addEventListener('mousemove', function (evt) {
        if (startOverlay && startOverlay.classList.contains('start-overlay--hidden')) return;
        startCursorImg.style.transform =
          'translate(calc(' + evt.clientX + 'px - 50%), calc(' + evt.clientY + 'px - 50%))';
      });
    } else {
      var vw0 = window.innerWidth, vh0 = window.innerHeight;
      // Initial position — random edge zone, outside START boundaries
      var dir0 = Math.floor(Math.random() * 4);
      var ix, iy;
      switch (dir0) {
        case 0: ix = vw0 * (0.04 + Math.random() * 0.12); iy = vh0 * (0.1 + Math.random() * 0.8); break;
        case 1: ix = vw0 * (0.84 + Math.random() * 0.12); iy = vh0 * (0.1 + Math.random() * 0.8); break;
        case 2: ix = vw0 * (0.1 + Math.random() * 0.8); iy = vh0 * (0.04 + Math.random() * 0.12); break;
        default: ix = vw0 * (0.1 + Math.random() * 0.8); iy = vh0 * (0.84 + Math.random() * 0.12); break;
      }
      startCursorImg.style.transition = 'none';
      startCursorImg.style.opacity = '1';
      startCursorImg.style.transform =
        'translate(calc(' + ix + 'px - 50%), calc(' + iy + 'px - 50%))';

      var mobilePhase = 1; // start by moving to center first
      (function mobileCursorCycle() {
        if (!startOverlay || startOverlay.classList.contains('start-overlay--hidden')) return;
        var vw = window.innerWidth, vh = window.innerHeight;
        var x, y, dur;

        if (mobilePhase === 0) {
          // Move to a random edge zone (on-screen but far from center)
          var dir = Math.floor(Math.random() * 4);
          switch (dir) {
            case 0: x = vw * (0.04 + Math.random() * 0.12); y = vh * (0.1  + Math.random() * 0.8); break; // left
            case 1: x = vw * (0.84 + Math.random() * 0.12); y = vh * (0.1  + Math.random() * 0.8); break; // right
            case 2: x = vw * (0.1  + Math.random() * 0.8);  y = vh * (0.04 + Math.random() * 0.12); break; // top
            default: x = vw * (0.1 + Math.random() * 0.8);  y = vh * (0.84 + Math.random() * 0.12); break; // bottom
          }
          dur = 2200 + Math.random() * 1600;
        } else {
          // Return to center zone (START area)
          x = vw * (0.35 + Math.random() * 0.30);
          y = vh * (0.35 + Math.random() * 0.30);
          dur = 2000 + Math.random() * 1400;
        }

        mobilePhase = 1 - mobilePhase;
        startCursorImg.style.transition = 'transform ' + dur + 'ms ease-in-out';
        startCursorImg.style.transform =
          'translate(calc(' + x + 'px - 50%), calc(' + y + 'px - 50%))';

        setTimeout(mobileCursorCycle, dur + 150 + Math.random() * 400);
      })();
    }
  }

  startScreen.addEventListener('click', function () {
    if (!started) {
      applyDefaultBackground();
      wireAnalyser();
      if (startOverlay) {
        startOverlay.classList.add('start-overlay--zooming');
        startOverlay.addEventListener('animationend', function () {
          startOverlay.classList.add('start-overlay--hidden');
        }, { once: true });
      } else {
        startScreen.classList.add('start-screen--hidden');
      }
    } else if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  });

  fetch(MUSIC_BASE + 'manifest.json')
    .then(function (res) {
      if (!res.ok) throw new Error('manifest fetch failed: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      MUSIC_LIBRARY = data;
      populateTrackSelect();
    })
    .catch(function () {
      populateTrackSelect();
    });

  function rebuildClubGifs() {
    CLUB_GIFS.length = 0;
    PRESET_ORDER.forEach(function (name) {
      var p = PRESETS[name];
      if (p.enabled) p.gifs.forEach(function (url) { CLUB_GIFS.push(url); });
    });
    uploadedDancerUrls.forEach(function (url) {
      if (CLUB_GIFS.indexOf(url) === -1) CLUB_GIFS.push(url);
    });
  }

  PRESET_ORDER.forEach(function (name) {
    var p = PRESETS[name];
    fetch(p.dir + 'manifest.json')
      .then(function (res) { return res.json(); })
      .then(function (files) {
        p.loadedGifs = files.slice();
        p.gifs = files.slice();
        if (p.enabled) {
          files.forEach(function (url) {
            if (CLUB_GIFS.indexOf(url) === -1) CLUB_GIFS.push(url);
          });
        }
      })
      .catch(function () {});
  });

  fetch('assets/extra/manifest.json')
    .then(function (res) { return res.json(); })
    .then(function (files) {
      DEFAULT_EXTRA_GIFS = files.slice();
      EXTRA_GIFS         = files.slice();
    })
    .catch(function () {
      DEFAULT_EXTRA_GIFS = ['assets/extra/extra-1.gif'];
      EXTRA_GIFS         = DEFAULT_EXTRA_GIFS.slice();
    });

  applyGridFromControl();

  var spectrumShell = document.getElementById('spectrum-fullscreen-root');
  var fullscreenEnter = document.getElementById('fullscreen-enter');
  var fullscreenExit = document.getElementById('fullscreen-exit');
  var customizeDancersFsBtn = document.getElementById('customize-dancers-fs-btn');
  var fsPlayBtn = document.getElementById('fs-play-btn');
  var fsControls = document.getElementById('fs-controls');
  var normalClubBtn = document.getElementById('normal-club-btn');
  var PSEUDO_FS = 'player__spectrum-shell--pseudo-fs';

  function inExpandedView() {
    if (!spectrumShell) return false;
    if (spectrumShell.classList.contains(PSEUDO_FS)) return true;
    return (
      document.fullscreenElement === spectrumShell ||
      document.webkitFullscreenElement === spectrumShell
    );
  }

  function syncFullscreenButtons() {
    var on = inExpandedView();
    var playing = audioEl && !audioEl.paused;
    if (fullscreenEnter)       fullscreenEnter.hidden       = on;
    if (fullscreenExit)        fullscreenExit.hidden        = !on;
    if (customizeDancersFsBtn) customizeDancersFsBtn.hidden = !on;
    if (fsControls)            fsControls.classList.toggle('fs-controls--visible', on && !playing);
  }

  function usePseudoFullscreen() {
    spectrumShell.classList.add(PSEUDO_FS);
    document.body.classList.add('body--spectrum-expanded');
    syncFullscreenButtons();
  }

  var clubWasActive = false;

  function enterExpandedView() {
    if (!spectrumShell) return;
    var req = spectrumShell.requestFullscreen || spectrumShell.webkitRequestFullscreen;
    if (req) {
      try {
        var result = req.call(spectrumShell);
        if (result && typeof result.then === 'function') {
          result
            .then(function () {
              spectrumShell.classList.remove(PSEUDO_FS);
              document.body.classList.remove('body--spectrum-expanded');
              syncFullscreenButtons();
              if (clubWasActive) {
                toggleClub();
                if (audioEl) audioEl.play().catch(function () {});
              }
            })
            .catch(function () {
              usePseudoFullscreen();
              if (clubWasActive) {
                toggleClub();
                if (audioEl) audioEl.play().catch(function () {});
              }
            });
          return;
        }
      } catch (e) {
        usePseudoFullscreen();
        if (clubWasActive) {
          toggleClub();
          if (audioEl) audioEl.play().catch(function () {});
        }
        return;
      }
    }
    usePseudoFullscreen();
    if (clubWasActive) {
      toggleClub();
      if (audioEl) audioEl.play().catch(function () {});
    }
  }

  function exitExpandedView() {
    if (!spectrumShell) return;
    var nativeOn =
      document.fullscreenElement === spectrumShell ||
      document.webkitFullscreenElement === spectrumShell;
    if (nativeOn) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
    spectrumShell.classList.remove(PSEUDO_FS);
    document.body.classList.remove('body--spectrum-expanded');
    clubWasActive = clubActive;
    if (clubActive) toggleClub();
    if (audioEl && !audioEl.paused) audioEl.pause();
    syncFullscreenButtons();
  }

  function onFullscreenEvent() {
    if (!spectrumShell) return;
    var el = document.fullscreenElement || document.webkitFullscreenElement;
    if (!el) {
      spectrumShell.classList.remove(PSEUDO_FS);
      document.body.classList.remove('body--spectrum-expanded');
    }
    syncFullscreenButtons();
  }

  if (fullscreenEnter) fullscreenEnter.addEventListener('click', enterExpandedView);
  if (fullscreenExit) fullscreenExit.addEventListener('click', exitExpandedView);

  if (fsPlayBtn) {
    fsPlayBtn.addEventListener('click', function () {
      if (!audioEl) return;
      if (clubActive) toggleClub();
      audioEl.play().catch(function () {});
    });
  }

  var spectrumCanvas = document.getElementById('spectrum-canvas');
  if (spectrumCanvas) {
    spectrumCanvas.addEventListener('click', function () {
      if (!inExpandedView() || !audioEl) return;
      if (audioEl.paused) {
        if (clubActive) toggleClub();
        audioEl.play().catch(function () {});
      } else {
        if (clubActive) toggleClub();
        audioEl.pause();
      }
    });
  }

  document.addEventListener('fullscreenchange', onFullscreenEvent);
  document.addEventListener('webkitfullscreenchange', onFullscreenEvent);

  document.addEventListener('keydown', function (evt) {
    if (evt.key === 'Escape' && inExpandedView()) {
      exitExpandedView();
    }
  });

  // --- CLUB MODE ---
  var clubActive      = false;
  var clubGeneration  = 0;
  var clubDancerCount = 0;
  var clubActiveGifs  = [];
  var clubSpawnIndex  = 0;
  var clubBtn         = document.getElementById('club-btn');

  function syncClubColors() {
    if (!clubBtn) return;
    clubBtn.style.setProperty('--club-c1', gradientColors[0] || '#ff00aa');
    clubBtn.style.setProperty('--club-c2', gradientColors[Math.min(1, gradientColors.length - 1)] || '#00eeff');
    clubBtn.style.setProperty('--club-c3', gradientColors[Math.min(2, gradientColors.length - 1)] || '#aaff00');
  }

  onGradientUpdate = function () { if (clubActive) syncClubColors(); };

  function isMobileDancerViewport() {
    return window.innerWidth <= CLUB_MOBILE_MAX_WIDTH;
  }

  /** Slower dancer spawns on mobile when not in fullscreen spectrum. */
  function clubSpawnIntervalMultiplier() {
    if (inExpandedView()) return 1;
    return isMobileDancerViewport() ? 2 : 1;
  }

  function getDancerZone() {
    var isMobile = window.innerWidth <= 480;
    if (isMobile || inExpandedView()) return 'canvas';
    var playerEl = document.querySelector('.player');
    if (!playerEl) return 'canvas';
    var rect      = playerEl.getBoundingClientRect();
    var leftSpace = rect.left;
    var rightSpace = window.innerWidth - rect.right;
    return (leftSpace < 80 && rightSpace < 80) ? 'canvas' : 'sides';
  }

  function spawnDancer(gen) {
    if (!clubActive || gen !== clubGeneration) return;
    if (clubDancerCount >= CLUB_MAX_DANCERS) return;

    var zone      = getDancerZone();
    var available = CLUB_GIFS.filter(function (g) { return clubActiveGifs.indexOf(g) === -1; });
    if (!available.length) return;
    var gif = available[Math.floor(Math.random() * available.length)];
    clubActiveGifs.push(gif);

    var img       = document.createElement('img');
    img.src       = gif;
    img.className = 'dancer';
    img.alt       = '';
    img.setAttribute('aria-hidden', 'true');
    var sizePool = isMobileDancerViewport() ? CLUB_DANCER_SIZES_MOBILE : CLUB_DANCER_SIZES;
    var sizeIdx = Math.floor(Math.random() * sizePool.length);
    var sizeH = sizePool[sizeIdx];
    img.style.height = sizeH;
    if (Math.random() < 0.5) img.style.transform = 'scaleX(-1)';
    if (sizeIdx === 2) {
      img.style.bottom = '0';
    } else if (sizeIdx === 1) {
      img.style.bottom = Math.random() * 50 + 'vh';
    } else {
      img.style.bottom = Math.random() * 70 + 'vh';
    }
    var container;
    var slot = clubSpawnIndex % CLUB_MAX_DANCERS;
    clubSpawnIndex++;

    if (zone === 'canvas') {
      img.classList.add('dancer--in-canvas');
      container  = spectrumShell || document.body;
      var shellW = container.offsetWidth || 400;
      var slotW  = shellW / CLUB_MAX_DANCERS;
      img.style.left = Math.max(0, slot * slotW + Math.random() * slotW * 0.6) + 'px';
    } else {
      container        = document.body;
      var playerEl2    = document.querySelector('.player');
      var rect2        = playerEl2 ? playerEl2.getBoundingClientRect() : null;
      var leftSpace2   = rect2 ? rect2.left                    : 0;
      var rightSpace2  = rect2 ? window.innerWidth - rect2.right : 0;
      var side;
      if (leftSpace2 < 80)       side = 'right';
      else if (rightSpace2 < 80) side = 'left';
      else                       side = slot % 2 === 0 ? 'left' : 'right';

      var sideSlot    = Math.floor(slot / 2);
      var sideSlots   = Math.ceil(CLUB_MAX_DANCERS / 2);
      if (side === 'left') {
        var segL = leftSpace2 / sideSlots;
        img.style.left  = Math.max(0, sideSlot * segL + Math.random() * segL * 0.7) + 'px';
      } else {
        var segR = rightSpace2 / sideSlots;
        img.style.right = Math.max(0, sideSlot * segR + Math.random() * segR * 0.7) + 'px';
      }
    }

    container.appendChild(img);
    clubDancerCount++;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { img.classList.add('dancer--visible'); });
    });

    var duration = CLUB_MIN_MS + Math.random() * (CLUB_MAX_MS - CLUB_MIN_MS);
    var capturedGen = gen;
    setTimeout(function () {
      img.classList.remove('dancer--visible');
      setTimeout(function () {
        if (img.parentNode) img.parentNode.removeChild(img);
        if (capturedGen === clubGeneration) {
          clubDancerCount = Math.max(0, clubDancerCount - 1);
          var idx = clubActiveGifs.indexOf(gif);
          if (idx !== -1) clubActiveGifs.splice(idx, 1);
        }
      }, 400);
    }, duration);
  }

  function clubTick(gen) {
    if (!clubActive || gen !== clubGeneration) return;
    var toSpawn = clubDancerCount < CLUB_MIN_DANCERS
      ? CLUB_MIN_DANCERS - clubDancerCount
      : (clubDancerCount < CLUB_MAX_DANCERS && Math.random() < 0.55 ? 1 : 0);
    for (var ci = 0; ci < toSpawn; ci++) spawnDancer(gen);
    var tickDelay = (700 + Math.random() * 1300) * clubSpawnIntervalMultiplier();
    setTimeout(function () { clubTick(gen); }, tickDelay);
  }

  function removeAllDancers() {
    var all = document.querySelectorAll('.dancer');
    for (var di = 0; di < all.length; di++) {
      (function (el) {
        el.classList.remove('dancer--visible');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
      })(all[di]);
    }
    clubDancerCount = 0;
    clubActiveGifs  = [];
    clubSpawnIndex  = 0;
  }

  var extraEl    = null;
  var extraImgEl = null;

  function ensureExtraEl() {
    if (extraEl) return;
    extraEl = document.createElement('div');
    extraEl.className = 'club-extra';
    extraImgEl = document.createElement('img');
    extraImgEl.src = EXTRA_GIFS[0] || '';
    extraImgEl.alt = '';
    extraImgEl.setAttribute('aria-hidden', 'true');
    extraEl.appendChild(extraImgEl);
    document.body.appendChild(extraEl);
  }

  function showExtra(gen) {
    if (!clubActive || gen !== clubGeneration) return;
    if (!extraEnabled || !EXTRA_GIFS.length) return;
    ensureExtraEl();
    if (extraImgEl && EXTRA_GIFS.length) {
      extraImgEl.src = EXTRA_GIFS[Math.floor(Math.random() * EXTRA_GIFS.length)];
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (extraEl && extraEnabled) extraEl.classList.add('club-extra--visible');
      });
    });
    setTimeout(function () {
      if (extraEl) extraEl.classList.remove('club-extra--visible');
      if (clubActive && gen === clubGeneration && extraEnabled && EXTRA_GIFS.length) scheduleExtra(gen);
    }, CLUB_EXTRA_SHOW_MS);
  }

  function scheduleExtra(gen) {
    if (!clubActive || gen !== clubGeneration) return;
    if (!extraEnabled || !EXTRA_GIFS.length) return;
    var delay = CLUB_EXTRA_MIN_INTERVAL + Math.random() * (CLUB_EXTRA_MAX_INTERVAL - CLUB_EXTRA_MIN_INTERVAL);
    setTimeout(function () { showExtra(gen); }, delay);
  }

  function toggleClub() {
    clubActive = !clubActive;
    clubGeneration++;
    if (clubBtn)       clubBtn.classList.toggle('club-btn--active', clubActive);
    if (normalClubBtn) normalClubBtn.classList.toggle('club-btn--active', clubActive);
    if (clubActive) {
      syncClubColors();
      clubDancerCount = 0;
      for (var si = 0; si < CLUB_MIN_DANCERS; si++) spawnDancer(clubGeneration);
      clubTick(clubGeneration);
      scheduleExtra(clubGeneration);
    } else {
      removeAllDancers();
      if (extraEl) extraEl.classList.remove('club-extra--visible');
    }
  }

  function onClubButtonClick() {
    toggleClub();
    if (audioEl) {
      if (clubActive) {
        audioEl.play().catch(function () {});
      } else {
        audioEl.pause();
      }
    }
  }

  if (clubBtn) {
    clubBtn.addEventListener('click', onClubButtonClick);
  }

  if (normalClubBtn) {
    normalClubBtn.addEventListener('click', onClubButtonClick);
  }

  if (audioPlayBtn && audioEl) {
    audioPlayBtn.addEventListener('click', function () {
      if (audioEl.paused) {
        if (clubActive) toggleClub();
        audioEl.play().catch(function () {});
      } else {
        if (clubActive) toggleClub();
        audioEl.pause();
      }
    });
  }

  // --- CUSTOMIZE DANCERS MODAL ---
  var uploadedDancerUrls    = [];
  var dancersModal          = null;
  var dancersModalGrid      = null;
  var dancersExtraSectionEl   = null;
  var dancersExtraGrid        = null;
  var dancersConfirmEl        = null;
  var dancersCustomAddTrigger = null;
  var dancersExtraAddTrigger  = null;
  var dancersExtraToggleBtn   = null;
  var dancersSaveBtn          = null;
  var openSnapshot            = [];
  var openPresetStates        = {};
  var sessionUploads          = [];
  var openExtraSnapshot       = [];
  var openExtraEnabledSnapshot = true;
  var sessionExtraUploads     = [];

  function snapshotPresets() {
    var snap = {};
    PRESET_ORDER.forEach(function (name) {
      var p = PRESETS[name];
      snap[name] = { gifs: p.gifs.slice(), enabled: p.enabled };
    });
    return snap;
  }

  function hasUnsavedChanges() {
    if (extraEnabled !== openExtraEnabledSnapshot) return true;
    if (EXTRA_GIFS.length !== openExtraSnapshot.length) return true;
    for (var ti = 0; ti < EXTRA_GIFS.length; ti++) {
      if (EXTRA_GIFS[ti] !== openExtraSnapshot[ti]) return true;
    }
    for (var pi = 0; pi < PRESET_ORDER.length; pi++) {
      var pname = PRESET_ORDER[pi];
      var pp = PRESETS[pname];
      var snap = openPresetStates[pname];
      if (!snap) return true;
      if (pp.enabled !== snap.enabled) return true;
      if (pp.gifs.length !== snap.gifs.length) return true;
      for (var gi = 0; gi < pp.gifs.length; gi++) {
        if (pp.gifs[gi] !== snap.gifs[gi]) return true;
      }
    }
    if (uploadedDancerUrls.length !== openSnapshot.length) return true;
    for (var ci = 0; ci < uploadedDancerUrls.length; ci++) {
      if (uploadedDancerUrls[ci] !== openSnapshot[ci]) return true;
    }
    return false;
  }

  function updateDancersSaveButtonVisibility() {
    if (!dancersSaveBtn) return;
    dancersSaveBtn.hidden = !hasUnsavedChanges();
  }

  function makeThumb(url, onRemove) {
    var thumb = document.createElement('div');
    thumb.className = 'dancer-thumb';
    var img = document.createElement('img');
    img.className = 'dancer-thumb__img';
    img.src = url;
    img.alt = '';
    var removeBtn = document.createElement('button');
    removeBtn.className = 'dancer-thumb__remove';
    removeBtn.type = 'button';
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', onRemove);
    thumb.appendChild(img);
    thumb.appendChild(removeBtn);
    return thumb;
  }

  function syncExtraSectionUI() {
    if (!dancersExtraToggleBtn || !dancersExtraGrid) return;
    dancersExtraToggleBtn.textContent = extraEnabled ? 'ON' : 'OFF';
    dancersExtraToggleBtn.className = 'dancers-modal__preset-toggle' +
      (extraEnabled ? ' dancers-modal__preset-toggle--on' : ' dancers-modal__preset-toggle--off');
    dancersExtraGrid.className = 'dancers-modal__extra-grid' +
      (extraEnabled ? '' : ' dancers-modal__preset-grid--off');
  }

  function renderExtraGrid() {
    if (!dancersExtraGrid) return;
    dancersExtraGrid.innerHTML = '';
    EXTRA_GIFS.forEach(function (url) {
      dancersExtraGrid.appendChild(makeThumb(url, function () {
        var idx = EXTRA_GIFS.indexOf(url);
        if (idx !== -1) EXTRA_GIFS.splice(idx, 1);
        renderExtraGrid();
      }));
    });
    if (dancersExtraAddTrigger) dancersExtraGrid.appendChild(dancersExtraAddTrigger);
    syncExtraSectionUI();
    updateDancersSaveButtonVisibility();
  }

  function renderDancersGrid() {
    renderExtraGrid();
    if (!dancersModalGrid) return;
    if (dancersExtraSectionEl && dancersExtraSectionEl.parentNode === dancersModalGrid) {
      dancersModalGrid.removeChild(dancersExtraSectionEl);
    }
    dancersModalGrid.innerHTML = '';

    // CUSTOM section – always first
    var customSection = document.createElement('div');
    customSection.className = 'dancers-modal__preset-section dancers-modal__preset-section--custom';

    var customHeader = document.createElement('div');
    customHeader.className = 'dancers-modal__preset-header';
    var customName = document.createElement('span');
    customName.className = 'dancers-modal__preset-name';
    customName.textContent = 'CUSTOM';
    customHeader.appendChild(customName);

    var customGrid = document.createElement('div');
    customGrid.className = 'dancers-modal__preset-grid';

    uploadedDancerUrls.forEach(function (url) {
      customGrid.appendChild(makeThumb(url, (function (gifUrl) {
        return function () {
          var ci = CLUB_GIFS.indexOf(gifUrl);
          if (ci !== -1) CLUB_GIFS.splice(ci, 1);
          var ui = uploadedDancerUrls.indexOf(gifUrl);
          if (ui !== -1) { uploadedDancerUrls.splice(ui, 1); URL.revokeObjectURL(gifUrl); }
          var si = sessionUploads.indexOf(gifUrl);
          if (si !== -1) sessionUploads.splice(si, 1);
          renderDancersGrid();
        };
      }(url))));
    });

    if (dancersCustomAddTrigger) customGrid.appendChild(dancersCustomAddTrigger);

    customSection.appendChild(customHeader);
    customSection.appendChild(customGrid);
    dancersModalGrid.appendChild(customSection);

    PRESET_ORDER.forEach(function (name) {
      var p = PRESETS[name];

      var section = document.createElement('div');
      section.className = 'dancers-modal__preset-section';

      var sectionHeader = document.createElement('div');
      sectionHeader.className = 'dancers-modal__preset-header';

      var sectionName = document.createElement('span');
      sectionName.className = 'dancers-modal__preset-name';
      sectionName.textContent = name;

      var toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'dancers-modal__preset-toggle' +
        (p.enabled ? ' dancers-modal__preset-toggle--on' : ' dancers-modal__preset-toggle--off');
      toggleBtn.textContent = p.enabled ? 'ON' : 'OFF';
      (function (preset, btn) {
        btn.addEventListener('click', function () {
          preset.enabled = !preset.enabled;
          rebuildClubGifs();
          renderDancersGrid();
        });
      }(p, toggleBtn));

      sectionHeader.appendChild(sectionName);
      sectionHeader.appendChild(toggleBtn);

      var sectionGrid = document.createElement('div');
      sectionGrid.className = 'dancers-modal__preset-grid' +
        (p.enabled ? '' : ' dancers-modal__preset-grid--off');

      p.gifs.forEach(function (url) {
        sectionGrid.appendChild(makeThumb(url, (function (gifUrl) {
          return function () {
            var idx = p.gifs.indexOf(gifUrl);
            if (idx !== -1) p.gifs.splice(idx, 1);
            rebuildClubGifs();
            renderDancersGrid();
          };
        }(url))));
      });

      section.appendChild(sectionHeader);
      section.appendChild(sectionGrid);
      dancersModalGrid.appendChild(section);
    });
    if (dancersExtraSectionEl) {
      dancersModalGrid.appendChild(dancersExtraSectionEl);
    }
    updateDancersSaveButtonVisibility();
  }

  function closeDancersModalDirect() {
    if (dancersModal)     dancersModal.hidden = true;
    if (dancersConfirmEl) dancersConfirmEl.hidden = true;
  }

  function saveDancers() {
    sessionUploads.forEach(function (url) {
      if (CLUB_GIFS.indexOf(url) === -1) {
        URL.revokeObjectURL(url);
        var i = uploadedDancerUrls.indexOf(url);
        if (i !== -1) uploadedDancerUrls.splice(i, 1);
      }
    });
    sessionExtraUploads.forEach(function (url) {
      if (EXTRA_GIFS.indexOf(url) === -1) URL.revokeObjectURL(url);
    });
    openSnapshot        = uploadedDancerUrls.slice();
    openExtraSnapshot        = EXTRA_GIFS.slice();
    openExtraEnabledSnapshot = extraEnabled;
    openPresetStates         = snapshotPresets();
    sessionUploads           = [];
    sessionExtraUploads      = [];
    closeDancersModalDirect();
  }

  function discardDancers() {
    sessionUploads.forEach(function (url) {
      if (openSnapshot.indexOf(url) === -1) {
        URL.revokeObjectURL(url);
        var i = uploadedDancerUrls.indexOf(url);
        if (i !== -1) uploadedDancerUrls.splice(i, 1);
      }
    });
    sessionExtraUploads.forEach(function (url) {
      if (openExtraSnapshot.indexOf(url) === -1) URL.revokeObjectURL(url);
    });
    PRESET_ORDER.forEach(function (name) {
      var snap = openPresetStates[name];
      if (snap) {
        PRESETS[name].gifs    = snap.gifs.slice();
        PRESETS[name].enabled = snap.enabled;
      }
    });
    rebuildClubGifs();
    extraEnabled = openExtraEnabledSnapshot;
    if (!extraEnabled && extraEl) extraEl.classList.remove('club-extra--visible');
    EXTRA_GIFS.length = 0;
    openExtraSnapshot.forEach(function (u) { EXTRA_GIFS.push(u); });
    sessionUploads      = [];
    sessionExtraUploads = [];
    renderExtraGrid();
    closeDancersModalDirect();
  }

  function resetDancers() {
    sessionUploads.forEach(function (url) {
      URL.revokeObjectURL(url);
      var i = uploadedDancerUrls.indexOf(url);
      if (i !== -1) uploadedDancerUrls.splice(i, 1);
    });
    sessionExtraUploads.forEach(function (url) {
      if (DEFAULT_EXTRA_GIFS.indexOf(url) === -1) URL.revokeObjectURL(url);
    });
    sessionUploads      = [];
    sessionExtraUploads = [];
    uploadedDancerUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    uploadedDancerUrls.length = 0;
    PRESET_ORDER.forEach(function (name) {
      PRESETS[name].gifs    = PRESETS[name].loadedGifs.slice();
      PRESETS[name].enabled = (name === 'FUN');
    });
    rebuildClubGifs();
    extraEnabled = true;
    EXTRA_GIFS.length = 0;
    DEFAULT_EXTRA_GIFS.forEach(function (u) { EXTRA_GIFS.push(u); });
    renderDancersGrid();
    if (dancersConfirmEl) dancersConfirmEl.hidden = true;
  }

  function tryCloseDancersModal() {
    if (hasUnsavedChanges()) {
      if (dancersConfirmEl) dancersConfirmEl.hidden = false;
    } else {
      closeDancersModalDirect();
    }
  }

  function makeFsBtn(text) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'player__fullscreen-btn';
    b.textContent = text;
    return b;
  }

  function createDancersModal() {
    var modal = document.createElement('div');
    modal.className = 'dancers-modal';
    modal.hidden = true;
    modal.addEventListener('click', function (e) { if (e.target === modal) tryCloseDancersModal(); });

    var box = document.createElement('div');
    box.className = 'dancers-modal__box';

    // Header
    var header = document.createElement('div');
    header.className = 'dancers-modal__header';
    var titleEl = document.createElement('span');
    titleEl.className = 'dancers-modal__title';
    titleEl.textContent = 'Customize Dancers';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dancers-modal__close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', tryCloseDancersModal);
    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    // Content (preset sections)
    var grid = document.createElement('div');
    grid.className = 'dancers-modal__content';
    dancersModalGrid = grid;

    // CUSTOM section add-trigger (created once, re-used across renders)
    var customFileInput = document.createElement('input');
    customFileInput.type = 'file';
    customFileInput.accept = 'image/gif';
    customFileInput.multiple = true;
    customFileInput.hidden = true;

    var customAddTrigger = document.createElement('div');
    customAddTrigger.className = 'dancer-thumb dancer-thumb--add';
    customAddTrigger.title = 'Upload GIF';
    var customAddLabel = document.createElement('span');
    customAddLabel.className = 'dancer-thumb__add-label';
    customAddLabel.textContent = '+';
    customAddTrigger.appendChild(customAddLabel);
    customAddTrigger.appendChild(customFileInput);
    dancersCustomAddTrigger = customAddTrigger;

    var wasExpandedOnUpload = false;

    function restoreFullscreen() {
      if (wasExpandedOnUpload && !inExpandedView()) {
        wasExpandedOnUpload = false;
        enterExpandedView();
      }
    }

    customAddTrigger.addEventListener('click', function () {
      wasExpandedOnUpload = inExpandedView();
      customFileInput.click();
    });
    customFileInput.addEventListener('change', function () {
      Array.prototype.forEach.call(customFileInput.files, function (file) {
        var url = URL.createObjectURL(file);
        uploadedDancerUrls.push(url);
        sessionUploads.push(url);
        rebuildClubGifs();
      });
      customFileInput.value = '';
      renderDancersGrid();
      restoreFullscreen();
    });
    customFileInput.addEventListener('cancel', function () {
      restoreFullscreen();
    });

    // Footer
    var footer = document.createElement('div');
    footer.className = 'dancers-modal__footer';

    var resetBtn = makeFsBtn('Reset');
    resetBtn.addEventListener('click', resetDancers);

    var saveBtn = makeFsBtn('Save');
    saveBtn.hidden = true;
    dancersSaveBtn = saveBtn;
    saveBtn.addEventListener('click', saveDancers);

    // Extra section (appended inside scrollable content after preset GIF sections)
    var extraSection = document.createElement('div');
    extraSection.className = 'dancers-modal__preset-section dancers-modal__extra-section';
    dancersExtraSectionEl = extraSection;

    var extraHeader = document.createElement('div');
    extraHeader.className = 'dancers-modal__preset-header';

    var extraName = document.createElement('span');
    extraName.className = 'dancers-modal__preset-name';
    extraName.textContent = 'EXTRA';

    var extraToggleBtn = document.createElement('button');
    extraToggleBtn.type = 'button';
    extraToggleBtn.className = 'dancers-modal__preset-toggle';
    extraToggleBtn.addEventListener('click', function () {
      extraEnabled = !extraEnabled;
      if (!extraEnabled && extraEl) extraEl.classList.remove('club-extra--visible');
      syncExtraSectionUI();
      updateDancersSaveButtonVisibility();
    });
    dancersExtraToggleBtn = extraToggleBtn;

    extraHeader.appendChild(extraName);
    extraHeader.appendChild(extraToggleBtn);

    var extraGrid = document.createElement('div');
    extraGrid.className = 'dancers-modal__extra-grid';
    dancersExtraGrid = extraGrid;

    var extraAddTrigger = document.createElement('div');
    extraAddTrigger.className = 'dancer-thumb dancer-thumb--add';
    extraAddTrigger.title = 'Add extra GIF';
    var extraAddLabel = document.createElement('span');
    extraAddLabel.textContent = '+';
    extraAddLabel.className = 'dancer-thumb__add-label';

    var extraFileInput = document.createElement('input');
    extraFileInput.type = 'file';
    extraFileInput.accept = 'image/gif';
    extraFileInput.multiple = true;
    extraFileInput.hidden = true;

    var wasExtraExpandedOnUpload = false;
    extraAddTrigger.addEventListener('click', function () {
      wasExtraExpandedOnUpload = inExpandedView();
      extraFileInput.click();
    });
    extraFileInput.addEventListener('change', function () {
      Array.prototype.forEach.call(extraFileInput.files, function (file) {
        var url = URL.createObjectURL(file);
        sessionExtraUploads.push(url);
        EXTRA_GIFS.push(url);
      });
      extraFileInput.value = '';
      renderExtraGrid();
      if (wasExtraExpandedOnUpload && !inExpandedView()) {
        wasExtraExpandedOnUpload = false;
        enterExpandedView();
      }
    });
    extraFileInput.addEventListener('cancel', function () {
      if (wasExtraExpandedOnUpload && !inExpandedView()) {
        wasExtraExpandedOnUpload = false;
        enterExpandedView();
      }
    });

    extraAddTrigger.appendChild(extraAddLabel);
    extraAddTrigger.appendChild(extraFileInput);
    dancersExtraAddTrigger = extraAddTrigger;

    extraSection.appendChild(extraHeader);
    extraSection.appendChild(extraGrid);

    footer.appendChild(resetBtn);
    footer.appendChild(saveBtn);

    // Confirm overlay (inside box so it covers only the modal)
    var confirm = document.createElement('div');
    confirm.className = 'dancers-confirm';
    confirm.hidden = true;
    var confirmBox = document.createElement('div');
    confirmBox.className = 'dancers-confirm__box';
    var confirmText = document.createElement('p');
    confirmText.className = 'dancers-confirm__text';
    confirmText.textContent = 'Save changes?';
    var confirmBtns = document.createElement('div');
    confirmBtns.className = 'dancers-confirm__btns';
    var yesBtn = makeFsBtn('Yes');
    yesBtn.addEventListener('click', saveDancers);
    var noBtn = makeFsBtn('No');
    noBtn.addEventListener('click', discardDancers);
    confirmBtns.appendChild(yesBtn);
    confirmBtns.appendChild(noBtn);
    confirmBox.appendChild(confirmText);
    confirmBox.appendChild(confirmBtns);
    confirm.appendChild(confirmBox);
    dancersConfirmEl = confirm;

    box.appendChild(header);
    box.appendChild(grid);
    box.appendChild(footer);
    box.appendChild(confirm);
    modal.appendChild(box);
    document.body.appendChild(modal);
    dancersModal = modal;
  }

  function syncPlaybackControlsUi() {
    if (audioPlayBtn && audioEl) {
      audioPlayBtn.textContent = audioEl.paused ? 'PLAY' : 'PAUSE';
    }
    if (clubBtn) clubBtn.classList.toggle('club-btn--active', clubActive);
    if (normalClubBtn) normalClubBtn.classList.toggle('club-btn--active', clubActive);
    syncFullscreenButtons();
  }

  function openDancersModal() {
    if (!dancersModal) createDancersModal();
    clearQueueAdvanceTimer();
    if (queueNowInner) {
      var qRow = queueNowInner.querySelector('.player-queue__now-track-inner');
      if (qRow) qRow.classList.remove('player-queue__now-track-inner--exit');
    }
    if (audioEl && !audioEl.paused) audioEl.pause();
    if (clubActive) toggleClub();
    syncPlaybackControlsUi();
    openSnapshot             = uploadedDancerUrls.slice();
    openExtraSnapshot        = EXTRA_GIFS.slice();
    openExtraEnabledSnapshot = extraEnabled;
    openPresetStates         = snapshotPresets();
    sessionUploads           = [];
    sessionExtraUploads      = [];
    renderDancersGrid();
    if (dancersConfirmEl) dancersConfirmEl.hidden = true;
    // In fullscreen the modal must live inside spectrumShell to be visible
    var target = inExpandedView() ? (spectrumShell || document.body) : document.body;
    if (dancersModal.parentNode !== target) target.appendChild(dancersModal);
    dancersModal.hidden = false;
  }

  var customizeDancersBtn = document.getElementById('customize-dancers-btn');
  if (customizeDancersBtn)   customizeDancersBtn.addEventListener('click', openDancersModal);
  if (customizeDancersFsBtn) customizeDancersFsBtn.addEventListener('click', openDancersModal);

  syncFullscreenButtons();
})();
