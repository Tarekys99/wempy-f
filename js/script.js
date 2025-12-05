// Check if user is logged in
function isUserLoggedIn() {
  return sessionStorage.getItem('wempyUserID');
}

// Logout function
function logoutUser() {
  sessionStorage.removeItem('wempyUserID');
  Toast.success('تم تسجيل الخروج بنجاح');
  setTimeout(() => window.location.href = 'login.html', 1000);
}

// Update navbar based on login status
function updateNavbar() {
  const navMenu = document.querySelector('.nav-menu');
  if (!navMenu) return;

  const loginLink = navMenu.querySelector('a[href="login.html"]');
  if (!loginLink) return;

  const userId = isUserLoggedIn();

  if (userId) {
    // User is logged in - keep "حسابي" text but link to account page
    loginLink.innerHTML = '<i class="fas fa-user"></i> حسابي';
    loginLink.href = 'login.html'; // يذهب لصفحة الحساب
  } else {
    // User is not logged in - show login text
    loginLink.innerHTML = '<i class="fas fa-user"></i> حسابي';
    loginLink.href = 'login.html';
  }
}

// Enhanced mobile navigation
document.addEventListener('DOMContentLoaded', () => {
  // Update navbar on page load
  updateNavbar();

  const hamburger = document.querySelector('.hamburger');
  const menu = document.querySelector('.nav-menu');

  if (hamburger && menu) {
    hamburger.addEventListener('click', () => {
      menu.classList.toggle('show');
      hamburger.classList.toggle('active');
    });

    // Close menu when clicking on links
    const navLinks = menu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('show');
        hamburger.classList.remove('active');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('show');
        hamburger.classList.remove('active');
      }
    });
  }

  // Enhanced smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});
