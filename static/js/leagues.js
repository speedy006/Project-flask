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
  const res = await fetch("/user/join_private_league", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  const data = await res.json();
  if (data.status === "joined") {
    alert("Successfully joined private league!");
    loadJoinedLeagues();
  } else {
    alert(data.error || "Invalid code.");
  }
};