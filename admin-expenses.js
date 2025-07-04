let bankAccount = 0;
let currentUser = null;

auth.onAuthStateChanged(user => {
  if (!user) return location.href = "login.html";
  currentUser = user;

  db.ref(`users/${user.uid}`).once("value").then(snap => {
    const info = snap.val();
    if (info?.role !== "admin") {
      alert("Unauthorized");
      auth.signOut();
    } else {
      document.getElementById("admin-user").textContent =
        "Logged in as: " + (info.displayName || user.email);
      loadBank();
      loadExpenses();
    }
  });
});

function logout() {
  auth.signOut().then(() => location.href = "login.html");
}

function loadBank() {
  db.ref("bank").once("value").then(snapshot => {
    bankAccount = snapshot.val()?.total || 0;
    const bankDiv = document.getElementById("bank-balance");
    if (bankDiv) {
      bankDiv.innerHTML = `💰 Current Bank Balance: ₱<strong>${bankAccount.toFixed(2)}</strong>`;
    }
  });
}

function addExpense() {
  const name = document.getElementById("expense-name").value.trim();
  const amount = parseFloat(document.getElementById("expense-amount").value);
  const date = document.getElementById("expense-date").value;

  if (!name || isNaN(amount) || !date) {
    return alert("Please complete all fields correctly.");
  }

  const expenseRef = db.ref("expenses").push();
  const newBalance = bankAccount - amount;

  const expenseData = {
    name,
    amount,
    date,
    createdBy: currentUser.uid,
    createdAt: new Date().toISOString(),
    submittedBy: currentUser.email || "admin",
    from: "admin",
    bankDeducted: true // Mark as deducted so we don't deduct again in list
  };

  Promise.all([
    expenseRef.set(expenseData),
    db.ref("bank").set({ total: newBalance })
  ]).then(() => {
    bankAccount = newBalance;
    alert("Expense recorded and bank updated.");
    document.getElementById("expense-name").value = "";
    document.getElementById("expense-amount").value = "";
    document.getElementById("expense-date").value = "";
    loadBank();
    loadExpenses();
  });
}

function loadExpenses() {
  db.ref("expenses").once("value").then(snapshot => {
    const list = document.getElementById("expense-list");
    const data = snapshot.val() || {};
    const sorted = Object.entries(data)
      .sort(([, a], [, b]) => new Date(b.createdAt) - new Date(a.createdAt));

    let newBalance = bankAccount;
    const updatedExpenses = [];

    const html = sorted.map(([key, exp]) => {
      const amount = parseFloat(exp.amount) || 0;

      // Auto-deduct supplier expenses if not already deducted
      if (exp.from === "supplier" && !exp.bankDeducted) {
        newBalance -= amount;
        exp.bankDeducted = true;
        updatedExpenses.push({ key, exp });
      }

      return `
        <div class="expense-item">
          <strong>${exp.name}</strong><br>
          Amount: ₱${amount.toFixed(2)}<br>
          Date: ${exp.date}<br>
          <small>Submitted by: ${exp.submittedBy || "Unknown"} (${exp.from})</small>
        </div>
      `;
    }).join("");

    // If supplier expenses were not deducted, deduct them now
    if (updatedExpenses.length > 0) {
      const updates = {};
      updatedExpenses.forEach(({ key, exp }) => {
        updates[`expenses/${key}/bankDeducted`] = true;
      });
      updates[`bank/total`] = newBalance;

      db.ref().update(updates).then(() => {
        bankAccount = newBalance;
        loadBank(); // Refresh bank display
      });
    }

    list.innerHTML = html || "<p>No expenses recorded yet.</p>";
  });
}
