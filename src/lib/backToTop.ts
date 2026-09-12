// "Back to top" floating button, wired sitewide from Layout.astro. Desktop/tablet only (see
// the button's own md:flex class) -- several pages already have a mobile-only fixed bottom bar
// (calculator sticky bars, the mobile app header), and this avoids stacking on top of those
// rather than trying to coordinate positioning with every one of them.
const SHOW_AFTER_PX = 500;

export function initBackToTop(): void {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;

  function updateVisibility() {
    btn!.hidden = window.scrollY < SHOW_AFTER_PX;
  }

  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
