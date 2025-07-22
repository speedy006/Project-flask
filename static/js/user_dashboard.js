// Live price maps
let driverPriceMap = {};
let teamPriceMap = {};
let currentUser = null;

// Ensure user is authenticated before loading teams
firebase.auth().onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "/";
    return;
  }

  currentUser = user;
  const token = await user.getIdToken();
  attachFantasyForm(token);
  loadFantasyTeams(token);
});

// Load fantasy teams for the user
async function loadFantasyTeams(token) {
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

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = async () => {
      const confirmed = confirm("Are you sure you want to delete this fantasy team?");
      if (!confirmed) return;

      const token = await firebase.auth().currentUser.getIdToken();
      const res = await fetch(`/user/fantasy_teams/${team.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        loadFantasyTeams(token); //Refresh the grid
      }
    };

    card.appendChild(deleteBtn);
    grid.appendChild(card);
  });
}

// Attach form handler
function attachFantasyForm(token) {
  const form = document.getElementById("fantasyForm");
  if (!form) return;

  form.onsubmit = async e => {
    e.preventDefault();
    const payload = {
      name: form.name.value,
      team: form.team.value,
      drivers: [...form.elements]
        .filter(el => el.name === "drivers" && el.value)
        .map(el => el.value)
    };

    const res = await fetch("/user/fantasy_teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      closeFantasyModal();
      loadFantasyTeams(token);
    }
  };
}

// Open modal and load driver/team options
function openFantasyModal() {
  document.getElementById("fantasyModal").style.display = "flex";
  const selects = document.getElementById("driverSelects");
  selects.innerHTML = "";
  document.getElementById("teamSelect").innerHTML = "";
  document.getElementById("budgetTracker").textContent = "Total Budget: $0";
  driverPriceMap = {};
  teamPriceMap = {};

  fetch("/admin/data/drivers").then(res => res.json()).then(drivers => {
    for (let i = 0; i < 5; i++) {
      const select = document.createElement("select");
      select.name = "drivers";
      select.innerHTML = `<option value="">-- Driver ${i + 1} --</option>` +
        drivers.map(d => `<option value="${d.id}">${d.name} ($${d.price})</option>`).join('');
      driverPriceMap = Object.fromEntries(drivers.map(d => [d.id, d.price]));
      select.onchange = updateBudgetTracker;
      selects.appendChild(select);
    }
  });

  fetch("/admin/data/teams").then(res => res.json()).then(teams => {
    const select = document.getElementById("teamSelect");
    select.innerHTML = `<option value="">-- Select Team --</option>` +
      teams.map(t => `<option value="${t.id}">${t.name} ($${t.price})</option>`).join('');
    teamPriceMap = Object.fromEntries(teams.map(t => [t.id, t.price]));
    select.onchange = updateBudgetTracker;
  });
}

function closeFantasyModal() {
  document.getElementById("fantasyModal").style.display = "none";
}

// Budget tracker
function updateBudgetTracker() {
  const form = document.getElementById("fantasyForm");
  let total = 0;

  [...form.elements].forEach(el => {
    if (el.name === "drivers" && el.value && driverPriceMap[el.value]) {
      total += driverPriceMap[el.value];
    }
  });

  const teamVal = form.team.value;
  if (teamVal && teamPriceMap[teamVal]) {
    total += teamPriceMap[teamVal];
  }

  const tracker = document.getElementById("budgetTracker");
  tracker.textContent = `Total Budget: $${total.toLocaleString()}`;
  tracker.style.color = total > 100_000_000 ? "red" : "green";

  if (total > 100_000_000) {
    tracker.textContent += " Over budget!";
  }
}