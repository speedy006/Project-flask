let selectedLeagueId = null;

// Page initialization
window.onload = () => {
  firebase.auth().onAuthStateChanged(user => {
    loadPublicLeagues();

    if (user) {
      loadJoinedLeagues();
    } else {
      console.warn("User is not logged in yet.");
    }

    loadTeamOptionsForModal();
  });
};

// Modal setup
const modal = document.getElementById('leagueModal');
const modalForm = document.getElementById('createLeagueForm');

function openCreateLeagueModal() {
  modal.style.display = "flex";
}

function closeModal() {
  modal.style.display = "none";
}

// Load dynamic team options
function loadTeamOptionsForModal() {
  fetch("/admin/data/teams")
    .then(res => res.json())
    .then(teams => {
      const select = document.getElementById("modalTeamSelect");
      teams.forEach(team => {
        const opt = document.createElement("option");
        opt.value = team.name;
        opt.textContent = team.name;
        select.appendChild(opt);
      });
    });
}

// Create private league
modalForm.onsubmit = async e => {
  e.preventDefault();
  const form = e.target;

  const user = firebase.auth().currentUser;
  if (!user) {
    alert("You must be logged in to create a league.");
    return;
  }

  const token = await user.getIdToken();

  const payload = {
    name: form.name.value,
    type: "private",
    team_restriction: form.team_restriction.value || null
  };

  const res = await fetch("/user/create_league", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (res.ok && data.code) {
    alert(`Private league created!\nYour join code: ${data.code}`);
    closeModal();
    loadJoinedLeagues();
  } else {
    console.error("Create league error:", data);
    alert(data.error || "Error creating league.");
  }
};

// Display public leagues
function loadPublicLeagues() {
  fetch("/user/leagues/public")
    .then(res => res.json())
    .then(leagues => {
      const grid = document.getElementById("publicLeaguesGrid");
      grid.innerHTML = "";
      leagues.forEach(l => {
        const div = document.createElement("div");
        div.className = "league-card";
        div.innerHTML = `<h4>${l.name}</h4><p>Restriction: ${l.team_restriction || 'None'}</p>`;
        div.onclick = () => {
          selectedLeagueId = l.id;
          showLeagueDetails(l);
        };
        grid.appendChild(div);
      });
    });
}

// Display joined leagues
async function loadJoinedLeagues() {
  const user = firebase.auth().currentUser;
  if (!user) {
    console.warn("No user is logged in.");
    return;
  }

  const token = await user.getIdToken();

  const res = await fetch("/user/leagues/joined", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await res.json();

  if (res.ok && Array.isArray(data)) {
    const list = document.getElementById("joinedLeaguesList");
    list.innerHTML = "";
    data.forEach(l => {
      const div = document.createElement("div");
      div.className = "league-card";
      div.innerHTML = `<h4>${l.name}</h4><p>${l.type} League</p>`;
      div.onclick = () => {
        selectedLeagueId = l.id;
        showLeagueDetails(l);
      };
      list.appendChild(div);
    });
  } else {
    console.error("Error loading joined leagues:", data.error || data);
  }
}

// Join private league by code
document.getElementById("joinPrivateForm").onsubmit = async e => {
  e.preventDefault();
  const code = e.target.code.value;

  const user = firebase.auth().currentUser;
  if (!user) {
    alert("You must be logged in to join a private league.");
    return;
  }

  const token = await user.getIdToken();

  const res = await fetch("/user/join_private_league", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ code })
  });

  const data = await res.json();
  if (res.ok && data.status === "joined") {
    alert("Successfully joined private league!");
    loadJoinedLeagues();
  } else {
    alert(data.error || "Invalid code or join failed.");
  }
};

// Display selected league details
async function showLeagueDetails(league) {
  document.getElementById("noLeagueSelected").style.display = "none";
  document.getElementById("selectedLeagueDetails").style.display = "block";

  // Fetch latest league info if code wasn't included
  if (!league.code) {
    const res = await fetch(`/user/leagues/${league.id}/info`);
    league = await res.json();
  }

  document.getElementById("leagueNameHeading").textContent = league.name;
  document.getElementById("leagueRestrictionLabel").textContent =
    `Restriction: ${league.team_restriction || "None"}`;

  // Show join code if league is private
  const codeContainer = document.getElementById("leagueJoinCode");
  if (league.type === "private" && league.code) {
    codeContainer.style.display = "block";
    codeContainer.textContent = `Join Code: ${league.code}`;
  } else {
    codeContainer.style.display = "none";
  }

  // Load standings
  const res = await fetch(`/user/leagues/${league.id}/standings`);
  const data = await res.json();

  const tableBody = document.querySelector("#leagueStandingsTable tbody");
  tableBody.innerHTML = "";
  if (Array.isArray(data)) {
    data.forEach(entry => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${entry.username}</td><td>${entry.team_name}</td><td>${entry.points}</td>`;
      tableBody.appendChild(tr);
    });
  }
}

// Change team modal setup
const changeTeamModal = document.getElementById("changeTeamModal");
const teamForm = document.getElementById("changeTeamForm");

function openChangeTeamModal() {
  loadUserFantasyTeams();
  changeTeamModal.style.display = "flex";
}

function closeChangeTeamModal() {
  changeTeamModal.style.display = "none";
}

// Load user's fantasy teams into dropdown
async function loadUserFantasyTeams() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const token = await user.getIdToken();
  const res = await fetch("/user/teams", {
    headers: { Authorization: `Bearer ${token}` }
  });

  const teams = await res.json();
  const dropdown = document.getElementById("teamDropdown");
  dropdown.innerHTML = "";

  teams.forEach(team => {
    const opt = document.createElement("option");
    opt.value = team.id;
    opt.textContent = `${team.name} - ${team.points} pts`;
    dropdown.appendChild(opt);
  });
}

// Submit team change to backend
teamForm.onsubmit = async e => {
  e.preventDefault();
  const form = e.target;

  const user = firebase.auth().currentUser;
  if (!user || !selectedLeagueId) return;

  const token = await user.getIdToken();
  const payload = {
    league_id: selectedLeagueId,
    team_id: form.team_id.value
  };

  const res = await fetch("/user/update_team_in_league", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (res.ok && data.status === "team updated") {
    alert("Team updated successfully!");
    closeChangeTeamModal();
    showLeagueDetails({ id: selectedLeagueId, name: document.getElementById("leagueNameHeading").textContent });
  } else {
    alert(data.error || "Could not update team.");
  }
};