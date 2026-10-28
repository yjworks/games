/** 받침에 맞춰 조사를 붙인다: jo('조조', '이가') → '조조가' */
export type Josa = '이가' | '을를' | '은는' | '과와' | '로';

export function jo(word: string, j: Josa): string {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) {
    return word + ({ 이가: '이(가)', 을를: '을(를)', 은는: '은(는)', 과와: '과(와)', 로: '(으)로' } as const)[j];
  }
  const jong = (ch - 0xac00) % 28;
  if (j === '로') return word + (jong === 0 || jong === 8 ? '로' : '으로'); // ㄹ 받침은 '로'
  const has = jong !== 0;
  const [a, b] = ({ 이가: ['이', '가'], 을를: ['을', '를'], 은는: ['은', '는'], 과와: ['과', '와'] } as const)[j];
  return word + (has ? a : b);
}
