// =============================================
// dashboard.js — PlagPro Admin Dashboard
// Shared JavaScript loaded on every page
// =============================================

// Auto-dismiss flash messages after 5 seconds
document.addEventListener('DOMContentLoaded', () => {
  // Flash messages
  document.querySelectorAll('.flash').forEach(el => {
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.5s';
      setTimeout(() => el.remove(), 500);
    }, 5000);
  });

  // Theme Switching
  const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
  const currentTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  function setTheme(theme, save = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (save) localStorage.setItem('theme', theme);
    
    if (toggleSwitch) {
      toggleSwitch.checked = (theme === 'dark');
    }
  }

  // Initial Load
  if (currentTheme) {
    setTheme(currentTheme, false);
  } else if (prefersDark.matches) {
    setTheme('dark', false);
  } else {
    // Default to dark as per existing design choice
    setTheme('dark', false);
  }

  if (toggleSwitch) {
    toggleSwitch.addEventListener('change', (e) => {
      const theme = e.target.checked ? 'dark' : 'light';
      setTheme(theme);
    });
  }

  // Listen for system theme changes if no preference saved
  prefersDark.addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      setTheme(e.matches ? 'dark' : 'light', false);
    }
  });
});
