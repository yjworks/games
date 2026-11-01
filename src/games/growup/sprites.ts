import type { Expression } from './engine';
import { FieldKey, Stage } from './types';

/**
 * 픽셀 스프라이트 — 글자 한 칸이 픽셀 하나. '.'은 투명.
 * 아이·친구·소품을 모두 같은 방식으로 그려 블록 마을과 초상화가 같은 그림이 된다.
 */
export type Rows = string[];
export type Palette = Record<string, string>;

export const SKIN = '#ffd9bf';

/* ── 사람 (폭 14) ── */
const HEAD: Rows = [
  '...HHHHHHHH...',
  '..HHHHHHHHHH..',
  '.HHHHHHHHHHHH.',
  '.HHSSSSSSSSHH.',
  '.HSSSSSSSSSSH.',
  '.HSSEESSEESSH.',
  '.HSSEESSEESSH.',
  '..SCSSSSSSCS..',
  '..SSSSMMSSSS..',
  '...SSSSSSSS...',
];

/** 표정별로 바꿔 끼우는 줄 (줄 번호 → 내용) */
const FACE: Record<Expression, Record<number, string>> = {
  normal: {},
  happy: {
    5: '.HSSESSSSESSH.',
    6: '.HSESESSESESH.',
    8: '..SSSMMMMSSS..',
    9: '...SSSMMSSS...',
  },
  tired: {
    5: '.HSSSSSSSSSSH.',
    6: '.HSSEESSEESSH.',
    8: '..SSSSSSSSSS..',
    9: '...SSSMMSSS...',
  },
  sad: {
    7: '..SCWSSSSSCS..',
    8: '..SSSSMMSSSS..',
    9: '...SSMSSMSS...',
  },
  sick: {
    5: '.HSESSSSSSESH.',
    6: '.HSSESSSSESSH.',
    7: '..SGSSSSSSGS..',
    8: '..SSSMSMSSSS..',
  },
};

const TEE_TOP = ['...TTTTTTTT...', '..TTTTTTTTTT..'];
const ARM = '.STTTTTTTTTTS.';
const UNI_TOP = ['...TTKKKKTT...', '..TTTKRRKTTT..', '.TTTTTRRTTTTT.'];
const UNI_ARM = ['.STTTTRRTTTTS.', '.STTTTTTTTTTS.'];

function legs(stage: Stage, frame: 0 | 1): Rows {
  const leg = '...PPP..PPP...';
  const out = ['...PPPPPPPP...'];
  for (let i = 0; i < stage; i++) out.push(leg);
  out.push(frame ? '..PPP....PPP..' : leg);
  out.push(frame ? '..BBB....BBB..' : '...BBB..BBB...');
  return out;
}

export interface PersonOpts {
  hair: string;
  /** 0 짧은 머리 · 1 긴 머리 · 2 묶은 머리 */
  style: number;
  stage: Stage;
  expr: Expression;
  frame?: 0 | 1;
  /** 있으면 사복(티셔츠) — 친구들. 없으면 학교급에 맞는 옷(초등 티셔츠, 중·고 교복) */
  shirt?: string;
}

export function personRows({ style, stage, expr, frame = 0, shirt }: PersonOpts): Rows {
  const head = HEAD.map((r, i) => FACE[expr][i] ?? r);
  let body: Rows;
  if (shirt || stage === 0) {
    body = [...TEE_TOP, ...Array(2 + stage).fill(ARM), ...legs(stage, frame)];
  } else {
    body = [...UNI_TOP, ...(stage === 2 ? [UNI_ARM[0], ...UNI_ARM] : UNI_ARM), ...legs(stage, frame)];
  }
  const rows = [...head, ...body].map((r) => r.split(''));
  if (style === 1) {
    /* 긴 머리 — 얼굴 옆과 어깨까지 */
    for (let y = 7; y < 13; y++) { rows[y][1] = 'H'; rows[y][12] = 'H'; }
  } else if (style === 2) {
    /* 묶은 머리 — 오른쪽으로 꽁지 */
    rows[2][13] = 'r';
    for (let y = 3; y < 8; y++) rows[y][13] = 'H';
  }
  return rows.map((r) => r.join(''));
}

const UNIFORM = [
  { T: '#f6c445', K: '#f4f4f8', R: '#c9403f', P: '#3a4a6a' },
  { T: '#34497e', K: '#f4f4f8', R: '#c9403f', P: '#2a3350' },
  { T: '#2f5c4c', K: '#f4f4f8', R: '#d9a53c', P: '#2f3a3a' },
];

export function personPalette({ hair, stage, shirt }: PersonOpts): Palette {
  const u = UNIFORM[stage];
  return {
    H: hair, S: SKIN, C: '#ff9aa8', E: '#2a2230', M: '#c94a5a', W: '#8fd0ff', G: '#b8d8a0', r: '#ff6b8a',
    T: shirt ?? u.T, K: u.K, R: u.R, P: shirt ? '#3a4a6a' : u.P, B: '#4a3020',
  };
}

/* ── 소품 (10×10) — 집 앞에 관심 분야를 보여 준다 ── */
interface Prop { rows: Rows; pal: Palette }

