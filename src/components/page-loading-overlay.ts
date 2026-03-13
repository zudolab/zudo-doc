document.addEventListener("astro:before-preparation", () => {
  const overlay = document.getElementById("page-loading-overlay");
  overlay?.setAttribute("data-visible", "");
  overlay?.setAttribute("aria-hidden", "false");
});

document.addEventListener("astro:page-load", () => {
  const overlay = document.getElementById("page-loading-overlay");
  overlay?.removeAttribute("data-visible");
  overlay?.setAttribute("aria-hidden", "true");
});
