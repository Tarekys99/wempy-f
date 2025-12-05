// Shared cart logic and cart page rendering
const CART_KEY = 'wempyCart';
const API_BASE_URL = 'https://wempy.onrender.com';
let deliveryZones = [];
let selectedAddressId = null; // لحفظ AddressID المختار

function cartRead() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
function cartWrite(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartHUD();
}

// Load delivery zones from API
async function loadDeliveryZones() {
  try {
    const response = await fetch(`${API_BASE_URL}/zones/all_zones`);
    if (!response.ok) throw new Error('Failed to load zones');
    deliveryZones = await response.json();
    return deliveryZones;
  } catch (e) {
    console.error("Could not load delivery zones", e);
    return [];
  }
}

// Load payment methods from API
async function loadPaymentMethods() {
  try {
    const response = await fetch(`${API_BASE_URL}/payment/all_payment_methods`);
    if (!response.ok) throw new Error('Failed to load payment methods');
    const paymentMethods = await response.json();
    return paymentMethods.filter(pm => pm.IsActive);
  } catch (e) {
    console.error("Could not load payment methods", e);
    return [];
  }
}

// Get active shift
async function getActiveShift() {
  try {
    const response = await fetch(`${API_BASE_URL}/shifts/all_shifts`);
    if (!response.ok) throw new Error('Failed to load shifts');

    const shifts = await response.json();
    const activeShift = shifts.find(shift => shift.IsActive === true);

    if (!activeShift) {
      throw new Error('لا يوجد شفت حالياً - مواعيد العمل يومياً من 7 صباحاً حتى 4 مساءً');
    }

    console.log('Active shift found:', activeShift);
    return activeShift.ShiftID;
  } catch (error) {
    console.error('Error getting active shift:', error);
    throw error;
  }
}

function getDeliveryFee() {
  const zoneSelect = document.getElementById('delivery-zone');
  if (!zoneSelect || !zoneSelect.value) {
    return 0;
  }
  const selectedZone = deliveryZones.find(z => z.ZoneID === parseInt(zoneSelect.value));
  return selectedZone ? parseFloat(selectedZone.DeliveryCost) : 0;
}

async function calculateTotals(cart) {
  const subtotal = cart.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;
  return { subtotal, deliveryFee, total };
}
async function updateCartHUD() {
  const cart = cartRead();
  const { subtotal, deliveryFee, total } = await calculateTotals(cart);
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = String(cart.reduce((a, i) => a + i.qty, 0));
  const bar = document.getElementById('cart-summary');
  if (bar) bar.style.display = cart.length > 0 ? 'block' : 'none';
  const infoItems = document.querySelector('.cart-items-count');
  const infoTotal = document.querySelector('.cart-total');
  if (infoItems) infoItems.textContent = cart.length + ' عنصر';
  if (infoTotal) infoTotal.textContent = total.toFixed(2) + ' جنيه';
}

async function renderCartPage() {
  const container = document.getElementById('cart-items');
  if (!container) return; // not on cart page
  const cart = cartRead();
  container.innerHTML = '';
  cart.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <img src="${item.image || ''}" class="thumb" alt="${item.name}">
      <div class="info">
        <div class="name">${item.name}</div>
        <div class="price">${item.unitPrice.toFixed(2)} جنيه</div>
      </div>
      <div class="qty">
        <button class="minus">-</button>
        <span class="value">${item.qty}</span>
        <button class="plus">+</button>
      </div>
      <div class="line-total">${(item.qty * item.unitPrice).toFixed(2)} جنيه</div>
      <button class="remove">✕</button>
    `;
    const minus = row.querySelector('.minus');
    const plus = row.querySelector('.plus');
    const value = row.querySelector('.value');
    const remove = row.querySelector('.remove');
    const lineTotal = row.querySelector('.line-total');
    minus.addEventListener('click', () => {
      item.qty = Math.max(0, item.qty - 1);
      if (item.qty === 0) { cart.splice(idx, 1); }
      value.textContent = String(item.qty);
      lineTotal.textContent = (item.qty * item.unitPrice).toFixed(2) + ' جنيه';
      cartWrite(cart); renderCartPage();
    });
    plus.addEventListener('click', () => {
      item.qty += 1; value.textContent = String(item.qty);
      lineTotal.textContent = (item.qty * item.unitPrice).toFixed(2) + ' جنيه';
      cartWrite(cart); renderCartPage();
    });
    remove.addEventListener('click', () => {
      cart.splice(idx, 1); cartWrite(cart); renderCartPage();
    });
    container.appendChild(row);
  });
  const { subtotal, deliveryFee, total } = await calculateTotals(cart);
  const subtotalEl = document.getElementById('subtotal');
  if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2) + ' جنيه';
  const deliveryFeeEl = document.getElementById('delivery-fee');
  if (deliveryFeeEl) deliveryFeeEl.textContent = deliveryFee.toFixed(2) + ' جنيه';
  const grandEl = document.getElementById('grand');
  if (grandEl) grandEl.textContent = total.toFixed(2) + ' جنيه';
}

function getUserId() {
  // Get from sessionStorage only (expires when tab closes)
  return sessionStorage.getItem('wempyUserID');
}

async function getUserAddressesFromAPI(userId) {
  if (!userId) {
    console.warn('No user ID provided');
    return [];
  }

  try {
    console.log('Fetching addresses for userId:', userId);
    const response = await fetch(`${API_BASE_URL}/addresses/user/${userId}`);

    if (!response.ok) {
      console.error('API response not OK:', response.status, response.statusText);
      throw new Error('Failed to load addresses');
    }

    const addresses = await response.json();
    console.log('Raw addresses from API:', addresses);

    // تحويل البيانات من API إلى الصيغة المستخدمة في التطبيق
    return addresses.map(addr => ({
      addressId: addr.AddressID,  // ← مهم جداً!
      name: addr.RecipientName,
      phone: addr.RecipientPhone,
      phone2: addr.Phone2,
      address: addr.Street,
      building: addr.Building,
      city: addr.City,
      deliveryZone: addr.ZoneID,
      notes: addr.DeliveryNotes
    }));
  } catch (error) {
    console.error('Error loading addresses from API:', error);
    return [];
  }
}

async function saveAddressToAPI(addressData, userId) {
  if (!userId) {
    console.warn('No user ID provided, skipping API save');
    return null;
  }

  try {
    const payload = {
      RecipientName: addressData.name || '',
      Street: addressData.address || '',
      Building: addressData.building || '',
      City: 'الجيزة',
      RecipientPhone: addressData.phone || '',
      Phone2: addressData.phone2 || null,  // null بدلاً من ''
      DeliveryNotes: addressData.notes || null,  // null بدلاً من ''
      ZoneID: parseInt(addressData.deliveryZone) || 1
    };

    console.log('Saving address to API:', payload);

    const response = await fetch(`${API_BASE_URL}/addresses/create/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error);
      throw new Error(error.detail || 'فشل حفظ العنوان');
    }

    const result = await response.json();
    console.log('Address saved successfully:', result);
    return result;
  } catch (error) {
    console.error('Error saving address to API:', error);
    Toast.warning('تم حفظ الطلب لكن فشل حفظ العنوان: ' + error.message);
    return null;
  }
}