export const FIELD_PROPS: Record<FieldKey, Prop> = {
  it: {
    pal: { K: '#2a2f3a', B: '#1d4f7a', G: '#7fe0a8', W: '#a8743a' },
    rows: ['..........', '.KKKKKKKK.', '.KBBBBBBK.', '.KBGBGGBK.', '.KBBBBBBK.', '.KKKKKKKK.', '....KK....', '..KKKKKK..', '.WWWWWWWW.', '.W......W.'],
  },
  eng: {
    pal: { R: '#ff5050', G: '#9aa4b0', C: '#5fe0ff', D: '#3a4048' },
    rows: ['....RR....', '....GG....', '.GGGGGGGG.', '.GCGGGGCG.', '.GGGGGGGG.', '.GGDDDDGG.', '..GGGGGG..', '.GGGGGGGG.', '.G.GGGG.G.', '...G..G...'],
  },
  sci: {
    pal: { B: '#4a6fd0', W: '#d8e4ff', G: '#7a7f8a' },
    rows: ['........WB', '......BBB.', '....BBB...', '..BBB.....', '..B..G....', '.....G....', '....G.G...', '...G...G..', '..G.....G.', '..........'],
  },
  med: {
    pal: { G: '#9aa4b0', W: '#f4f4f8', R: '#e04848' },
    rows: ['..........', '...GGGG...', '...G..G...', '.WWWWWWWW.', '.WWWRRWWW.', '.WWRRRRWW.', '.WWRRRRWW.', '.WWWRRWWW.', '.WWWWWWWW.', '..........'],
  },
  art: {
    pal: { W: '#8a5a30', C: '#f6ecd6', P: '#ff7aa2', B: '#4a8af0', Y: '#f6c445', G: '#4fbf6b' },
    rows: ['....W.....', '.CCCCCCCC.', '.CPPCCBBC.', '.CPPCYYBC.', '.CCGGGCCC.', '.CCCCCCCC.', '..W....W..', '..W....W..', '.W......W.', '.W......W.'],
  },
  music: {
    pal: { K: '#1d1a22', W: '#f4f4f8', N: '#f6c445' },
    rows: ['.......N..', '.......NN.', '.KKKKKKKK.', '.KKKKKKKK.', '.WKWKWWKW.', '.WWWWWWWW.', '.KKKKKKKK.', '.K......K.', '.K......K.', '.K......K.'],
  },
  write: {
    pal: { W: '#8a5a30', R: '#d04848', B: '#4a6fd0', G: '#4fbf6b', Y: '#f6c445' },
    rows: ['WWWWWWWWWW', 'WRBGYRBGYW', 'WRBGYRBGYW', 'WWWWWWWWWW', 'WGYRBGYRBW', 'WGYRBGYRBW', 'WWWWWWWWWW', 'WBRYGBRYGW', 'WBRYGBRYGW', 'WWWWWWWWWW'],
  },
  food: {
    pal: { S: '#d8dde4', G: '#4a4f58', O: '#ff8a3c', Y: '#f6d045', R: '#e04848' },
    rows: ['...S.S....', '....S.S...', '..........', '.GGGGGGGG.', 'GGGGGGGGGG', '.GGGGGGGG.', '.GGGGGGGG.', '..GGGGGG..', '..OYROYR..', '..........'],
  },
  sport: {
    pal: { W: '#f4f4f8', K: '#1d1a22' },
    rows: ['..........', '..........', '...WWWW...', '..WWKKWW..', '.WWKKKKWW.', '.WKWWWWKW.', '.WWWKKWWW.', '..WWKKWW..', '...WWWW...', '..........'],
  },
  biz: {
    pal: { O: '#9a6030', B: '#5a3418', Y: '#f6c445' },
    rows: ['..........', '..........', '.OOOOOOOO.', '.OBBBBBBO.', '.OOOOOOOO.', '.OOOYYOOO.', '.OOOYYOOO.', '.OOOOOOOO.', '.OBBBBBBO.', '..........'],
  },
  edu: {
    pal: { W: '#8a5a30', G: '#2f6a4a', T: '#f4f4f8' },
    rows: ['.WWWWWWWW.', '.WGGGGGGW.', '.WGTGGTGW.', '.WGGTTGGW.', '.WGGGGGGW.', '.WWWWWWWW.', '...W..W...', '...W..W...', '..W....W..', '..W....W..'],
  },
};

export const TROPHY: Prop = {
  pal: { Y: '#f2c230', L: '#fff0a0', B: '#5a3418' },
  rows: ['..........', 'Y.YYYYYY.Y', 'Y.YLYYYY.Y', '.YYLYYYYY.', '..YYYYYY..', '...YYYY...', '....YY....', '....YY....', '..BBBBBB..', '..BBBBBB..'],
};

/* ── 그리기 ── */
export function drawRows(ctx: CanvasRenderingContext2D, rows: Rows, pal: Palette, x: number, y: number, scale = 1, flip = false) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const c = row[flip ? row.length - 1 - i : i];
      if (c === '.' || c === ' ') continue;
      const col = pal[c];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x + i * scale), Math.round(y + j * scale), scale, scale);
    }
  }
}

export function drawProp(ctx: CanvasRenderingContext2D, p: Prop, x: number, y: number, scale = 1) {
  drawRows(ctx, p.rows, p.pal, x, y, scale);
}

export function drawPerson(ctx: CanvasRenderingContext2D, o: PersonOpts, x: number, y: number, scale = 1, flip = false) {
  drawRows(ctx, personRows(o), personPalette(o), x, y, scale, flip);
}

export const PERSON_W = 14;
export const personHeight = (stage: Stage) => personRows({ hair: '', style: 0, stage, expr: 'normal' }).length;
