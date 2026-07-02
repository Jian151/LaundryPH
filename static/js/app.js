import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getDatabase, ref, set, get, child, update } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyApcHYUnrL-O0CNTkXM',
  authDomain: 'laundryph-71e55.firebaseapp.com',
  // Use the regional Realtime Database URL to avoid the "different region" warning
  databaseURL: 'https://laundryph-71e55-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'laundryph-71e55',
  // Correct storage bucket hostname to the expected Firebase pattern
  storageBucket: 'laundryph-71e55.appspot.com',
  messagingSenderId: '250589820629',
  appId: '1:250589820629:web:23a7722eaa33557e85145c',
  measurementId: 'G-7E2LDD9RQR'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let currentUserProfile = null;

const defaultServices = [
  { id: 'svc1', name: 'Wash', motto: 'Clean clothes fast', description: 'Standard wash service at ₱60 per kg.', price: 60, unit: 'kg', ownerUid: null, ownerName: null },
  { id: 'svc2', name: 'Wash & Dry', motto: 'Ready to wear', description: 'Wash and dry included at ₱90 per kg.', price: 90, unit: 'kg', ownerUid: null, ownerName: null },
  { id: 'svc3', name: 'Wash, Dry & Fold', motto: 'Perfectly folded', description: 'Complete care at ₱120 per kg.', price: 120, unit: 'kg', ownerUid: null, ownerName: null },
  { id: 'svc4', name: 'Dry Cleaning', motto: 'Premium garment care', description: 'Dry clean service at ₱180 per item.', price: 180, unit: 'item', ownerUid: null, ownerName: null }
];

