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
    { label: 'Kacha - Złote Tarasy', file: 'warsaw.mp3', coverArt: 'kacha.png' },
    { label: 'Toto — Africa', file: 'Toto - Africa.mp3', coverArt: 'toto.png' },
    { label: 'Motörhead — Hellraiser', file: 'Motörhead - Hellraiser.mp3', coverArt: 'motorhead.png' }
  ];

  var audioEl = document.getElementById('spectrum-audio');
  var albumFigure = document.getElementById('track-album');
  var albumImg = document.getElementById('track-cover-art');
  var fileInput = document.getElementById('track-file-input');
  var uploadTrigger = document.getElementById('upload-trigger');
  var gridDensityRange = document.getElementById('grid-density-range');
  var trackSelect = document.getElementById('library-track-select');
  var hueRange = document.getElementById('hue-range-input');
  var startScreen = document.getElementById('experience-start');

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
      return;
    }
    if (v === CUSTOM_VALUE) {
      albumFigure.classList.remove('player__album--placeholder');
      albumImg.alt = 'Unknown album';
      albumImg.src = ASSETS_BASE + UNKNOWN_ALBUM_ART;
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
    if (!entry || !entry.coverArt) {
      albumFigure.classList.add('player__album--placeholder');
      albumImg.removeAttribute('src');
      albumImg.alt = '';
      return;
    }
    albumFigure.classList.remove('player__album--placeholder');
    albumImg.alt = entry.label + ' album art';
    albumImg.src = ASSETS_BASE + entry.coverArt;
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

  function getHueBase() {
    return parseInt(hueRange.value, 10) || 0;
  }

  window.colorRange = function () {
    return getHueBase();
  };

  function randomHueNearBase(percent) {
    var min = Math.ceil(percent - 30);
    var max = Math.floor(percent);
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
    var hue = getHueBase();
    var barHue = randomHueNearBase(hue);
    ctx.fillStyle = 'hsl(' + barHue + ', 100%, 63%)';

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
