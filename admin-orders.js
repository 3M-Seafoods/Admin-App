// admin-orders.js

let today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split("T")[0]; // Local date (UTC+8)
let basePrices = {};
let finalPrices = {};

const keyOverrides = {
  "shrimp200g": "shrimp200" // UI → Firebase
};

auth.onAuthStateChanged(user => {
  if (!user) return (location.href = "login.html");

  db.ref(`users/${user.uid}`).once("value").then(snap => {
    const info = snap.val();
    if (!info || info.role !== "admin") {
      alert("Unauthorized");
      auth.signOut();
    } else {
      document.getElementById("admin-user").textContent =
        "Logged in as: " + (info.displayName || user.email);
      loadPrices();
    }
  });
});

function normalizeKey(str) {
  return (str || "").toLowerCase().replace(/\s+/g, "");
}

function loadPrices() {
  Promise.all([
    db.ref("basePrices").once("value"),
    db.ref("finalPrices").once("value")
  ]).then(([baseSnap, finalSnap]) => {
    const rawBase = baseSnap.val() || {};
    const rawFinal = finalSnap.val() || {};

    basePrices = {};
    finalPrices = {};

    for (let key in rawBase) {
      basePrices[normalizeKey(key)] = parseFloat(rawBase[key]);
    }

    for (let key in rawFinal) {
      finalPrices[normalizeKey(key)] = parseFloat(rawFinal[key]);
    }

    // Apply key overrides
    for (let alias in keyOverrides) {
      const actualKey = keyOverrides[alias];
      const normActual = normalizeKey(actualKey);
      basePrices[normalizeKey(alias)] = basePrices[normActual] || 0;
      finalPrices[normalizeKey(alias)] = finalPrices[normActual] || 0;
    }

    populateUserDropdown();
  });
}

function populateUserDropdown() {
  const userSelect = document.getElementById("user-filter");
  userSelect.innerHTML = `<option value="all">All Users</option>`;

  db.ref("orders").once("value").then(snapshot => {
    const orders = snapshot.val() || {};
    const usersSet = new Set();

    Object.values(orders).forEach(order => {
      if (order.date === today && order.username) {
        usersSet.add(order.username);
      }
    });

    [...usersSet].sort().forEach(username => {
      const option = document.createElement("option");
      option.value = username;
      option.textContent = username;
      userSelect.appendChild(option);
    });

    loadOrders();
  });
}

function loadOrders() {
  const selectedUser = document.getElementById("user-filter").value;
  const results = document.getElementById("order-results");

  db.ref("orders").once("value").then(snapshot => {
    const orders = snapshot.val() || {};
    let html = "";
    let found = false;

    Object.entries(orders).forEach(([orderId, order]) => {
      if (order.date !== today) return;
      if (selectedUser !== "all" && order.username !== selectedUser) return;

      found = true;
      let orderTotalCustomer = 0;
      let orderTotalBase = 0;

      html += `<div class="order-summary">
        <h3>User: ${order.username}</h3>
        <p><strong>Time:</strong> ${new Date(order.timestamp).toLocaleTimeString()}</p>
        <ul>`;

      (order.items || []).forEach(item => {
        const itemName = item.item;
        const normalized = normalizeKey(itemName);
        const basePrice = basePrices[normalized] || 0;
        const finalPrice = finalPrices[normalized] || parseFloat(item.unitPrice || item.price || 0);
        const adjustedQty = parseFloat(order.supplierAdjustedItems?.[itemName]) || parseFloat(item.qty) || 0;

        const totalCustomer = adjustedQty * finalPrice;
        const totalBase = adjustedQty * basePrice;
        const commission = totalCustomer - totalBase;

        orderTotalCustomer += totalCustomer;
        orderTotalBase += totalBase;

        html += `
          <li>
            <strong>${itemName}</strong><br>
            Qty: ${adjustedQty} kg<br>
            Base Price: ₱${basePrice.toFixed(2)}<br>
            Selling Price: ₱${finalPrice.toFixed(2)}<br>
            Base Total: ₱${totalBase.toFixed(2)}<br>
            Customer Total: ₱${totalCustomer.toFixed(2)}<br>
            <span style="color:green;">Commission: ₱${commission.toFixed(2)}</span>
          </li>
        `;

        // OPTIONAL: Save basePrice & unitPrice in order to persist future history
        item.basePrice = basePrice;
        item.unitPrice = finalPrice;
        item.adjustedQty = adjustedQty;
        item.total = totalCustomer.toFixed(2);
      });

      const totalCommission = orderTotalCustomer - orderTotalBase;

      html += `</ul>
        <p><strong>Status:</strong> ${order.status || "N/A"}</p>
        <p><strong>Total Base:</strong> ₱${orderTotalBase.toFixed(2)}</p>
        <p><strong>Total Customer:</strong> ₱${orderTotalCustomer.toFixed(2)}</p>
        <p><strong>Total Commission Earned:</strong> <span style="color:green;">₱${totalCommission.toFixed(2)}</span></p>
        <hr/>
      </div>`;

      // ✅ Save updated item data back to Firebase to preserve snapshot for history
      db.ref(`orders/${orderId}`).update({
        items: order.items,
        summary: {
          totalBase: orderTotalBase,
          totalCustomer: orderTotalCustomer,
          totalCommission,
          updated: Date.now()
        }
      });
    });

    results.innerHTML = found ? html : "<p>No orders found for today.</p>";
  });
}
