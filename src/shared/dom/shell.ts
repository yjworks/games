import { GameMeta, HUB_HREF } from '../registry';
import { getPrefs, setPrefs } from '../prefs';
import { createDbHome } from '../brand';

/**
 * React를 쓰지 않는 게임(스도쿠)용 공통 상단 바.
 * GameShell.tsx와 같은 마크업/클래스를 사용한다.
 */
export function mountShellBar(meta: GameMeta, extraActions: HTMLElement[] = []): HTMLElement {
  document.title = `${meta.title} · 딴짓`;

  const bar = document.createElement('header');
  bar.className = 'db-bar shell-bar';
  bar.style.setProperty('--shell-accent', meta.accent);

  const back = document.createElement('a');
  back.className = 'shell-back';
  back.href = HUB_HREF;
  back.textContent = '← 게임 목록';

  const title = document.createElement('div');
  title.className = 'shell-title';
  title.innerHTML = `<h1>${meta.emoji} ${meta.title}</h1><span class="shell-sub">${meta.subtitle}</span>`;

  const actions = document.createElement('div');
  actions.className = 'shell-actions';
  extraActions.forEach((el) => actions.appendChild(el));

  const soundBtn = document.createElement('button');
  soundBtn.className = 'db-btn shell-btn';
  soundBtn.type = 'button';
  const paint = () => {
    const on = getPrefs().sound;
    soundBtn.textContent = on ? '🔊' : '🔈';
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? '효과음 끄기' : '효과음 켜기');
  };
  soundBtn.addEventListener('click', () => { setPrefs({ sound: !getPrefs().sound }); paint(); });
  paint();
  actions.appendChild(soundBtn);

  bar.append(createDbHome(), back, title, actions);
  return bar;
}