async function saveAddress(addressData) {
  const userId = getUserId();
  if (userId) {
    return await saveAddressToAPI(addressData, userId);
  }
  return null;
}

function loadSavedAddress(addressData) {
  // حفظ AddressID المختار
  selectedAddressId = addressData.addressId;
  console.log('Selected address ID:', selectedAddressId);

  document.getElementById('cust-name').value = addressData.name || '';
  document.getElementById('cust-phone').value = addressData.phone || '';
  document.getElementById('cust-phone2').value = addressData.phone2 || '';
  document.getElementById('cust-building').value = addressData.building || '';
  document.getElementById('cust-address').value = addressData.address || '';
  if (addressData.notes) {
    document.getElementById('cust-notes').value = addressData.notes;
  }
  if (addressData.deliveryZone) {
    document.getElementById('delivery-zone').value = addressData.deliveryZone;
    renderCartPage();
  }
  document.getElementById('saved-addresses-list').style.display = 'none';
}

async function displaySavedAddresses() {
  const container = document.getElementById('saved-addresses-list');

  // Toggle: if already visible, hide it
  if (container.style.display === 'block') {
    container.style.display = 'none';
    return;
  }

  const userId = getUserId();
  console.log('Display saved addresses - userId:', userId);

  if (!userId) {
    container.innerHTML = '<div class="no-saved-addresses">يرجى تسجيل الدخول لعرض العناوين المحفوظة</div>';
    container.style.display = 'block';
    return;
  }

  container.innerHTML = '<div class="no-saved-addresses">جاري التحميل...</div>';
  container.style.display = 'block';

  const addresses = await getUserAddressesFromAPI(userId);
  console.log('Loaded addresses:', addresses);

  if (addresses.length === 0) {
    container.innerHTML = '<div class="no-saved-addresses">لا توجد عناوين محفوظة</div>';
  } else {
    const zoneName = (zoneId) => {
      const zone = deliveryZones.find(z => z.ZoneID === parseInt(zoneId));
      return zone ? zone.ZoneName : '';
    };

    container.innerHTML = addresses.map((addr, idx) => `
      <div class="saved-address-item" data-index="${idx}">
        <div class="address-name">${addr.name} - ${addr.phone}</div>
        <div class="address-details">${addr.address}${addr.building ? ' - مبنى ' + addr.building : ''} ${addr.deliveryZone ? '• ' + zoneName(addr.deliveryZone) : ''}</div>
      </div>
    `).join('');

    container.querySelectorAll('.saved-address-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        loadSavedAddress(addresses[idx]);
      });
    });
  }
}

