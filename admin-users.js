// admin-users.js

auth.onAuthStateChanged(user => {
  if (!user) return (location.href = "login.html");

  db.ref("users/" + user.uid).once("value").then(snap => {
    const info = snap.val();
    if (!info || info.role !== "admin") {
      alert("Unauthorized access");
      auth.signOut();
    } else {
      document.getElementById("admin-user").textContent = "Logged in as: " + (info.displayName || user.email);
      loadUsers();
    }
  });
});

function registerUser() {
  const email = document.getElementById("newEmail").value;
  const password = document.getElementById("newPassword").value;
  const displayName = document.getElementById("displayName").value;
  const role = document.getElementById("roleSelect").value;
  const statusEl = document.getElementById("register-status");

  const secondaryApp = firebase.initializeApp(firebase.app().options, "Secondary");

  secondaryApp.auth().createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      const uid = userCredential.user.uid;
      return db.ref("users/" + uid).set({
        email,
        displayName: displayName || email,
        role
      });
    })
    .then(() => {
      statusEl.textContent = "✅ User registered!";
      loadUsers();
    })
    .catch(err => {
      statusEl.textContent = "❌ " + err.message;
    })
    .finally(() => {
      secondaryApp.delete();
    });
}

function loadUsers() {
  db.ref("users").once("value").then(snap => {
    const users = snap.val() || {};
    const userList = document.getElementById("user-list");

    let html = `<table style="width:100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid #00796b;">
          <th style="text-align: left; padding: 8px;">Name</th>
          <th style="text-align: left; padding: 8px;">Email</th>
          <th style="text-align: left; padding: 8px;">Role</th>
        </tr>
      </thead>
      <tbody>`;

    Object.values(users).forEach(user => {
      html += `<tr style="border-bottom: 1px solid #ccc;">
        <td style="padding: 8px;">${user.displayName || ""}</td>
        <td style="padding: 8px;">${user.email}</td>
        <td style="padding: 8px;">${user.role}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    userList.innerHTML = html;
  });
}
