import { Stage } from './types';

/** 초1 3월부터 고3 2월까지 12년 = 144달 */
export const TOTAL_TURNS = 144;

export interface Calendar {
  /** 0 = 초1 … 11 = 고3 */
  grade: number;
  gradeLabel: string;
  month: number;
  stage: Stage;
  vacation: boolean;
  season: '봄' | '여름' | '가을' | '겨울';
  /** 학년의 마지막 달(2월) */
  yearEnd: boolean;
}

export function gradeLabel(grade: number): string {
  if (grade < 6) return `초${grade + 1}`;
  if (grade < 9) return `중${grade - 5}`;
  return `고${grade - 8}`;
}

export function stageOf(grade: number): Stage {
  return grade < 6 ? 0 : grade < 9 ? 1 : 2;
}

export const STAGE_LABEL = ['초등학생', '중학생', '고등학생'] as const;

export function calendar(turn: number): Calendar {
  const t = Math.min(Math.max(turn, 0), TOTAL_TURNS - 1);
  const grade = Math.floor(t / 12);
  const idx = t % 12;
  const month = ((idx + 2) % 12) + 1;
  const season = month >= 3 && month <= 5 ? '봄' : month <= 8 && month >= 6 ? '여름' : month >= 9 && month <= 11 ? '가을' : '겨울';
  return {
    grade,
    gradeLabel: gradeLabel(grade),
    month,
    stage: stageOf(grade),
    vacation: month === 1 || month === 2 || month === 8,
    season,
    yearEnd: idx === 11,
  };
}

export const whenLabel = (turn: number) => {
  const c = calendar(turn);
  return `${c.gradeLabel} ${c.month}월`;
};
