// Login/Registration with API
const API_BASE_URL = 'https://wempy.onrender.com';
const USER_SESSION_KEY = 'wempyUserID';

// Get user data from API
async function getUserData(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!response.ok) {
            throw new Error('Failed to load user data');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading user data:', error);
        return null;
    }
}

// Get user orders from API
async function getUserOrders(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/orders/user_orders/${userId}`);
        if (!response.ok) {
            throw new Error('Failed to load orders');
        }
        const orders = await response.json();

        // Sort by timestamp (newest first) and get last 5
        return orders
            .sort((a, b) => new Date(b.OrderTimestamp) - new Date(a.OrderTimestamp))
            .slice(0, 5);
    } catch (error) {
        console.error('Error loading user orders:', error);
        return [];
    }
}

// Save user session (UserID only)
function saveUserSession(userID) {
    // Save in localStorage (persists even after browser closes)
    localStorage.setItem(USER_SESSION_KEY, userID);
    console.log('User session saved:', userID);
}

// Get current user session
function getUserSession() {
    // Get from localStorage (persistent)
    return localStorage.getItem(USER_SESSION_KEY);
}

// Check if logged in
function isLoggedIn() {
    return getUserSession() !== null;
}

// Logout
function logout() {
    localStorage.removeItem(USER_SESSION_KEY);
    window.location.href = 'login.html';
}

// Register new user
async function registerUser(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({
                FName: userData.firstName,
                LName: userData.lastName,
                PhoneNumber: userData.phone,
                Email: userData.email || 'user@example.com'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'فشل التسجيل');
        }

        return await response.json();
    } catch (error) {
        console.error('Register error:', error);
        throw error;
    }
}

// Login user
async function loginUser(phone) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({
                PhoneNumber: phone
            })
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('رقم الهاتف غير مسجل. الرجاء إنشاء حساب جديد');
            }

            try {
                const error = await response.json();
                throw new Error(error.detail || 'حدث خطأ أثناء تسجيل الدخول');
            } catch (e) {
                if (e.message.includes('رقم الهاتف')) throw e;
                throw new Error('حدث خطأ أثناء تسجيل الدخول');
            }
        }

        return await response.json();
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// Show account info if logged in
async function showAccountInfo() {
    const userId = getUserSession();
    if (!userId) return false;

    const accountSection = document.getElementById('account-section');
    const authToggle = document.getElementById('auth-toggle');
    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');

    if (accountSection && authToggle && loginSection && registerSection) {
        // Hide login/register, show account
        authToggle.style.display = 'none';
        loginSection.style.display = 'none';
        registerSection.style.display = 'none';
        accountSection.style.display = 'block';

        // Load user data and show welcome message
        const userData = await getUserData(userId);
        const welcomeEl = document.getElementById('user-welcome');
        if (welcomeEl && userData) {
            welcomeEl.textContent = `مرحباً ${userData.FName} ${userData.LName}!`;
        }

        // Load orders from API
        const orderInfo = document.getElementById('last-order-info');
        if (orderInfo) {
            orderInfo.style.display = 'block';
            orderInfo.innerHTML = `
                <h3 style="color: #2c5530; margin-bottom: 1rem; font-size: 1.1rem;">
                    <i class="fas fa-spinner fa-spin"></i> جاري تحميل الطلبات...
                </h3>
            `;

            const orders = await getUserOrders(userId);

            if (orders.length > 0) {
                // Build orders list HTML
                const ordersHTML = orders.map((order) => {
                    const time = new Date(order.OrderTimestamp);
                    const statusIcon = order.is_completed ? '✓' : '⏳';
                    const statusText = order.is_completed ? 'مكتمل' : order.OrderStatus;

                    return `
                        <div style="padding: 0.75rem; background: #fff; border-radius: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e0e0e0;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <strong style="color: #2c5530;">طلب #${order.OrderNumber}</strong>
                                <span style="color: #2c5530; font-weight: 600;">${parseFloat(order.TotalPrice).toFixed(2)} جنيه</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #666;">
                                <span>${time.toLocaleString('ar-EG')}</span>
                                <span style="color: ${order.is_completed ? '#4caf50' : '#ff9800'};">${statusIcon} ${statusText}</span>
                            </div>
                        </div>
                    `;
                }).join('');

                orderInfo.innerHTML = `
                    <h3 style="color: #2c5530; margin-bottom: 1rem; font-size: 1.1rem;">
                        <i class="fas fa-receipt"></i> آخر ${orders.length} طلبات
                    </h3>
                    <div style="max-height: 20rem; overflow-y: auto;">
                        ${ordersHTML}
                    </div>
                `;
            } else {
                orderInfo.innerHTML = `
                    <h3 style="color: #2c5530; margin-bottom: 1rem; font-size: 1.1rem;">
                        <i class="fas fa-receipt"></i> طلباتي
                    </h3>
                    <div style="text-align: center; padding: 2rem; color: #999;">
                        <i class="fas fa-shopping-bag" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                        <p>لا توجد طلبات بعد</p>
                    </div>
                `;
            }
        }

        return true;
    }
    return false;
}

// Toggle between login and register
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in first
    if (await showAccountInfo()) {
        return; // User is logged in, show account page
    }

    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');

    if (toggleBtns.length > 0) {
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;

                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (mode === 'login') {
                    loginSection.classList.add('active');
                    registerSection.classList.remove('active');
                } else {
                    registerSection.classList.add('active');
                    loginSection.classList.remove('active');
                }
            });
        });
    }

    // Handle login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const phone = document.getElementById('login-phone').value.trim();
            const submitBtn = loginForm.querySelector('.submit-btn');

            if (!phone) {
                Toast.warning('الرجاء إدخال رقم الهاتف');
                return;
            }

            // Validate phone number
            const phoneRegex = /^01[0-2,5]{1}[0-9]{8}$/;
            if (!phoneRegex.test(phone)) {
                Toast.warning('الرجاء إدخال رقم هاتف صحيح (مثال: 01234567890)');
                return;
            }

            // Disable button
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...';

            try {
                const userData = await loginUser(phone);

                // Save UserID only
                saveUserSession(userData.UserID);

                Toast.success(`مرحباً ${userData.FName} ${userData.LName}!`);
                setTimeout(() => window.location.href = 'menu.html', 1000);
            } catch (error) {
                const errorMsg = error.message || 'رقم الهاتف غير مسجل. الرجاء إنشاء حساب جديد';
                Toast.error(errorMsg);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول';
            }
        });
    }

    // Handle register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = document.getElementById('first-name').value.trim();
            const lastName = document.getElementById('last-name').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const email = document.getElementById('email').value.trim();
            const submitBtn = registerForm.querySelector('.submit-btn');

            if (!firstName || !lastName || !phone) {
                Toast.warning('الرجاء ملء جميع الحقول المطلوبة');
                return;
            }

            // Validate phone number
            const phoneRegex = /^01[0-2,5]{1}[0-9]{8}$/;
            if (!phoneRegex.test(phone)) {
                Toast.warning('الرجاء إدخال رقم هاتف صحيح (مثال: 01234567890)');
                return;
            }

            // Validate email if provided
            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    Toast.warning('الرجاء إدخال بريد إلكتروني صحيح');
                    return;
                }
            }

            // Disable button
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء الحساب...';

            try {
                const userData = await registerUser({
                    firstName,
                    lastName,
                    phone,
                    email
                });

                // Save UserID only
                saveUserSession(userData.UserID);

                Toast.success(`مرحباً ${userData.FName} ${userData.LName}! تم إنشاء حسابك بنجاح`);
                setTimeout(() => window.location.href = 'menu.html', 1000);
            } catch (error) {
                let errorMsg = 'حدث خطأ أثناء التسجيل';

                if (error.message.includes('already exists') || error.message.includes('duplicate')) {
                    errorMsg = 'رقم الهاتف مسجل بالفعل. الرجاء تسجيل الدخول';
                } else if (error.message) {
                    errorMsg = error.message;
                }

                Toast.error(errorMsg);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء حساب';
            }
        });
    }
});
