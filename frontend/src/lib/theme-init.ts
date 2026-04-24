/**
 * Inline script string for theme initialization.
 *
 * Injected into <head> via dangerouslySetInnerHTML to run synchronously
 * before React hydration, preventing flash of wrong theme (FOWT).
 *
 * - Reads the user's stored preference from localStorage ("horizon-theme")
 * - Validates the value is "dark" or "light"
 * - Falls back to "dark" if no valid value or localStorage is unavailable
 * - Sets the data-theme attribute on <html> accordingly
 */
export const themeInitScript = `(function() {
  try {
    var t = localStorage.getItem('horizon-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();`;