async function submitOrder() {
  const cart = cartRead();
  if (cart.length === 0) {
    Toast.warning('سلة المشتريات فارغة');
    return;
  }

  const zoneSelect = document.getElementById('delivery-zone');
  const selectedZone = deliveryZones.find(z => z.ZoneID === parseInt(zoneSelect?.value));

  if (!zoneSelect?.value) {
    Toast.warning('الرجاء اختيار منطقة التوصيل');
    return;
  }

  const paymentMethodSelect = document.getElementById('payment-method');
  if (!paymentMethodSelect?.value) {
    Toast.warning('الرجاء اختيار طريقة الدفع');
    return;
  }

  const customer = {
    name: document.getElementById('cust-name')?.value || 'غير محدد',
    phone: document.getElementById('cust-phone')?.value || 'غير محدد',
    phone2: document.getElementById('cust-phone2')?.value || '',
    building: document.getElementById('cust-building')?.value || '',
    address: document.getElementById('cust-address')?.value || 'غير محدد',
    deliveryZone: selectedZone ? selectedZone.ZoneName : 'غير محدد',
    externalItems: document.getElementById('external-items')?.value || '',
    notes: document.getElementById('cust-notes')?.value || ''
  };

  try {
    // 1. Check if user is logged in first
    const userId = getUserId();
    if (!userId) {
      Toast.error('يرجى تسجيل الدخول أولاً لإتمام الطلب');
      setTimeout(() => window.location.href = 'login.html', 2000);
      return;
    }

    // 2. Get or create AddressID
    let addressId;

    if (selectedAddressId) {
      // استخدام عنوان محفوظ
      addressId = selectedAddressId;
      console.log('Using saved address ID:', addressId);
    } else {
      // حفظ عنوان جديد
      const savedAddressResult = await saveAddress({
        name: customer.name,
        phone: customer.phone,
        phone2: customer.phone2,
        building: customer.building,
        address: customer.address,
        deliveryZone: zoneSelect?.value,
        notes: customer.notes
      });

      if (!savedAddressResult) {
        throw new Error('يرجى تسجيل الدخول أولاً لإتمام الطلب');
      }

      addressId = savedAddressResult.AddressID;
      console.log('New address saved with ID:', addressId);
    }

    // 3. Get active shift
    const shiftId = await getActiveShift();
    console.log('Active shift ID:', shiftId);

    // 4. Prepare order payload
    const orderPayload = {
      UserID: userId,
      AddressID: addressId,
      PaymentID: parseInt(paymentMethodSelect.value),
      ShiftID: shiftId,
      OrderNotes: customer.notes,
      ExternalNotes: customer.externalItems,
      items: cart.map(item => ({
        VariantID: item.variantId,
        Quantity: item.qty
      }))
    };

    console.log('Sending order:', orderPayload);

    // 5. Create order
    const response = await fetch(`${API_BASE_URL}/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'فشل إنشاء الطلب');
    }

    const result = await response.json();
    console.log('Order created:', result);

    Toast.success(`تم إرسال الطلب بنجاح! ✓<br>رقم الطلب: ${result.OrderNumber}<br>الإجمالي: ${result.TotalPrice} جنيه`, 5000);
    localStorage.removeItem(CART_KEY);
    setTimeout(() => window.location.href = 'login.html', 2000);

  } catch (error) {
    console.error('Error submitting order:', error);
    Toast.error(`خطأ في إرسال الطلب: ${error.message}`);
  }
}

async function populateDeliveryZones() {
  const zoneSelect = document.getElementById('delivery-zone');
  if (!zoneSelect) return;

  await loadDeliveryZones();

  deliveryZones.forEach(zone => {
    const option = document.createElement('option');
    option.value = zone.ZoneID;
    const cost = parseFloat(zone.DeliveryCost);
    option.textContent = `${zone.ZoneName} - ${cost === 0 ? 'مجاني' : cost.toFixed(2) + ' جنيه'}`;
    zoneSelect.appendChild(option);
  });

  zoneSelect.addEventListener('change', async () => {
    await renderCartPage();
  });
}

async function populatePaymentMethods() {
  const paymentSelect = document.getElementById('payment-method');
  if (!paymentSelect) return;

  const paymentMethods = await loadPaymentMethods();

  paymentMethods.forEach(method => {
    const option = document.createElement('option');
    option.value = method.PaymentID;
    option.textContent = method.PaymentName;
    paymentSelect.appendChild(option);
  });
}

async function initCartPage() {
  await populateDeliveryZones();
  await populatePaymentMethods();
  updateCartHUD();
  await renderCartPage();

  const submitBtn = document.getElementById('submit-order');
  if (submitBtn) submitBtn.addEventListener('click', submitOrder);

  const savedAddressesBtn = document.getElementById('show-saved-addresses');
  if (savedAddressesBtn) {
    savedAddressesBtn.addEventListener('click', displaySavedAddresses);
  }

  // إعادة تعيين selectedAddressId عند تعديل أي حقل يدوياً
  const addressFields = [
    'cust-name', 'cust-phone', 'cust-phone2',
    'cust-building', 'cust-address', 'delivery-zone'
  ];

  addressFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', () => {
        if (selectedAddressId) {
          console.log('Address field modified, resetting selectedAddressId');
          selectedAddressId = null;
        }
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await updateCartHUD();
  if (document.getElementById('cart-items')) initCartPage();
});
