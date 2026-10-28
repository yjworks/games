/**
 * 그려 둔 초상 그림을 쓸 인물 목록. 비어 있으면 모든 인물을 코드로 그린다(ui/art/Portrait.tsx).
 *
 * 쓰는 법: 그림을 public/samguk/portraits/<id>.webp 로 넣고(정사각형, 256px 이상 권장)
 * 아래에 `caocao: P('caocao'),` 처럼 한 줄 추가한다. 파일은 서비스 워커가 처음 쓸 때 캐시한다.
 * 그림의 저작권은 넣는 사람이 확인해야 한다(다른 게임의 그림은 넣지 말 것).
 */
const P = (id: string) => `../../samguk/portraits/${id}.webp`;
void P;

export const PORTRAIT_FILES: Record<string, string> = {};
