// Хранилище данных на устройстве
const Store = {
  KEY: 'hd.episodes',

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

  create() {
    const ep = {
      id: Date.now().toString(36),
      start: new Date().toISOString(),
      end: null,
      intensity: null,
      tags: [],
      symptoms: [],
      triggers: [],
      meds: [],
      note: ''
    };
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
  }
};
