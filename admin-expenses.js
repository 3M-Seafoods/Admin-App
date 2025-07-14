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
  const list = document.getElementById("expense-list");
  const summary = document.getElementById("expense-summary");
  const selectedDate = document.getElementById("expense-filter-date")?.value;
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = selectedDate || today;

  db.ref("expenses").once("value").then(snapshot => {
    const data = snapshot.val() || {};
    let total = 0;

    const html = Object.entries(data)
      .filter(([, exp]) => exp.date === targetDate)
      .map(([key, exp]) => {
        const amount = parseFloat(exp.amount) || 0;
        total += amount;

        const needsApproval = exp.from === "supplier" && !exp.bankDeducted;

        return `
          <div class="expense-item" style="border:1px solid #ccc; margin-bottom:10px; padding:10px;">
            <strong>${exp.name}</strong><br>
            Amount: ₱${amount.toFixed(2)}<br>
            Submitted by: ${exp.submittedBy || "Unknown"} (${exp.from})<br>
            ${needsApproval ? `<button onclick="approveExpense('${key}', ${amount})">✅ Approve & Deduct</button>` : `<small>✅ Already deducted</small>`}
          </div>
        `;
      }).join("");

    summary.innerHTML = `📅 Total Expenses for ${targetDate}: <strong>₱${total.toFixed(2)}</strong>`;
    list.innerHTML = html || `<p>No expenses recorded for ${targetDate}.</p>`;
  });
}

function approveExpense(expenseId, amount) {
  const newBalance = bankAccount - amount;

  const updates = {
    [`expenses/${expenseId}/bankDeducted`]: true,
    "bank/total": newBalance,
  };

  db.ref().update(updates).then(() => {
    bankAccount = newBalance;
    loadBank();
    loadExpenses();
    alert(`✅ Expense approved. ₱${amount.toFixed(2)} deducted from bank.`);
  });
}
