(function () {
  'use strict';

  var GRID_MIN = 10;
  var GRID_MAX = 100;
  var MUSIC_BASE = 'music/';

  /**
   * Files in /music — add entries here when new tracks are added to the folder.
   * Browsers cannot enumerate directories over HTTP.
   */
  var MUSIC_LIBRARY = [
    { label: 'Simple', file: 'simple.mp3' },
    { label: 'Warsaw', file: 'warsaw.mp3' },
    { label: 'Toto — Africa', file: 'Toto - Africa.mp3' },
    { label: 'Motörhead — Hellraiser', file: 'Motörhead - Hellraiser.mp3' }
  ];

  var audioEl = document.getElementById('spectrum-audio');
  var fileInput = document.getElementById('track-file-input');
  var uploadTrigger = document.getElementById('upload-trigger');
  var buildBtn = document.getElementById('grid-build-button');
  var columnsInput = document.getElementById('grid-columns-input');
  var rowsInput = document.getElementById('grid-rows-input');
  var trackSelect = document.getElementById('library-track-select');
  var hueRange = document.getElementById('hue-range-input');
  var startScreen = document.getElementById('experience-start');

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

  function applyGridClampToInput(inputEl) {
    inputEl.value = String(clampGridValue(inputEl.value));
  }

  function onGridInputKeypress(evt) {
    var ch = String.fromCharCode(evt.which);
    if (!/[0-9]/.test(ch)) evt.preventDefault();
  }

  var CUSTOM_VALUE = '__custom_upload__';

  function setAudioFromLibrary(fileName) {
    audioEl.src = MUSIC_BASE + encodeURIComponent(fileName);
  }

  function ensureCustomUploadOption() {
    var existing = trackSelect.querySelector('option[value="' + CUSTOM_VALUE + '"]');
    if (existing) return;
    var opt = document.createElement('option');
    opt.value = CUSTOM_VALUE;
    opt.textContent = 'Uploaded file';
    trackSelect.insertBefore(opt, trackSelect.firstChild);
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
  }

  uploadTrigger.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) {
      ensureCustomUploadOption();
      trackSelect.value = CUSTOM_VALUE;
      audioEl.src = URL.createObjectURL(fileInput.files[0]);
    }
  });

  trackSelect.addEventListener('change', function () {
    var v = trackSelect.value;
    if (!v || v === CUSTOM_VALUE) return;
    fileInput.value = '';
    setAudioFromLibrary(v);
  });

  [columnsInput, rowsInput].forEach(function (el) {
    el.addEventListener('keyup', function () {
      applyGridClampToInput(el);
    });
    el.addEventListener('change', function () {
      applyGridClampToInput(el);
    });
  });

  buildBtn.addEventListener('click', function () {
    applyGridClampToInput(columnsInput);
    applyGridClampToInput(rowsInput);
    columnsN = parseInt(columnsInput.value, 10);
    rowsN = parseInt(rowsInput.value, 10);
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
    ctx.fillStyle = 'hsl(' + randomHueNearBase(hue) + ', 100%, 63%)';

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

  applyGridClampToInput(columnsInput);
  applyGridClampToInput(rowsInput);
  columnsN = parseInt(columnsInput.value, 10);
  rowsN = parseInt(rowsInput.value, 10);

  window.isInputNumber = onGridInputKeypress;
  window.isFromTo = function (el) {
    applyGridClampToInput(el);
  };
})();
