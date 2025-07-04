let bankAccount = 0;
let isBoss = false; // 👈 Flag to allow editing only for Boss Marvs

auth.onAuthStateChanged(user => {
  if (!user) return location.href = "login.html";

  db.ref(`users/${user.uid}`).once("value").then(snap => {
    const info = snap.val();
    const displayName = info.displayName || user.email;

    if (info?.role !== "admin") {
      alert("Unauthorized");
      auth.signOut();
    } else {
      document.getElementById("admin-user").textContent = "Logged in as: " + displayName;

      if (displayName === "Boss Marvs") {
        isBoss = true;
      }

      loadBankAccount();
      watchOrderCosts();
    }
  });
});

document.getElementById("earnings-date").addEventListener("change", loadEarnings);

function loadBankAccount() {
  db.ref("bank").once("value").then(snapshot => {
    const val = snapshot.val();
    bankAccount = val?.total || 0;

    let html = `💰 Company Bank: ₱<span id="bank-amount">${bankAccount.toFixed(2)}</span><br>`;

    if (isBoss) {
      html += `
        <button id="edit-bank-btn" onclick="showBankEdit()">✏️ Edit Bank Value</button>
        <div id="edit-bank-container" style="margin-top:8px; display:none;">
          <input id="edit-bank" type="number" step="0.01" placeholder="Enter new amount" />
          <button onclick="saveBankAmount()">💾 Save</button>
        </div>
      `;
    }

    document.getElementById("bank-balance").innerHTML = html;
  });
}

function showBankEdit() {
  document.getElementById("edit-bank-container").style.display = "block";
  document.getElementById("edit-bank-btn").style.display = "none";
}

function saveBankAmount() {
  const newVal = parseFloat(document.getElementById("edit-bank").value);
  if (isNaN(newVal)) return alert("Please enter a valid amount.");

  db.ref("bank").set({ total: newVal }).then(() => {
    bankAccount = newVal;
    document.getElementById("bank-amount").textContent = bankAccount.toFixed(2);
    document.getElementById("edit-bank").value = "";
    alert("Bank updated successfully!");
    document.getElementById("edit-bank-container").style.display = "none";
    document.getElementById("edit-bank-btn").style.display = "inline-block";
  });
}

function watchOrderCosts() {
  db.ref("orders").on("child_changed", snapshot => {
    const order = snapshot.val();
    const orderId = snapshot.key;
    if (order?.baseCostDeducted || !order.items) return;

    let totalBase = 0;
    order.items.forEach(item => {
      const name = item.item || item.key || "Unknown";
      const adjustedQty = parseFloat(order.supplierAdjustedItems?.[name] ?? item.qty ?? 0);
      const basePrice = parseFloat(item.basePrice || 0);
      totalBase += adjustedQty * basePrice;
    });

    if (totalBase > 0) {
      const newTotal = bankAccount - totalBase;
      db.ref("bank").set({ total: newTotal }).then(() => {
        bankAccount = newTotal;
        db.ref("orders/" + orderId).update({
          baseCostDeducted: true,
          deductedCost: totalBase.toFixed(2)
        });
        loadBankAccount();
      });
    }
  });
}

function loadEarnings() {
  const selectedDate = document.getElementById("earnings-date").value;
  const resultBox = document.getElementById("earnings-results");
  if (!selectedDate) return (resultBox.innerHTML = "");

  db.ref("orders").once("value").then(snapshot => {
    const orders = snapshot.val() || {};
    let html = "";
    let grandTotalCustomer = 0;
    let grandTotalBase = 0;
    let totalCommission = 0;
    let paidCustomerTotal = 0;

    Object.entries(orders).forEach(([orderId, order]) => {
      if (!order.date?.startsWith(selectedDate)) return;

      let totalCustomer = 0;
      let totalBase = 0;

      const itemList = (order.items || []).map(item => {
        const name = item.item || item.key || "Unknown";
        const adjustedQty = parseFloat(order.supplierAdjustedItems?.[name] ?? item.qty ?? 0);
        const unitPrice = parseFloat(item.unitPrice || 0);
        const basePrice = parseFloat(item.basePrice || 0);
        const subtotal = adjustedQty * unitPrice;
        const baseTotal = adjustedQty * basePrice;

        totalCustomer += subtotal;
        totalBase += baseTotal;

        return `
          <li>
            <strong>${name}</strong> — ${adjustedQty.toFixed(2)} kg × ₱${unitPrice.toFixed(2)} = ₱${subtotal.toFixed(2)}<br>
            <small style="color:gray;">Base: ₱${basePrice.toFixed(2)} × ${adjustedQty.toFixed(2)} = ₱${baseTotal.toFixed(2)}</small>
          </li>`;
      }).join("");

      const isPaid = !!order.isPaid;
      if (isPaid) paidCustomerTotal += totalCustomer;

      grandTotalCustomer += totalCustomer;
      grandTotalBase += totalBase;

      const commission = totalCustomer - totalBase;
      totalCommission += commission;

      html += `
        <div class="order-block">
          <h4>${order.username} — ${order.date}</h4>
          <p>Status: ${order.status} ${isPaid ? "✅ Paid" : "❌ Not Paid"}</p>
          <ul>${itemList}</ul>
          <p><strong>Total (Customer):</strong> ₱${totalCustomer.toFixed(2)}</p>
          <p><strong>Total (Base Cost):</strong> ₱${totalBase.toFixed(2)}</p>
          <p><strong>Commission Earned:</strong> <span style="color:green;">₱${commission.toFixed(2)}</span></p>
          ${!isPaid ? `<button onclick="markAsPaid('${orderId}', ${totalCustomer})">💵 Mark as Paid</button>` : ""}
        </div>`;
    });

    const unpaidSales = grandTotalCustomer - paidCustomerTotal;

    resultBox.innerHTML = `
      <div style="margin-bottom: 20px;">
        <strong>Total Sales:</strong> ₱${grandTotalCustomer.toFixed(2)}<br>
        <strong>Total Cost:</strong> ₱${grandTotalBase.toFixed(2)}<br>
        <strong>Unpaid Sales:</strong> <span style="color:red;">₱${unpaidSales.toFixed(2)}</span><br>
        <strong>Total Earnings:</strong> <span style="color:green;">₱${totalCommission.toFixed(2)}</span>
      </div>
      ${html || "<p>No records found for this month.</p>"}
    `;
  });
}

function markAsPaid(orderId, totalCustomer) {
  const newTotal = bankAccount + totalCustomer;

  db.ref("orders/" + orderId).update({
    isPaid: true,
    paidAmount: totalCustomer.toFixed(2)
  }).then(() => {
    db.ref("bank").set({ total: newTotal }).then(() => {
      bankAccount = newTotal;
      loadBankAccount();
      loadEarnings();
    });
  });
}
