

const API = "http://localhost:5000/api";

// ================= LOGIN =================
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Login failed");

    localStorage.setItem("token", result.token);
    localStorage.setItem("role", result.role);
    localStorage.setItem("loggedInUser", JSON.stringify(result.user));

    if (result.role === "donor") location.href = "donor.html";
    if (result.role === "requester") location.href = "blood-request.html";
    if (result.role === "admin") location.href = "admin-dashboard.html";
    if (result.role === "hospital") location.href = "hospital-dashboard.html";
  } catch (err) { alert(err.message); }
});

// ================= REGISTER =================
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    alert("Registration successful! Please login.");
    location.href = "login.html";
  } catch (err) { alert(err.message); }
});

/// ================= ADMIN DASHBOARD =================
async function loadAdmin() {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login first!");
      location.href = "login.html";
      return;
    }

    const res = await fetch(`${API}/admin/all`, { 
      headers: { "Authorization": `Bearer ${token}` } 
    });

    if (!res.ok) throw new Error("Failed to load admin data. Unauthorized or server error.");

    const data = await res.json();

    // Inventory
    const invMap = {};
    if (data.inventory && data.inventory.length) {
      data.inventory.forEach(i => invMap[i.bloodGroup] = i.availableUnits);
    }
    document.getElementById("blood-A+").textContent = invMap['A+'] || 0;
    document.getElementById("blood-B+").textContent = invMap['B+'] || 0;
    document.getElementById("blood-O+").textContent = invMap['O+'] || 0;
    document.getElementById("blood-AB+").textContent = invMap['AB+'] || 0;

    // Donor Table
    const donorTable = document.getElementById("donorTable");
    if (donorTable && data.donors && data.donors.length) {
      donorTable.innerHTML = data.donors.map(d => `
        <tr>
          <td><img src="/uploads/${d.photo || 'default.png'}" width="50" style="border-radius:50%"></td>
          <td>${d.name}</td>
          <td>${d.bloodGroup}</td>
          <td>${d.units}</td>
          <td><span class="status-badge status-${d.status.toLowerCase()}">${d.status}</span></td>
          <td>
            ${d.status.toLowerCase() === 'pending' ? `<button onclick="approveDonor('${d._id}')" class="btn btn-success btn-sm">Approve</button>` : ''}
          </td>
        </tr>
      `).join("");
    }

    // Blood Requests Table
    const requestTable = document.getElementById("requestTable");
    if (requestTable && data.requests && data.requests.length) {
      requestTable.innerHTML = data.requests.map(r => `
        <tr>
          <td><img src="/uploads/${r.photo || 'default.png'}" width="50" style="border-radius:50%"></td>
          <td>${r.name}</td>
          <td>${r.bloodGroup}</td>
          <td>${r.unitsNeeded}</td>
          <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
          <td>
            ${r.status.toLowerCase() === 'pending' ? `<button onclick="approveRequest('${r._id}')" class="btn btn-danger btn-sm">Approve</button>` : ''}
          </td>
        </tr>
      `).join("");
    }

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// Approve Donor
async function approveDonor(id) {
  try {
    const token = localStorage.getItem("token");
    await fetch(`${API}/admin/approve-donor/${id}`, { 
      method: "PUT", 
      headers: { "Authorization": `Bearer ${token}` } 
    });
    loadAdmin();
  } catch (err) {
    console.error(err);
    alert("Failed to approve donor.");
  }
}

// Approve Blood Request
async function approveRequest(id) {
  try {
    const token = localStorage.getItem("token");
    await fetch(`${API}/admin/approve-request/${id}`, { 
      method: "PUT", 
      headers: { "Authorization": `Bearer ${token}` } 
    });
    loadAdmin();
  } catch (err) {
    console.error(err);
    alert("Failed to approve request.");
  }
}

if (document.getElementById("adminPage")) loadAdmin();
// ================= LOGOUT =================
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.clear();
  location.href = "login.html";
});





