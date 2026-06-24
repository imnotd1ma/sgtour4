(function () {
  var STORAGE_KEY = "sg-theme-preference";
  var DEFAULT_THEME = "original";
  var TRANSITION_CLASS = "theme-transitioning";
  var TRANSITION_MS = 380;
  var transitionTimer = null;

  function normalizeTheme(value) {
    if (value === "old" || value === "black") {
      return "old";
    }

    if (value === "dark" || value === "original") {
      return "original";
    }

    return DEFAULT_THEME;
  }

  function getStoredTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return DEFAULT_THEME;
    }
  }

  function getCurrentTheme() {
    return normalizeTheme(document.documentElement.dataset.theme);
  }

  function getNextTheme(theme) {
    return normalizeTheme(theme) === "old" ? "original" : "old";
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn("Unable to persist theme", error);
    }
  }

  function updateToggleLabel(button, theme) {
    if (!button) {
      return;
    }

    var nextTheme = getNextTheme(theme);

    button.dataset.currentTheme = theme;
    button.dataset.nextTheme = nextTheme;
    button.setAttribute("aria-label", "Current theme " + theme.toUpperCase() + ". Switch to " + nextTheme.toUpperCase());
    button.setAttribute("title", "Current: " + theme.toUpperCase() + " / Switch to: " + nextTheme.toUpperCase());
    button.setAttribute("aria-pressed", theme === "old" ? "true" : "false");
  }

  function syncAllToggles(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      updateToggleLabel(button, theme);
    });
  }

  function runTransition() {
    var root = document.documentElement;

    root.classList.add(TRANSITION_CLASS);
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(function () {
      root.classList.remove(TRANSITION_CLASS);
    }, TRANSITION_MS);
  }

  function applyTheme(theme, options) {
    var settings = options || {};
    var normalizedTheme = normalizeTheme(theme);
    var root = document.documentElement;

    root.dataset.theme = normalizedTheme;
    if (settings.persist !== false) {
      persistTheme(normalizedTheme);
    }

    syncAllToggles(normalizedTheme);

    if (settings.animate) {
      runTransition();
    }
  }

  function createToggle() {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.setAttribute("data-theme-toggle", "");
    button.innerHTML = '<span class="theme-toggle-option" data-theme-option="original">Original</span><span class="theme-toggle-option" data-theme-option="old">Old</span>';
    button.addEventListener("click", function () {
      applyTheme(getNextTheme(getCurrentTheme()), { animate: true });
    });
    return button;
  }

  function ensureDock() {
    var dock = document.querySelector("[data-theme-toggle-dock]");

    if (dock) {
      return dock;
    }

    if (!document.body) {
      return null;
    }

    dock = document.createElement("div");
    dock.className = "theme-toggle-dock";
    dock.setAttribute("data-theme-toggle-dock", "");
    document.body.appendChild(dock);
    return dock;
  }

  function mountToggle() {
    var dock = ensureDock();

    if (!dock) {
      syncAllToggles(getCurrentTheme());
      return;
    }

    if (dock.querySelector("[data-theme-toggle]")) {
      syncAllToggles(getCurrentTheme());
      return;
    }

    var button = createToggle();
    dock.appendChild(button);
    updateToggleLabel(button, getCurrentTheme());
  }

  function init() {
    applyTheme(getStoredTheme(), { persist: false });
    mountToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.sgTheme = {
    apply: applyTheme,
    current: getCurrentTheme
  };
}());
