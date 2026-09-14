// Plain JavaScript inlined by the root layout; works on the static HTML
// without any framework code in the browser. It filters the list modals
// (components/ListModal.tsx) as the user types, resets and focuses the
// filter when a popover opens, and remembers the Charts/List tab choice in
// a cookie (components/HostsSections.tsx).
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
  // Remember the chosen Charts/List tab across entries (see HostsSections).
  document.addEventListener("click", function (e) {
    var tab = e.target && e.target.closest && e.target.closest("[data-hosts-tab]");
    if (tab) {
      document.cookie =
        "hosts-tab=" + tab.getAttribute("data-hosts-tab") + "; path=/; max-age=31536000; SameSite=Lax";
    }
  });
  // Comments (components/Comments.tsx): show the ones stored in this
  // browser and store new ones. Demo only, nothing leaves the browser.
  function relative(iso) {
    var seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 45) return "just now";
    var units = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
    for (var i = 0; i < units.length; i++) {
      if (seconds >= units[i][0]) {
        var n = Math.round(seconds / units[i][0]);
        return n + " " + units[i][1] + (n === 1 ? "" : "s") + " ago";
      }
    }
    return "less than a minute ago";
  }
  function commentStorageKey(section) { return "knowdb-comments:" + section.getAttribute("data-comments"); }
  function loadComments(section) {
    try { return JSON.parse(localStorage.getItem(commentStorageKey(section)) || "[]"); } catch (err) { return []; }
  }
  function appendComment(section, comment) {
    var local = section.querySelector("[data-local-comments]");
    var empty = local.querySelector("[data-comments-empty]");
    if (empty) empty.remove();
    var li = document.createElement("li");
    li.className = "comment-card comment-card-local";
    li.setAttribute("data-testid", "comment-card");
    var meta = document.createElement("div");
    meta.className = "comment-meta";
    var author = document.createElement("strong");
    author.setAttribute("data-testid", "comment-card-author");
    author.textContent = comment.author;
    var time = document.createElement("time");
    time.className = "muted";
    time.setAttribute("datetime", comment.time);
    time.title = new Date(comment.time).toUTCString();
    time.textContent = relative(comment.time);
    meta.appendChild(author);
    meta.appendChild(document.createTextNode(" "));
    meta.appendChild(time);
    var body = document.createElement("p");
    body.className = "comment-body";
    body.setAttribute("data-testid", "comment-card-text");
    body.textContent = comment.text;
    li.appendChild(meta);
    li.appendChild(body);
    local.appendChild(li);
    var total = section.querySelectorAll(".comment-card").length;
    var counts = document.querySelectorAll("[data-comments-count]");
    for (var i = 0; i < counts.length; i++) counts[i].textContent = "(" + total + ")";
  }
  function initComments() {
    var sections = document.querySelectorAll("[data-comments]");
    for (var i = 0; i < sections.length; i++) {
      var stored = loadComments(sections[i]);
      for (var j = 0; j < stored.length; j++) appendComment(sections[i], stored[j]);
      var input = sections[i].querySelector("input[name=author]");
      if (input && !input.value) input.value = localStorage.getItem("knowdb-comment-author") || "";
    }
  }
  document.addEventListener("submit", function (e) {
    var form = e.target && e.target.closest && e.target.closest("[data-comment-form]");
    if (!form) return;
    e.preventDefault();
    var section = form.closest("[data-comments]");
    var text = form.querySelector("textarea[name=text]").value.trim();
    if (!text) return;
    var author = form.querySelector("input[name=author]").value.trim() || "Anonymous";
    var comment = { author: author, time: new Date().toISOString(), text: text };
    var stored = loadComments(section);
    stored.push(comment);
    localStorage.setItem(commentStorageKey(section), JSON.stringify(stored));
    localStorage.setItem("knowdb-comment-author", author);
    appendComment(section, comment);
    form.querySelector("textarea[name=text]").value = "";
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initComments);
  else initComments();
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
