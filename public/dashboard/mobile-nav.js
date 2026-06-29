"use strict";

function closeMobileNav() {
  const toggle = document.getElementById("nav-toggle");
  if (toggle instanceof HTMLInputElement) toggle.checked = false;
}

function bindMobileNav() {
  const root = document.querySelector(".dashboard-page");
  if (!root || root.dataset.mobileNavBound === "1") return;
  root.dataset.mobileNavBound = "1";

  root.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    if (
      target.closest("#apply") ||
      target.closest("#refresh") ||
      target.closest(".nav-links a")
    ) {
      closeMobileNav();
    }

    const overviewToggle = target.closest("#overview-toggle");
    if (overviewToggle) {
      const panel = document.getElementById("overview-float");
      if (!panel) return;
      const expanded = panel.classList.toggle("is-expanded");
      overviewToggle.setAttribute(
        "aria-expanded",
        expanded ? "true" : "false",
      );
    }
  });
}

bindMobileNav();
