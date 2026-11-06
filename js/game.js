/* ============================================================
   КЁНИГ ЗА НОЧЬ — игровая логика (без DOM)
   Данные: window.LISTINGS (data/listings.js)
   ============================================================ */
(function () {
  'use strict';

  const GAME_ROUNDS = 10;
  const SLIDER_MIN = 1500;
  const SLIDER_MAX = 15000;
  const SLIDER_STEP = 50;

  /* ---------- Утилиты ---------- */

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function formatPrice(value) {
    return Math.round(value).toLocaleString('ru-RU');
  }

  /* ---------- Стратифицированный отбор квартир ---------- */
  /* База сортируется по цене и делится на 10 ценовых сегментов
     (децилей); из каждого сегмента случайно берётся одна квартира.
     Так в игре всегда есть дешёвые, средние и дорогие варианты. */

  function pickRoundListings(all, count) {
    const n = count || GAME_ROUNDS;
    const sorted = all.slice().sort((a, b) => a.price - b.price);
    const bucketSize = Math.ceil(sorted.length / n);
    const picked = [];
    for (let i = 0; i < n; i++) {
      const bucket = sorted.slice(i * bucketSize, (i + 1) * bucketSize);
      if (!bucket.length) continue;
      picked.push(bucket[Math.floor(Math.random() * bucket.length)]);
    }
    return shuffle(picked);
  }

  /* ---------- Баллы ---------- */

  function calcPoints(guess, real) {
    if (!guess || guess <= 0 || !real || real <= 0) return 0;
    return Math.max(0, Math.round(100 * (1 - Math.abs(guess - real) / real)));
  }

  /* Отклонение в процентах со знаком: + = переоценил, − = недооценил */
  function calcDeviation(guess, real) {
    if (!real) return 0;
    return (guess - real) / real * 100;
  }

  /* ---------- Персональный профиль ---------- */

  const PROFILES = {
    hunter: {
      id: 'hunter',
      name: 'Охотник за выгодой',
      icon: '🎯',
      tagline: 'Торг уместен — даже в голове',
      description: 'Кажется, ты уверен: в Калининграде можно найти отличную квартиру дешевле, чем думают остальные. И ты готов это доказать! Красивые фотографии тебя не соблазняют — ты ищешь выгоду там, где другие платят лишнее.'
    },
    navigator: {
      id: 'navigator',
      name: 'Ценовой навигатор',
      icon: '🧭',
      tagline: 'Рынок слушал, цены помнит',
      description: 'Ты отлично чувствуешь этот город: отличаешь уютную студию от апартаментов с видом на канал и почти не промахиваешься. Прогуляйся по Калининграду с закрытыми глазами — цены сами выстроятся в маршрут.'
    },
    comfort: {
      id: 'comfort',
      name: 'Любитель комфорта',
      icon: '🛋️',
      tagline: 'Красивый интерьер = дорогая ночь',
      description: 'Тёплый свет, дизайнерский ремонт и уютный плед мгновенно повышают в твоих глазах цену квартиры. Что ж, за комфорт платить приятно — вопрос только в том, сколько именно.'
    }
  };

  function determineProfile(rounds) {
    if (!rounds.length) {
      return { profile: PROFILES.navigator, meanSigned: 0, meanAbs: 0, accuracyTag: null };
    }
    const devs = rounds.map(r => calcDeviation(r.guess, r.real));
    const meanSigned = devs.reduce((s, d) => s + d, 0) / devs.length;
    const meanAbs = devs.reduce((s, d) => s + Math.abs(d), 0) / devs.length;

    let profile;
    if (meanSigned < -10) profile = PROFILES.hunter;
    else if (meanSigned > 10) profile = PROFILES.comfort;
    else profile = PROFILES.navigator;

    /* Характеристика точности: направление ошибок могло
       взаимно компенсироваться — смотрим среднюю абсолютную ошибку */
    let accuracyTag = null;
    if (meanAbs > 25) accuracyTag = 'Интуиция пока тренируется';
    else if (meanAbs <= 10) accuracyTag = 'Отличное чувство цены';

    return { profile, meanSigned, meanAbs, accuracyTag };
  }

  /* ---------- Статистика игры ---------- */

  function calcSummary(rounds) {
    const n = rounds.length;
    const total = rounds.reduce((s, r) => s + r.points, 0);
    const pointsList = rounds.map(r => r.points);
    const avgPoints = n ? pointsList.reduce((a, b) => a + b, 0) / n : 0;
    const absDevs = rounds.map(r => Math.abs(calcDeviation(r.guess, r.real)));
    const meanAbsPercent = n ? absDevs.reduce((a, b) => a + b, 0) / n : 0;
    const absRub = rounds.map(r => Math.abs(r.guess - r.real));
    const meanAbsRub = n ? absRub.reduce((a, b) => a + b, 0) / n : 0;

    /* «Точный ответ» — ошибка не больше 5% */
    const over = rounds.filter(r => r.guess > r.real * 1.05).length;
    const under = rounds.filter(r => r.guess < r.real * 0.95).length;
    const exact = n - over - under;

    return {
      rounds,
      total: Math.min(total, 1000),
      avgPoints,
      meanAbsPercent,
      meanAbsRub,
      over,
      under,
      exact,
      maxPossible: n * 100
    };
  }

  /* ---------- Состояние игры ---------- */

  function newGame(listings) {
    return {
      deck: pickRoundListings(listings, GAME_ROUNDS),
      current: 0,
      totalScore: 0,
      rounds: [],       // { listing, guess, real, points, deviation }
      locked: false
    };
  }

  /* Экспорт */
  window.Game = {
    GAME_ROUNDS,
    SLIDER_MIN,
    SLIDER_MAX,
    SLIDER_STEP,
    PROFILES,
    pickRoundListings,
    calcPoints,
    calcDeviation,
    determineProfile,
    calcSummary,
    newGame,
    formatPrice,
    clamp
  };
})();
