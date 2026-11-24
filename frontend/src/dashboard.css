/* Dashboard Admin & Relawan SirkulaAI.
   Memakai token dari styles.css (--ink, --paper, --brand, dst.), semua kelas berawalan sk-. */

.sk-root {
  --sk-ink: var(--ink, #0e2f33);
  --sk-paper: var(--paper, #f2f5f3);
  --sk-surface: var(--surface, #ffffff);
  --sk-line: var(--line, #d5ddd9);
  --sk-muted: var(--muted, #5b6f6c);
  --sk-brand: var(--brand, #0f5e5a);
  --sk-brand-dark: var(--brand-dark, #0a4643);
  --sk-parah: var(--parah, #cf3f2b);
  --sk-sedang: var(--sedang, #e19a1a);
  --sk-ringan: var(--ringan, #3f9a66);
  --sk-display: 'Bricolage Grotesque', 'Public Sans', system-ui, sans-serif;
  font-family: 'Public Sans', system-ui, sans-serif;
  color: var(--sk-ink);
  line-height: 1.5;
}

.sk-root *,
.sk-root *::before,
.sk-root *::after { box-sizing: border-box; }

.sk-root h1,
.sk-root h2,
.sk-root h3 { font-family: var(--sk-display); margin: 0; letter-spacing: -0.01em; line-height: 1.2; }
.sk-root p { margin: 0; }

/* ---------- Tombol & chip ---------- */
.sk-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 42px; padding: 0 16px; border-radius: 8px;
  border: 1px solid transparent; font-weight: 600; font-size: 0.9rem;
  text-decoration: none; cursor: pointer; background: transparent; color: inherit;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.sk-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.sk-btn--primary { background: var(--sk-brand); color: #fff; }
.sk-btn--primary:hover:not(:disabled) { background: var(--sk-brand-dark); }
.sk-btn--ghost { border-color: var(--sk-line); background: var(--sk-surface); color: var(--sk-ink); }
.sk-btn--ghost:hover:not(:disabled) { border-color: var(--sk-brand); }
.sk-btn--danger { border-color: var(--sk-parah); color: #a52f1e; background: var(--sk-surface); }
.sk-btn--danger:hover:not(:disabled) { background: #fbe5e1; }
.sk-btn--block { width: 100%; }
.sk-btn--sm { min-height: 36px; padding: 0 12px; font-size: 0.84rem; }
.sk-icon { width: 18px; height: 18px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.sk-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 99px;
  font-size: 0.78rem; font-weight: 600; background: #e4ebe8; color: #3b514e; white-space: nowrap;
}
.sk-chip--ringan { background: #e3f2e9; color: #276a46; }
.sk-chip--sedang { background: #fcefd2; color: #8a5a00; }
.sk-chip--parah { background: #fbe5e1; color: #a52f1e; }
.sk-chip--ok { background: #e3f2e9; color: #276a46; }
.sk-chip--wait { background: #fcefd2; color: #8a5a00; }
.sk-chip--bad { background: #fbe5e1; color: #a52f1e; }

.sk-field { display: grid; gap: 6px; }
.sk-field label { font-size: 0.84rem; font-weight: 600; }
.sk-input {
  width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 8px;
  border: 1px solid var(--sk-line); background: var(--sk-surface); font: inherit; color: inherit;
}
.sk-input:focus-visible { outline: 3px solid #2563eb; outline-offset: 1px; }
.sk-hint { font-size: 0.82rem; color: var(--sk-muted); }

.sk-seg { display: inline-flex; padding: 3px; border-radius: 10px; background: #e4ebe8; gap: 2px; max-width: 100%; overflow-x: auto; }
.sk-seg button {
  border: 0; background: transparent; padding: 7px 14px; border-radius: 8px;
  font-weight: 600; font-size: 0.86rem; color: var(--sk-muted); white-space: nowrap; cursor: pointer;
}
.sk-seg button[aria-pressed='true'] { background: var(--sk-surface); color: var(--sk-ink); box-shadow: 0 1px 2px rgba(14, 47, 51, 0.12); }

.sk-notice { padding: 12px 16px; border-radius: 10px; font-size: 0.9rem; font-weight: 600; border: 1px solid; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.sk-notice--ok { background: #e3f2e9; color: #1f5a3a; border-color: #b6dcc5; }
.sk-notice--err { background: #fbe5e1; color: #8f2a1b; border-color: #f0bdb4; }
.sk-notice--info { background: #fcefd2; color: #6e4700; border-color: #f1d79b; }
.sk-notice button { border: 0; background: transparent; cursor: pointer; padding: 0; color: inherit; display: inline-flex; }

.sk-empty { padding: 28px 20px; border: 1px dashed var(--sk-line); border-radius: 12px; background: var(--sk-surface); color: var(--sk-muted); display: grid; gap: 4px; }
.sk-empty strong { color: var(--sk-ink); font-family: var(--sk-display); font-size: 1.05rem; }

/* ---------- Lightbox ---------- */
.sk-lightbox {
  position: fixed; inset: 0; z-index: 1000; background: rgba(8, 24, 26, 0.88);
  display: flex; align-items: center; justify-content: center; padding: 24px; animation: sk-fade 0.15s ease-out;
}
.sk-lightbox img { max-width: 100%; max-height: 100%; border-radius: 8px; object-fit: contain; background: #0b1c1e; }
.sk-lightbox__close { position: absolute; top: calc(14px + env(safe-area-inset-top)); right: 14px; width: 44px; height: 44px; border-radius: 99px; border: 0; background: rgba(255, 255, 255, 0.16); color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.sk-lightbox__link { position: absolute; bottom: calc(16px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); color: #fff; font-size: 0.86rem; background: rgba(255, 255, 255, 0.16); padding: 8px 14px; border-radius: 99px; text-decoration: none; }
@keyframes sk-fade { from { opacity: 0; } to { opacity: 1; } }

/* ---------- Admin: kerangka ---------- */
.sk-admin { min-height: 100dvh; display: grid; grid-template-columns: 252px minmax(0, 1fr); background: var(--sk-paper); }
.sk-rail {
  position: sticky; top: 0; height: 100dvh; background: var(--sk-ink); color: #dcebe8;
  padding: 22px 14px; display: flex; flex-direction: column; gap: 22px;
}
.sk-rail__brand { padding: 0 8px; display: grid; gap: 2px; }
.sk-rail__brand h1 { color: #fff; font-size: 1.35rem; }
.sk-rail__brand span { font-size: 0.82rem; color: #93b3ae; }
.sk-nav { display: grid; gap: 4px; }
.sk-nav button {
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 0 12px;
  border: 0; border-left: 3px solid transparent; border-radius: 8px; background: transparent;
  color: inherit; font-weight: 600; font-size: 0.92rem; text-align: left; cursor: pointer;
}
.sk-nav button:hover { background: rgba(255, 255, 255, 0.06); }
.sk-nav button[aria-current='page'] { background: rgba(255, 255, 255, 0.1); border-left-color: #7fd6cc; color: #fff; }
.sk-nav__count { margin-left: auto; min-width: 24px; padding: 1px 8px; border-radius: 99px; background: #e19a1a; color: #3a2600; font-size: 0.76rem; font-weight: 700; text-align: center; }
.sk-rail__foot { margin-top: auto; display: grid; gap: 8px; padding: 0 4px; }
.sk-rail__who { font-size: 0.8rem; color: #93b3ae; padding: 0 8px; overflow-wrap: anywhere; }
.sk-rail__foot .sk-btn { justify-content: flex-start; border-color: rgba(255, 255, 255, 0.2); color: #fff; background: transparent; }
.sk-rail__foot .sk-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }

.sk-main { padding: 26px clamp(16px, 3vw, 36px) 48px; display: grid; gap: 18px; align-content: start; min-width: 0; }
.sk-main__head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.sk-main__head h2 { font-size: 1.6rem; }
.sk-main__head p { color: var(--sk-muted); font-size: 0.92rem; margin-top: 2px; }

/* ---------- Admin: antrean laporan ---------- */
.sk-queue { display: grid; grid-template-columns: minmax(280px, 350px) minmax(0, 1fr); gap: 16px; align-items: start; }
.sk-list { display: grid; gap: 8px; max-height: calc(100dvh - 210px); overflow-y: auto; padding-right: 2px; }
.sk-item {
  display: grid; grid-template-columns: 68px minmax(0, 1fr); gap: 12px; width: 100%; padding: 10px 12px 10px 10px;
  border: 1px solid var(--sk-line); border-left: 5px solid var(--sk-line); border-radius: 10px;
  background: var(--sk-surface); text-align: left; cursor: pointer; color: inherit;
}
.sk-item:hover { border-color: var(--sk-brand); }
.sk-item[aria-pressed='true'] { border-color: var(--sk-brand); box-shadow: 0 0 0 1px var(--sk-brand); }
.sk-item--ringan { border-left-color: var(--sk-ringan); }
.sk-item--sedang { border-left-color: var(--sk-sedang); }
.sk-item--parah { border-left-color: var(--sk-parah); }
.sk-thumb { width: 68px; height: 68px; border-radius: 8px; background: #dfe8e5; object-fit: cover; display: flex; align-items: center; justify-content: center; color: #7d918d; overflow: hidden; }
.sk-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sk-item__body { display: grid; gap: 4px; align-content: center; min-width: 0; }
.sk-item__title { font-weight: 600; font-size: 0.92rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.sk-item__meta { font-size: 0.78rem; color: var(--sk-muted); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.sk-detail { background: var(--sk-surface); border: 1px solid var(--sk-line); border-radius: 12px; overflow: hidden; }
.sk-photo { position: relative; display: block; width: 100%; aspect-ratio: 16 / 10; max-height: 460px; border: 0; padding: 0; background: #dfe8e5; cursor: zoom-in; }
.sk-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sk-photo__badge { position: absolute; right: 12px; bottom: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 99px; background: rgba(8, 24, 26, 0.78); color: #fff; font-size: 0.8rem; font-weight: 600; }
.sk-photo--empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #52666a; cursor: default; text-align: center; padding: 20px; }
.sk-detail__body { padding: 18px 20px 20px; display: grid; gap: 18px; }
.sk-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px 20px; margin: 0; }
.sk-facts dt { font-size: 0.78rem; color: var(--sk-muted); font-weight: 600; }
.sk-facts dd { margin: 2px 0 0; font-size: 0.92rem; overflow-wrap: anywhere; }
.sk-facts a { color: var(--sk-brand); font-weight: 600; }

.sk-ai { padding: 12px 14px; border-radius: 10px; border-left: 5px solid var(--sk-line); background: #f4f7f6; display: grid; gap: 4px; }
.sk-ai--yes { border-left-color: var(--sk-ringan); background: #eef7f1; }
.sk-ai--no { border-left-color: var(--sk-parah); background: #fdf0ed; }
.sk-ai--unsure { border-left-color: var(--sk-sedang); background: #fdf6e6; }
.sk-ai strong { font-size: 0.92rem; }
.sk-ai p { font-size: 0.88rem; color: #33494a; }

.sk-sevgroup { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.sk-sev { display: grid; gap: 2px; padding: 10px 12px; text-align: left; border: 2px solid var(--sk-line); border-radius: 10px; background: var(--sk-surface); cursor: pointer; color: inherit; }
.sk-sev strong { font-size: 0.95rem; display: flex; justify-content: space-between; gap: 6px; }
.sk-sev span { font-size: 0.78rem; color: var(--sk-muted); }
.sk-sev[aria-checked='true'].sk-sev--ringan { border-color: var(--sk-ringan); background: #eef7f1; }
.sk-sev[aria-checked='true'].sk-sev--sedang { border-color: var(--sk-sedang); background: #fdf6e6; }
.sk-sev[aria-checked='true'].sk-sev--parah { border-color: var(--sk-parah); background: #fdf0ed; }
.sk-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.sk-actions .sk-btn--primary { flex: 2 1 200px; }
.sk-actions .sk-btn--danger { flex: 1 1 120px; }

/* ---------- Admin: daftar baris (tugas, relawan) ---------- */
.sk-rows { display: grid; gap: 10px; }
.sk-row { display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 12px 14px; background: var(--sk-surface); border: 1px solid var(--sk-line); border-radius: 12px; }
.sk-row--plain { grid-template-columns: 44px minmax(0, 1fr) auto; }
.sk-row .sk-thumb { width: 96px; height: 80px; border: 0; padding: 0; cursor: zoom-in; }
.sk-row__title { font-weight: 700; font-family: var(--sk-display); font-size: 1.02rem; }
.sk-row__sub { font-size: 0.85rem; color: var(--sk-muted); }
.sk-row__text { display: grid; gap: 4px; min-width: 0; }
.sk-row__btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.sk-avatar { width: 44px; height: 44px; border-radius: 99px; background: #d7e8e4; color: var(--sk-brand-dark); font-weight: 700; font-family: var(--sk-display); display: inline-flex; align-items: center; justify-content: center; }

.sk-panel { background: var(--sk-surface); border: 1px solid var(--sk-line); border-radius: 12px; padding: 22px; display: grid; gap: 14px; max-width: 520px; }

/* ---------- Login admin ---------- */
.sk-login { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--sk-ink); }
.sk-login__box { width: 100%; max-width: 400px; padding: 28px; border-radius: 14px; background: #fff; display: grid; gap: 16px; }
.sk-login__box h1 { font-size: 1.5rem; }

/* ---------- Relawan ---------- */
.sk-vol { max-width: 980px; margin: 0 auto; padding: 16px 16px 48px; display: grid; gap: 16px; }
.sk-vhead { background: var(--sk-ink); color: #fff; border-radius: 14px; padding: 20px 22px; display: grid; gap: 16px; }
.sk-vhead__top { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
.sk-vhead h2 { font-size: 1.55rem; }
.sk-vhead__chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.sk-vhead .sk-chip { background: rgba(255, 255, 255, 0.14); color: #fff; }
.sk-vhead .sk-chip--ok { background: #2f8a5b; }
.sk-vhead .sk-chip--wait { background: #e19a1a; color: #3a2600; }
.sk-vhead .sk-btn { border-color: rgba(255, 255, 255, 0.35); color: #fff; }
.sk-vhead .sk-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
.sk-xp { display: grid; gap: 6px; }
.sk-xp__bar { height: 8px; border-radius: 99px; background: rgba(255, 255, 255, 0.18); overflow: hidden; }
.sk-xp__bar span { display: block; height: 100%; background: #7fd6cc; border-radius: 99px; }
.sk-xp p { font-size: 0.84rem; color: #b9d3cf; }

.sk-vtabs { position: sticky; top: 0; z-index: 5; background: var(--sk-paper); padding: 4px 0; }
.sk-vtabs .sk-seg { display: flex; width: 100%; }
.sk-vtabs .sk-seg button { flex: 1 0 auto; }

.sk-spots { display: grid; gap: 10px; }
.sk-spot {
  display: grid; grid-template-columns: 84px minmax(0, 1fr) auto; gap: 14px; align-items: center; width: 100%;
  padding: 12px 16px 12px 12px; border: 1px solid var(--sk-line); border-left: 6px solid var(--sk-line); border-radius: 12px;
  background: var(--sk-surface); text-align: left; cursor: pointer; color: inherit;
}
.sk-spot:hover { border-color: var(--sk-brand); }
.sk-spot--ringan { border-left-color: var(--sk-ringan); }
.sk-spot--sedang { border-left-color: var(--sk-sedang); }
.sk-spot--parah { border-left-color: var(--sk-parah); }
.sk-spot .sk-thumb { width: 84px; height: 84px; }
.sk-spot__title { font-family: var(--sk-display); font-weight: 700; font-size: 1.05rem; }
.sk-spot__meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
.sk-spot__cta { margin-top: 8px; font-size: 0.84rem; font-weight: 600; color: var(--sk-brand); }
.sk-dist { text-align: right; font-family: var(--sk-display); min-width: 64px; }
.sk-dist b { font-size: 1.9rem; line-height: 1; font-weight: 700; }
.sk-dist span { font-size: 0.85rem; color: var(--sk-muted); margin-left: 2px; font-family: 'Public Sans', system-ui, sans-serif; }

.sk-card { background: var(--sk-surface); border: 1px solid var(--sk-line); border-radius: 12px; padding: 16px 18px; display: grid; gap: 12px; }
.sk-card__head { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: flex-start; }
.sk-card__title { font-family: var(--sk-display); font-weight: 700; font-size: 1.08rem; }
.sk-callout { padding: 10px 12px; border-radius: 8px; border-left: 5px solid var(--sk-sedang); background: #fdf6e6; font-size: 0.88rem; }
.sk-proof { display: grid; gap: 12px; padding-top: 12px; border-top: 1px solid var(--sk-line); }
.sk-proof__grid { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 14px; }
.sk-proof__preview { width: 120px; height: 120px; border-radius: 10px; background: #dfe8e5; overflow: hidden; display: flex; align-items: center; justify-content: center; color: #7d918d; text-align: center; font-size: 0.78rem; padding: 6px; }
.sk-proof__preview img { width: 100%; height: 100%; object-fit: cover; }

.sk-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.sk-stat { padding: 14px 16px; border-radius: 12px; background: var(--sk-surface); border: 1px solid var(--sk-line); }
.sk-stat b { display: block; font-family: var(--sk-display); font-size: 1.7rem; line-height: 1.1; }
.sk-stat span { font-size: 0.82rem; color: var(--sk-muted); }

.sk-filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between; }

/* ---------- Responsif ---------- */
@media (max-width: 880px) {
  .sk-admin { grid-template-columns: minmax(0, 1fr); }
  .sk-rail { position: static; height: auto; padding: 14px 12px; gap: 12px; }
  .sk-nav { display: flex; overflow-x: auto; gap: 6px; }
  .sk-nav button { width: auto; flex: 0 0 auto; border-left: 0; border-bottom: 3px solid transparent; border-radius: 8px 8px 0 0; }
  .sk-nav button[aria-current='page'] { border-bottom-color: #7fd6cc; }
  .sk-rail__foot { margin-top: 0; display: flex; flex-wrap: wrap; align-items: center; }
  .sk-rail__who { flex: 1 1 100%; padding: 0 4px; }
  .sk-queue { grid-template-columns: minmax(0, 1fr); }
  .sk-list { max-height: 320px; }
  .sk-row { grid-template-columns: 80px minmax(0, 1fr); }
  .sk-row--plain { grid-template-columns: 44px minmax(0, 1fr); }
  .sk-row__btns { grid-column: 1 / -1; justify-content: flex-start; }
  .sk-row .sk-thumb { width: 80px; height: 72px; }
}
@media (max-width: 560px) {
  .sk-sevgroup { grid-template-columns: minmax(0, 1fr); }
  .sk-spot { grid-template-columns: 72px minmax(0, 1fr); }
  .sk-spot .sk-thumb { width: 72px; height: 72px; }
  .sk-dist { grid-column: 1 / -1; text-align: left; display: flex; align-items: baseline; gap: 4px; }
  .sk-proof__grid { grid-template-columns: minmax(0, 1fr); }
  .sk-vhead { padding: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .sk-root *, .sk-lightbox { animation: none !important; transition: none !important; }
}