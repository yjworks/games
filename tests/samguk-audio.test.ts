import { describe, expect, it } from 'vitest';
import { battleCue } from '../src/games/samguk/audio';

describe('천하삼분 전투 효과음', () => {
  it('전투 기록 줄마다 맞는 효과음을 고른다', () => {
    expect(battleCue('하후돈 → 여포: 공격 −320 (반격 −90)')).not.toBeNull();
    expect(battleCue('하후연 → 장료: 사격 −210')).not.toBeNull();
    expect(battleCue('조인 → 성문: −140')).not.toBeNull();
    expect(battleCue('조인 → 성문: −140 — 성문이 무너졌다!')).not.toBeNull();
    expect(battleCue('순욱의 화계가 실패했다.')).toBeNull();
    expect(battleCue('3일째 — 날씨가 비로 바뀌었다.')).toBeNull();
  });
});
