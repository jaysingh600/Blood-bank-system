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

    switch (result.role) {
      case "donor": location.href = "donor.html"; break;
      case "requester": location.href = "blood-request.html"; break;
      case "admin": location.href = "admin-dashboard.html"; break;
      case "hospital": location.href = "hospital-dashboard.html"; break;
      default: location.href = "login.html";
    }
  } catch (err) {
    alert(err.message);
  }
});

// ================= REGISTER =================
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector("button");

  btn.disabled = true;
  btn.textContent = "Registering...";

  const data = Object.fromEntries(new FormData(form));

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error(await res.text());

    alert("Registered Successfully");
    location.href = "login.html";
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Register";
  }
});

// ================= LOGIN CHECK =================
function checkLogin(roleRequired) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    alert("Login required");
    location.href = "login.html";
    return false;
  }

  if (roleRequired && role !== roleRequired) {
    alert("Access denied");
    location.href = "login.html";
    return false;
  }

  return true;
}

// ================= LOGOUT =================
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.clear();
  location.href = "login.html";
});

// ================= ADMIN DASHBOARD =================
async function loadAdmin() {
  if (!checkLogin("admin")) return;

  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/admin/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    // ===== Inventory =====
    const invMap = {};
    data.inventory?.forEach(i => invMap[i.bloodGroup] = i.availableUnits);

    ["A+","A-","B+","B-","O+","O-","AB+","AB-"].forEach(bg => {
      const el = document.getElementById(`blood-${bg}`);
      if (el) el.textContent = invMap[bg] || 0;
    });

    // ===== Donor Table =====
    const donorTable = document.getElementById("donorTable");

    donorTable.innerHTML = data.donors?.map(d => `
      <tr>
        <td><img src="/uploads/${d.photo || 'default.png'}" width="50"></td>
        <td>${d.name}</td>
        <td>${d.email}</td>
        <td>${d.bloodGroup}</td>
        <td>${d.units}</td>
        <td>${d.mobile}</td>
        <td>${d.address}</td>

        <td>
          <span class="status-badge status-${(d.status || "pending").toLowerCase()}">
            ${d.status || "Pending"}
          </span>
        </td>

        <td>
          ${
            d.status === "pending"
              ? `
              <button class="btn btn-success btn-action" onclick="approveDonor('${d._id}')">Approve</button>
              <button class="btn btn-danger btn-action" onclick="rejectDonor('${d._id}')">Reject</button>
              `
              : d.status
          }
        </td>
      </tr>
    `).join("") || "";

    // ===== Request Table =====
    const requestTable = document.getElementById("requestTable");

    requestTable.innerHTML = data.requests?.map(r => `
      <tr>
        <td><img src="/uploads/${r.photo || 'default.png'}" width="50"></td>
        <td>${r.name}</td>
        <td>${r.email}</td>
        <td>${r.bloodGroup}</td>
        <td>${r.unitsNeeded}</td>
         <td>${r.mobile}</td>
        <td>${r.address}</td>

        <td>
          <span class="status-badge status-${(r.status || "pending").toLowerCase()}">
            ${r.status || "Pending"}
          </span>
        </td>

        <td>
          ${
            r.status === "pending"
              ? `
              <button class="btn btn-success btn-action" onclick="approveRequest('${r._id}')">Approve</button>
              <button class="btn btn-danger btn-action" onclick="rejectRequest('${r._id}')">Reject</button>
              `
              : r.status
          }
        </td>
      </tr>
    `).join("") || "";

  } catch (err) {
    console.error(err);
    alert("Error loading admin data");
  }
}

// ================= ACTION FUNCTIONS =================
async function approveDonor(id) {
  const token = localStorage.getItem("token");

  await fetch(`${API}/admin/approve-donor/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` }
  });

  loadAdmin();
}

async function rejectDonor(id) {
  const token = localStorage.getItem("token");

  await fetch(`${API}/admin/reject-donor/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` }
  });

  loadAdmin();
}

async function approveRequest(id) {
  const token = localStorage.getItem("token");

  await fetch(`${API}/admin/approve-request/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` }
  });

  loadAdmin();
}

