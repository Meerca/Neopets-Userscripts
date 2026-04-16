// ==UserScript==
// @name         Neopets Fancy Quickstock
// @namespace    https://hiddenist.com
// @version      2026-04-16
// @description  Adds item images and information to the quickstock page after caching data from the inventory page.
// @author       Hiddenist
// @match        https://www.neopets.com/quickstock.phtml*
// @match        https://www.neopets.com/inventory.phtml*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=neopets.com
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://github.com/Meerca/Neopets-Userscripts/raw/main/quickstock.user.js
// @downloadURL  https://github.com/Meerca/Neopets-Userscripts/raw/main/quickstock.user.js
// @supportURL   https://github.com/Meerca/Neopets-Userscripts/issues
// ==/UserScript==

(function () {
  "use strict";

  const options = {
    debug: false,
  };

  main();

  function main() {
    if (isInventoryPage()) {
      window.addEventListener("load", async () => {
        const hasItems = await waitUntilItemsLoaded();
        if (!hasItems) {
          debug("No items found in inventory.");
          return;
        }
        debug("Caching all item data from inventory...");
        cacheAllItems();
        debug("Finished caching all item data.");
      });
    } else if (isQuickStockPage()) {
      // Quickstock is now paginated and it loads in dynamically, so need to
      // observe the table to keep an eye out for changes.
      observeQuickstockTable();

      // But the initial page still needs images added!
      debug("Adding images to quickstock...");
      addImagesToQuickStock();
      debug("Finished adding images to quickstock.");
    }
  }

  function debug(...args) {
    if (options.debug) {
      console.debug("Neopets Fancy Quickstock script (debug mode):", ...args);
    }
  }

  function isInventoryPage() {
    return window.location.href.includes("inventory.phtml");
  }

  function isQuickStockPage() {
    return window.location.href.includes("quickstock.phtml");
  }

  /**
   * @returns {Promise<boolean>}
   */
  async function waitUntilItemsLoaded() {
    return new Promise((resolve) => {
      const items = document.querySelectorAll(".item-img");
      if (items.length) {
        resolve(true);
      }

      const observer = new MutationObserver(() => {
        const itemCount = document.querySelector(".inv-total-count, #noItems");
        if (itemCount != null) {
          observer.disconnect();
          resolve(document.querySelectorAll(".item-img").length > 0);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  function cacheAllItems() {
    const items = document.querySelectorAll(".item-img");

    debug("Caching data for items:", items);
    items.forEach(cacheItemData);
  }

  /**
   * @param {HTMLElement} item
   */
  function cacheItemData(item) {
    const data = item.dataset;
    const itemName = data.itemname;
    const flags = item.parentElement.querySelector(".item-subname").innerHTML;

    /**
     * @typedef {ItemData}
     * @property {string} image
     * @property {boolean} isNc
     * @property {string} rarity
     * @property {string} flags
     *
     * @type {ItemData}
     */
    const itemData = {
      image: data.image,
      isNc: data.itemset == "nc",
      rarity: data.rarity,
      flags,
    };

    const serializedData = JSON.stringify(itemData);

    debug("Caching item data:", itemName, itemData);
    GM_setValue(itemName, serializedData);
  }

  /**
   * @param {string} itemName
   * @returns {ItemData | null}
   */
  function loadItemData(itemName) {
    const value = GM_getValue(itemName);
    return value ? JSON.parse(value) : null;
  }

  function observeQuickstockTable() {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.target === 'childList' && !record.nextSibling) {
          observer.disconnect();
        }
      }

      addImagesToQuickStock();
    });

    observer.observe(document.querySelector('.quickstock-table'), {
      childList: true,
      subtree: true,
    });
  }

  function addImagesToQuickStock() {
    const items = getQuickstockItems();
    if (!items.length) {
      debug("No items in quick stock.");
      return;
    }

    items.forEach(addImageToQuickstockItem);
  }

  /**
   * @typedef {QuickstockItem}
   * @property {string} name
   * @property {ItemData} itemData
   * @property {HTMLTableRowElement} row
   * @property {QuickStockCheckboxes} checkboxes
   *
   * @typedef {QuickStockCheckboxes}
   * @property {HTMLInputElement?} stock
   * @property {HTMLInputElement?} deposit
   * @property {HTMLInputElement?} donate
   * @property {HTMLInputElement?} discard
   * @property {HTMLInputElement?} gallery
   * @property {HTMLInputElement?} closet
   * @property {HTMLInputElement?} shed
   *
   * @returns {QuickstockItem[]}
   */
  function getQuickstockItems() {
    const form = document.forms.quickstock;

    if (!form) {
      if (isQuickStockPage()) {
        console.warn("Could not find quickstock form.");
      }
      return [];
    }

    // Quickstock update: rows all have this class. Including the empty row
    // separating the Neopoint items from the NeoCash ones. And the NeoCash
    // items. And the row with the "check all" options. BUT WHATEVER.
    const rows = form.querySelectorAll('.np-table-row');
    const items = [];

    rows.forEach((row) => {
      const name = row.querySelector("td").textContent.trim();
      const itemData = loadItemData(name);
      const checkboxes = getCheckboxes(row);

      items.push({ name, itemData, row, checkboxes });
    });

    return items;
  }

  /**
   * @param {HTMLTableRowElement} row
   * @returns {QuickStockCheckboxes}
   */
  function getCheckboxes(row) {
    const checkboxes = {};

    const inputs = row.querySelectorAll("input[type='radio']");
    inputs.forEach((input) => {
      checkboxes[input.value] = input;
    });

    return checkboxes;
  }

  /**
   * @param {QuickstockItem} item
   */
  function addImageToQuickstockItem(item) {
    const { itemData, row } = item;

    if (!itemData) {
      debug("No data found for item:", item.name);
      return;
    }

    const image = document.createElement("img");
    image.src = itemData.image;
    image.style.height = "50px";
    image.style.width = "50px";
    image.style.marginRight = "10px";
    image.style.float = "left";

    const textContainer = document.createElement("div");
    textContainer.style.display = "grid";
    textContainer.style.gap = "4px";

    textContainer.innerHTML = itemData.flags;

    if (itemData.isNc) {
      // Weird one: NC items are now indicated by an invisible span.
      const ncIndicator = document.createElement('span');
      ncIndicator.classList = 'qs-cash-marker';
      ncIndicator.style.display = 'none';

      textContainer.prepend(ncIndicator);
    }

    const name = document.createElement("span");
    name.textContent = item.name;
    name.style.fontSize = "1.1em";

    textContainer.prepend(name);

    const rarity = document.createElement("span");
    rarity.textContent = "Rarity: " + itemData.rarity;

    textContainer.append(rarity);

    debug("Adding image to quickstock item:", item.name, row, image, rarity);
    const firstCell = row.querySelector("td");

    firstCell.innerHTML = "";
    firstCell.append(image, textContainer);
  }
})();
