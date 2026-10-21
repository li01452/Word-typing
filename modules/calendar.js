function summarize(records) {
  const totals = {
    count: records.length,
    duration: 0,
    words: 0,
    correct: 0,
    accuracy: 0,
    speed: 0,
  };
  for (const record of records) {
    totals.duration += record.duration || 0;
    totals.words += record.totalWords || 0;
    totals.correct += record.correctWords || 0;
    totals.accuracy += record.accuracy || 0;
    totals.speed += record.typingSpeed || 0;
  }
  totals.accuracy = records.length
    ? ((totals.accuracy / records.length) * 100).toFixed(1)
    : "100.0";
  totals.speed = records.length ? Math.round(totals.speed / records.length) : 0;
  return totals;
}

function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function describe(stats) {
  return `练习 ${stats.count} 次 · ${Math.round(stats.duration / 60)} 分钟\n单词 ${stats.words} 个 · 完成 ${stats.correct} 个\n正确率 ${stats.accuracy}% · 速度 ${stats.speed} 字/分`;
}

// Grid 自动排星期和日期，无补空格、表格行列或自定义 tooltip。
function renderCalendar(container, history, today = new Date()) {
  const monthFormat = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  });
  const fragment = document.createDocumentFragment();
  for (let offset = 0; offset < 6; offset++) {
    const start = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const month = document.createElement("section");
    month.className = "calendar";
    const heading = document.createElement("h3");
    heading.textContent = monthFormat.format(start);
    const grid = document.createElement("div");
    grid.className = "calendar-grid";
    for (const weekday of "一二三四五六日") {
      const label = document.createElement("span");
      label.textContent = weekday;
      grid.append(label);
    }
    const days = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    for (let day = 1; day <= days; day++) {
      const date = new Date(start.getFullYear(), start.getMonth(), day);
      const key = dateKey(date);
      const saved = history[key];
      const stats = summarize(
        Array.isArray(saved) ? saved : saved?.records || [],
      );
      const cell = document.createElement("button");
      cell.type = "button";
      cell.textContent = day;
      cell.dataset.date = key;
      cell.title = `${key}\n${describe(stats)}`;
      cell.setAttribute("aria-label", cell.title);
      if (day === 1)
        cell.style.gridColumnStart = ((start.getDay() + 6) % 7) + 1;
      if (stats.count) {
        cell.className = "has-practice";
        cell.style.background = `hsl(120 60% ${90 - (50 * Math.min(stats.count, 20)) / 20}%)`;
      }
      grid.append(cell);
    }
    month.append(heading, grid);
    fragment.append(month);
  }
  container.replaceChildren(fragment);
}
