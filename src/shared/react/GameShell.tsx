import { ReactNode, useCallback, useEffect, useState } from 'react';
import { GameMeta, HUB_HREF } from '../registry';
import { getPrefs, setPrefs } from '../prefs';
import { TutorialContent, hasSeenTutorial, markTutorialSeen } from '../tutorial';
import { TutorialOverlay } from './Tutorial';
import { GameMark } from './GameMark';
import { DB_HOME_HREF, DB_HOME_LABEL, DB_MARK_SVG } from '../brand';

/** 공통 상단 바 왼쪽 브랜드 마크 — 누르면 DigitalBrain 첫 화면으로 간다 */
export function DbHome() {
  return (
    <a className="db-home" href={DB_HOME_HREF} aria-label={DB_HOME_LABEL}
      dangerouslySetInnerHTML={{ __html: DB_MARK_SVG }} />
  );
}

/** 전역 효과음 토글 (모든 게임이 같은 설정을 공유한다) */
export function SoundButton() {
  const [on, setOn] = useState(getPrefs().sound);
  return (
    <button
      className="db-btn shell-btn"
      aria-pressed={on}
      aria-label={on ? '효과음 끄기' : '효과음 켜기'}
      title={on ? '효과음 끄기' : '효과음 켜기'}
      onClick={() => { const next = !on; setOn(next); setPrefs({ sound: next }); }}
    >
      {on ? '🔊' : '🔈'}
    </button>
  );
}

interface Props {
  meta: GameMeta;
  /** 있으면 헤더에 도움말 버튼이 생기고, 첫 방문 때 자동으로 열린다 */
  tutorial?: TutorialContent;
  /** 상단 우측 추가 버튼 */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * 모든 게임 화면의 공통 껍데기.
 * 허브 링크 · 제목 · 도움말 · 전역 효과음 토글을 한곳에서 처리한다.
 */
export function GameShell({ meta, tutorial, actions, children }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    document.title = `${meta.title} · 딴짓`;
    if (tutorial && !hasSeenTutorial(meta.id)) setHelpOpen(true);
  }, [meta.id, meta.title, tutorial]);

  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    markTutorialSeen(meta.id);
  }, [meta.id]);

  /* 어디서든 ? 또는 F1으로 도움말 */
  useEffect(() => {
    if (!tutorial) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === '?' || e.key === 'F1') { e.preventDefault(); setHelpOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tutorial]);

  return (
    <div className="game-shell" style={{ ['--shell-accent' as string]: meta.accent }}>
      <header className="db-bar shell-bar">
        <DbHome />
        <a className="shell-back" href={HUB_HREF}>← 게임 목록</a>
        <div className="shell-title">
          <h1><GameMark id={meta.id} size={22} className="shell-mark" />{meta.title}</h1>
          <span className="shell-sub">{meta.subtitle}</span>
        </div>
        <div className="shell-actions">
          {actions}
          {tutorial && (
            <button className="db-btn shell-btn" onClick={() => setHelpOpen(true)}
              aria-label="게임 방법" title="게임 방법 (?)">?</button>
          )}
          <SoundButton />
        </div>
      </header>

      <div className="game-body">{children}</div>

      {tutorial && (
        <TutorialOverlay meta={meta} content={tutorial} open={helpOpen} onClose={closeHelp} />
      )}
    </div>
  );
}
