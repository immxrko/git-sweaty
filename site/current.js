function parseDateOnly(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatShortDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

function startOfWeek(date, weekStart) {
  const day = date.getDay(); // 0=Sun
  const weekStartDay = weekStart === "monday" ? 1 : 0;
  const diff = (day - weekStartDay + 7) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfWeek(start) {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatDuration(seconds) {
  const total = Math.round(seconds || 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, "0")}m`;
  return `${mins}m`;
}

function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(decimals);
}

function createCard(title, value) {
  const card = document.createElement("div");
  card.className = "card";
  const label = document.createElement("div");
  label.className = "card-title";
  label.textContent = title;
  const val = document.createElement("div");
  val.className = "card-value";
  val.textContent = value;
  card.appendChild(label);
  card.appendChild(val);
  return card;
}

function listItem(html) {
  const item = document.createElement("div");
  item.className = "list-item";
  item.innerHTML = html;
  return item;
}

async function init() {
  const resp = await fetch("data.json");
  if (!resp.ok) throw new Error(`Failed to load data.json (${resp.status})`);
  const payload = await resp.json();

  const weekStartSetting = String(payload.week_start || "sunday").toLowerCase();
  const now = new Date();
  const weekStart = startOfWeek(now, weekStartSetting);
  const weekEnd = endOfWeek(weekStart);

  const weekRangeEl = document.getElementById("weekRange");
  const summaryCards = document.getElementById("summaryCards");
  const typeBreakdown = document.getElementById("typeBreakdown");
  const activityList = document.getElementById("activityList");

  const weekRangeText = `${formatShortDate(weekStart)} – ${formatDate(weekEnd)}`;
  weekRangeEl.textContent = `Week range: ${weekRangeText}`;

  let totalCount = 0;
  let totalDistance = 0;
  let totalElevation = 0;
  let totalTime = 0;
  const typeCounts = {};

  const aggregates = payload.aggregates || {};
  Object.values(aggregates).forEach((yearData) => {
    Object.entries(yearData || {}).forEach(([type, entries]) => {
      Object.entries(entries || {}).forEach(([dateStr, entry]) => {
        const d = parseDateOnly(dateStr);
        if (!d) return;
        if (d < weekStart || d > weekEnd) return;
        const count = Number(entry.count || 0);
        totalCount += count;
        totalDistance += Number(entry.distance || 0);
        totalElevation += Number(entry.elevation_gain || 0);
        totalTime += Number(entry.moving_time || 0);
        typeCounts[type] = (typeCounts[type] || 0) + count;
      });
    });
  });

  const units = payload.units || { distance: "mi", elevation: "ft" };
  summaryCards.appendChild(createCard("Activities", String(totalCount)));
  summaryCards.appendChild(createCard("Distance", `${formatNumber(totalDistance)} ${units.distance}`));
  summaryCards.appendChild(createCard("Time", formatDuration(totalTime)));
  summaryCards.appendChild(createCard("Elevation", `${formatNumber(totalElevation, 0)} ${units.elevation}`));

  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  if (!typeEntries.length) {
    typeBreakdown.appendChild(listItem("<span class=\"muted\">No activities this week.</span>"));
  } else {
    typeEntries.forEach(([type, count]) => {
      typeBreakdown.appendChild(listItem(`<strong>${type}</strong> — ${count}`));
    });
  }

  const activities = (payload.activities || [])
    .filter((act) => {
      const d = parseDateOnly(act.date);
      return d && d >= weekStart && d <= weekEnd;
    })
    .sort((a, b) => {
      if (a.date === b.date) return (b.hour || 0) - (a.hour || 0);
      return a.date < b.date ? 1 : -1;
    });

  if (!activities.length) {
    activityList.appendChild(listItem("<span class=\"muted\">No activities logged yet.</span>"));
  } else {
    activities.forEach((act) => {
      const date = parseDateOnly(act.date);
      const dateLabel = date ? formatDate(date) : act.date;
      const name = act.name || act.subtype || act.type || "Activity";
      const typeLabel = act.type || "";
      const url = act.url;
      const content = url
        ? `<div><a href=\"${url}\" target=\"_blank\" rel=\"noreferrer\">${name}</a></div><div class=\"muted\">${dateLabel}${typeLabel ? ` • ${typeLabel}` : ""}</div>`
        : `<div>${name}</div><div class=\"muted\">${dateLabel}${typeLabel ? ` • ${typeLabel}` : ""}</div>`;
      activityList.appendChild(listItem(content));
    });
  }
}

init().catch((err) => {
  const weekRangeEl = document.getElementById("weekRange");
  if (weekRangeEl) {
    weekRangeEl.textContent = "Failed to load current week summary.";
  }
  console.error(err);
});
