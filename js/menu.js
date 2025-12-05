// Menu page logic: load from API, render, manage add-to-cart
const CART_KEY = 'wempyCart';
const API_BASE_URL = 'https://wempy.onrender.com';

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartUI();
}
function cartTotals(cart) {
  const items = cart.reduce((a, i) => a + i.qty, 0);
  const total = cart.reduce((a, i) => a + i.qty * i.unitPrice, 0);
  return { items, total };
}
function updateCartUI() {
  const cart = readCart();
  const { items, total } = cartTotals(cart);
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = String(items);
  const bar = document.getElementById('cart-summary');
  if (bar) bar.style.display = items > 0 ? 'block' : 'none';
  const infoItems = document.querySelector('.cart-items-count');
  const infoTotal = document.querySelector('.cart-total');
  if (infoItems) infoItems.textContent = items + ' عنصر';
  if (infoTotal) infoTotal.textContent = total.toFixed(2) + ' جنيه';
}

// Load categories from API
async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/categories/get_all_categories`);
    if (!response.ok) throw new Error('Failed to load categories');
    return await response.json();
  } catch (error) {
    console.error('Error loading categories:', error);
    return [];
  }
}

// Load all products from API
async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE_URL}/products/all_products`);
    if (!response.ok) throw new Error('Failed to load products');
    return await response.json();
  } catch (error) {
    console.error('Error loading products:', error);
    return [];
  }
}

// Load product variants (with sizes, types, prices)
async function loadProductVariants() {
  try {
    const response = await fetch(`${API_BASE_URL}/product_variants/all_products`);
    if (!response.ok) throw new Error('Failed to load product variants');
    return await response.json();
  } catch (error) {
    console.error('Error loading product variants:', error);
    return [];
  }
}

// Get all variants for a specific product
function getProductVariants(allVariants, productID) {
  return allVariants.filter(v => v.ProductID === productID);
}

// Filter products by category ID
function getProductsByCategory(products, categoryID) {
  return products.filter(p => p.CategoryID === categoryID);
}



