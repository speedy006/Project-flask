window.onload = () => {
  loadTeams();
  loadDrivers();
  loadCalendar();
};

function loadTeams() {
  fetch("/admin/data/teams")
    .then(res => res.json())
    .then(data => {
      const grid = document.getElementById("teamsGrid");
      grid.innerHTML = "";
      data.forEach(team => {
        const block = document.createElement("div");
        block.className = "info-block";
        block.innerHTML = `
          <h4>${team.name}</h4>
          <p>Points: ${team.score}</p>
          <p>Price: $${team.price.toLocaleString()}</p>
        `;
        grid.appendChild(block);
      });
    });
}

function loadDrivers() {
  fetch("/admin/data/drivers")
    .then(res => res.json())
    .then(data => {
      const grid = document.getElementById("driversGrid");
      grid.innerHTML = "";
      data.forEach(driver => {
        const block = document.createElement("div");
        block.className = "info-block";
        block.innerHTML = `
          <h4>${driver.name}</h4>
          <p>Points: ${driver.points}</p>
          <p>Price: $${driver.price.toLocaleString()}</p>
        `;
        grid.appendChild(block);
      });
    });
}

function loadCalendar() {
  fetch("/admin/data/races")
    .then(res => res.json())
    .then(data => {
      const grid = document.getElementById("calendarGrid");
      grid.innerHTML = "";
      data.forEach(race => {
        const block = document.createElement("div");
        block.className = "info-block";
        block.innerHTML = `
          <h4>${race.name}</h4>
          <p>Date: ${race.date}</p>
        `;
        grid.appendChild(block);
      });
    });
}