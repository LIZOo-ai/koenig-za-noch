/* ============================================================
   КЁНИГ ЗА НОЧЬ — интерфейс (DOM)
   Логика — в js/game.js, данные — в data/listings.js
   ============================================================ */
(function () {
  'use strict';

  const G = window.Game;
  const LISTINGS = window.LISTINGS || [];

  /* ---------- Короткие хелперы ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }
  const fmt = v => G.formatPrice(v);

  const ICONS = {
    star: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 15 8.5 22 9.3 17 14l1.2 7L12 17.8 5.8 21 7 14 2 9.3 9 8.5Z"/></svg>',
    pin: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    chevL: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    chevR: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>'
  };

  /* ---------- Состояние ---------- */
  let game = null;

  const STORAGE_KEY = 'koenig-game-state';
  function saveState() {
    if (!game) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        deck: game.deck.map(l => l.id),
        current: game.current,
        totalScore: game.totalScore,
        rounds: game.rounds.map(r => ({ id: r.listing.id, guess: r.guess, real: r.real, points: r.points }))
      }));
    } catch (e) { /* приватный режим — играем без сохранения */ }
  }
  function clearState() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }
  function loadState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.deck) || s.deck.length !== G.GAME_ROUNDS) return null;
      const byId = Object.create(null);
      LISTINGS.forEach(l => { byId[l.id] = l; });
      const deck = s.deck.map(id => byId[id]);
      if (deck.some(d => !d)) return null;
      return {
        deck,
        current: s.current,
        totalScore: s.totalScore,
        rounds: (s.rounds || []).map(r => ({ listing: byId[r.id], guess: r.guess, real: r.real, points: r.points })),
        locked: false
      };
    } catch (e) { return null; }
  }

  /* ---------- Переключение экранов ---------- */
  const screens = {
    start: $('#screen-start'),
    game: $('#screen-game'),
    result: $('#screen-result'),
    answers: $('#screen-answers')
  };
  function show(name) {
    Object.values(screens).forEach(s => { s.hidden = true; });
    screens[name].hidden = false;
    window.scrollTo(0, 0);
  }

  /* ============================================================
     СТАРТОВЫЙ ЭКРАН — коллаж
     ============================================================ */
  function buildCollage() {
    const box = $('#start-collage');
    if (!box || !LISTINGS.length) return;
    const shuffled = LISTINGS.slice().sort(() => Math.random() - .5);
    const photos = [];
    for (const l of shuffled) {
      if (l.photos && l.photos[0]) photos.push(l.photos[0]);
      if (photos.length >= 9) break;
    }
    box.innerHTML = '';
    photos.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = i < 6 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.onerror = () => img.remove();
      box.appendChild(img);
    });
  }

  /* ============================================================
     ИГРОВОЙ ЭКРАН
     ============================================================ */
  const headerEls = {
    round: $('#game-round'),
    score: $('#game-score'),
    scoreWrap: $('#game-score-wrap'),
    bar: $('#progress-bar')
  };

  function updateHeader() {
    headerEls.round.textContent =
      String(game.current + 1).padStart(2, '0') + ' / ' + String(G.GAME_ROUNDS).padStart(2, '0');
    headerEls.score.textContent = game.totalScore;
    headerEls.bar.style.width = (game.current / G.GAME_ROUNDS * 100) + '%';
  }

  function bumpScore(delta) {
    if (!delta) return;
    headerEls.scoreWrap.classList.remove('bump');
    void headerEls.scoreWrap.offsetWidth; // перезапуск анимации
    headerEls.scoreWrap.classList.add('bump');
  }

  /* ---------- Галерея ---------- */
  function initGallery(root, listing) {
    const photos = (listing.photos && listing.photos.length) ? listing.photos : [];
    const track = $('.gallery__track', root);
    const dotsBox = $('.gallery__dots', root);
    const counter = $('.gallery__counter', root);
    const btnPrev = $('.gallery__nav--prev', root);
    const btnNext = $('.gallery__nav--next', root);
    let index = 0;

    photos.forEach((src, i) => {
      const slide = el('div', 'gallery__slide');
      const img = document.createElement('img');
      img.alt = 'Фотография квартиры, ' + (i + 1);
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => img.classList.add('loaded');
      img.onerror = () => slide.classList.add('error');
      img.src = src;
      slide.appendChild(img);
      slide.appendChild(el('div', 'slide-fallback', 'Фото не загрузилось'));
      track.appendChild(slide);

      const dot = el('button', 'gallery__dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Фото ' + (i + 1));
      dot.addEventListener('click', () => go(i));
      dotsBox.appendChild(dot);
    });

    counter.textContent = '1 / ' + photos.length;

    function go(i) {
      index = G.clamp(i, 0, photos.length - 1);
      track.style.transform = 'translateX(-' + index * 100 + '%)';
      counter.textContent = (index + 1) + ' / ' + photos.length;
      [...dotsBox.children].forEach((d, di) => d.classList.toggle('active', di === index));
      btnPrev.classList.toggle('hidden', index === 0);
      btnNext.classList.toggle('hidden', index === photos.length - 1);
      /* лениво подгружаем соседние кадры */
      [index + 1].forEach(j => {
        const img = track.children[j] && track.children[j].querySelector('img');
        if (img && !img.src) img.src = photos[j];
      });
    }

    btnPrev.addEventListener('click', () => go(index - 1));
    btnNext.addEventListener('click', () => go(index + 1));

    /* свайп пальцем */
    let startX = null, startY = null;
    root.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    root.addEventListener('touchend', e => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        go(index + (dx < 0 ? 1 : -1));
      }
      startX = startY = null;
    }, { passive: true });

    if (photos.length) { go(0); }
  }

  /* ---------- Ставка ---------- */
  function initBid(root, onLock) {
    const priceOut = $('.bid__price', root);
    const slider = $('.slider', root);
    const input = $('input[type=number]', root);
    const lockBtn = $('.bid__lock', root);
    let value = null;          // null = «Выбери свою цену»
    let locked = false;

    const PLACEHOLDER = '<span style="opacity:.4">Выбери свою цену</span>';

    function render() {
      priceOut.innerHTML = value === null
        ? PLACEHOLDER
        : fmt(value) + ' <span class="rub">₽</span>';
      const pct = ((value === null ? G.SLIDER_MIN : value) - G.SLIDER_MIN) / (G.SLIDER_MAX - G.SLIDER_MIN) * 100;
      slider.style.setProperty('--fill', pct.toFixed(2) + '%');
      slider.value = value === null ? G.SLIDER_MIN : value;
    }

    slider.addEventListener('input', () => {
      if (locked) return;
      value = parseInt(slider.value, 10);
      input.value = value;
      render();
    });
    input.addEventListener('input', () => {
      if (locked) return;
      const raw = parseInt(input.value, 10);
      if (isNaN(raw)) { value = null; render(); return; }
      value = G.clamp(raw, G.SLIDER_MIN, G.SLIDER_MAX);
      render();
    });
    input.addEventListener('blur', () => { if (value !== null) input.value = value; });

    lockBtn.addEventListener('click', () => {
      if (locked || value === null) {
        if (!locked) {
          priceOut.classList.remove('bump');
          void priceOut.offsetWidth;
          priceOut.classList.add('bump');
          priceOut.style.animation = 'bump .5s ease';
        }
        return;
      }
      locked = true;
      slider.disabled = true;
      input.disabled = true;
      lockBtn.disabled = true;
      onLock(value);
    });

    render();
  }

  /* ---------- Карточка раунда ---------- */
  function renderRound() {
    const listing = game.deck[game.current];
    updateHeader();

    const root = el('div', 'round');
    root.innerHTML =
      '<div class="gallery">' +
      '  <div class="gallery__track"></div>' +
      '  <button type="button" class="gallery__nav gallery__nav--prev" aria-label="Предыдущее фото">' + ICONS.chevL + '</button>' +
      '  <button type="button" class="gallery__nav gallery__nav--next" aria-label="Следующее фото">' + ICONS.chevR + '</button>' +
      '  <div class="gallery__counter"></div>' +
      '  <div class="gallery__dots"></div>' +
      '</div>' +
      '<div class="apt-info">' +
      '  <div class="apt-info__title"></div>' +
      '  <div class="apt-info__addr">' + ICONS.pin + '<span></span></div>' +
      '  <div class="apt-info__chips"></div>' +
      '</div>' +
      '<div class="bid">' +
      '  <h2 class="bid__question">Как думаешь, сколько стоит<br>одна ночь?</h2>' +
      '  <div class="bid__panel">' +
      '    <div class="bid__hint">Твоя ставка · 1 ночь · 2 гостя</div>' +
      '    <div class="bid__price"></div>' +
      '    <div class="slider-wrap">' +
      '      <input class="slider" type="range" min="' + G.SLIDER_MIN + '" max="' + G.SLIDER_MAX + '" step="' + G.SLIDER_STEP + '" aria-label="Стоимость одной ночи">' +
      '      <div class="slider-scale"><span>' + fmt(G.SLIDER_MIN) + '</span><span>' + fmt(G.SLIDER_MAX) + '</span></div>' +
      '    </div>' +
      '    <div class="bid__manual">Точная цена, ₽ <input type="number" min="' + G.SLIDER_MIN + '" max="' + G.SLIDER_MAX + '" step="' + G.SLIDER_STEP + '" inputmode="numeric" placeholder="—">' +
      '    </div>' +
      '    <button type="button" class="btn btn--primary btn--lg bid__lock">Зафиксировать цену</button>' +
      '  </div>' +
      '</div>';

    $('.apt-info__title', root).textContent = listing.title || listing.type || 'Квартира в Калининграде';
    $('.apt-info__addr span', root).textContent = listing.address || 'Калининград';

    const chips = $('.apt-info__chips', root);
    if (listing.area) chips.appendChild(el('span', 'chip', listing.area.toLocaleString('ru-RU') + ' м²'));
    if (listing.beds) chips.appendChild(el('span', 'chip', listing.beds + ' ' + plural(listing.beds, 'кровать', 'кровати', 'кроватей')));
    if (listing.rating) chips.appendChild(el('span', 'chip chip--rating', ICONS.star + ' ' + String(listing.rating).replace('.', ',') + (listing.reviews ? ' · ' + listing.reviews + ' ' + plural(listing.reviews, 'отзыв', 'отзыва', 'отзывов') : '')));
    if (listing.superhost) chips.appendChild(el('span', 'chip', 'Суперхозяин'));
    if (listing.instant) chips.appendChild(el('span', 'chip', 'Мгновенная бронь'));

    const main = $('#game-main');
    main.innerHTML = '';
    main.appendChild(root);

    initGallery(root, listing);
    initBid(root, guess => lockAnswer(guess));
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  /* ---------- Фиксация ответа ---------- */
  function lockAnswer(guess) {
    const listing = game.deck[game.current];
    const points = G.calcPoints(guess, listing.price);
    const dev = G.calcDeviation(guess, listing.price);

    game.rounds.push({
      listing,
      guess,
      real: listing.price,
      points,
      deviation: dev
    });
    game.totalScore += points;
    game.current += 1;
    game.locked = false;
    saveState();

    bumpScore(points);
    updateHeader();
    showRoundResult(guess, listing.price, points, dev);
  }

  /* ---------- Результат раунда ---------- */
  function showRoundResult(guess, real, points, dev) {
    const root = el('div', 'round-result');

    let verdict, cls;
    if (Math.abs(guess - real) < 1) {
      verdict = 'Цена угадана точно!'; cls = 'exact';
    } else if (dev > 0) {
      verdict = 'Ты переоценил квартиру на ' + fmt(guess - real) + ' ₽'; cls = 'over';
    } else {
      verdict = 'Ты недооценил квартиру на ' + fmt(real - guess) + ' ₽'; cls = 'under';
    }

    const pctDev = Math.round(Math.abs(dev));
    const isLast = game.current >= G.GAME_ROUNDS;
    const listing = game.deck[game.current - 1];

    root.innerHTML =
      '<div class="round-result__verdict round-result__verdict--' + cls + '">' + verdict + '</div>' +
      '<div class="rr-grid">' +
      '  <div class="rr-cell"><div class="rr-cell__label">Твоя оценка</div><div class="rr-cell__value">' + fmt(guess) + ' <small>₽</small></div></div>' +
      '  <div class="rr-cell rr-cell--real"><div class="rr-cell__label">Реальная цена</div><div class="rr-cell__value">' + fmt(real) + ' <small class="rub">₽</small></div></div>' +
      '</div>' +
      '<div class="rr-diff">Отклонение: <strong>' + pctDev + '%</strong>' +
      (pctDev ? ' · ' + (dev > 0 ? '<span class="dir-up">выше цены</span>' : '<span class="dir-down">ниже цены</span>') : '') +
      '</div>' +
      '<div class="rr-points' + (points >= 100 ? ' perfect' : '') + '">' +
      '  <div class="rr-points__label">' + (points >= 100 ? 'Идеально!' : 'Точность') + '</div>' +
      '  <div class="rr-points__bar"><div class="rr-points__fill"></div></div>' +
      '  <div class="rr-points__num">+<span class="pts-num">0</span><small> / 100 баллов</small></div>' +
      '</div>' +
      (listing.listingUrl
        ? '<a class="round-result__link" href="' + listing.listingUrl + '" target="_blank" rel="noopener noreferrer">Посмотреть оригинальное объявление ↗</a>'
        : '') +
      '<button type="button" class="btn ' + (isLast ? 'btn--lime' : 'btn--primary') + ' btn--lg" id="btn-next-round">' +
      (isLast ? 'К результатам игры' : 'Следующая квартира' + ICONS.chevR) + '</button>';

    const gameMain = $('#game-main');
    gameMain.appendChild(root);

    /* анимации: полоса + счётчик баллов */
    requestAnimationFrame(() => {
      $('.rr-points__fill', root).style.width = points + '%';
    });
    animateNumber($('.pts-num', root), points, 900);

    $('#btn-next-round', root).addEventListener('click', () => {
      if (isLast) renderResult();
      else { renderRound(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });

    root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function animateNumber(node, target, duration) {
    if (!node) return;
    const t0 = performance.now();
    function tick(t) {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ============================================================
     ИТОГОВЫЙ ЭКРАН
     ============================================================ */
  function renderResult() {
    clearState();
    const summary = G.calcSummary(game.rounds);
    const { profile, meanSigned, accuracyTag } = G.determineProfile(game.rounds);

    const root = el('div', 'result__inner');
    root.innerHTML =
      '<div class="result__logo">Кёниг за ночь · итоги</div>' +
      '<div class="result__eyebrow">Твой профиль</div>' +
      '<div class="result__profile">' +
      '  <div class="result__profile-ico">' + profile.icon + '</div>' +
      '  <h2 class="result__profile-name">Ты — ' + profile.name + '</h2>' +
      '  ' + (accuracyTag ? '<div class="result__profile-tag">' + accuracyTag + '</div>' : '') +
      '  <p class="result__profile-desc">' + profile.description + '</p>' +
      '</div>' +
      '<div class="result__score">' +
      '  <div class="result__score-num"><span id="final-score">0</span><small> / ' + summary.maxPossible + '</small></div>' +
      '  <div class="result__score-sub">итоговый счёт</div>' +
      '</div>' +
      '<div class="result__card">' +
      '  <div class="result__card-title">Твои показатели</div>' +
      '  <div class="metrics">' +
      '    <div class="metric"><div class="metric__label">Средняя точность</div><div class="metric__value">' + Math.round(summary.avgPoints) + '<small> / 100</small></div></div>' +
      '    <div class="metric"><div class="metric__label">Средняя ошибка</div><div class="metric__value">' + Math.round(summary.meanAbsPercent) + '<small>%</small></div></div>' +
      '    <div class="metric"><div class="metric__label">Ошибка в рублях</div><div class="metric__value">±' + fmt(summary.meanAbsRub) + '<small> ₽</small></div></div>' +
      '    <div class="metric"><div class="metric__label">Среднее отклонение</div><div class="metric__value">' + (meanSigned > 0 ? '+' : '−') + Math.abs(Math.round(meanSigned)) + '<small>%</small></div></div>' +
      '  </div>' +
      buildDirBar(summary) +
      '</div>' +
      '<div class="result__card">' +
      '  <div class="result__card-title">Оценка против реальности</div>' +
      '  <div class="chart">' + buildChart(summary) + '</div>' +
      '  <div class="chart__legend">' +
      '    <span><i style="background:var(--over)"></i>Твоя оценка</span>' +
      '    <span><i style="background:var(--blue)"></i>Реальная цена</span>' +
      '  </div>' +
      '</div>' +
      '<div class="result__actions">' +
      '  <button type="button" class="btn btn--lime btn--lg" id="btn-again">Играть снова</button>' +
      '  <button type="button" class="btn btn--ghost btn--lg btn--onblue" id="btn-answers">Посмотреть мои ответы</button>' +
      '</div>' +
      '<p class="result__footnote">Цены — реальные объявления Avito: одна ночь, два гостя, 14–15 ноября 2026 года. Стоимость на другие даты может отличаться.</p>';

    const box = $('#result-main');
    box.innerHTML = '';
    box.appendChild(root);
    show('result');

    $('.btn--onblue', root).style.color = '#D7E4F5';
    $('.btn--onblue', root).style.borderColor = 'rgba(215,228,245,.4)';

    animateNumber($('#final-score', root), summary.total, 1400);
    $('#btn-again', root).addEventListener('click', startGame);
    $('#btn-answers', root).addEventListener('click', () => renderAnswers(summary));

    /* анимация полос диаграммы */
    requestAnimationFrame(() => {
      [...root.querySelectorAll('.chart__bar')].forEach(b => {
        b.style.width = b.dataset.w + '%';
      });
      [...root.querySelectorAll('.dir-bar__seg')].forEach(s => {
        s.style.width = s.dataset.w + '%';
      });
    });
  }

  function buildDirBar(summary) {
    const n = summary.rounds.length || 1;
    const wOver = summary.over / n * 100;
    const wFlat = summary.exact / n * 100;
    const wUnder = summary.under / n * 100;
    return '<div class="dir-bar">' +
      '  <div class="dir-bar__labels"><span class="l-under">↓ Занижал</span><span class="l-over">Завышал ↑</span></div>' +
      '  <div class="dir-bar__track">' +
      '    <div class="dir-bar__seg dir-bar__seg--under" data-w="' + wUnder + '" style="width:0"></div>' +
      '    <div class="dir-bar__seg dir-bar__seg--flat" data-w="' + wFlat + '" style="width:0"></div>' +
      '    <div class="dir-bar__seg dir-bar__seg--over" data-w="' + wOver + '" style="width:0"></div>' +
      '  </div>' +
      '  <div class="dir-bar__legend">' +
      '    <span><i style="background:var(--under)"></i>недооценил: ' + summary.under + '</span>' +
      '    <span><i style="background:var(--lime-deep)"></i>в пределах 5%: ' + summary.exact + '</span>' +
      '    <span><i style="background:var(--over)"></i>переоценил: ' + summary.over + '</span>' +
      '  </div>' +
      '</div>';
  }

  function buildChart(summary) {
    const max = Math.max(...summary.rounds.map(r => Math.max(r.guess, r.real)), 1);
    return summary.rounds.map((r, i) => {
      const wg = r.guess / max * 100;
      const wr = r.real / max * 100;
      return '<div class="chart__row">' +
        '<div class="chart__num">' + String(i + 1).padStart(2, '0') + '</div>' +
        '<div class="chart__bars">' +
        '  <div class="chart__bar chart__bar--guess" data-w="' + wg + '" style="width:0" title="Оценка: ' + fmt(r.guess) + ' ₽"></div>' +
        '  <div class="chart__bar chart__bar--real" data-w="' + wr + '" style="width:0" title="Реальная цена: ' + fmt(r.real) + ' ₽"></div>' +
        '</div></div>';
    }).join('');
  }

  /* ============================================================
     МОИ ОТВЕТЫ
     ============================================================ */
  function renderAnswers(summary) {
    const list = $('#answers-list');
    list.innerHTML = '';
    summary.rounds.forEach((r, i) => {
      const diff = r.guess - r.real;
      let badge, cls;
      if (Math.abs(diff) < 1) { badge = 'точно'; cls = 'exact'; }
      else if (diff > 0) { badge = '+' + fmt(diff) + ' ₽'; cls = 'over'; }
      else { badge = '−' + fmt(-diff) + ' ₽'; cls = 'under'; }

      const card = el('div', 'answer-card');
      card.innerHTML =
        (r.listing.photos && r.listing.photos[0]
          ? '<img class="answer-card__thumb" loading="lazy" decoding="async" referrerPolicy="no-referrer" alt="">'
          : '<div class="answer-card__thumb-fallback">🏠</div>') +
        '<div>' +
        '  <div class="answer-card__title">' + String(i + 1).padStart(2, '0') + '. ' + (r.listing.title || 'Квартира') + '</div>' +
        '  <div class="answer-card__addr">' + (r.listing.address || '') + '</div>' +
        '  <div class="answer-card__prices">' +
        '    <span class="g">Оценка: ' + fmt(r.guess) + ' ₽</span>' +
        '    <span class="r">Цена: ' + fmt(r.real) + ' ₽</span>' +
        '  </div>' +
        '  <div class="answer-card__foot">' +
        '    <div class="answer-card__pts">' + r.points + ' из 100 баллов</div>' +
        '    <div class="answer-card__badge answer-card__badge--' + cls + '">' + badge + '</div>' +
        '  </div>' +
        (r.listing.listingUrl ? '<a class="answer-card__link" href="' + r.listing.listingUrl + '" target="_blank" rel="noopener noreferrer">Объявление ↗</a>' : '') +
        '</div>';

      const img = card.querySelector('img');
      if (img) {
        img.src = r.listing.photos[0];
        img.onerror = () => {
          const fb = el('div', 'answer-card__thumb-fallback', '🏠');
          img.replaceWith(fb);
        };
      }
      list.appendChild(card);
    });
    show('answers');
  }

  /* ============================================================
     Запуск / перезапуск
     ============================================================ */
  function startGame() {
    game = G.newGame(LISTINGS);
    clearState();
    saveState();
    renderRound();
    show('game');
  }

  function init() {
    buildCollage();
    $('#btn-start').addEventListener('click', startGame);
    $('#btn-back-result').addEventListener('click', () => show('result'));

    /* Возобновление игры после перезагрузки страницы */
    const saved = loadState();
    if (saved && saved.current > 0 && saved.current < G.GAME_ROUNDS) {
      game = saved;
      renderRound();
      show('game');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
