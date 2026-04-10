export function dispatchAppEvent(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}