// ================= HOSPITAL DASHBOARD JS =================

// --- Sidebar Section Switching ---
const menuItems = document.querySelectorAll("#menu li");
const sections = document.querySelectorAll("main .section");

menuItems.forEach(item => {
  item.addEventListener("click", () => {
    // Highlight active menu
    menuItems.forEach(i => i.classList.remove("active"));
    item.classList.add("active");

    // Show corresponding section
    const target = item.getAttribute("data-target");
    sections.forEach(sec => sec.classList.toggle("active", sec.id === target));
  });
});

// --- Load Donors & Requests Dynamically ---
async function loadHospitalDashboard() {
  try {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "hospital") {
      alert("Please login as Hospital!");
      location.href = "login.html";
      return;
    }

    // Fetch donors and requests
    const [donorsRes, requestsRes, invRes] = await Promise.all([
      fetch(`${API}/hospital/donors`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${API}/hospital/requests`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${API}/admin/all`, { headers: { "Authorization": `Bearer ${token}` } })
    ]);

    const donors = await donorsRes.json();
    const requests = await requestsRes.json();
    const invData = await invRes.json();

    // Populate Donors Table
    const donorsTable = document.getElementById("donors-table");
    if (donorsTable) {
      donorsTable.innerHTML = donors.map(d => `
        <tr>
          <td><img src="/uploads/${d.photo || 'default.png'}" width="50" style="border-radius:50%"></td>
          <td>${d.name}</td>
          <td>${d.email}</td>
          <td>${d.bloodGroup}</td>
          <td>${d.units}</td>
          <td>${d.mobile}</td>
          <td>${d.address}</td>
        </tr>
      `).join("");
    }

    // Populate Blood Requests Table
    const requestsTable = document.getElementById("requests-table");
    if (requestsTable) {
      requestsTable.innerHTML = requests.map(r => `
        <tr>
          <td><img src="/uploads/${r.photo || 'default.png'}" width="50" style="border-radius:50%"></td>
          <td>${r.name}</td>
          <td>${r.email}</td>
          <td>${r.bloodGroup}</td>
          <td>${r.unitsNeeded}</td>
          <td>${r.contact}</td>
          <td>${r.address}</td>
          <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>
      `).join("");
    }

    // Update Inventory
    if (window.updateBloodInventory && invData.inventory) {
      updateBloodInventory(invData.inventory);
    }

  } catch (err) {
    console.error("Error loading hospital dashboard:", err);
    alert("Failed to load dashboard data.");
  }
}

// --- Blood Inventory Update Function ---
function updateBloodInventory(inventory) {
  const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
  bloodGroups.forEach(bg => {
    const el = document.getElementById(`blood-${bg}`);
    if (el && inventory[bg] != null) el.textContent = inventory[bg];
  });
}


// --- Initialize Dashboard only on hospital page ---
if (document.getElementById("hospital-dashboard-page")) {
  document.addEventListener("DOMContentLoaded", loadHospitalDashboard);
}


//blood-request page
window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bloodRequestForm");
  const successMsg = document.getElementById("successMessage");

  const token = localStorage.getItem("token");
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

  if (!token || !loggedInUser) {
    alert("Please login first.");
    location.href = "login.html";
    return;
  }

  // Prefill name & email
  form.querySelector('input[name="name"]').value = loggedInUser.name;
  form.querySelector('input[name="email"]').value = loggedInUser.email;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    try {
      const res = await fetch(`${API}/request`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });

      const data = await res.json(); // JSON parse safe
      if (!res.ok) throw new Error(data.message || "Request failed");

      successMsg.classList.remove("d-none");
      setTimeout(() => successMsg.classList.add("d-none"), 2000);
      form.reset();
      form.querySelector('input[name="name"]').value = loggedInUser.name;
      form.querySelector('input[name="email"]').value = loggedInUser.email;
      alert(data.message);

    } catch (err) {
      alert("Error: " + err.message);
    }
  });
});