function createCard(item, category, allVariants = []) {
  const card = document.createElement('div');
  card.className = 'menu-card';

  // Handle API products (from backend)
  const isAPIProduct = item.ProductID !== undefined;

  if (isAPIProduct) {
    const imgPath = item.ImageUrl || '';
    const fullImageUrl = imgPath ? `${API_BASE_URL}/${imgPath}` : '';
    const description = item.Description && item.Description !== 'لا وصف' ? item.Description : '';

    // Get variants for this product
    const variants = getProductVariants(allVariants, item.ProductID);

    // Build options HTML
    let optionsHtml = '';
    let defaultPrice = '0.00';

    if (variants.length > 0) {
      // Check for multiple types (for sandwiches)
      const nonDefaultTypes = variants.filter(v => v.types.TypeName !== 'افتراضي');

      // Check for multiple sizes (for dishes)
      const nonDefaultSizes = variants.filter(v => v.sizes.SizeName !== 'افتراضي');

      if (nonDefaultTypes.length > 1) {
        // Multiple types - show type options
        optionsHtml = '<div class="options-group">';
        nonDefaultTypes.forEach((variant, index) => {
          optionsHtml += `
            <label>
              <input type="radio" name="option-${item.ProductID}" value="${variant.VariantID}" data-price="${variant.Price}" ${index === 0 ? 'checked' : ''}>
              ${variant.types.TypeName} - ${parseFloat(variant.Price).toFixed(2)} جنيه
            </label>
          `;
        });
        optionsHtml += '</div>';
        defaultPrice = nonDefaultTypes[0].Price;
      } else if (nonDefaultSizes.length > 1) {
        // Multiple sizes - show size options
        optionsHtml = '<div class="options-group">';
        nonDefaultSizes.forEach((variant, index) => {
          optionsHtml += `
            <label>
              <input type="radio" name="option-${item.ProductID}" value="${variant.VariantID}" data-price="${variant.Price}" ${index === 0 ? 'checked' : ''}>
              ${variant.sizes.SizeName} - ${parseFloat(variant.Price).toFixed(2)} جنيه
            </label>
          `;
        });
        optionsHtml += '</div>';
        defaultPrice = nonDefaultSizes[0].Price;
      } else {
        // Single variant - just show price
        defaultPrice = variants[0].Price;
      }
    }

    card.innerHTML = `
      <img src="${fullImageUrl}" alt="${item.Name}">
      <div class="content">
        <div class="title">${item.Name || ''}</div>
        ${description ? `<div class="desc">${description}</div>` : ''}
        ${optionsHtml}
        <div class="price">${parseFloat(defaultPrice).toFixed(2)} جنيه</div>
        <div class="controls">
          <div class="qty">
            <button class="minus" aria-label="decrease">-</button>
            <span class="value">1</span>
            <button class="plus" aria-label="increase">+</button>
          </div>
          <button class="add-btn">أضف للسلة</button>
        </div>
      </div>`;

    const minus = card.querySelector('.minus');
    const plus = card.querySelector('.plus');
    const value = card.querySelector('.value');
    const addBtn = card.querySelector('.add-btn');
    const priceEl = card.querySelector('.price');

    // Update price when type changes
    card.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        priceEl.textContent = `${parseFloat(e.target.dataset.price).toFixed(2)} جنيه`;
      });
    });

    let qty = 1;
    minus.addEventListener('click', () => { qty = Math.max(1, qty - 1); value.textContent = String(qty); });
    plus.addEventListener('click', () => { qty += 1; value.textContent = String(qty); });

    addBtn.addEventListener('click', () => {
      if (qty <= 0) {
        Toast.warning("الرجاء تحديد الكمية أولاً.");
        return;
      }

      const cart = readCart();

      // Get selected variant
      let selectedVariant = variants[0]; // Default to first variant
      const selectedRadio = card.querySelector('input[type="radio"]:checked');
      if (selectedRadio) {
        const variantId = parseInt(selectedRadio.value);
        selectedVariant = variants.find(v => v.VariantID === variantId) || variants[0];
      }

      // Build item name with size/type
      let itemName = item.Name;
      if (selectedVariant.sizes.SizeName !== 'افتراضي') {
        itemName += ` (${selectedVariant.sizes.SizeName})`;
      }
      if (selectedVariant.types.TypeName !== 'افتراضي') {
        itemName += ` (${selectedVariant.types.TypeName})`;
      }

      // Check if item already exists in cart
      const existing = cart.find(i => i.variantId === selectedVariant.VariantID);
      if (existing) {
        existing.qty += qty;
      } else {
        cart.push({
          variantId: selectedVariant.VariantID,
          name: itemName,
          unitPrice: parseFloat(selectedVariant.Price),
          qty: qty,
          image: fullImageUrl,
          category: category
        });
      }

      writeCart(cart);
      const addedQty = qty;
      qty = 1;
      value.textContent = '1';
      Toast.success(`تمت إضافة ${addedQty}x ${itemName} إلى سلة المشتريات`);
    });

    return card;
  }

  // Handle old JSON products (local data)
  let priceText = item.price ? item.price : (item.size && item.size.length ? item.size[0].price : 0);
  // Handle ranges like "15-20" => take minimum
  if (typeof priceText === 'string' && priceText.includes('-')) {
    const parts = priceText.split('-').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
    if (parts.length) priceText = Math.min(...parts);
  }
  const unitPrice = Number(priceText) || 0;
  const img = item.image || '';
  let optionsHtml = '';
  let basePrice = item.price;

  if (item.size && item.size.length > 0) {
    basePrice = item.size[0].price; // Default to first size's price
    optionsHtml = `<div class="options-group" data-id="${item.id}">`;
    optionsHtml += item.size.map((s, index) => `
      <label>
        <input type="radio" name="size-${item.id}" value="${s.price}" data-name="${s.name}" ${index === 0 ? 'checked' : ''}>
        ${s.name} (${s.price.toFixed(2)} جنيه)
      </label>
    `).join('');
    optionsHtml += `</div>`;
  } else if (item.type && item.type.length > 0) {
    optionsHtml = `<div class="options-group" data-id="${item.id}">`;
    optionsHtml += item.type.map((t, index) => `
      <label>
        <input type="radio" name="type-${item.id}" value="${t}" ${index === 0 ? 'checked' : ''}>
        ${t}
      </label>
    `).join('');
    optionsHtml += `</div>`;
  }

  const priceDisplay = isNaN(parseFloat(basePrice)) ? basePrice : `${parseFloat(basePrice).toFixed(2)} جنيه`;

  card.innerHTML = `
    <img src="${img}" alt="${item.title}">
    <div class="content">
      <div class="title">${item.title || ''}</div>
      <div class="desc">${item.description || ''}</div>
      ${optionsHtml}
      <div class="price">${priceDisplay}</div>
      <div class="controls">
        <div class="qty">
          <button class="minus" aria-label="decrease">-</button>
          <span class="value">1</span>
          <button class="plus" aria-label="increase">+</button>
        </div>
        <button class="add-btn">أضف للسلة</button>
      </div>
    </div>`;

  const minus = card.querySelector('.minus');
  const plus = card.querySelector('.plus');
  const value = card.querySelector('.value');
  const addBtn = card.querySelector('.add-btn');

  let qty = 1;
  value.textContent = '1';
  minus.addEventListener('click', () => { qty = Math.max(1, qty - 1); value.textContent = String(qty); });
  plus.addEventListener('click', () => { qty += 1; value.textContent = String(qty); });

  addBtn.addEventListener('click', () => {
    if (qty <= 0) {
      Toast.warning("الرجاء تحديد الكمية أولاً.");
      return;
    }

    const cart = readCart();
    let finalPrice = unitPrice;
    let finalName = item.title;
    let cartItemId = item.id;

    const sizeSelector = card.querySelector(`input[name="size-${item.id}"]:checked`);
    if (sizeSelector) {
      finalPrice = parseFloat(sizeSelector.value);
      const sizeName = sizeSelector.dataset.name;
      finalName = `${item.title} (${sizeName})`;
      cartItemId = `${item.id}-${sizeName}`;
    }

    const typeSelector = card.querySelector(`input[name="type-${item.id}"]:checked`);
    if (typeSelector) {
      const typeName = typeSelector.value;
      finalName = `${item.title} (${typeName})`;
      cartItemId = `${item.id}-${typeName}`;
    }

    const existing = cart.find(i => i.id === cartItemId);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ id: cartItemId, name: finalName, unitPrice: finalPrice, qty, image: img, category });
    }

    writeCart(cart);
    const addedQty = qty;
    qty = 1;
    value.textContent = '1';
    Toast.success(`تمت إضافة ${addedQty}x ${finalName} إلى سلة المشتريات`);
  });

  // Add event listeners for radio buttons to update price
  card.querySelectorAll('.options-group input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const priceEl = card.querySelector('.price');
      if (e.target.name.startsWith('size-')) {
        const newPrice = parseFloat(e.target.value);
        priceEl.textContent = `${newPrice.toFixed(2)} جنيه`;
      }
    });
  });

  return card;
}

