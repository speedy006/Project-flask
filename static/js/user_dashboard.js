// Load fantasy teams for the user
async function loadFantasyTeams() {
  const token = await firebase.auth().currentUser.getIdToken();
  const res = await fetch("/user/fantasy_teams", {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  const teams = await res.json();
  const grid = document.getElementById("fantasyGrid");
  grid.innerHTML = "";

  teams.forEach(team => {
    const card = document.createElement("div");
    card.className = "card";
    const driverList = team.driver_names?.join(', ') || "Unlisted";
    card.innerHTML = `
      <h3>${team.name}</h3>
      <p>Drivers: ${driverList}</p>
      <p>Team: ${team.team_name}</p>
      <p>Price: $${team.price.toLocaleString()}</p>
    `;
    grid.appendChild(card);
  });
}

// Open modal and load driver/team options
function openFantasyModal() {
  document.getElementById("fantasyModal").style.display = "flex";
  const selects = document.getElementById("driverSelects");
  selects.innerHTML = "";

  fetch("/admin/data/drivers").then(res => res.json()).then(drivers => {
    for (let i = 0; i < 5; i++) {
      const select = document.createElement("select");
      select.name = "drivers";
      select.innerHTML = `<option value="">-- Driver ${i + 1} --</option>` +
        drivers.map(d => `<option value="${d.id}">${d.name} ($${d.price})</option>`).join('');
      selects.appendChild(select);
    }
  });

  fetch("/admin/data/teams").then(res => res.json()).then(teams => {
    const select = document.getElementById("teamSelect");
    select.innerHTML = `<option value="">-- Select Team --</option>` +
      teams.map(t => `<option value="${t.id}">${t.name} ($${t.price})</option>`).join('');
  });
}

function closeFantasyModal() {
  document.getElementById("fantasyModal").style.display = "none";
}

// Submit fantasy team form with Firebase token
document.addEventListener("DOMContentLoaded", () => {
  loadFantasyTeams();

  document.getElementById("fantasyForm").onsubmit = async e => {
    e.preventDefault();
    const form = e.target;
    const token = await firebase.auth().currentUser.getIdToken();
    const payload = {
      name: form.name.value,
      team: form.team.value,
      drivers: [...form.elements].filter(el => el.name === "drivers" && el.value).map(el => el.value)
    };

    fetch("/user/fantasy_teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }).then(res => res.json()).then(data => {
      if (data.error) {
        alert(data.error);
      } else {
        closeFantasyModal();
        loadFantasyTeams();
      }
    });
  };
});