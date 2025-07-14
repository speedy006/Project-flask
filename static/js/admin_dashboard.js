const sections = ['teams', 'drivers', 'races', 'leagues'];
const modal = document.getElementById('modalOverlay');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');

sections.forEach(section => loadSection(section));

function loadSection(section) {
  fetch(`/admin/data/${section}`)
    .then(res => res.json())
    .then(data => {
      const grid = document.getElementById(`${section}Grid`);
      grid.innerHTML = "";
      data.forEach(item => {
        const block = document.createElement("div");
        block.className = "info-block";
        block.onclick = () => openForm(section, item);
        block.innerHTML = renderBlockContent(section, item);
        grid.appendChild(block);
      });
    });
}

function renderBlockContent(section, item) {
  switch(section) {
    case 'teams':
      return `<h3>${item.name}</h3><p>Drivers: ${item.drivers.join(", ")}</p><p>Score: ${item.score}</p>`;
    case 'drivers':
      return `<h3>${item.name}</h3><p>Team: ${item.team}</p><p>Points: ${item.points}</p><p>Price: ${item.price}</p>`;
    case 'races':
      return `<h3>${item.name}</h3><p>Date: ${item.date}</p>`;
    case 'leagues':
      return `<h3>${item.name}</h3><p>Type: ${item.type}</p><p>Users: ${item.users.length}</p>`;
    default:
      return `<h3>Unknown</h3>`;
  }
}

function openForm(section, data = null) {
  modal.style.display = "flex";
  modalForm.innerHTML = ""; // Clear previous
  modalTitle.textContent = data ? `Edit ${section}` : `Add ${section}`;

  const fields = {
    teams: ['name', 'drivers', 'score'],
    drivers: ['name', 'price', 'points', 'team'],
    races: ['name', 'date', 'results'],
    leagues: ['name', 'type', 'users']
  };

  fields[section].forEach(field => {
    const input = document.createElement(field === 'results' || field === 'users' ? 'textarea' : 'input');
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

function closeModal() {
  modal.style.display = "none";
}