// PrivateAI · site.js
// Small enhancements. Every page works fully without this file.

// 1. The narrow-screen menu is a native popover. Close it when a link inside is chosen, and when a page is
//    restored from the back/forward cache, so it never greets you already open.
const nav = document.getElementById("site-nav");
if (nav && "hidePopover" in nav) {
  const close = () => {
    if (nav.matches(":popover-open")) nav.hidePopover();
  };
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });
  window.addEventListener("pageshow", close);
}

// 2. Copy buttons for anything marked data-copy, added only where the Clipboard API is available.
if (navigator.clipboard && window.isSecureContext) {
  for (const source of document.querySelectorAll("[data-copy]")) {
    const holder = source.parentElement.querySelector("[data-copy-holder]");
    if (!holder) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button--small";
    button.textContent = "Copy address";
    const status = document.createElement("span");
    status.className = "copy-status";
    status.setAttribute("role", "status");
    let timer;
    button.addEventListener("click", async () => {
      clearTimeout(timer);
      try {
        await navigator.clipboard.writeText(source.dataset.copy);
        status.textContent = "Copied.";
      } catch {
        status.textContent = "Could not copy. Select the address instead.";
      }
      timer = setTimeout(() => (status.textContent = ""), 4000);
    });
    holder.append(button, status);
  }
}
