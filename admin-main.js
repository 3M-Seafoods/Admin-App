// admin-main.js

auth.onAuthStateChanged(user => {
  if (!user) return location.href = "login.html";
  db.ref(`users/${user.uid}`).once('value').then(snap => {
    const info = snap.val();
    if (info?.role !== 'admin') {
      alert('Unauthorized');
      auth.signOut();
    } else {
      document.getElementById("admin-user").textContent = `Logged in as: ${info.displayName || user.email}`;
      checkPriceAlert();
      checkNewOrdersAlert();
    }
  });
});

function logout() {
  auth.signOut().then(() => location.href = "index.html");
}

function checkPriceAlert() {
  db.ref("alerts/basePriceUpdated").on("value", snap => {
    const changed = snap.val();
    const el = document.getElementById("price-alert");
    el.innerHTML = changed === true ? "⚠️ New base price submitted by supplier!" : "";
  });
}

function checkNewOrdersAlert() {
  db.ref("alerts/newOrder").on("value", snap => {
    const val = snap.val();
    const el = document.getElementById("order-alert");
    el.innerHTML = val === true ? "📦 New orders have been submitted!" : "";
  });
}
