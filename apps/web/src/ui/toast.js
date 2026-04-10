/**
 * Toast notification system.
 * Slides in from top-right, auto-dismisses.
 */

const container = document.getElementById('toasts');

const ICONS = {
  info: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  success: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
  error: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
  event: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>`,
};

const COLORS = {
  info: 'border-blue-500/40 bg-blue-500/10',
  success: 'border-green-500/40 bg-green-500/10',
  error: 'border-red-500/40 bg-red-500/10',
  event: 'border-purple-500/40 bg-purple-500/10',
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Shows a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'|'event'} type
 * @param {number} duration - ms (0 = sticky)
 */
export function showToast(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `
    flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md
    text-sm text-white transition-all duration-300 translate-x-full opacity-0
    ${COLORS[type] ?? COLORS.info}
  `.trim().replace(/\s+/g, ' ');

  const iconSpan = document.createElement('span');
  iconSpan.className = 'shrink-0';
  iconSpan.innerHTML = ICONS[type] ?? ICONS.info; // SVG icon literals (trusted)

  const textSpan = document.createElement('span');
  textSpan.className = 'flex-1';
  textSpan.textContent = message; // textContent — safe, never parsed as HTML

  const dismissBtn = document.createElement('button');
  dismissBtn.setAttribute('aria-label', 'Dismiss');
  dismissBtn.className = 'shrink-0 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none';
  dismissBtn.textContent = '\u00d7';

  toast.appendChild(iconSpan);
  toast.appendChild(textSpan);
  toast.appendChild(dismissBtn);

  const dismiss = () => {
    toast.style.transform = 'translateX(110%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  };

  dismissBtn.addEventListener('click', dismiss);
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });
  });

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return dismiss;
}

export const toast = {
  info: (msg, dur) => showToast(msg, 'info', dur),
  success: (msg, dur) => showToast(msg, 'success', dur),
  error: (msg, dur) => showToast(msg, 'error', dur),
  event: (msg, dur = 8000) => showToast(msg, 'event', dur),
};