async function rejectRequest(id) {
  const token = localStorage.getItem("token");

  await fetch(`${API}/admin/reject-request/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` }
  });

  loadAdmin();
}

// ================= LOAD =================
if (document.getElementById("adminPage")) {
  loadAdmin();
}


// ================= HOSPITAL DASHBOARD =================
async function loadHospitalDashboard() {
  if (!checkLogin("hospital")) return;

  try {
    const token = localStorage.getItem("token");

    // Fetch inventory
    const invRes = await fetch(`${API}/hospital/inventory`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const inventory = await invRes.json();
    if (!invRes.ok) throw new Error(inventory.message || "Failed to load inventory.");

    const invMap = {};
    inventory.forEach(i => invMap[i.bloodGroup] = i.availableUnits);
    ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].forEach(bg => {
      const el = document.getElementById(`blood-${bg}`);
      if (el) el.textContent = invMap[bg] || 0;
    });

    // Fetch donors
    const donorsRes = await fetch(`${API}/hospital/donors`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const donors = await donorsRes.json();
    if (!donorsRes.ok) throw new Error(donors.message || "Failed to load donors.");

    const donorTable = document.getElementById("donors-table");
    donorTable.innerHTML = donors?.map(d => `
      <tr>
        <td><img src="/uploads/${d.photo || 'default.png'}" width="50" style="border-radius:50%"></td>
        <td>${d.name}</td>
        <td>${d.email}</td>
        <td>${d.bloodGroup}</td>
        <td>${d.units}</td>
        <td>${d.mobile}</td>
        <td>${d.address}</td>
      </tr>
    `).join("") || '';

    // Fetch requests
    const reqRes = await fetch(`${API}/hospital/requests`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const requests = await reqRes.json();
    if (!reqRes.ok) throw new Error(requests.message || "Failed to load requests.");

    const requestTable = document.getElementById("requests-table");
    requestTable.innerHTML = requests?.map(r => `
      <tr>
        <td><img src="/uploads/${r.photo || 'default.png'}" width="50" style="border-radius:50%"></td>
        <td>${r.name}</td>
        <td>${r.email}</td>
        <td>${r.bloodGroup}</td>
        <td>${r.units}</td>
        <td>${r.contact || ''}</td>
        <td>${r.address}</td>
        <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
      </tr>
    `).join("") || '';

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// ================= LOAD DASHBOARDS =================
if (document.getElementById("adminPage")) loadAdmin();
if (document.getElementById("hospital-dashboard-page")) loadHospitalDashboard();

// ================= BLOOD REQUEST FORM =================
window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bloodRequestForm");
  const successMsg = document.getElementById("successMessage");
  if (!form || !checkLogin("requester")) return;

  const token = localStorage.getItem("token");
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

  // Prefill
  form.querySelector('input[name="name"]').value = loggedInUser.name || '';
  form.querySelector('input[name="email"]').value = loggedInUser.email || '';

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    try {
      const res = await fetch(`${API}/request`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }

      const data = await res.json();
      successMsg.classList.remove("d-none");
      setTimeout(() => successMsg.classList.add("d-none"), 2000);
      form.reset();
      form.querySelector('input[name="name"]').value = loggedInUser.name || '';
      form.querySelector('input[name="email"]').value = loggedInUser.email || '';
      alert(data.message);
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
});

// ================= DONOR FORM =================
document.getElementById("donorForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API}/donor`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Request failed");
    }

    const data = await res.json();
    alert("Donor request submitted successfully!");
    e.target.reset();
  } catch (err) {
    alert(err.message);
  }
});

// ================= DASHBOARD MENU SWITCH =================
const menuItems = document.querySelectorAll('aside ul li');
const sections = document.querySelectorAll('main .section');
menuItems.forEach(item => {
  item.addEventListener('click', () => {
    menuItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    sections.forEach(s => s.classList.remove('active'));

    const target = document.getElementById(item.getAttribute('data-target'));
    if (target) target.classList.add('active');
  });
});

// Show first section by default
sections.forEach((s, i) => { if(i===0) s.classList.add('active'); });