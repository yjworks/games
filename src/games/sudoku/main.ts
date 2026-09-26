import "../../shared/base.css";
import "./sudoku.css";
import { generatePuzzle, type Difficulty } from "./engine/generator.js";
import {
  createInitialState,
  reducer,
  type GameState,
  type Action,
  type CellValue,
} from "./state/gameState.js";
import { loadState, saveState, flushState, clearState, saveBest, loadBest } from "./state/storage.js";
import { mountShellBar } from "../../shared/dom/shell";
import { createTutorial } from "../../shared/dom/tutorial";
import { gameById } from "../../shared/registry";
import { sfx } from "../../shared/sound";
import { sudokuTutorial } from "./tutorial";
import { registerServiceWorker } from "../../shared/pwa";
import {
  activeStreak, dailyRandom, getDaily, recordDaily, todayKey, todayResult,
} from "../../shared/daily";
import { HUB_HREF } from "../../shared/registry";

const meta = gameById("sudoku");
const DIFF_LABEL: Record<string, string> = { easy: "쉬움", medium: "보통", hard: "어려움" };
import { Board } from "./ui/Board.js";
import { NumberPad } from "./ui/NumberPad.js";
import { Controls } from "./ui/Controls.js";
import { Timer } from "./ui/Timer.js";
import { ScoreBoard } from "./ui/ScoreBoard.js";
import { Modal, formatTime } from "./ui/Modal.js";
import { STR } from "./ui/strings.js";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, html?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

class App {
  private state!: GameState;
  private board!: Board;
  private numpad!: NumberPad;
  private controls!: Controls;
  private timer!: Timer;
  private scoreboard!: ScoreBoard;
  private modal!: Modal;
  private noteMode = false;
  private noteBtnEl!: HTMLButtonElement;
  private pauseBtnEl!: HTMLButtonElement;
  private undoBtnEl!: HTMLButtonElement;
  private redoBtnEl!: HTMLButtonElement;
  private pauseOverlayEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private failShown = false;
  private tutorial!: ReturnType<typeof createTutorial>;
  private dailyBarEl!: HTMLElement;

