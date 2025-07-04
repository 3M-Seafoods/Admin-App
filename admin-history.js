auth.onAuthStateChanged(user => {
  if (!user) return location.href = "login.html";

  db.ref(`users/${user.uid}`).once("value").then(snap => {
    const info = snap.val();
    if (!info || info.role !== "admin") {
      alert("Unauthorized");
      auth.signOut();
    } else {
      document.getElementById("admin-user").textContent =
        "Logged in as: " + (info.displayName || user.email);
      populateUserDropdown();
    }
  });
});

document.getElementById("history-user").addEventListener("change", loadHistory);
document.getElementById("history-date").addEventListener("change", loadHistory);

function populateUserDropdown() {
  const userSelect = document.getElementById("history-user");
  userSelect.innerHTML = `<option value="all">All Users</option>`;

  db.ref("orders").once("value").then(snapshot => {
    const orders = snapshot.val() || {};
    const users = new Set();

    Object.values(orders).forEach(order => {
      if (order.username) users.add(order.username);
    });

    [...users].sort().forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      userSelect.appendChild(opt);
    });

    loadHistory(); // Load on first render
  });
}

function loadHistory() {
  const filterUser = document.getElementById("history-user").value;
  const filterDate = document.getElementById("history-date").value;
  const resultBox = document.getElementById("history-results");

  db.ref("orders").once("value").then(snapshot => {
    const orders = snapshot.val() || {};
    let html = "";

    const entries = Object.entries(orders);
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp); // Newest first

    entries.forEach(([id, order]) => {
      if (filterUser !== "all" && order.username !== filterUser) return;
      if (filterDate && order.date !== filterDate) return;

      let orderTotalCustomer = 0;
      let orderTotalBase = 0;

      html += `<div class="order-summary">
        <h3>User: ${order.username}</h3>
        <p><strong>Date:</strong> ${order.date} &nbsp;&nbsp; <strong>Time:</strong> ${new Date(order.timestamp).toLocaleTimeString()}</p>
        <ul>`;

      (order.items || []).forEach(item => {
        const name = item.item || item.key || "Unknown";
        const adjustedQty = parseFloat(order.supplierAdjustedItems?.[name] ?? item.qty ?? 0);
        const unitPrice = parseFloat(item.unitPrice ?? 0); // Customer price
        const basePrice = parseFloat(item.basePrice ?? 0); // Supplier price

        const totalCustomer = adjustedQty * unitPrice;
        const totalBase = adjustedQty * basePrice;
        const commission = totalCustomer - totalBase;

        orderTotalCustomer += totalCustomer;
        orderTotalBase += totalBase;

        html += `
          <li>
            <strong>${name}</strong><br>
            Qty: ${adjustedQty.toFixed(2)} kg<br>
            Base Price: ₱${basePrice.toFixed(2)}<br>
            Selling Price: ₱${unitPrice.toFixed(2)}<br>
            Base Total: ₱${totalBase.toFixed(2)}<br>
            Customer Total: ₱${totalCustomer.toFixed(2)}<br>
            <span style="color:green;">Commission: ₱${commission.toFixed(2)}</span>
          </li>
        `;
      });

      const totalCommission = orderTotalCustomer - orderTotalBase;

      html += `</ul>
        <p><strong>Status:</strong> ${order.status || "N/A"}</p>
        <p><strong>Total Base:</strong> ₱${orderTotalBase.toFixed(2)}</p>
        <p><strong>Total Customer:</strong> ₱${orderTotalCustomer.toFixed(2)}</p>
        <p><strong>Total Commission Earned:</strong> <span style="color:green;">₱${totalCommission.toFixed(2)}</span></p>
        <hr/>
      </div>`;
    });

    resultBox.innerHTML = html || "<p>No matching records found.</p>";
  });
}
