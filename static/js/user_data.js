window.onload = () => {
  loadTeams();
};

function loadTeams() {
  fetch("/admin/data/teams")
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("teamList");
      container.innerHTML = "";

      data.forEach(team => {
        const card = document.createElement("div");
        card.className = "grid-card";
        card.innerHTML = `
          <h4>${team.name}</h4>
          <p>Points: ${team.points}</p>
          <p>Price: $${team.price.toLocaleString()}</p>
        `;
        container.appendChild(card);
      });
    });
}