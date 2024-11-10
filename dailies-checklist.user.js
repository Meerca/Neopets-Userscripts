// ==UserScript==
// @name         Neopets: Dailies Checklist
// @author       Hiddenist
// @namespace    https://hiddenist.com
// @version      2024-11-02
// @description  Adds a checklist to the dailies page to help you keep track of which dailies you've done.
// @match        http*://www.neopets.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @updateURL    https://github.com/Meerca/Neopets-Userscripts/raw/main/dailies-checklist.user.js
// @downloadURL  https://github.com/Meerca/Neopets-Userscripts/raw/main/dailies-checklist.user.js
// @supportURL   https://github.com/Meerca/Neopets-Userscripts/issues
// ==/UserScript==

const DAILIES_CHECKLIST_ITEMS = "dailiesChecklistItems";
const TODAYS_CHECKLIST_PROGRESS = "todaysChecklistProgress";
const CHECKLIST_POSITION = "checklistPosition";

function main() {
  document.body.append(makeChecklist());
}

function makeChecklist() {
  const host = document.createElement("div");
  const shadowRoot = host.attachShadow({ mode: "open" });

  const container = document.createElement("div");
  container.classList.add("hiddenist-dailies-container");

  shadowRoot.append(container);

  const header = document.createElement("h2");
  header.textContent = "Dailies Checklist";
  container.append(header);

  const checklist = document.createElement("ul");
  const items = getChecklistItems();
  const progress = getTodaysChecklistProgress();

  container.append(progress.date);

  for (const id in items) {
    const item = items[id];
    checklist.append(makeChecklistElement(item, id));
  }

  container.append(checklist);

  const input = document.createElement("input");
  input.placeholder = "Add new item";
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const id = addChecklistItem(input.value);
      checklist.append(makeChecklistElement(input.value, id));
      input.value = "";
    }
  });

  container.append(input);

  const styles = document.createElement("style");
  styles.textContent = `
    h2 {
      margin: 0;
      font-size: 1.5em;
      user-select: none;
    }

    div.hiddenist-dailies-container {
      background-color: #f8f8f8;
      padding: 1em;
      position: fixed;
      top: 0;
      left: 16px;
      text-align: left;
      z-index: 999999999;
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3);
      font-family: Arial, sans-serif;
      font-size: 12px;
    }

    ul {
      padding: 0;
      margin: 1em 0;
      list-style-type: none;
    }

    li {
      padding: 2px 4px;
      user-select: none;
    }

    li span {
      width: 1em;
      display: inline-block;
      margin-right: 4px;
    }

    li:hover {
      background-color: teal;
      color: white;
    }
  `;

  shadowRoot.append(styles);

  addClickAndDrag(container);

  return host;
}

function addClickAndDrag(element) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const initialPosition = JSON.parse(GM_getValue(CHECKLIST_POSITION, "{}"));

  function setPosition(top, left) {
    if (typeof top === "string") {
      top = parseInt(top);
    }
    if (typeof left === "string") {
      left = parseInt(left);
    }

    const rect = element.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      left = window.innerWidth - rect.width;
    }
    if (rect.bottom > window.innerHeight) {
      top = window.innerHeight - rect.height;
    }
    if (top < 0) {
      top = 0;
    }
    if (left < 0) {
      left = 0;
    }

    element.style.top = `${top}px`;
    element.style.left = `${left}px`;

    GM_setValue(CHECKLIST_POSITION, JSON.stringify({ top, left }));
  }

  setPosition(initialPosition.top ?? 16, initialPosition.left ?? 16);

  element.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - element.getBoundingClientRect().left;
    offsetY = e.clientY - element.getBoundingClientRect().top;
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      setPosition(e.clientY - offsetY, e.clientX - offsetX);
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  window.addEventListener("resize", () => {
    setPosition(element.style.top, element.style.left);
  });

  return element;
}

function makeChecklistElement(itemName, id) {
  const li = document.createElement("li");
  li.textContent = itemName;
  li.style.cursor = "pointer";

  const checkmark = document.createElement("span");
  const checked = "✓";
  const unchecked = "☐";

  checkmark.textContent = isItemCompleted(id) ? checked : unchecked;

  li.prepend(checkmark);

  li.addEventListener("click", () => {
    const isCompleted = toggleItemCompleted(id);
    checkmark.textContent = isCompleted ? checked : unchecked;
  });

  li.addEventListener("dblclick", (e) => {
    e.preventDefault();
    const newName = prompt("Enter new name", itemName);
    if (!newName) {
      return;
    }

    renameChecklistItem(id, newName);
    const checkmark = li.querySelector("span");
    li.textContent = newName;
    li.prepend(checkmark);
  });

  li.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (
      !confirm(
        `Would you like to remove ${itemName} from your dailies checklist?`
      )
    ) {
      return;
    }

    removeChecklistItem(id);
    li.remove();
  });

  return li;
}

function getTodaysChecklistProgress() {
  const progress = JSON.parse(
    GM_getValue(TODAYS_CHECKLIST_PROGRESS, "{ items: [] }")
  );

  if (progress?.date !== getNstDate()) {
    const newEntry = {
      date: getNstDate(),
      items: {},
    };
    setTodaysChecklistProgress(newEntry);
    return newEntry;
  }

  return progress;
}

function setTodaysChecklistProgress(progress) {
  GM_setValue(TODAYS_CHECKLIST_PROGRESS, JSON.stringify(progress));
}

function isItemCompleted(id) {
  return getTodaysChecklistProgress().items[id];
}

function getNstDate() {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
  });
}

function getChecklistItems() {
  return JSON.parse(GM_getValue(DAILIES_CHECKLIST_ITEMS, "{}"));
}

function setChecklistItems(items) {
  GM_setValue(DAILIES_CHECKLIST_ITEMS, JSON.stringify(items));
}

function toggleItemCompleted(id) {
  const progress = getTodaysChecklistProgress();
  progress.items[id] = !progress.items[id];
  setTodaysChecklistProgress(progress);

  return progress.items[id];
}

function renameChecklistItem(id, newName) {
  const items = getChecklistItems();
  items[id] = newName;
  setChecklistItems(items);
}

function addChecklistItem(name) {
  const items = getChecklistItems();
  const id = Date.now();
  items[id] = name;

  setChecklistItems(items);

  return id;
}

function removeChecklistItem(id) {
  const items = getChecklistItems();
  delete items[id];
  setChecklistItems(items);
}

main();
