const sections = ['teams', 'drivers', 'races', 'leagues'];
const modal = document.getElementById('modalOverlay');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');

window.onload = () => {
  sections.forEach(section => loadSection(section));
};

async function getUnassignedDrivers() {
  const res = await fetch("/admin/data/drivers");
  const allDrivers = await res.json();
  return allDrivers.filter(d => !d.team_id);
}

// Load and render content by section
async function loadSection(section) {
  const response = await fetch(`/admin/data/${section}`);
  const data = await response.json();

  const grid = document.getElementById(`${section}Grid`);
  grid.innerHTML = "";

  data.forEach(item => {
    const block = document.createElement("div");
    block.className = "info-block";
    block.onclick = () => openForm(section, item);
    block.innerHTML = renderBlockContent(section, item);
    grid.appendChild(block);
  });
}

// Render driver, race, and league cards
function renderBlockContent(section, item) {
  switch (section) {
    case 'teams':
      const driverNames = Array.isArray(item.driver_names) ? item.driver_names.join(', ') : "None";
      return `
        <h3>${item.name}</h3>
        <p>Drivers: ${driverNames}</p>
        <p>Score: ${item.score}</p>
        <p>Price: $${item.price ?? 0}</p>
      `;

    case 'drivers':
      const teamName = item.team_name || "Unassigned";
      return `<h3>${item.name}</h3><p>Team: ${teamName}</p><p>Points: ${item.points}</p><p>Price: ${item.price}</p>`;

    case 'races':
      return `<h3>${item.name}</h3><p>Date: ${item.date}</p>`;

    case 'leagues':
      const restriction = item.team_restriction || "None";
      return `<h3>${item.name}</h3><p>Team Restriction: ${restriction}</p><p>Type: ${item.type || "public"}</p>`;
    default:
      return `<h3>Unknown</h3>`;
  }
}

// Modal setup
function openForm(section, data = null) {
  modal.style.display = "flex";
  modalForm.innerHTML = "";
  modalTitle.textContent = data ? `Edit ${section}` : `Add ${section}`;

  const fields = {
    drivers: ['name', 'price', 'points', 'team_id'],
    races: ['name', 'date', 'results'],
    leagues: ['name', 'type', 'team_restriction']
  };

  if (section === 'teams') {
    const teamId = data?.id || null;

    const nameInput = document.createElement('input');
    nameInput.placeholder = "Team Name";
    nameInput.name = "name";
    nameInput.value = data?.name ?? '';
    modalForm.appendChild(nameInput);

    const scoreInput = document.createElement('input');
    scoreInput.placeholder = "Score";
    scoreInput.name = "score";
    scoreInput.type = "number";
    scoreInput.value = data?.score ?? 0;
    modalForm.appendChild(scoreInput);

    const priceInput = document.createElement('input');
    priceInput.placeholder = "Price";
    priceInput.name = "price";
    priceInput.type = "number";
    priceInput.value = data?.price ?? 0;
    modalForm.appendChild(priceInput);

    fetch("/admin/data/drivers")
      .then(res => res.json())
      .then(drivers => {
        const currentDrivers = data?.drivers || [];
        const available = drivers.filter(d => !d.team_id || d.team_id === teamId);

        for (let i = 0; i < 3; i++) {
          const select = document.createElement('select');
          select.name = 'drivers';

          const defaultOption = document.createElement('option');
          defaultOption.value = "";
          defaultOption.textContent = `-- Select Driver ${i + 1} --`;
          select.appendChild(defaultOption);

          available.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.id;
            option.textContent = `${driver.name} (${driver.price})`;
            if (currentDrivers[i] === driver.id) option.selected = true;
            select.appendChild(option);
          });

          modalForm.appendChild(select);
        }

        const submit = document.createElement('button');
        submit.type = "submit";
        submit.textContent = "Save";
        modalForm.appendChild(submit);

        modalForm.onsubmit = e => {
          e.preventDefault();

          const payload = {
            name: modalForm.elements.name.value,
            score: parseInt(modalForm.elements.score.value || "0"),
            price: parseInt(modalForm.elements.price.value || "0"),
            drivers: [...modalForm.elements]
              .filter(el => el.name === "drivers" && el.value)
              .map(el => el.value)
          };

          fetch(`/admin/update/${section}`, {
            method: data ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: data?.id, ...payload })
          }).then(() => {
            closeModal();
            loadSection(section);
          });
        };
      });

  } else if (section === 'leagues') {
    // League Name
    const nameInput = document.createElement('input');
    nameInput.name = 'name';
    nameInput.placeholder = 'League Name';
    nameInput.value = data?.name || '';
    modalForm.appendChild(nameInput);

    // League Type
    const typeSelect = document.createElement('select');
    typeSelect.name = 'type';

    ['public', 'private'].forEach(type => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      if (data?.type === type) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    modalForm.appendChild(typeSelect);

    // Team Restriction
    const teamSelect = document.createElement('select');
    teamSelect.name = 'team_restriction';
    teamSelect.id = 'modalTeamSelect';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- No Restriction --';
    teamSelect.appendChild(defaultOption);
    modalForm.appendChild(teamSelect);

    fetch("/admin/data/teams").then(res => res.json()).then(teams => {
      teams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team.name;
        opt.textContent = team.name;
        if (data?.team_restriction === team.name) opt.selected = true;
        teamSelect.appendChild(opt);
      });
    });

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Save League';
    modalForm.appendChild(submit);

    modalForm.onsubmit = async e => {
      e.preventDefault();

      const payload = {
        name: nameInput.value,
        type: typeSelect.value,
        team_restriction: teamSelect.value || null
      };

      const method = data ? 'PUT' : 'POST';
      const url = data ? '/admin/update/leagues' : '/admin/create_league';

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data?.id ? { ...payload, id: data.id } : payload)
      });

      const result = await res.json();

      if (result.status === 'league created' || result.status === 'success') {
        if (payload.type === 'private' && result.code) {
          alert(`Private league created!\nJoin Code: ${result.code}`);
        } else {
          alert('League saved successfully.');
        }
        closeModal();
        loadSection('leagues');
      } else {
        alert(result.error || 'Something went wrong.');
      }
    };

  } else {
    // Default handling for drivers and races
    fields[section].forEach(field => {
      const input = document.createElement(field === 'results' ? 'textarea' : 'input');
      input.placeholder = field.charAt(0).toUpperCase() + field.slice(1);
      input.value = data?.[field] || '';
      input.name = field;
      modalForm.appendChild(input);
    });

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Save';
    modalForm.appendChild(submit);

    modalForm.onsubmit = e => {
      e.preventDefault();
      const payload = {};
      [...modalForm.elements].forEach(el => {
        if (el.name) payload[el.name] = el.value;
      });

      fetch(`/admin/update/${section}`, {
        method: data ? 'PUT' : 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data?.id, ...payload })
      }).then(() => {
        closeModal();
        loadSection(section);
      });
    };
  }
}

function closeModal() {
  modal.style.display = "none";
}