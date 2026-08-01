// Plain id-addressed divs toggled with .hidden (house pattern) — overlay,
// moment caption + chips, toast queue, interaction prompt. No framework.
export function initUI(G) {
  const el = id => document.getElementById(id);
  const overlay = el('overlay'), promptEl = el('prompt'), toastEl = el('toast');
  const nameEl = el('momentName'), bar = el('moments'), hud = el('hud');

  const chips = [];
  const queue = [];
  let toastT = 0;
  let promptShown = null;

  G.ui = {
    buildChips(moments) {
      moments.forEach((m, i) => {
        const b = document.createElement('button');
        b.className = 'chip';
        b.innerHTML = `<span>${i + 1}</span>${m.name}`;
        b.addEventListener('click', () => G.setMoment(i));
        bar.appendChild(b);
        chips.push(b);
      });
    },

    setMoment(m, idx) {
      nameEl.innerHTML = `${m.name} <i>· ${m.area}</i>`;
      chips.forEach((c, i) => c.classList.toggle('active', i === idx));
    },

    prompt(html) {
      if (html === promptShown) return;
      promptShown = html;
      if (html) { promptEl.innerHTML = html; promptEl.classList.remove('hidden'); }
      else promptEl.classList.add('hidden');
    },

    /* toasts queue rather than clobber — blurbs are worth reading out */
    toast(msg, secs = 2.6) {
      queue.push({ msg, secs });
    },

    update(dt) {
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0) toastEl.classList.add('hidden');
      }
      if (toastT <= 0 && queue.length) {
        const t = queue.shift();
        toastEl.textContent = t.msg;
        toastEl.classList.remove('hidden');
        toastEl.style.animation = 'none';   // restart the pop animation
        void toastEl.offsetWidth;
        toastEl.style.animation = '';
        toastT = t.secs;
      }
    },

    showHUD() {
      hud.classList.remove('hidden');
      bar.classList.remove('hidden');
    },

    hideOverlay() {
      overlay.style.transition = 'opacity .5s ease';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.classList.add('hidden'), 500);
    },
  };
}
