// ==UserScript==
// @name         Neopets SDB Cataloger
// @namespace    http://hiddenist.com/
// @version      2024-07-21
// @description  Scans your safety deposit box on Neopets and prints a report of all items found.
// @author       Hiddenist
// @match        https://www.neopets.com/safetydeposit.phtml*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @updateURL    https://github.com/Meerca/Neopets-Userscripts/raw/main/scan-sdb.user.js
// @downloadURL  https://github.com/Meerca/Neopets-Userscripts/raw/main/scan-sdb.user.js
// @supportURL   https://github.com/Meerca/Neopets-Userscripts/issues
// ==/UserScript==

(function () {
  "use strict";

  const isCataloging = GM_getValue("isCataloging", false);
  const scanDate = GM_getValue("scanDate", null);
  main();

  var cancelCatalogingCommand;
  if (isCataloging) {
    cancelCatalogingCommand = GM_registerMenuCommand(
      "Cancel Cataloging",
      () => {
        GM_setValue("isCataloging", false);
      }
    );
  } else if (scanDate) {
    GM_registerMenuCommand("Print Report", () => {
      const date = new Date(scanDate).toLocaleDateString();
      alert(
        `View the developer console in your browser to see the report from your last scan on ${date}.`
      );
      console.log("Scan date:");
      printItemReport();
    });
  }

  GM_registerMenuCommand("Start Cataloging", () => {
    saveItemData({});
    GM_setValue("scanDate", null);
    GM_setValue("isCataloging", true);
    window.location = "https://www.neopets.com/safetydeposit.phtml";
  });

  async function main() {
    if (!isCataloging) {
      return;
    }
    await waitUntilLoaded();
    appendItemData(readItems());

    if (!nextPage()) {
      GM_setValue("scanDate", new Date().toISOString());
      GM_setValue("isCataloging", false);
      alert(
        "Finished cataloging! View the developer console in your browser to see the results."
      );

      printItemReport();

      if (cancelCatalogingCommand) {
        GM_unregisterMenuCommand(cancelCatalogingCommand);
      }
    }
  }

  function printItemReport() {
    const itemData = loadItemData();
    const values = Object.values(itemData);
    const uniqueItemCount = values.length;
    const itemCount = values.reduce((acc, item) => acc + item.quantity, 0);
    console.log("Unique items:", uniqueItemCount);
    console.log("Total items:", itemCount);
    console.table(itemData);
  }

  function waitUntilLoaded() {
    return new Promise((resolve) => {
      window.addEventListener("load", resolve);
    });
  }

  function nextPage() {
    const navButtons = document.querySelectorAll("a[href^='?category']");

    const nextButton = Array.from(navButtons).find((button) =>
      /^Next/.test(button.textContent)
    );

    if (!nextButton) {
      return false;
    }
    nextButton.click();
    return true;
  }

  function appendItemData(items) {
    saveItemData({ ...loadItemData(), ...items });
  }

  function saveItemData(items) {
    GM_setValue("items", JSON.stringify(items));
  }

  function loadItemData() {
    return JSON.parse(GM_getValue("items", "{}"));
  }

  function readItems() {
    const itemRows = document.querySelectorAll("#boxform ~ tr[bgcolor^='#F']");

    return Array.from(itemRows)
      .map((row) => {
        const item = {
          id: getItemId(row),
          name: getItemName(row),
          image: getItemImage(row),
          quantity: getItemQuantity(row),
        };
        return item;
      })
      .reduce((acc, { id, ...item }) => {
        return {
          ...acc,
          [id]: item,
        };
      }, {});
  }

  function getItemId(row) {
    const removeInput = row.querySelector("input.remove_safety_deposit");
    const id = removeInput.name.match(/back_to_inv\[(\d+)\]/)[1];
    return parseInt(id);
  }

  /**
   * @param {HTMLTableRowElement} row
   */
  function getItemQuantity(row) {
    const removeInput = row.querySelector("input.remove_safety_deposit");
    const count = removeInput.dataset.total_count;
    return parseInt(count);
  }

  /**
   * @param {HTMLTableRowElement} row
   */
  function getItemName(row) {
    const nameCell = row.querySelector("td:nth-child(2)");
    const boldTag = nameCell.firstElementChild;
    assert(
      boldTag.tagName === "B",
      "Expected to find a B tag but instead found " + boldTag.tagName
    );

    const textNode = boldTag.firstChild;

    assert(
      textNode.nodeType === Node.TEXT_NODE,
      `Expected to find a text node (${Node.TEXT_NODE}) but instead found ${textNode.nodeType}`
    );

    return textNode.textContent.trim();
  }

  /**
   * @param {HTMLTableRowElement} row
   */
  function getItemImage(row) {
    const img = row.querySelector("img");
    return img.src;
  }

  function assert(condition, message) {
    if (!condition) {
      throw new FailedAssertionError(message);
    }
  }

  class FailedAssertionError extends Error {
    constructor(message) {
      super(message);
      this.name = "FailedAssertionError";
    }
  }
})();
