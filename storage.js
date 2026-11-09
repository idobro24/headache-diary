// Хранилище данных на устройстве
const Store = {
  KEY: 'hd.episodes',
  FIRST_USE_KEY: 'hd.firstUse',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  save(episodes) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(episodes));
    } catch (e) {
      alert('Не удалось сохранить запись. Проверьте свободное место на устройстве.');
    }
  },

  upsert(episode) {
    const all = this.load();
    const i = all.findIndex(e => e.id === episode.id);
    if (i >= 0) all[i] = episode; else all.push(episode);
    this.save(all);
  },

  remove(id) {
    this.save(this.load().filter(e => e.id !== id));
  },

  blank(start, end) {
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      intensity: null,
      tags: [],
      symptoms: [],
      triggers: [],
      meds: [],
      note: ''
    };
  },

  // Новый приступ, который идёт прямо сейчас
  create() {
    const ep = this.blank(new Date(), null);
    this.upsert(ep);
    return ep;
  },

  // Прошлый приступ, который уже закончился
  createPast(start, end) {
    const ep = this.blank(start, end);
    this.upsert(ep);
    return ep;
  },

  active() {
    return this.load().find(e => !e.end) || null;
  },

  lastEnded() {
    return this.load()
      .filter(e => e.end)
      .sort((a, b) => new Date(b.end) - new Date(a.end))[0] || null;
  },

  recentMeds() {
    const names = [];
    this.load()
      .sort((a, b) => new Date(b.start) - new Date(a.start))
      .forEach(e => e.meds.forEach(m => {
        if (!names.includes(m.name)) names.push(m.name);
      }));
    return names;
  },

  // С какого дня ведётся дневник: дни раньше не красим в календаре
  firstUse() {
    let first = null;
    try { first = localStorage.getItem(this.FIRST_USE_KEY); } catch (e) {}
    if (!first) {
      first = new Date().toISOString();
      try { localStorage.setItem(this.FIRST_USE_KEY, first); } catch (e) {}
    }
    let date = new Date(first);
    this.load().forEach(e => {
      const s = new Date(e.start);
      if (s < date) date = s;
    });
    return date;
  }
};