function renderList(list, containerId, category, allVariants = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  list.forEach(item => container.appendChild(createCard(item, category, allVariants)));
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.category;
    document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
    document.getElementById(target).classList.add('active');
    window.location.hash = target;
  }));
  if (location.hash) {
    const id = location.hash.replace('#', '');
    const targetBtn = Array.from(tabs).find(b => b.dataset.category === id);
    if (targetBtn) targetBtn.click();
  }
}

// Render category tabs dynamically
function renderCategoryTabs(categories) {
  const tabsContainer = document.querySelector('.category-tabs');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = '';

  categories.forEach((cat, index) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (index === 0 ? ' active' : '');
    btn.dataset.category = `category-${cat.CategoryID}`;
    btn.textContent = cat.CategoryName;
    tabsContainer.appendChild(btn);
  });
}

// Render category sections dynamically
function renderCategorySections(categories) {
  const container = document.querySelector('.menu-content .container');
  if (!container) return;

  container.innerHTML = '';

  categories.forEach((cat, index) => {
    const section = document.createElement('section');
    section.id = `category-${cat.CategoryID}`;
    section.className = 'menu-section' + (index === 0 ? ' active' : '');
    section.innerHTML = `
      <h2 class="section-title">${cat.CategoryName}</h2>
      <div class="menu-grid" id="grid-${cat.CategoryID}"></div>
    `;
    container.appendChild(section);
  });
}

async function initMenu() {
  updateCartUI();

  try {
    // Load categories from API
    const categories = await loadCategories();

    if (categories.length === 0) {
      console.error('No categories loaded');
      return;
    }

    // Render tabs and sections
    renderCategoryTabs(categories);
    renderCategorySections(categories);

    // Setup tab functionality
    setupTabs();

    // Load products and variants from API
    const [allProducts, allVariants] = await Promise.all([
      loadProducts(),
      loadProductVariants()
    ]);

    // Render products for each category
    categories.forEach(cat => {
      const categoryProducts = getProductsByCategory(allProducts, cat.CategoryID);
      const gridId = `grid-${cat.CategoryID}`;
      renderList(categoryProducts, gridId, `category-${cat.CategoryID}`, allVariants);
    });
  } catch (e) {
    console.error('Error loading menu', e);
  }
}

document.addEventListener('DOMContentLoaded', initMenu);
