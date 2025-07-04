// admin-pricing.js

// UI keys (used in input IDs and span IDs)
const productKeys = [
  "tanigue",
  "shrimp40g",
  "shrimp200g",  // UI label & input ID
  "squidM",
  "squidCalamari"
];

// Mapping from UI keys to Firebase keys
const firebaseKeyMap = {
  tanigue: "tanigue",
  shrimp40g: "shrimp40g",
  shrimp200g: "shrimp200",  // <- Fix: maps UI ID to Firebase key
  squidM: "squidM",
  squidCalamari: "squidCalamari"
};

auth.onAuthStateChanged(user => {
  if (!user) return (location.href = "login.html");

  db.ref(`users/${user.uid}`).once("value").then(snap => {
    const data = snap.val();
    if (!data || data.role !== "admin") {
      alert("Unauthorized");
      auth.signOut();
      return;
    }

    document.getElementById("admin-user").textContent =
      "Logged in as: " + (data.displayName || user.email);

    loadPrices();
  });
});

function toPeso(value) {
  return `₱${parseFloat(value || 0).toFixed(2)}`;
}

function loadPrices() {
  Promise.all([
    db.ref("basePrices").once("value"),
    db.ref("finalPrices").once("value")
  ]).then(([baseSnap, finalSnap]) => {
    const base = baseSnap.val() || {};
    const final = finalSnap.val() || {};

    productKeys.forEach(uiKey => {
      const firebaseKey = firebaseKeyMap[uiKey];
      const baseEl = document.getElementById(`base-${uiKey}`);
      const finalEl = document.getElementById(`final-${uiKey}`);

      if (baseEl) baseEl.textContent = toPeso(base[firebaseKey]);
      if (finalEl) finalEl.textContent = toPeso(final[uiKey]);  // finalPrices already uses UI keys
    });
  });
}

function getMarkupInputs() {
  const markup = {};
  productKeys.forEach(key => {
    const input = document.getElementById(`markup-${key}`);
    markup[key] = parseFloat(input?.value) || 0;
  });
  return markup;
}

function applyMarkup() {
  const markup = getMarkupInputs();

  db.ref("commission").set(markup)
    .then(() => db.ref("basePrices").once("value"))
    .then(snapshot => {
      const base = snapshot.val() || {};

      const final = { updated: Date.now() };
      productKeys.forEach(uiKey => {
        const firebaseKey = firebaseKeyMap[uiKey];
        const baseVal = parseFloat(base[firebaseKey]) || 0;
        final[uiKey] = (baseVal + markup[uiKey]).toFixed(2);  // Save with UI key name
      });

      return db.ref("finalPrices").set(final);
    })
    .then(() => {
      document.getElementById("status").textContent = "✅ Final prices updated successfully.";
      loadPrices(); // Refresh display
    })
    .catch(err => {
      document.getElementById("status").textContent = "❌ Failed to update: " + err.message;
    });
}
