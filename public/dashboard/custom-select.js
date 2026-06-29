"use strict";

(function () {
  function getRoot() {
    return document.querySelector(".dashboard-page");
  }

  function closeAllExcept(except) {
    const root = getRoot();
    if (!root) return;
    root.querySelectorAll(".custom-select.is-open").forEach((el) => {
      if (el === except) return;
      el.classList.remove("is-open");
      el.querySelector(".custom-select-trigger")?.setAttribute(
        "aria-expanded",
        "false",
      );
      resetMenuPosition(el.querySelector(".custom-select-menu"));
    });
  }

  function resetMenuPosition(menu) {
    if (!menu) return;
    menu.style.position = "";
    menu.style.top = "";
    menu.style.left = "";
    menu.style.width = "";
    menu.style.right = "";
  }

  function positionMenu(wrap, trigger, menu) {
    const rect = trigger.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${rect.width}px`;
    menu.style.right = "auto";

    const menuHeight = Math.min(240, menu.scrollHeight || 240);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;

    if (spaceBelow >= Math.min(menuHeight, 120) || spaceBelow >= spaceAbove) {
      menu.style.top = `${rect.bottom + 4}px`;
      wrap.classList.remove("opens-up");
    } else {
      menu.style.top = `${rect.top - menuHeight - 4}px`;
      wrap.classList.add("opens-up");
    }
  }

  function hookValue(select, syncUI) {
    const desc = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    );
    if (!desc?.set) return;
    Object.defineProperty(select, "value", {
      configurable: true,
      get() {
        return desc.get.call(this);
      },
      set(v) {
        desc.set.call(this, v);
        syncUI();
      },
    });
  }

  function enhanceSelect(select) {
    if (select.dataset.customSelect === "1") return;
    select.dataset.customSelect = "1";

    const wrap = document.createElement("div");
    wrap.className = "custom-select";
    select.classList.add("custom-select-native");
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");

    const valueEl = document.createElement("span");
    valueEl.className = "custom-select-value";

    const chevron = document.createElement("span");
    chevron.className = "custom-select-chevron";
    chevron.setAttribute("aria-hidden", "true");

    trigger.append(valueEl, chevron);

    const menu = document.createElement("div");
    menu.className = "custom-select-menu";
    menu.setAttribute("role", "listbox");

    wrap.append(trigger, menu);

    let open = false;
    let activeIndex = -1;

    function selectedIndex() {
      return Math.max(0, select.selectedIndex);
    }

    function syncTrigger() {
      const opt = select.options[select.selectedIndex];
      valueEl.textContent = opt ? opt.textContent : "";
      wrap.classList.toggle("is-placeholder", select.value === "");
      trigger.disabled = select.disabled;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function buildMenu() {
      menu.innerHTML = "";
      activeIndex = selectedIndex();

      [...select.options].forEach((opt, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "custom-select-option";
        item.setAttribute("role", "option");
        item.dataset.index = String(index);
        item.textContent = opt.textContent;

        const isSelected = opt.value === select.value;
        item.classList.toggle("is-selected", isSelected);
        item.setAttribute("aria-selected", isSelected ? "true" : "false");
        item.classList.toggle("is-active", index === activeIndex);

        if (opt.disabled) {
          item.disabled = true;
          item.classList.add("is-disabled");
        }

        item.addEventListener("click", (e) => {
          e.stopPropagation();
          choose(index);
        });

        menu.appendChild(item);
      });
    }

    function syncUI() {
      syncTrigger();
      buildMenu();
      if (open) positionMenu(wrap, trigger, menu);
    }

    function choose(index) {
      const opt = select.options[index];
      if (!opt || opt.disabled) return;
      select.value = opt.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      closeMenu();
      trigger.focus();
    }

    function scrollActiveIntoView() {
      const active = menu.querySelector(".custom-select-option.is-active");
      active?.scrollIntoView({ block: "nearest" });
    }

    function highlightActive() {
      menu.querySelectorAll(".custom-select-option").forEach((el) => {
        el.classList.toggle(
          "is-active",
          Number(el.dataset.index) === activeIndex,
        );
      });
      scrollActiveIntoView();
    }

    function moveActive(delta) {
      const opts = [...select.options];
      if (!opts.length) return;

      let idx =
        activeIndex >= 0 ? activeIndex : Math.max(0, select.selectedIndex);
      for (let step = 0; step < opts.length; step += 1) {
        idx = (idx + delta + opts.length) % opts.length;
        if (!opts[idx].disabled) break;
      }

      activeIndex = idx;
      highlightActive();
    }

    function openMenu() {
      if (open || select.disabled) return;
      closeAllExcept(wrap);
      open = true;
      wrap.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      activeIndex = selectedIndex();
      buildMenu();
      positionMenu(wrap, trigger, menu);
      scrollActiveIntoView();
    }

    function closeMenu() {
      open = false;
      wrap.classList.remove("is-open");
      wrap.classList.remove("opens-up");
      trigger.setAttribute("aria-expanded", "false");
      resetMenuPosition(menu);
    }

    function toggleMenu() {
      if (open) closeMenu();
      else openMenu();
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    trigger.addEventListener("keydown", (e) => {
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === " "
      ) {
        e.preventDefault();
        if (!open) openMenu();
        if (e.key === "ArrowDown") moveActive(1);
        if (e.key === "ArrowUp") moveActive(-1);
        if ((e.key === "Enter" || e.key === " ") && open) choose(activeIndex);
      }
      if (e.key === "Escape") closeMenu();
    });

    menu.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose(activeIndex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
        trigger.focus();
      }
    });

    window.addEventListener(
      "resize",
      () => {
        if (open) positionMenu(wrap, trigger, menu);
      },
      { passive: true },
    );

    hookValue(select, syncUI);

    new MutationObserver(() => syncUI()).observe(select, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });

    select.addEventListener("change", syncUI);
    syncUI();
  }

  function init() {
    const root = getRoot();
    if (!root) return false;
    root.querySelectorAll("select:not([data-custom-select])").forEach(
      enhanceSelect,
    );
    return true;
  }

  function boot() {
    if (init()) return;
    let tries = 0;
    const retry = () => {
      if (init() || tries >= 60) return;
      tries += 1;
      requestAnimationFrame(retry);
    };
    retry();
  }

  document.addEventListener("click", () => closeAllExcept(null));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllExcept(null);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.initCustomSelects = init;
})();
