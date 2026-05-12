// Mobile nav
const burger    = document.querySelector('.nav-burger');
const mobileNav = document.querySelector('.mobile-nav');

if (burger && mobileNav) {
  burger.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    document.body.style.overflow = open ? 'hidden' : '';
  });
}

document.querySelectorAll('.mobile-nav-link').forEach(link => {
  link.addEventListener('click', () => {
    mobileNav?.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// Desktop dropdown: click also toggles open (hover handled by CSS)
document.querySelectorAll('.nav-dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const dropdown = toggle.closest('.nav-dropdown');
    const isOpen = dropdown.classList.contains('open');
    document.querySelectorAll('.nav-dropdown').forEach(d => d.classList.remove('open'));
    if (!isOpen) dropdown.classList.add('open');
  });
});
document.addEventListener('click', () => {
  document.querySelectorAll('.nav-dropdown').forEach(d => d.classList.remove('open'));
});

// Auto-detect active state for mega-menu tiles and Blog link
const page = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-mega-tile').forEach(tile => {
  if (tile.getAttribute('href') === page) {
    tile.classList.add('active');
    tile.closest('.nav-dropdown')?.querySelector('.nav-dropdown-toggle')?.classList.add('active');
  }
});
document.querySelectorAll('.nav-link:not(.nav-dropdown-toggle)').forEach(link => {
  if (link.getAttribute('href') === page) link.classList.add('active');
});

// Form submit → Formspree
const form = document.querySelector('#enquiry-form');
if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      const res = await fetch('https://formspree.io/f/xnjwdglr', {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        btn.textContent = "Thanks — we'll be in touch within 1 working day.";
        btn.style.background = 'var(--green-600)';
        btn.style.boxShadow = 'none';
        btn.style.transform = 'none';
        form.reset();
      } else {
        btn.textContent = 'Something went wrong — please call 07840 092397';
        btn.disabled = false;
      }
    } catch {
      btn.textContent = 'Something went wrong — please call 07840 092397';
      btn.disabled = false;
    }
  });
}

// Smooth scroll anchors
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});
