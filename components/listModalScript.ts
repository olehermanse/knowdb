// Plain JavaScript inlined by the root layout; works on the static HTML
// without any framework code in the browser. It filters the list modals
// (components/ListModal.tsx) as the user types, resets and focuses the
// filter when a popover opens, remembers the Charts/List/Ports tab choice
// in a cookie (components/HostsSections.tsx), stores comments, and keeps
// the software, classes and variables pinned to the host view in local
// storage (components/HostView.tsx).
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
  // Sections whose stored comments were added, since init runs again after
  // client-side navigation. Kept here rather than as an attribute, which
  // would make React's hydration see a changed element and warn.
  var loadedSections = new WeakSet();
  function initComments() {
    var sections = document.querySelectorAll("[data-comments]");
    for (var i = 0; i < sections.length; i++) {
      if (loadedSections.has(sections[i])) continue;
      loadedSections.add(sections[i]);
      var stored = loadComments(sections[i]);
      for (var j = 0; j < stored.length; j++) appendComment(sections[i], stored[j]);
    }
  }
  document.addEventListener("submit", function (e) {
    var form = e.target && e.target.closest && e.target.closest("[data-comment-form]");
    if (!form) return;
    e.preventDefault();
    var section = form.closest("[data-comments]");
    var text = form.querySelector("textarea[name=text]").value.trim();
    if (!text) return;
    // Demo: no login, so the author is Alice or Bob at random.
    var author = Math.random() < 0.5 ? "Alice" : "Bob";
    var comment = { author: author, time: new Date().toISOString(), text: text };
    var stored = loadComments(section);
    stored.push(comment);
    localStorage.setItem(commentStorageKey(section), JSON.stringify(stored));
    appendComment(section, comment);
    form.querySelector("textarea[name=text]").value = "";
  });
  // Pins: "type:name" strings in local storage, shared by all hosts. Each
  // pinned item is a name/value pair in the host view: the version of the
  // software, "defined" for a class, the value of a variable, taken from
  // its row in the list modal when the host has it, or otherwise
  // "(not installed)" / "(not defined)".
  var PIN_KEY = "knowdb-pins";
  var PINNED_EMPTY = "Nothing pinned. Use the pin icon in the lists below to keep software, classes or variables here.";
  function loadPins() {
    try {
      var pins = JSON.parse(localStorage.getItem(PIN_KEY) || "[]");
      return Array.isArray(pins) ? pins : [];
    } catch (err) { return []; }
  }
  function pinOf(el) {
    var row = el.closest("[data-pin-type]");
    return row ? row.getAttribute("data-pin-type") + ":" + row.getAttribute("data-pin-name") : null;
  }
  // The unpin button of a pinned item; its icon is copied from the hidden
  // lucide icon rendered by HostView.
  function unpinButton(name) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pin-button pin-button-pinned";
    btn.setAttribute("data-pin-toggle", "");
    btn.setAttribute("data-testid", "pin-button");
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("aria-label", "Unpin " + name);
    btn.title = "Unpin from the host view";
    var icon = document.querySelector("[data-icon=pin-off] svg");
    if (icon) btn.appendChild(icon.cloneNode(true));
    else btn.textContent = "\u00D7";
    return btn;
  }
  function modalRow(type, name) {
    var rows = document.querySelectorAll("[data-list-modal-row][data-pin-type]");
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute("data-pin-type") === type && rows[i].getAttribute("data-pin-name") === name) return rows[i];
    }
    return null;
  }
  // A pinned item as a <dt> (the name, plain text like the labels of the
  // fields above, even though it is an entry: the value links) and a <dd>
  // (its value on this host, and the unpin button), appended to the list.
  function appendPinnedItem(list, pin) {
    var sep = pin.indexOf(":");
    var type = pin.slice(0, sep);
    var name = pin.slice(sep + 1);
    var dt = document.createElement("dt");
    dt.setAttribute("data-testid", "pinned-name");
    dt.textContent = name;
    var dd = document.createElement("dd");
    dd.className = "pinned-value";
    dd.setAttribute("data-testid", "pinned-item");
    dd.setAttribute("data-pin-type", type);
    dd.setAttribute("data-pin-name", name);
    var row = modalRow(type, name);
    if (row) {
      // The second link of the row is the version or value, if any.
      var links = row.querySelectorAll("[data-pin-content] > a");
      if (links.length > 1) dd.appendChild(links[1].cloneNode(true));
      else dd.appendChild(document.createTextNode(type === "software" ? "installed" : "defined"));
    } else {
      var missing = document.createElement("em");
      missing.className = "muted pinned-missing";
      missing.setAttribute("data-testid", "pinned-missing");
      missing.textContent = type === "software" ? "(not installed)" : "(not defined)";
      dd.appendChild(missing);
    }
    dd.appendChild(unpinButton(name));
    list.appendChild(dt);
    list.appendChild(dd);
  }
  function renderPins() {
    var pins = loadPins();
    var buttons = document.querySelectorAll("[data-list-modal-row] [data-pin-toggle]");
    for (var i = 0; i < buttons.length; i++) {
      var pin = pinOf(buttons[i]);
      var on = pin !== null && pins.indexOf(pin) !== -1;
      var name = pin ? pin.slice(pin.indexOf(":") + 1) : "";
      buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
      buttons[i].setAttribute("aria-label", (on ? "Unpin " : "Pin ") + name);
      buttons[i].title = on ? "Unpin from the host view" : "Pin to the host view";
      if (on) buttons[i].classList.add("pin-button-pinned");
      else buttons[i].classList.remove("pin-button-pinned");
    }
    var lists = document.querySelectorAll("[data-pinned]");
    for (var j = 0; j < lists.length; j++) {
      lists[j].innerHTML = "";
      if (pins.length === 0) {
        var empty = document.createElement("div");
        empty.className = "muted pinned-empty";
        empty.setAttribute("data-pinned-empty", "");
        empty.textContent = PINNED_EMPTY;
        lists[j].appendChild(empty);
      }
      for (var k = 0; k < pins.length; k++) appendPinnedItem(lists[j], pins[k]);
    }
  }
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest("[data-pin-toggle]");
    if (!btn) return;
    var pin = pinOf(btn);
    if (!pin) return;
    var pins = loadPins();
    var at = pins.indexOf(pin);
    if (at === -1) pins.push(pin);
    else pins.splice(at, 1);
    localStorage.setItem(PIN_KEY, JSON.stringify(pins));
    renderPins();
  });
  function init() {
    initComments();
    renderPins();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  // Following a link swaps the page content without reloading, so the
  // new page's pinned list and comments arrive after init ran. Run it
  // again whenever such a container is added. Our own rendering only adds
  // rows inside the containers, so it does not trigger this.
  var NEW_CONTENT = "[data-pinned], [data-comments], [data-list-modal-row]";
  var scheduled = false;
  function needsInit(node) {
    return node.nodeType === 1 && (node.matches(NEW_CONTENT) || !!node.querySelector(NEW_CONTENT));
  }
  new MutationObserver(function (records) {
    if (scheduled) return;
    for (var i = 0; i < records.length && !scheduled; i++) {
      var added = records[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        if (needsInit(added[j])) { scheduled = true; break; }
      }
    }
    if (!scheduled) return;
    requestAnimationFrame(function () {
      scheduled = false;
      init();
    });
  }).observe(document.body, { childList: true, subtree: true });
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
