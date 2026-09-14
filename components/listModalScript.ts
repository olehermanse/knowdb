// Plain JavaScript for the list modals (components/ListModal.tsx): filter
// rows as the user types, and reset + focus the filter when a popover
// opens. Inlined into the page by the root layout; works on the static
// HTML without any framework code in the browser.
export const LIST_MODAL_SCRIPT = `
(function () {
  function update(modal) {
    var input = modal.querySelector("[data-list-modal-filter]");
    var q = (input && input.value ? input.value : "").trim().toLowerCase();
    var rows = modal.querySelectorAll("[data-list-modal-row]");
    var shown = 0;
    for (var i = 0; i < rows.length; i++) {
      var match = !q || rows[i].getAttribute("data-label").indexOf(q) !== -1;
      rows[i].hidden = !match;
      if (match) shown++;
    }
    var empty = modal.querySelector("[data-list-modal-empty]");
    if (empty) empty.hidden = shown !== 0;
    var text = modal.querySelector("[data-list-modal-shown]");
    if (text) {
      var total = Number(modal.getAttribute("data-total"));
      text.textContent =
        shown === total
          ? modal.getAttribute("data-count")
          : shown + " of " + total + " " + modal.getAttribute("data-plural") + " match";
    }
  }
  document.addEventListener("input", function (e) {
    var modal = e.target && e.target.closest && e.target.closest("[data-list-modal]");
    if (modal) update(modal);
  });
  function isModal(el) {
    return el && el.hasAttribute && el.hasAttribute("data-list-modal");
  }
  // Reset the filter synchronously before the popover shows, so typing
  // right after opening is never wiped, and focus the filter once shown.
  document.addEventListener("beforetoggle", function (e) {
    if (!isModal(e.target) || e.newState !== "open") return;
    var input = e.target.querySelector("[data-list-modal-filter]");
    if (input) input.value = "";
    update(e.target);
  }, true);
  document.addEventListener("toggle", function (e) {
    if (!isModal(e.target) || e.newState !== "open") return;
    var input = e.target.querySelector("[data-list-modal-filter]");
    if (input) input.focus();
  }, true);
})();
`;