  constructor() {
    const appEl = document.getElementById("app")!;
    appEl.innerHTML = "";

    // ── 헤더: 공통 셸 바 + 게임별 조작 ─────────────
    const helpBtn = el("button", "db-btn shell-btn");
    helpBtn.type = "button";
    helpBtn.textContent = "?";
    helpBtn.setAttribute("aria-label", "게임 방법");
    const shellBar = mountShellBar(meta, [helpBtn]);

    this.tutorial = createTutorial(meta, sudokuTutorial);
    helpBtn.addEventListener("click", () => this.tutorial.open());
    document.body.appendChild(this.tutorial.element);

    // ── 오늘의 문제 / 자유 전환 ─────────────────
    this.dailyBarEl = el("div", "daily-bar");
    this.dailyBarEl.innerHTML = `
      <div class="daily-modes">
        <button type="button" data-mode="daily">오늘의 문제</button>
        <button type="button" data-mode="free">자유</button>
      </div>
      <div class="daily-streak"></div>`;
    this.dailyBarEl.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => this.switchMode(btn.dataset.mode as "daily" | "free"));
    });

    const headerNav = el("div", "app-header-nav");

    // ── 스탯 바 ──────────────────────────────────
    const statsEl = el("div", "app-stats");

    // ── 보드 영역 ─────────────────────────────────
    const boardWrap = el("div", "app-board-wrap");

    this.pauseOverlayEl = el("div", "pause-overlay hidden",
      `<div class="pause-content">
        <div class="pause-icon-lg">⏸</div>
        <div class="pause-label">${STR.paused}</div>
        <div class="pause-hint">탭하여 계속</div>
      </div>`
    );
    this.pauseOverlayEl.addEventListener("click", () => this.togglePause());
    boardWrap.appendChild(this.pauseOverlayEl);

    // ── 툴바 ─────────────────────────────────────
    const toolbar = el("div", "app-toolbar");

    this.undoBtnEl = this.makeToolBtn("↺", STR.undo, "Z", STR.undoShort);
    this.undoBtnEl.addEventListener("click", () => this.onUndo());

    this.redoBtnEl = this.makeToolBtn("↻", STR.redo, "Y", STR.redoShort);
    this.redoBtnEl.addEventListener("click", () => this.onRedo());

    const eraseBtn = this.makeToolBtn("⌫", STR.erase, "Del");
    eraseBtn.addEventListener("click", () => this.onErase());

    this.noteBtnEl = this.makeToolBtn("✏", STR.note, "N");
    this.noteBtnEl.setAttribute("aria-pressed", "false");
    this.noteBtnEl.addEventListener("click", () => this.toggleNoteMode());

    const autoNotesBtn = this.makeToolBtn("✎", STR.autoNotes, undefined, STR.autoNotesShort);
    autoNotesBtn.addEventListener("click", () => this.onAutoNotes());

    const hintBtn = this.makeToolBtn("💡", STR.hint, "H");
    hintBtn.addEventListener("click", () => this.onHint());

    this.pauseBtnEl = this.makeToolBtn("⏸", STR.pause, "Space", STR.pauseShort);
    this.pauseBtnEl.addEventListener("click", () => this.togglePause());

    toolbar.append(this.undoBtnEl, this.redoBtnEl, eraseBtn, this.noteBtnEl, autoNotesBtn, hintBtn, this.pauseBtnEl);

    // ── 숫자 패드 ─────────────────────────────────
    const numpadWrap = el("div", "app-numpad-wrap");

    // ── 토스트 ───────────────────────────────────
    this.toastEl = el("div", "toast hidden");
    this.toastEl.setAttribute("role", "status");
    this.toastEl.setAttribute("aria-live", "polite");

    appEl.append(shellBar, this.dailyBarEl, headerNav, statsEl, boardWrap, toolbar, numpadWrap, this.toastEl);

    // ── UI 초기화 ────────────────────────────────
    this.timer = new Timer(statsEl, (ms) => this.onTick(ms));
    this.scoreboard = new ScoreBoard(statsEl);

    this.board = new Board(boardWrap, (action) => this.dispatch(action));
    this.numpad = new NumberPad(numpadWrap, (v) => this.board.inputNumber(v));

    this.controls = new Controls(headerNav);
    this.controls.onNewGame = (d) => this.confirmNewGame(d);
    this.controls.onReset = () => this.onReset();

    this.modal = new Modal();

    document.addEventListener("keydown", (e) => this.onGlobalKeydown(e));

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !this.state.isPaused && !this.state.isCompleted) {
        this.setPaused(true);
      }
    });

    window.addEventListener("beforeunload", () => {
      if (!this.state.isCompleted) flushState(this.state);
    });

    // ── 상태 복원 또는 새 게임 ─────────────────────
    const saved = loadState();
    if (saved && !saved.isCompleted) {
      this.state = saved;
      this.controls.setDifficulty(saved.difficulty);
      this.timer.start(saved.elapsedMs);
      if (saved.isPaused) {
        this.timer.stop();
        this.showPausedUI(true);
      }
      this.toast(`이어서 풀기 · ${formatTime(saved.elapsedMs)}`);
    } else {
      this.state = this.createGame("easy");
      this.timer.start(0);
    }

    this.render();
    this.tutorial.openIfFirstVisit();
  }

  private makeToolBtn(icon: string, label: string, key?: string, short?: string): HTMLButtonElement {
    const btn = el("button", "tool-btn");
    btn.type = "button";
    btn.title = key ? `${label} (${key})` : label;
    btn.setAttribute("aria-label", label);
    btn.innerHTML = `<span class="tool-icon">${icon}</span><span>${short ?? label}</span>`;
    return btn;
  }

  private createGame(difficulty: Difficulty): GameState {
    const { puzzle, solution } = generatePuzzle(difficulty);
    return createInitialState(difficulty, puzzle, solution);
  }

  /** 오늘의 문제 — 날짜 시드라 같은 날이면 누구에게나 같은 판 */
  private createDailyGame(): GameState {
    const date = todayKey();
    const { puzzle, solution } = generatePuzzle("medium", dailyRandom("sudoku"));
    return createInitialState("medium", puzzle, solution, { date });
  }

  private isDaily(): boolean {
    return this.state.daily === true && this.state.dailyDate === todayKey();
  }

  private switchMode(mode: "daily" | "free"): void {
    if (mode === "daily" && this.isDaily()) return;
    if (mode === "free" && !this.isDaily()) return;
    this.timer.stop();
    clearState();
    const game = mode === "daily" ? this.createDailyGame() : this.createGame(this.controls.getDifficulty());
    this.applyGame(game);
  }

  private renderDailyBar(): void {
    const daily = this.isDaily();
    this.dailyBarEl.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String((btn.dataset.mode === "daily") === daily));
    });
    const rec = getDaily("sudoku");
    const done = todayResult("sudoku") !== null;
    const streakEl = this.dailyBarEl.querySelector(".daily-streak")!;
    streakEl.innerHTML = daily
      ? `<span>연속 <strong>${activeStreak(rec)}</strong>일</span><span>최고 <strong>${rec.bestStreak}</strong>일</span>`
      : `<span>${DIFF_LABEL[this.state.difficulty]}</span>`;
    const dailyBtn = this.dailyBarEl.querySelector<HTMLButtonElement>('[data-mode="daily"]')!;
    dailyBtn.textContent = done ? "오늘의 문제 ✓" : "오늘의 문제";
    /* 오늘의 문제에서는 난이도를 고르지 않는다 */
    this.controls.setHidden(daily);
  }

  private dispatch(action: Action): void {
    const prev = this.state;
    this.state = reducer(this.state, action);
    if (prev === this.state) return;

    /* 입력 결과에 맞는 효과음 */
    if (action.type === "SET_VALUE" && this.state.mistakes > prev.mistakes) sfx.alert();
    else if (action.type === "SET_VALUE" || action.type === "SET_NOTE") sfx.tap();
    else if (action.type === "UNDO" || action.type === "REDO") sfx.undo();

    saveState(this.state);
    this.render();

    if (this.state.isCompleted && !prev.isCompleted) {
      this.timer.stop();
      clearState();
      setTimeout(() => this.showCompletedModal(), 400);
    } else if (this.state.isFailed && !prev.isFailed && !this.failShown) {
      this.failShown = true;
      this.timer.stop();
      setTimeout(() => this.showFailedModal(), 300);
    }
  }

  private onTick(ms: number): void {
    if (this.state.isPaused || this.state.isCompleted || this.state.isFailed) return;
    this.state = reducer(this.state, { type: "TICK", elapsedMs: ms });
    this.scoreboard.render(this.state);
  }

  private toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.remove("hidden");
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.add("hidden"), 1800);
  }

  private onErase(): void {
    this.board.inputNumber(0 as CellValue);
  }

  private onUndo(): void {
    if (this.state.past.length === 0) { this.toast(STR.nothingToUndo); return; }
    this.dispatch({ type: "UNDO" });
  }

  private onRedo(): void {
    if (this.state.future.length === 0) return;
    this.dispatch({ type: "REDO" });
  }

  private onAutoNotes(): void {
    this.dispatch({ type: "AUTO_NOTES" });
    this.toast(STR.autoNotesDone);
  }

  private onHint(): void {
    const idx = this.board.getSelectedIndex();
    if (idx === -1) { this.toast(STR.selectCellFirst); return; }
    const cell = this.state.board[idx];
    if (cell.given || cell.hinted || cell.value === this.state.solution[idx]) {
      this.toast(STR.hintOnFilled);
      return;
    }
    this.dispatch({ type: "USE_HINT", index: idx });
  }

  private toggleNoteMode(): void {
    this.noteMode = !this.noteMode;
    this.board.setNoteMode(this.noteMode);
    this.noteBtnEl.classList.toggle("active", this.noteMode);
    this.noteBtnEl.setAttribute("aria-pressed", String(this.noteMode));
  }

  private togglePause(): void {
    if (this.state.isCompleted || this.state.isFailed) return;
    this.setPaused(!this.state.isPaused);
  }

  private showPausedUI(paused: boolean): void {
    this.pauseOverlayEl.classList.toggle("hidden", !paused);
    this.pauseBtnEl.innerHTML = paused
      ? `<span class="tool-icon">▶</span><span>${STR.resumeShort}</span>`
      : `<span class="tool-icon">⏸</span><span>${STR.pauseShort}</span>`;
    this.pauseBtnEl.classList.toggle("active", paused);
    this.pauseBtnEl.setAttribute("aria-pressed", String(paused));
  }

  private setPaused(paused: boolean): void {
    if (paused === this.state.isPaused) return;
    if (paused) {
      this.dispatch({ type: "PAUSE" });
      this.timer.stop();
    } else {
      this.dispatch({ type: "RESUME" });
      this.timer.start(this.state.elapsedMs);
    }
    this.showPausedUI(paused);
  }

  /** 진행 중인 게임이 있으면 확인 후 새 게임 */
  private confirmNewGame(difficulty: Difficulty): void {
    const started = this.state.board.some((c, i) => !c.given && c.value !== this.state.puzzle[i]);
    if (!started || this.state.isCompleted || this.state.isFailed) {
      this.startNewGame(difficulty);
      return;
    }
    const content = el("div", "confirm-modal");
    content.innerHTML = `
      <p>${STR.newGameConfirm}</p>
      <div class="modal-btn-row">
        <button class="modal-btn-danger">${STR.startBtn}</button>
        <button class="modal-btn-cancel">${STR.cancel}</button>
      </div>`;
    content.querySelector(".modal-btn-danger")!.addEventListener("click", () => {
      this.modal.hide();
      this.startNewGame(difficulty);
    });
    content.querySelector(".modal-btn-cancel")!.addEventListener("click", () => this.modal.hide());
    this.modal.show(content, { dismissible: true, label: STR.newGame });
  }

  private applyGame(state: GameState): void {
    this.state = state;
    this.failShown = false;
    this.noteMode = false;
    this.board.setNoteMode(false);
    this.noteBtnEl.classList.remove("active");
    this.noteBtnEl.setAttribute("aria-pressed", "false");
    this.showPausedUI(false);
    saveState(this.state);
    this.timer.start(state.elapsedMs);
    this.render();
  }

  private startNewGame(difficulty: Difficulty): void {
    this.timer.stop();
    this.controls.setDifficulty(difficulty);

    const wrap = el("div", "generating-wrap",
      `<div class="generating-spinner"></div><div class="generating-text">${STR.generating}</div>`
    );
    this.modal.show(wrap, { label: STR.generating });

    setTimeout(() => {
      const game = this.createGame(difficulty);
      this.modal.hide();
      this.applyGame(game);
    }, 40);
  }

  /** 같은 문제를 처음부터 다시 */
  private retrySamePuzzle(): void {
    this.timer.stop();
    this.applyGame(createInitialState(this.state.difficulty, this.state.puzzle, this.state.solution));
  }

  private onReset(): void {
    const content = el("div", "confirm-modal");
    content.innerHTML = `
      <p>${STR.resetConfirm}</p>
      <div class="modal-btn-row">
        <button class="modal-btn-danger">${STR.resetBtn}</button>
        <button class="modal-btn-cancel">${STR.cancel}</button>
      </div>`;
    content.querySelector(".modal-btn-danger")!.addEventListener("click", () => {
      this.modal.hide();
      clearState();
      this.startNewGame(this.controls.getDifficulty());
    });
    content.querySelector(".modal-btn-cancel")!.addEventListener("click", () => this.modal.hide());
    this.modal.show(content, { dismissible: true, label: STR.reset });
  }

  private showFailedModal(): void {
    const content = el("div", "completed-modal");
    content.innerHTML = `
      <div class="modal-trophy">💥</div>
      <h2>${STR.failedTitle}</h2>
      <p class="completed-subtitle">${STR.failedMsg}</p>
      <button class="btn-play-again">${STR.keepPlaying}</button>
      <div class="modal-btn-row" style="margin-top:10px">
        <button class="modal-btn-cancel btn-retry">${STR.retrySame}</button>
        <button class="modal-btn-cancel btn-new">${STR.newGame}</button>
      </div>`;
    content.querySelector(".btn-play-again")!.addEventListener("click", () => {
      this.modal.hide();
      this.dispatch({ type: "LIFT_LIMIT" });
      this.timer.start(this.state.elapsedMs);
      this.toast("실수 제한을 해제했습니다");
    });
    content.querySelector(".btn-retry")!.addEventListener("click", () => {
      this.modal.hide();
      this.retrySamePuzzle();
    });
    content.querySelector(".btn-new")!.addEventListener("click", () => {
      this.modal.hide();
      this.startNewGame(this.state.difficulty);
    });
    this.modal.show(content, { label: STR.failedTitle });
  }

  private showCompletedModal(): void {
    if (this.isDaily()) recordDaily("sudoku", { solved: true, tries: this.state.mistakes + 1 });
    const isBest = saveBest(this.state.difficulty, this.state.elapsedMs);
    const best = loadBest(this.state.difficulty);

    const content = el("div", "completed-modal");
    content.innerHTML = `
      <div class="modal-trophy">🏆</div>
      <h2>${STR.completed}</h2>
      <p class="completed-subtitle">${isBest ? STR.newRecord : STR.completedMsg}</p>
      <div class="completed-stats">
        <div class="stat-row"><span>${STR.elapsedTime}</span><strong>${formatTime(this.state.elapsedMs)}</strong></div>
        <div class="stat-row"><span>${STR.finalScore}</span><strong>${this.state.score.toLocaleString()}</strong></div>
        <div class="stat-row"><span>${STR.totalMistakes}</span><strong>${this.state.mistakes}</strong></div>
        <div class="stat-row"><span>${STR.hintsUsed}</span><strong>${this.state.hintsUsed}${STR.times}</strong></div>
        ${best ? `<div class="stat-row"><span>${STR.best}</span><strong>${formatTime(best.value)}</strong></div>` : ""}
      </div>
      <button class="btn-play-again">${STR.playAgain}</button>`;
    content.querySelector(".btn-play-again")!.addEventListener("click", () => {
      this.modal.hide();
      this.startNewGame(this.state.difficulty);
    });
    sfx.win();
    this.modal.show(content, { label: STR.completed });
  }

  private onGlobalKeydown(e: KeyboardEvent): void {
    if (this.modal.isVisible() || this.tutorial.isOpen()) return;
    if (e.key === "?" || e.key === "F1") { e.preventDefault(); this.tutorial.open(); return; }
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;

    /* Ctrl+Z / Ctrl+Shift+Z (또는 Ctrl+Y) */
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) this.onRedo(); else this.onUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.onRedo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key) {
      case "ArrowUp": e.preventDefault(); this.board.moveSelection(-1, 0); return;
      case "ArrowDown": e.preventDefault(); this.board.moveSelection(1, 0); return;
      case "ArrowLeft": e.preventDefault(); this.board.moveSelection(0, -1); return;
      case "ArrowRight": e.preventDefault(); this.board.moveSelection(0, 1); return;
      case "Backspace": case "Delete": case "0":
        e.preventDefault(); this.onErase(); return;
      case " ": e.preventDefault(); this.togglePause(); return;
      case "Escape": if (this.state.isPaused) this.setPaused(false); return;
    }

    if (e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      this.board.inputNumber(parseInt(e.key, 10) as CellValue);
      return;
    }

    const k = e.key.toLowerCase();
    if (k === "n") { e.preventDefault(); this.toggleNoteMode(); }
    else if (k === "h") { e.preventDefault(); this.onHint(); }
    else if (k === "p") { e.preventDefault(); this.togglePause(); }
    else if (k === "z") { e.preventDefault(); this.onUndo(); }
    else if (k === "y") { e.preventDefault(); this.onRedo(); }
  }

  private render(): void {
    this.renderDailyBar();
    this.board.render(this.state);
    this.scoreboard.render(this.state);
    this.numpad.update(this.state);
    this.undoBtnEl.disabled = this.state.past.length === 0;
    this.redoBtnEl.disabled = this.state.future.length === 0;
  }
}

new App();

registerServiceWorker(HUB_HREF);
