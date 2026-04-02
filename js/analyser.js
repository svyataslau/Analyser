(function () {
  'use strict';

  var GRID_MIN = 10;
  var GRID_MAX = 100;
  var MUSIC_BASE = 'music/';
  var ASSETS_BASE = 'assets/';

  var MUSIC_LIBRARY = [];

  var CLUB_GIFS = [];
  var CLUB_MAX_DANCERS        = 5;
  var CLUB_MIN_DANCERS        = 3;
  var CLUB_MIN_MS             = 3000;
  var CLUB_MAX_MS             = 5000;
  var CLUB_DANCER_SIZES       = ['33vh', '66vh', '100vh'];
  var CLUB_TWERK_MIN_INTERVAL = 10000;
  var CLUB_TWERK_MAX_INTERVAL = 25000;
  var CLUB_TWERK_SHOW_MS      = 6000;

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
    });
    audioEl.addEventListener('pause', function () {
      if (audioPlayBtn) audioPlayBtn.textContent = 'PLAY';
    });
  }

  if (audioPlayBtn && audioEl) {
    audioPlayBtn.addEventListener('click', function () {
      if (audioEl.paused) { audioEl.play().catch(function () {}); }
      else { audioEl.pause(); }
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
  var UNKNOWN_ALBUM_ART = 'unknown_album.png';
  var UPLOAD_DEFAULT_BG = 'Gorillaz - New Gold (feat. Tame Impala and Bootie Brown).jpg';

  function setAudioFromLibrary(fileName) {
    var wasPlaying = !audioEl.paused;
    audioEl.src = MUSIC_BASE + encodeURIComponent(fileName);
    if (wasPlaying) audioEl.play().catch(function () {});
  }

  function updateAlbumArt() {
    var v = trackSelect.value;
    if (!albumFigure || !albumImg) return;
    if (!v) {
      albumFigure.classList.add('player__album--placeholder');
      albumImg.removeAttribute('src');
      albumImg.alt = '';
      applyDefaultBackground();
      return;
    }
    if (v === CUSTOM_VALUE) {
      albumFigure.classList.remove('player__album--placeholder');
      albumImg.alt = 'Unknown album';
      albumImg.src = ASSETS_BASE + UNKNOWN_ALBUM_ART;
      applyDefaultBackground();
      return;
    }
    var entry = null;
    var k;
    for (k = 0; k < MUSIC_LIBRARY.length; k++) {
      if (MUSIC_LIBRARY[k].file === v) {
        entry = MUSIC_LIBRARY[k];
        break;
      }
    }
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
    MUSIC_LIBRARY.forEach(function (entry) {
      var opt = document.createElement('option');
      opt.value = entry.file;
      opt.textContent = entry.label;
      trackSelect.appendChild(opt);
    });
    if (MUSIC_LIBRARY.length) {
      trackSelect.value = MUSIC_LIBRARY[0].file;
      setAudioFromLibrary(MUSIC_LIBRARY[0].file);
    }
    updateAlbumArt();
  }

  uploadTrigger.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) {
      var file = fileInput.files[0];
      var opt = ensureCustomUploadOption();
      opt.textContent = file.name;
      opt.title = file.name;
      trackSelect.value = CUSTOM_VALUE;
      var wasPlaying = !audioEl.paused;
      audioEl.src = URL.createObjectURL(file);
      if (wasPlaying) audioEl.play().catch(function () {});
      updateAlbumArt();
    }
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
    setAudioFromLibrary(v);
    updateAlbumArt();
  });

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
    var v = trackSelect.value;
    if (!v) return null;
    if (v === CUSTOM_VALUE) {
      return new URL(ASSETS_BASE + UPLOAD_DEFAULT_BG, document.baseURI).href;
    }
    var k;
    for (k = 0; k < MUSIC_LIBRARY.length; k++) {
      if (MUSIC_LIBRARY[k].file === v && MUSIC_LIBRARY[k].coverArt) {
        return new URL(ASSETS_BASE + MUSIC_LIBRARY[k].coverArt, document.baseURI).href;
      }
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
    document.addEventListener('mousemove', function (evt) {
      if (startOverlay && startOverlay.classList.contains('start-overlay--hidden')) return;
      startCursorImg.style.transform =
        'translate(calc(' + evt.clientX + 'px - 50%), calc(' + evt.clientY + 'px - 50%))';
    });
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

  (function loadDanceGifs(n) {
    var img = new Image();
    img.onload = function () {
      CLUB_GIFS.push('assets/dance-girl/dance-girl-' + n + '.gif');
      loadDanceGifs(n + 1);
    };
    img.onerror = function () {};
    img.src = 'assets/dance-girl/dance-girl-' + n + '.gif';
  }(1));

  applyGridFromControl();

  var spectrumShell = document.getElementById('spectrum-fullscreen-root');
  var fullscreenEnter = document.getElementById('fullscreen-enter');
  var fullscreenExit = document.getElementById('fullscreen-exit');
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
    if (fullscreenEnter) fullscreenEnter.hidden = on;
    if (fullscreenExit)  fullscreenExit.hidden  = !on;
    if (clubBtn)         clubBtn.hidden          = !on;
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
              if (clubWasActive) toggleClub();
            })
            .catch(function () {
              usePseudoFullscreen();
              if (clubWasActive) toggleClub();
            });
          return;
        }
      } catch (e) {
        usePseudoFullscreen();
        if (clubWasActive) toggleClub();
        return;
      }
    }
    usePseudoFullscreen();
    if (clubWasActive) toggleClub();
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
    var sizeH = CLUB_DANCER_SIZES[Math.floor(Math.random() * CLUB_DANCER_SIZES.length)];
    img.style.height = sizeH;
    if (sizeH === '100vh') {
      img.style.bottom = '0';
    } else if (sizeH === '66vh') {
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
    setTimeout(function () { clubTick(gen); }, 700 + Math.random() * 1300);
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

  var twerkEl = null;

  function ensureTwerkEl() {
    if (twerkEl) return;
    twerkEl = document.createElement('div');
    twerkEl.className = 'club-twerk';
    var twerkImg = document.createElement('img');
    twerkImg.src = 'assets/dance-girl/twerk.gif';
    twerkImg.alt = '';
    twerkImg.setAttribute('aria-hidden', 'true');
    twerkEl.appendChild(twerkImg);
    document.body.appendChild(twerkEl);
  }

  function showTwerk(gen) {
    if (!clubActive || gen !== clubGeneration) return;
    ensureTwerkEl();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (twerkEl) twerkEl.classList.add('club-twerk--visible');
      });
    });
    setTimeout(function () {
      if (twerkEl) twerkEl.classList.remove('club-twerk--visible');
      if (clubActive && gen === clubGeneration) scheduleTwerk(gen);
    }, CLUB_TWERK_SHOW_MS);
  }

  function scheduleTwerk(gen) {
    if (!clubActive || gen !== clubGeneration) return;
    var delay = CLUB_TWERK_MIN_INTERVAL + Math.random() * (CLUB_TWERK_MAX_INTERVAL - CLUB_TWERK_MIN_INTERVAL);
    setTimeout(function () { showTwerk(gen); }, delay);
  }

  function toggleClub() {
    clubActive = !clubActive;
    clubGeneration++;
    if (clubBtn) clubBtn.classList.toggle('club-btn--active', clubActive);
    if (clubActive) {
      syncClubColors();
      clubDancerCount = 0;
      for (var si = 0; si < CLUB_MIN_DANCERS; si++) spawnDancer(clubGeneration);
      clubTick(clubGeneration);
      scheduleTwerk(clubGeneration);
    } else {
      removeAllDancers();
      if (twerkEl) twerkEl.classList.remove('club-twerk--visible');
    }
  }

  if (clubBtn) clubBtn.addEventListener('click', toggleClub);

  syncFullscreenButtons();
})();
