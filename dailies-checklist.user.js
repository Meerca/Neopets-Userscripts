// ==UserScript==
// @name         Neopets: Dailies Checklist
// @author       Hiddenist
// @namespace    https://hiddenist.com
// @version      2024-10-30
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

  console.log(GM_listValues().map((key) => ({ key, value: GM_getValue(key) })));
}

function makeChecklist() {
  const shadowRoot = document.createElement("div");
  const shadow = shadowRoot.attachShadow({ mode: "open" });

  const container = document.createElement("div");
  container.classList.add("container");

  shadow.append(container);

  const header = document.createElement("h2");
  header.textContent = "Dailies Checklist";
  container.append(header);

  const checklist = document.createElement("ul");
  const items = getChecklistItems();

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

    div.container {
      background-color: #f8f8f8;
      padding: 1em;
      position: fixed;
      top: 0;
      left: 16px;
      text-align: left;
      z-index: 999999999;
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3);
    }

    ul {
      padding: 0;
      margin: 1em 0;
      list-style-type: none;
    }
  `;

  container.append(styles);

  addClickAndDrag(container);

  return container;
}

function addClickAndDrag(element) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const initialPosition = JSON.parse(GM_getValue(CHECKLIST_POSITION, "{}"));

  function setPosition(top, left) {
    const rect = element.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      left = window.innerWidth - rect.width + "px";
    }
    if (rect.bottom > window.innerHeight) {
      top = window.innerHeight - rect.height + "px";
    }

    element.style.top = top;
    element.style.left = left;

    GM_setValue(CHECKLIST_POSITION, JSON.stringify({ top, left }));
  }

  setPosition(initialPosition.top ?? "16px", initialPosition.left ?? "16px");

  element.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - element.getBoundingClientRect().left;
    offsetY = e.clientY - element.getBoundingClientRect().top;
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      setPosition(e.clientY - offsetY + "px", e.clientX - offsetX + "px");
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
  const checked = "✓ ";
  const unchecked = "☐ ";

  checkmark.textContent = isItemCompleted(id) ? checked : unchecked;

  li.prepend(checkmark);

  li.addEventListener("click", () => {
    const isCompleted = toggleItemCompleted(id);
    checkmark.textContent = isCompleted ? checked : unchecked;
  });

  li.addEventListener("dblclick", () => {
    const newName = prompt("Enter new name", itemName);
    if (!newName) {
      return;
    }

    renameChecklistItem(id, newName);
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
    timeZone: "America/New_York",
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
