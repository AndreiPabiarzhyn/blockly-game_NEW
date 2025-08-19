// app.js — 15 уровней, сетка 8x8. 1–5 без цикла, 6–10 с циклом, 11–15 «★» сложные.
// Стартовый блок добавляет сам пользователь (и можно удалять).
// Панорамирование включено, зум ±15%. Модалки, звуки, анимация монет и финальный салют.

(function () {
  // ===== Настройки анимации =====
  const MOVE_MS = 260;       // медленнее движения (было ~160)
  const COIN_DELAY = 120;    // задержка перед сбором монеты
  const COIN_POP_MS = 320;   // вспышка/пульс монеты

  // ===== DOM =====
  const blocklyDiv = document.getElementById("blocklyDiv");
  const stage = document.getElementById("stage");
  const ctx   = stage.getContext("2d");

  const levelLabel = document.getElementById("levelLabel");
  const consoleBox = document.getElementById("console");

  const btnRun   = document.getElementById("btnRun");
  const btnReset = document.getElementById("btnReset");
  const btnHint  = document.getElementById("btnHint");
  const btnPrev  = document.getElementById("btnPrev");
  const btnNext  = document.getElementById("btnNext");
  const actionsBar = document.getElementById('actionsBar');

  // модалки результата, подсказки, старта, финала
  const modalResult    = document.getElementById("modalResult");
  const resultImg      = document.getElementById("resultImg");
  const resultTitle    = document.getElementById("resultTitle");
  const resultMsg      = document.getElementById("resultMsg");
  const btnResultClose = document.getElementById("btnResultClose");
  const btnNextLevel   = document.getElementById("btnNextLevel");

  const modalHint      = document.getElementById("modalHint");
  const hintText       = document.getElementById("hintText");
  const btnHintClose   = document.getElementById("btnHintClose");
  const btnAutoStart   = document.getElementById("btnAutoStart"); // мы её удалим

  const modalStart     = document.getElementById("modalStart");
  const btnStart       = document.getElementById("btnStart");

  // финальная модалка создадим динамически
  let finalModal = null;

  // ===== Состояние =====
  let workspace;
  let currentLevel = 0;
  let grid = 8, cell = 56;
  const player = { x: 0, y: 0, rx: 0, ry: 0 };
  let coins = [];

  // ===== Ассеты =====
  const imgPlayer = new Image(); imgPlayer.src = "assets/player.png";
  const imgCoin   = new Image(); imgCoin.src   = "assets/coin.png";
  const sWin  = new Audio("assets/win.mp3");
  const sFail = new Audio("assets/fail.mp3");
  sWin.preload = "auto"; sFail.preload = "auto";

  // Blockly генератор
  const JS = Blockly.JavaScript || Blockly.javascriptGenerator;

  // ===== Утилиты =====
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const log   = (t) => { consoleBox.textContent = t; };
  const bodyLock = (on) => document.body.classList.toggle('modal-open', !!on);
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  // ===== Модалки =====
  function showResult(ok, message) {
    if (ok) {
      resultImg.src = "assets/correct.gif";
      resultTitle.textContent = "Отлично!";
      resultMsg.textContent   = message || "Задание выполнено правильно.";
      btnNextLevel.style.display = (currentLevel < window.LEVELS.length - 1) ? "inline-flex" : "none";
      try { sWin.currentTime = 0; sWin.play(); } catch {}
    } else {
      resultImg.src = "assets/incorrect.png";
      resultTitle.textContent = "Почти получилось";
      resultMsg.textContent   = message || "Проверь блоки и попробуй ещё раз.";
      btnNextLevel.style.display = "none";
      try { sFail.currentTime = 0; sFail.play(); } catch {}
    }
    modalResult.setAttribute("aria-hidden", "false");
    bodyLock(true);
  }
  function hideResult() { modalResult.setAttribute("aria-hidden", "true"); bodyLock(false); }

  function showHint() {
    const L = window.LEVELS[currentLevel];
    hintText.textContent = L.hint || "Подумай: где монеты и как туда дойти?";
    modalHint.setAttribute("aria-hidden", "false");
    bodyLock(true);
  }
  function hideHint() { modalHint.setAttribute("aria-hidden", "true"); bodyLock(false); }

  function showFinalPrize() {
    if (!finalModal) {
      finalModal = document.createElement('div');
      finalModal.className = 'prize-modal';
      finalModal.innerHTML = `
        <div class="prize-card">
          <h2>Ты прошёл все уровни! 🎉</h2>
          <p>Вот твой приз!</p>
          <img src="assets/prize.png" alt="Приз" class="prize-img" onerror="this.style.display='none'">
          <div class="fireworks">
            <div class="firework"></div>
            <div class="firework delay1"></div>
            <div class="firework delay2"></div>
          </div>
          <div class="prize-actions">
            <button id="btnRestartAll">Сначала</button>
          </div>
        </div>`;
      document.body.appendChild(finalModal);
      finalModal.querySelector('#btnRestartAll').addEventListener('click', () => {
        finalModal.remove();
        finalModal = null;
        bodyLock(false);
        loadLevel(0);
      });
    }
    finalModal.style.display = 'flex';
    bodyLock(true);

    const audio = document.getElementById("end-audio");
    if (audio) {
      audio.currentTime = 0;
      audio.play();
    }
  }

  // ===== Сцена =====
  function draw() {
    ctx.clearRect(0,0,stage.width,stage.height);

    // сетка
    ctx.save(); ctx.globalAlpha = 0.22; ctx.strokeStyle = "#94a3b8";
    for (let i=0;i<=grid;i++){
      ctx.beginPath(); ctx.moveTo(i*cell,0); ctx.lineTo(i*cell,grid*cell); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*cell); ctx.lineTo(grid*cell,i*cell); ctx.stroke();
    }
    ctx.restore();

    // монеты
    coins.forEach(c=>{
      if (c.taken) return;
      if (imgCoin.complete && imgCoin.naturalWidth>0)
        ctx.drawImage(imgCoin, c.x*cell+cell*0.2, c.y*cell+cell*0.2, cell*0.6, cell*0.6);
      else { ctx.fillStyle = "#f59e0b";
        ctx.beginPath(); ctx.arc(c.x*cell+cell/2, c.y*cell+cell/2, cell*0.26, 0, Math.PI*2); ctx.fill(); }
    });

    // игрок
    if (imgPlayer.complete && imgPlayer.naturalWidth>0)
      ctx.drawImage(imgPlayer, player.rx, player.ry, cell, cell);
    else { ctx.fillStyle="#22d3ee"; ctx.fillRect(player.rx, player.ry, cell, cell); }
  }

  function resizeBlockly() { if (workspace) Blockly.svgResize(workspace); }
  function resizeStage() {
    const wrap = document.querySelector(".stage-wrap");
    const size = Math.min(wrap.clientWidth - 16, 560);
    stage.width = stage.height = size;
    cell = Math.floor(size / grid);
    player.rx = player.x * cell; player.ry = player.y * cell;
    draw();
  }

  // вспышка при сборе монеты
  function coinPopFX(cx, cy) {
    return new Promise(resolve => {
      const start = performance.now();
      const loop = (t) => {
        const p = Math.min(1, (t - start) / COIN_POP_MS);
        draw(); // перерисовать базовую сцену
        const x = cx * cell + cell / 2;
        const y = cy * cell + cell / 2;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(x, y, cell * (0.25 + 0.35 * p), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        if (p < 1) requestAnimationFrame(loop);
        else resolve();
      };
      requestAnimationFrame(loop);
    });
  }

  function positionActionsBar() {
  // где находится правая панель
  const right = document.querySelector('.right');
  const topbar = document.querySelector('.topbar');
  if (!right || !topbar || !actionsBar) return;

  const r = right.getBoundingClientRect();
  const tb = topbar.getBoundingClientRect();
  const barW = actionsBar.offsetWidth;

  // центр правой панели минус половина ширины блока действий
  let left = (r.left + r.width / 2) - (barW / 2) - tb.left;

  // небольшие границы, чтобы не наезжать на края
  left = Math.max(12, Math.min(left, tb.width - barW - 12));

  actionsBar.style.left = `${left}px`;
}

// пересчитываем при изменении размеров
window.addEventListener('resize', positionActionsBar);
new ResizeObserver(positionActionsBar).observe(document.querySelector('.right'));
new ResizeObserver(positionActionsBar).observe(document.querySelector('.topbar'));

// первый запуск, когда всё отрисовалось
requestAnimationFrame(positionActionsBar);

  // сброс только игрового поля (без блоков)
  function resetPlayfield() {
    const L = window.LEVELS[currentLevel];
    grid = L.grid;
    const wrap = document.querySelector(".stage-wrap");
    const size = Math.min(wrap.clientWidth - 16, 560);
    stage.width = stage.height = size;
    cell = Math.floor(size / grid);
    player.x = L.player.x; player.y = L.player.y;
    player.rx = player.x * cell; player.ry = player.y * cell;
    coins = L.coins.map(c => ({ ...c, taken: false }));
    draw();
  }

  // ===== Плавная анимация шага =====
  function tweenTo(nx, ny, ms = MOVE_MS) {
    return new Promise(resolve=>{
      const sx=player.rx, sy=player.ry, ex=nx*cell, ey=ny*cell;
      if (sx===ex && sy===ey) { resolve(); return; }
      let t0=null;
      const step=(ts)=>{
        if (t0===null) t0=ts;
        const p=Math.min(1,(ts-t0)/ms), e=p*(2-p);
        player.rx = sx + (ex - sx)*e;
        player.ry = sy + (ey - sy)*e;
        draw();
        if (p<1) requestAnimationFrame(step);
        else { player.x=nx; player.y=ny; player.rx=ex; player.ry=ey; draw(); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  // ===== API для кодогенерации =====
  function __move(dx, dy) {
    const nx = clamp(player.x + (dx|0), 0, grid-1);
    const ny = clamp(player.y + (dy|0), 0, grid-1);
    return tweenTo(nx, ny, MOVE_MS);
  }

  async function __pick() {
    const t = coins.find(c => !c.taken && c.x === player.x && c.y === player.y);
    if (t) {
      await sleep(COIN_DELAY);
      t.taken = true;                 // монета исчезает
      await coinPopFX(t.x, t.y);      // вспышка
      draw();
    }
  }
  const isWin = () => coins.every(c=>c.taken);
  window.__move = __move; window.__pick = __pick;

  // ===== Динамический тулбокс =====
  function buildToolboxXML(hasLoop) {
    const xml = document.createElement('xml');
    xml.setAttribute('id', 'toolbox');
    xml.setAttribute('style', 'display:none');

    const add = (tag, attrs = {}) => {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      xml.appendChild(el); return el;
    };

    // стартовый блок есть в тулбоксе (не автодобавляется)
    add('block', { type: 'when_run' });

    // Движение
    add('block', { type: 'move_right' });
    add('block', { type: 'move_left'  });
    add('block', { type: 'move_up'    });
    add('block', { type: 'move_down'  });

    // Цикл — только для уровней, где надо
    if (hasLoop) {
      const rep = add('block', { type: 'controls_repeat_ext' });
      const val = document.createElement('value'); val.setAttribute('name','TIMES'); rep.appendChild(val);
      const sh  = document.createElement('shadow'); sh.setAttribute('type','repeat_count'); val.appendChild(sh);
    }

    add('block', { type: 'pick_coin' });
    return xml;
  }

  // Подсчёт блоков программы (без when_run)
  function countProgramBlocks(start) {
    const seen = new Set();
    function visit(b) {
      if (!b || seen.has(b.id)) return 0;
      seen.add(b.id);
      let n = (b.type === 'when_run') ? 0 : 1;
      for (const name of ['DO','BODY']) {
        const inp = b.getInput?.(name);
        const child = inp?.connection?.targetBlock?.();
        if (child) n += visit(child);
      }
      const next = b.getNextBlock?.();
      if (next) n += visit(next);
      return n;
    }
    return visit(start);
  }

  // ===== Работа с уровнями =====
  function loadLevel(idx) {
    currentLevel = Math.max(0, Math.min(window.LEVELS.length - 1, idx));
    const L = window.LEVELS[currentLevel];
    grid = L.grid;

    // сцена
    const wrap = document.querySelector(".stage-wrap");
    const size = Math.min(wrap.clientWidth - 16, 560);
    stage.width = stage.height = size;
    cell = Math.floor(size / grid);

    // состояние
    player.x = L.player.x; player.y = L.player.y;
    player.rx = player.x * cell; player.ry = player.y * cell;
    coins = L.coins.map(c => ({ ...c, taken: false }));

    levelLabel.textContent = `Уровень ${currentLevel+1}/${window.LEVELS.length}${L.hard ? " ★" : ""}`;
    draw();

    // тулбокс по уровню
    const hasLoop = !!(L.require && L.require.loops);
    workspace.updateToolbox(buildToolboxXML(hasLoop));

    // блоки — пользователь сам ставит "Когда запущено"
    workspace.clear();
    log(L.hint || "Собери кристаллы.");
  }

  // ===== Выполнить программу =====
  function getStartBlock() {
    const arr = workspace.getBlocksByType
      ? workspace.getBlocksByType("when_run", false)
      : workspace.getAllBlocks(false).filter(b => b.type === "when_run");
    return arr && arr[0];
  }

  function failReset(message) {
    showResult(false, message);
    resetPlayfield(); // откатываем только сцену, блоки остаются
  }

  async function run() {
    const L = window.LEVELS[currentLevel];

    const start = getStartBlock();
    if (!start) return failReset("Добавь блок «Когда запущено» и прикрепи к нему команды.");
    const first = start.getNextBlock();
    if (!first) return failReset("К блоку «Когда запущено» ничего не подключено.");

    const used = countProgramBlocks(start);
    const minAllowed = (L.limits?.min ?? 1);
    const maxAllowed = (L.limits?.max ?? 99);
    if (used < minAllowed) return failReset(`Слишком короткая программа. Нужно минимум ${minAllowed} блок(а).`);
    if (used > maxAllowed) return failReset(`Слишком длинная программа. Можно максимум ${maxAllowed} блоков.`);

    if (L.require && L.require.loops) {
      const usedLoop = workspace.getAllBlocks(false)
        .some(b => b.type === "controls_repeat" || b.type === "controls_repeat_ext");
      if (!usedLoop) return failReset("На этом уровне необходимо использовать цикл.");
    }

    if (JS?.init) JS.init(workspace);
    let code = JS?.blockToCode ? JS.blockToCode(first) : "";
    if (Array.isArray(code)) code = code[0] || "";
    if (JS?.finish) code = JS.finish(code);

    const wrapped = `(async () => { try { ${code} } catch(e){ throw e; } })()`;
    try { /* eslint-disable no-eval */ await eval(wrapped); }
    catch (e) { return failReset("В блоках есть ошибка: " + e.message); }

    if (isWin()) {
      if (currentLevel === window.LEVELS.length - 1) {
        showFinalPrize(); // финальная модалка и салют
      } else {
        showResult(true, "Отлично! Все монеты собраны.");
      }
    } else {
      failReset("Не все монеты собраны. Попробуй ещё раз.");
    }
  }

  // ===== Тема и Workspace =====
  const HighContrast = Blockly.Theme.defineTheme("HighContrast", {
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: "#0b1220",
      toolboxBackgroundColour:   "#0f172a",
      toolboxForegroundColour:   "#e5e7eb",
      flyoutBackgroundColour:    "#0b1220",
      flyoutForegroundColour:    "#e5e7eb",
      flyoutOpacity: 1,
      scrollbarColour: "#64748b",
      insertionMarkerColour: "#22d3ee",
      insertionMarkerOpacity: 0.6,
      scrollbarOpacity: 0.8,
      cursorColour: "#22d3ee",
    },
  });

  workspace = Blockly.inject("blocklyDiv", {
    toolbox: document.getElementById("toolbox"), // подменяется динамически
    theme: HighContrast,
    grid: { spacing: 28, length: 3, colour: "#64748b", snap: true },
    move: { scrollbars: false, drag: true, wheel: true },
    zoom: { controls: true, wheel: true, pinch: true, startScale: 1, minScale: 0.85, maxScale: 1.15, scaleSpeed: 1.1 },
    trashcan: true,
    renderer: "geras",
  });

  // Разрешим удалять стартовый блок на всякий случай
  workspace.addChangeListener((ev) => {
    if (!ev || !ev.blockId) return;
    const b = workspace.getBlockById(ev.blockId);
    if (!b || b.type !== 'when_run' || !b.setDeletable) return;
    if (!b.isDeletable?.()) b.setDeletable(true);
  });

  // Кнопку автодобавления стартового блока из подсказки — убираем
  btnAutoStart?.remove();

  // ===== Слушатели =====
  const leftPane = document.querySelector('.left');
  new ResizeObserver(() => resizeBlockly()).observe(leftPane);
  window.addEventListener("resize", resizeBlockly);
  new ResizeObserver(() => resizeStage()).observe(document.querySelector(".stage-wrap"));

  btnRun.addEventListener("click", run);
  btnReset.addEventListener("click", () => loadLevel(currentLevel));
  btnPrev.addEventListener("click", () => loadLevel(currentLevel - 1));
  btnNext.addEventListener("click", () => loadLevel(currentLevel + 1));
  btnHint.addEventListener("click", showHint);
  btnHintClose.addEventListener("click", hideHint);
  btnResultClose.addEventListener("click", hideResult);
  btnNextLevel.addEventListener("click", () => { hideResult(); loadLevel(currentLevel + 1); });

  // ===== Старт =====
  resizeBlockly(); requestAnimationFrame(resizeBlockly); setTimeout(resizeBlockly, 50);
  resizeStage();

  if (modalStart) { modalStart.setAttribute("aria-hidden", "false"); bodyLock(true); }
  btnStart?.addEventListener("click", () => { modalStart.setAttribute("aria-hidden", "true"); bodyLock(false); loadLevel(0); });
})();
