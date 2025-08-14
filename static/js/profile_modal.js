document.addEventListener("DOMContentLoaded", () => {
  const profileImg = document.querySelector(".header-profile");
  if (profileImg) {
    profileImg.addEventListener("click", openProfileModal);
  }
});

function openProfileModal() {
  const modal = document.getElementById("profileModal");
  modal.style.display = "flex";

  const user = firebase.auth().currentUser;
  if (user) {
    const uid = user.uid;
    const userRef = firebase.firestore().collection("users").doc(uid);

    userRef.get().then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        document.getElementById("profileUsername").textContent = data.username || "N/A";
        document.getElementById("profileEmail").textContent = data.email || "N/A";
      } else {
        document.getElementById("profileUsername").textContent = "Unknown";
        document.getElementById("profileEmail").textContent = "Unknown";
      }
    }).catch((error) => {
      console.error("Error fetching user data:", error);
      document.getElementById("profileUsername").textContent = "Error";
      document.getElementById("profileEmail").textContent = "Error";
    });
  }
}

function closeProfileModal() {
  document.getElementById("profileModal").style.display = "none";
}

function logoutUser() {
  firebase.auth().signOut().then(() => {
    window.location.href = "/";
  }).catch((error) => {
    console.error("Logout error:", error);
  });
}