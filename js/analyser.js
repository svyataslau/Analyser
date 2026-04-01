(function () {
  'use strict';

  var GRID_MIN = 10;
  var GRID_MAX = 100;
  var MUSIC_BASE = 'music/';
  var ASSETS_BASE = 'assets/';

  /**
   * Files in /music — add entries here when new tracks are added to the folder.
   * Browsers cannot enumerate directories over HTTP.
   */
  var MUSIC_LIBRARY = [
    { label: 'Gorillaz - New Gold (feat. Tame Impala and Bootie Brown)', file: 'Gorillaz - New Gold (feat. Tame Impala and Bootie Brown).mp3', coverArt: 'gorillaz.jpg' },
    { label: 'Kacha - Złote Tarasy', file: 'warsaw.mp3', coverArt: 'kacha.jpg' },
    { label: 'Toto — Africa', file: 'Toto - Africa.mp3', coverArt: 'toto.jpg' },
    { label: 'Motörhead — Hellraiser', file: 'Motörhead - Hellraiser.mp3', coverArt: 'motorhead.jpg' },
    { label: 'Женя Трофимов — Самолеты', file: 'Женя Трофимов - Самолеты.mp3', coverArt: 'samolety.jpg' },
  ];

  var audioEl = document.getElementById('spectrum-audio');
  var albumFigure = document.getElementById('track-album');
  var albumImg = document.getElementById('track-cover-art');
  var fileInput = document.getElementById('track-file-input');
  var uploadTrigger = document.getElementById('upload-trigger');
  var gridDensityRange = document.getElementById('grid-density-range');
  var trackSelect = document.getElementById('library-track-select');
  var startScreen = document.getElementById('experience-start');
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
    audioEl.setAttribute('controlsList', 'nodownload');
    audioEl.addEventListener('contextmenu', function (evt) {
      evt.preventDefault();
    });
    audioEl.addEventListener('dragstart', function (evt) {
      evt.preventDefault();
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

  function setAudioFromLibrary(fileName) {
    audioEl.src = MUSIC_BASE + encodeURIComponent(fileName);
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
      audioEl.src = URL.createObjectURL(file);
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
    if (!v || v === CUSTOM_VALUE) return null;
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

    var i;
    for (i = 0; i < columnsN; i++) {
      var binIndex = Math.floor((i / columnsN) * binCount);
      var level = data[binIndex] / 255;
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

  startScreen.addEventListener('click', function () {
    if (!started) {
      applyDefaultBackground();
      wireAnalyser();
      startScreen.classList.add('start-screen--hidden');
    } else if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  });

  populateTrackSelect();
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
    if (fullscreenExit) fullscreenExit.hidden = !on;
  }

  function usePseudoFullscreen() {
    spectrumShell.classList.add(PSEUDO_FS);
    document.body.classList.add('body--spectrum-expanded');
    syncFullscreenButtons();
  }

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
            })
            .catch(function () {
              usePseudoFullscreen();
            });
          return;
        }
      } catch (e) {
        usePseudoFullscreen();
        return;
      }
    }
    usePseudoFullscreen();
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

  syncFullscreenButtons();
})();
