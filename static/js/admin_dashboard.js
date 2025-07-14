const sections = ['teams', 'drivers', 'races', 'leagues'];
const modal = document.getElementById('modalOverlay');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');

// 🧠 Declare caches
let cachedTeams = {};

window.onload = () => {
  preloadTeamData().then(() => {
    sections.forEach(section => loadSection(section));
  });
};

// 🌐 Preload team documents for ID-to-name resolution
async function preloadTeamData() {
  const teamRes = await fetch("/admin/data/teams");
  const teams = await teamRes.json();
  teams.forEach(team => {
    cachedTeams[team.id] = team;
  });
}

// 🛠️ Load and render content by section
async function loadSection(section) {
  const response = await fetch(`/admin/data/${section}`);
  const data = await response.json();

  const grid = document.getElementById(`${section}Grid`);
  grid.innerHTML = "";

  if (section === 'teams') {
    for (const item of data) {
      const block = document.createElement("div");
      block.className = "info-block";
      block.onclick = () => openForm(section, item);

      const driverNames = await resolveDriverNames(item.drivers || []);
      block.innerHTML = `
        <h3>${item.name}</h3>
        <p>Drivers: ${driverNames}</p>
        <p>Score: ${item.score}</p>
      `;
      grid.appendChild(block);
    }
  } else {
    data.forEach(item => {
      const block = document.createElement("div");
      block.className = "info-block";
      block.onclick = () => openForm(section, item);
      block.innerHTML = renderBlockContent(section, item);
      grid.appendChild(block);
    });
  }
}

// 🎯 Render driver, race, and league cards (teams skipped here)
function renderBlockContent(section, item) {
  switch (section) {
    case 'drivers':
      const teamName = item.team_id ? (cachedTeams[item.team_id]?.name || "Unassigned") : "Unassigned";
      return `<h3>${item.name}</h3><p>Team: ${teamName}</p><p>Points: ${item.points}</p><p>Price: ${item.price}</p>`;

    case 'races':
      return `<h3>${item.name}</h3><p>Date: ${item.date}</p>`;

    case 'leagues':
      return `<h3>${item.name}</h3><p>Type: ${item.type}</p><p>Users: ${item.users.length}</p>`;

    default:
      return `<h3>Unknown</h3>`;
  }
}

// 🧩 Modal setup
function openForm(section, data = null) {
  modal.style.display = "flex";
  modalForm.innerHTML = "";
  modalTitle.textContent = data ? `Edit ${section}` : `Add ${section}`;

  const fields = {
    teams: ['name', 'drivers', 'score'],
    drivers: ['name', 'price', 'points', 'team_id'],
    races: ['name', 'date', 'results'],
    leagues: ['name', 'type', 'users']
  };

  fields[section].forEach(field => {
    const input = document.createElement((field === 'results' || field === 'users') ? 'textarea' : 'input');
    input.placeholder = field.charAt(0).toUpperCase() + field.slice(1);
    input.value = data?.[field] ?? '';
    input.name = field;
    modalForm.appendChild(input);
  });

  const submit = document.createElement('button');
  submit.type = "submit";
  submit.textContent = "Save";
  modalForm.appendChild(submit);

  modalForm.onsubmit = e => {
    e.preventDefault();
    const payload = {};
    [...modalForm.elements].forEach(el => {
      if (el.name) payload[el.name] = el.value;
    });

    fetch(`/admin/update/${section}`, {
      method: data ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: data?.id, ...payload })
    }).then(() => {
      closeModal();
      loadSection(section);
    });
  };
}

// 🔍 Resolve driver names for team card display
async function resolveDriverNames(driverIds) {
  const names = [];
  for (const id of driverIds) {
    try {
      const res = await fetch(`/admin/data/driver/${id}`);
      const driver = await res.json();
      names.push(driver.name);
    } catch {
      names.push("Unknown");
    }
  }
  return names.join(", ");
}

function closeModal() {
  modal.style.display = "none";
}