function queryAll(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function showMessage(target, html) {
  if (target) target.innerHTML = html;
}

async function ensureDefaultServices() {
  try {
    const snapshot = await get(child(ref(db), 'services'));
    if (!snapshot.exists()) {
      const updates = {};
      defaultServices.forEach((service) => {
        updates[`services/${service.id}`] = service;
      });
      await update(ref(db), updates);
    }
  } catch (err) {
    console.error('ensureDefaultServices error:', err);
    const code = err && (err.code || err.codeName || '');
    if (String(err).toLowerCase().includes('permission') || String(code).toLowerCase().includes('permission')) {
      console.warn('Realtime Database permission denied while attempting to seed default services. Adjust your Realtime Database rules or seed data manually in the console.');
    }
  }
}

async function loadServices() {
  await ensureDefaultServices();
  const snapshot = await get(child(ref(db), 'services'));
  return snapshot.exists() ? Object.values(snapshot.val()) : [];
}

async function loadServiceById(serviceId) {
  const snapshot = await get(child(ref(db), `services/${serviceId}`));
  return snapshot.exists() ? snapshot.val() : null;
}

async function loadServiceByOwner(ownerUid) {
  const snapshot = await get(child(ref(db), 'services'));
  if (!snapshot.exists()) return null;
  const services = snapshot.val();
  return Object.values(services).find((item) => item.ownerUid === ownerUid) || null;
}

async function saveService(service) {
  await set(ref(db, `services/${service.id}`), service);
}

async function deleteServiceByOwner(ownerUid) {
  const snapshot = await get(child(ref(db), 'services'));
  if (!snapshot.exists()) return;
  const services = snapshot.val();
  for (const key in services) {
    if (services[key].ownerUid === ownerUid) {
      await set(ref(db, `services/${key}`), null);
      return;
    }
  }
}

async function getUserProfile(uid) {
  const snapshot = await get(child(ref(db), `users/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
}

async function saveUserProfile(uid, profile) {
  await set(ref(db, `users/${uid}`), profile);
}

async function saveOrder(order) {
  await set(ref(db, `orders/${order.id}`), order);
}

async function loadOrdersByCustomer(uid) {
  const snapshot = await get(child(ref(db), 'orders'));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()).filter((order) => order.customerUid === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function loadOrderById(orderId) {
  const snapshot = await get(child(ref(db), `orders/${orderId}`));
  return snapshot.exists() ? snapshot.val() : null;
}

function formatMoney(value) {
  return `₱${parseFloat(value || 0).toFixed(2)}`;
}

function updateNav() {
  const guestLinks = queryAll('.guest-only');
  const authLinks = queryAll('.auth-only');
  if (currentUserProfile) {
    guestLinks.forEach((el) => (el.style.display = 'none'));
    authLinks.forEach((el) => (el.style.display = 'list-item'));
  } else {
    guestLinks.forEach((el) => (el.style.display = 'list-item'));
    authLinks.forEach((el) => (el.style.display = 'none'));
  }

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.onclick = async () => {
      await signOut(auth);
      window.location.href = 'index.html';
    };
  }
}

function updatePricing() {
  const serviceSelect = document.getElementById('service');
  const quantityInput = document.getElementById('quantity');
  const pricingResult = document.getElementById('pricingResult');
  const quantityLabel = document.getElementById('quantityLabel');
  if (!serviceSelect || !quantityInput || !pricingResult || !quantityLabel) return;
  const selected = serviceSelect.options[serviceSelect.selectedIndex];
  const price = parseFloat(selected.dataset.price || '0');
  const quantity = parseFloat(quantityInput.value || '0');
  const total = price * quantity;
  quantityLabel.textContent = selected.dataset.unit === 'item' ? 'Quantity' : 'Weight (kg)';
  pricingResult.textContent = `Total: ${formatMoney(total)}`;
}

async function renderServiceOptions() {
  const serviceSelect = document.getElementById('service');
  if (!serviceSelect) return;
  const services = await loadServices();
  serviceSelect.innerHTML = services
    .map((service) => `<option value="${service.id}" data-price="${service.price}" data-unit="${service.unit}">${service.name} - ₱${service.price}/${service.unit}</option>`)
    .join('');
  updatePricing();
}

async function renderServicesPage() {
  const servicesList = document.getElementById('servicesList');
  if (!servicesList) return;
  const services = await loadServices();
  servicesList.innerHTML = services
    .map((service) => `
      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex flex-column flex-md-row justify-content-between gap-3">
            <div>
              <h5>${service.name}</h5>
              <p class="mb-1 text-muted">${service.motto}</p>
              <p class="mb-0">${service.description}</p>
            </div>
            <div class="text-md-end">
              <p class="mb-2"><strong>${formatMoney(service.price)}</strong> / ${service.unit}</p>
              <a href="service_detail.html?id=${service.id}" class="btn btn-outline-primary btn-sm">View Details</a>
              ${currentUserProfile && currentUserProfile.accountType === 'customer' ? `<a href="booking.html" class="btn btn-primary btn-sm mt-2 mt-md-0">Book</a>` : ''}
            </div>
          </div>
        </div>
      </div>
    `)
    .join('');
}

async function renderServiceDetailPage() {
  const serviceDetail = document.getElementById('serviceDetail');
  if (!serviceDetail) return;
  const params = new URLSearchParams(window.location.search);
  const serviceId = params.get('id');
  const service = await loadServiceById(serviceId);
  if (!service) {
    serviceDetail.innerHTML = '<div class="alert alert-warning">Service not found.</div>';
    return;
  }
  const bookingButton = currentUserProfile && currentUserProfile.accountType === 'customer'
    ? `<a href="booking.html" class="btn btn-primary">Book This Service</a>`
    : `<a href="login.html" class="btn btn-outline-primary">Login to Book</a>`;
  const ownerButton = currentUserProfile && currentUser?.uid === service.ownerUid
    ? `<a href="service_account.html" class="btn btn-outline-secondary ms-2">Edit My Service</a>`
    : '';

  serviceDetail.innerHTML = `
    <div class="card p-4">
      <h2>${service.name}</h2>
      <p class="text-muted">${service.motto}</p>
      <p>${service.description}</p>
      <p><strong>Price:</strong> ${formatMoney(service.price)} / ${service.unit}</p>
      <div class="d-flex flex-wrap gap-2">
        ${bookingButton}
        ${ownerButton}
      </div>
    </div>
  `;
}

async function renderBookingPage() {
  const bookingForm = document.getElementById('bookingForm');
  const bookingMessage = document.getElementById('bookingMessage');
  if (!bookingForm) return;
  if (!currentUserProfile) {
    bookingForm.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
    showMessage(bookingMessage, '<div class="alert alert-warning">Please log in with a customer account to book laundry.</div>');
    return;
  }
  if (currentUserProfile.accountType !== 'customer') {
    bookingForm.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
    showMessage(bookingMessage, '<div class="alert alert-warning">Only customer accounts can place laundry bookings.</div>');
    return;
  }
  bookingForm.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = false; });
  bookingForm.onsubmit = async (event) => {
    event.preventDefault();
    const requiredIds = ['pickupDate', 'pickupTime', 'deliveryDate', 'deliveryTime', 'quantity'];
    for (const id of requiredIds) {
      const field = document.getElementById(id);
      if (!field || !field.value) {
        showMessage(bookingMessage, '<div class="alert alert-danger">Please complete all required fields.</div>');
        return;
      }
    }
    const serviceSelect = document.getElementById('service');
    const selected = serviceSelect.options[serviceSelect.selectedIndex];
    const service = await loadServiceById(selected.value);
    const quantity = parseFloat(document.getElementById('quantity').value);
    const total = parseFloat(selected.dataset.price) * quantity;
    const orderId = `ORD${Date.now()}`;
    const order = {
      id: orderId,
      customerUid: currentUser.uid,
      customerEmail: currentUser.email,
      customerName: currentUserProfile.name,
      serviceId: service.id,
      serviceName: service.name,
      status: 'Received',
      total: total.toFixed(2),
      pickup: `${document.getElementById('pickupDate').value} ${document.getElementById('pickupTime').value}`,
      delivery: `${document.getElementById('deliveryDate').value} ${document.getElementById('deliveryTime').value}`,
      instructions: document.getElementById('instructions').value,
      createdAt: new Date().toISOString(),
      progress: 1,
      quantity,
      price: service.price,
      unit: service.unit
    };
    await saveOrder(order);
    showMessage(bookingMessage, `
      <div class="alert alert-success">
        Booking submitted!<br>
        <strong>Order number:</strong> ${order.id}<br>
        <strong>Total:</strong> ${formatMoney(order.total)}
      </div>
    `);
    bookingForm.reset();
    updatePricing();
  };
}

async function renderDashboardPage() {
  const dashboardOrders = document.getElementById('dashboardOrders');
  if (!dashboardOrders) return;
  const dashboardPending = document.getElementById('dashboardPending');
  const dashboardDelivered = document.getElementById('dashboardDelivered');
  const dashboardTotal = document.getElementById('dashboardTotal');
  const dashboardOrdersList = document.getElementById('dashboardOrdersList');
  if (!currentUserProfile) {
    dashboardOrders.textContent = '0';
    dashboardPending.textContent = '0';
    dashboardDelivered.textContent = '0';
    dashboardTotal.textContent = '₱0.00';
    dashboardOrdersList.innerHTML = '<div class="alert alert-warning">Please log in to view your dashboard.</div>';
    return;
  }
  const orders = await loadOrdersByCustomer(currentUser.uid);
  const pending = orders.filter((order) => order.status !== 'Delivered').length;
  const delivered = orders.filter((order) => order.status === 'Delivered').length;
  const total = orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
  dashboardOrders.textContent = orders.length;
  dashboardPending.textContent = pending;
  dashboardDelivered.textContent = delivered;
  dashboardTotal.textContent = formatMoney(total);
  dashboardOrdersList.innerHTML = orders.slice(0, 5).map((order) => `
    <div class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h6 class="mb-1">${order.id}</h6>
            <p class="mb-0 text-muted">${order.serviceName}</p>
          </div>
          <span class="badge bg-secondary">${order.status}</span>
        </div>
      </div>
    </div>
  `).join('');
}

async function renderHistoryPage() {
  const historyContent = document.getElementById('historyContent');
  if (!historyContent) return;
  if (!currentUserProfile) {
    historyContent.innerHTML = '<div class="alert alert-warning">Please log in to view your order history.</div>';
    return;
  }
  const orders = await loadOrdersByCustomer(currentUser.uid);
  if (!orders.length) {
    historyContent.innerHTML = '<div class="alert alert-info">You have no orders yet. Book a service to get started.</div>';
    return;
  }
  historyContent.innerHTML = orders.map((order) => `
    <div class="card mb-3">
      <div class="card-body">
        <div class="d-flex flex-column flex-md-row justify-content-between gap-3">
          <div>
            <h5 class="card-title">${order.id}</h5>
            <p class="mb-1"><strong>${order.serviceName}</strong></p>
            <p class="mb-1">Status: ${order.status}</p>
            <p class="mb-1">Total: ${formatMoney(order.total)}</p>
          </div>
          <div class="d-flex flex-column gap-2 align-items-start align-items-md-end">
            <a href="receipt.html#${order.id}" class="btn btn-outline-primary btn-sm">View Receipt</a>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

async function renderProfilePage() {
  const profileForm = document.getElementById('profileForm');
  if (!profileForm) return;
  const profileName = document.getElementById('profileName');
  const profilePhone = document.getElementById('profilePhone');
  const profileAddress = document.getElementById('profileAddress');
  const profileMessage = document.getElementById('profileMessage');
  if (!currentUserProfile) {
    profileForm.innerHTML = '<div class="alert alert-warning">Please log in to manage your profile.</div>';
    return;
  }
  profileName.value = currentUserProfile.name || '';
  profilePhone.value = currentUserProfile.phone || '';
  profileAddress.value = currentUserProfile.address || '';
  profileForm.onsubmit = async (event) => {
    event.preventDefault();
    const updatedProfile = {
      ...currentUserProfile,
      name: profileName.value,
      phone: profilePhone.value,
      address: profileAddress.value
    };
    await saveUserProfile(currentUser.uid, updatedProfile);
    currentUserProfile = updatedProfile;
    showMessage(profileMessage, '<div class="alert alert-success">Profile saved.</div>');
  };
}

async function renderReceiptPage() {
  const receiptContent = document.getElementById('receiptContent');
  if (!receiptContent) return;
  const orderId = window.location.hash.replace('#', '');
  if (!orderId) {
    receiptContent.innerHTML = '<div class="alert alert-warning">No receipt selected.</div>';
    return;
  }
  const order = await loadOrderById(orderId);
  if (!order) {
    receiptContent.innerHTML = '<div class="alert alert-warning">Receipt not found.</div>';
    return;
  }
  if (!currentUserProfile || currentUser.uid !== order.customerUid) {
    receiptContent.innerHTML = '<div class="alert alert-danger">You do not have permission to view this receipt.</div>';
    return;
  }
  receiptContent.innerHTML = `
    <div class="card p-4">
      <div class="d-flex justify-content-between align-items-start flex-column flex-md-row gap-3 mb-4">
        <div>
          <h2>Receipt ${order.id}</h2>
          <p class="mb-1">Service: ${order.serviceName}</p>
          <p class="mb-1">Status: ${order.status}</p>
          <p class="mb-0">Total: ${formatMoney(order.total)}</p>
        </div>
        <div class="text-start text-md-end">
          <button class="btn btn-primary" id="printReceipt">Print Receipt</button>
        </div>
      </div>
      <table class="table">
        <tbody>
          <tr><th>Pickup</th><td>${order.pickup}</td></tr>
          <tr><th>Delivery</th><td>${order.delivery}</td></tr>
          <tr><th>Instructions</th><td>${order.instructions || 'None'}</td></tr>
        </tbody>
      </table>
    </div>
  `;
  document.getElementById('printReceipt').onclick = () => window.print();
}

async function renderServiceAccountPage() {
  const serviceForm = document.getElementById('serviceForm');
  if (!serviceForm) return;
  const serviceName = document.getElementById('serviceName');
  const serviceMotto = document.getElementById('serviceMotto');
  const serviceDescription = document.getElementById('serviceDescription');
  const servicePrice = document.getElementById('servicePrice');
  const serviceUnit = document.getElementById('serviceUnit');
  const serviceMessage = document.getElementById('serviceMessage');
  const deleteService = document.getElementById('deleteService');
  if (!currentUserProfile || currentUserProfile.accountType !== 'service') {
    serviceForm.innerHTML = '<div class="alert alert-danger">Only laundry service accounts can access this store profile. Customers and guests cannot create a store.</div>';
    return;
  }
  let service = await loadServiceByOwner(currentUser.uid);
  if (!service) {
    service = {
      id: `service-${currentUser.uid}`,
      name: '',
      motto: '',
      description: '',
      price: 0,
      unit: 'kg',
      ownerUid: currentUser.uid,
      ownerName: currentUserProfile.name
    };
  }
  serviceName.value = service.name;
  serviceMotto.value = service.motto;
  serviceDescription.value = service.description;
  servicePrice.value = service.price;
  serviceUnit.value = service.unit;
  serviceForm.onsubmit = async (event) => {
    event.preventDefault();
    service.name = serviceName.value.trim();
    service.motto = serviceMotto.value.trim();
    service.description = serviceDescription.value.trim();
    service.price = parseFloat(servicePrice.value || 0);
    service.unit = serviceUnit.value;
    await saveService(service);
    showMessage(serviceMessage, '<div class="alert alert-success">Service details saved.</div>');
  };
  if (deleteService) {
    deleteService.onclick = async () => {
      await deleteServiceByOwner(currentUser.uid);
      showMessage(serviceMessage, '<div class="alert alert-warning">Your service has been removed.</div>');
      setTimeout(() => { window.location.href = 'services.html'; }, 800);
    };
  }
}

function setupRegisterPage() {
  const registerForm = document.getElementById('registerForm');
  const registerMessage = document.getElementById('registerMessage');
  if (!registerForm) return;
  registerForm.onsubmit = async (event) => {
    event.preventDefault();
    const name = registerForm.querySelector('[name="name"]').value.trim();
    const email = registerForm.querySelector('[name="email"]').value.trim().toLowerCase();
    const phone = registerForm.querySelector('[name="phone"]').value.trim();
    const address = registerForm.querySelector('[name="address"]').value.trim();
    const password = registerForm.querySelector('[name="password"]').value;
    const selectedAccountType = registerForm.querySelector('[name="accountType"]:checked');
    const accountType = selectedAccountType ? selectedAccountType.value : 'customer';
    if (!name || !email || !phone || !password) {
      showMessage(registerMessage, '<div class="alert alert-danger">Please complete all required fields.</div>');
      return;
    }
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      await updateProfile(user, { displayName: name });
      const profile = { name, email, phone, address, accountType };
      try {
        await saveUserProfile(user.uid, profile);
      } catch (dbErr) {
        console.error('saveUserProfile error:', dbErr);
        showMessage(registerMessage, '<div class="alert alert-warning">Account created, but we could not save your profile to the database. You can still log in — your Auth account was created.</div>');
        setTimeout(() => { window.location.href = accountType === 'service' ? 'service_account.html' : 'dashboard.html'; }, 1200);
        return;
      }
      showMessage(registerMessage, '<div class="alert alert-success">Account created — thank you for supporting LaundryPH! Redirecting...</div>');
      setTimeout(() => {
        window.location.href = accountType === 'service' ? 'service_account.html' : 'dashboard.html';
      }, 800);
    } catch (error) {
      showMessage(registerMessage, `<div class="alert alert-danger">${error.message}</div>`);
    }
  };
}

function setupLoginPage() {
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  if (!loginForm) return;
  loginForm.onsubmit = async (event) => {
    event.preventDefault();
    const email = loginForm.querySelector('[name="email"]').value.trim().toLowerCase();
    const password = loginForm.querySelector('[name="password"]').value;
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      const profile = await getUserProfile(user.uid);
      if (!profile) {
        showMessage(loginMessage, '<div class="alert alert-danger">User profile not found.</div>');
        return;
      }
      showMessage(loginMessage, '<div class="alert alert-success">Login successful. Redirecting...</div>');
      setTimeout(() => {
        window.location.href = profile.accountType === 'service' ? 'service_account.html' : 'dashboard.html';
      }, 600);
    } catch (error) {
      showMessage(loginMessage, `<div class="alert alert-danger">${error.message}</div>`);
    }
  };
}

function setupTrackPage() {
  const trackForm = document.getElementById('trackForm');
  const trackResult = document.getElementById('trackResult');
  if (!trackForm) return;
  trackForm.onsubmit = async (event) => {
    event.preventDefault();
    const orderNumber = document.getElementById('orderNumber').value.trim();
    if (!orderNumber) {
      showMessage(trackResult, '<div class="alert alert-danger">Please enter an order number.</div>');
      return;
    }
    const order = await loadOrderById(orderNumber);
    if (!order) {
      showMessage(trackResult, '<div class="alert alert-warning">Order number not found.</div>');
      return;
    }
    const statuses = ['Received', 'Driver Assigned', 'Picked Up', 'Washing', 'Drying', 'Ready for Delivery', 'Out for Delivery', 'Delivered'];
    const statusIndex = Math.min(order.progress, statuses.length - 1);
    const status = statuses[statusIndex];
    const progressValue = Math.round(((statusIndex + 1) / statuses.length) * 100);
    trackResult.innerHTML = `
      <div class="card p-3">
        <h5>Order ${order.id}</h5>
        <p>Status: <strong>${status}</strong></p>
        <div class="progress mb-3">
          <div class="progress-bar" role="progressbar" style="width: ${progressValue}%" aria-valuenow="${progressValue}" aria-valuemin="0" aria-valuemax="100">${progressValue}%</div>
        </div>
        <p class="mb-0">Pickup: ${order.pickup}</p>
        <p class="mb-0">Delivery: ${order.delivery}</p>
      </div>
    `;
  };
}

async function initPage() {
  updateNav();
  setupRegisterPage();
  setupLoginPage();
  setupTrackPage();
  await renderServiceOptions();
  await renderServicesPage();
  await renderServiceDetailPage();
  await renderBookingPage();
  await renderDashboardPage();
  await renderHistoryPage();
  await renderProfilePage();
  await renderReceiptPage();
  await renderServiceAccountPage();
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  currentUserProfile = null;
  if (user) {
    currentUserProfile = await getUserProfile(user.uid);
  }
  // Best-effort: seed default services after auth state is known (may be denied by rules).
  try {
    await ensureDefaultServices();
  } catch (err) {
    // ensureDefaultServices already logs errors; continue regardless.
  }
  await initPage();
});

window.addEventListener('DOMContentLoaded', async () => {
  await initPage();
});
