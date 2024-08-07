// ==UserScript==
// @name         Neopets: Display Stock Price
// @author       Hiddenist
// @namespace    https://hiddenist.com
// @version      2024-07-29
// @description  Displays the price of Neopets stocks on the purchase page, and pre-fill the number of shares to max.
// @match        http*://www.neopets.com/stockmarket.phtml?type=buy*
// @match        http*://www.neopets.com/stockmarket.phtml?ticker=*&type=buy*
// @grant        none
// @updateURL    https://github.com/Meerca/Neopets-Userscripts/raw/main/stock-price.user.js
// @downloadURL  https://github.com/Meerca/Neopets-Userscripts/raw/main/stock-price.user.js
// @supportURL  https://github.com/Meerca/Neopets-Userscripts/issues
// ==/UserScript==

(function () {
  ("use strict");

  const numberOfShares = 1000;
  const minBuyPrice = getMinPurchasePrice();

  const updatedEveryMinutes = 30; // how often Neopets stock prices update
  const loadTime = new Date();
  const refreshInterval = 1000 * 60 * 5; // 5 minutes
  let refreshTimeout = false;

  const purchaseForm = document.querySelector(
    'form[action="process_stockmarket.phtml"]'
  );
  const div = document.createElement("div");

  function init() {
    purchaseForm.ticker_symbol.parentElement.appendChild(div);
    purchaseForm.amount_shares.value = numberOfShares;

    div.style.backgroundColor = "white";
    div.style.padding = "5px";
    div.style.borderRadius = "5px";
    div.style.textAlign = "center";

    displayTickerInfo();
    purchaseForm.ticker_symbol.addEventListener("change", displayTickerInfo);
    // when re-entering tab, since the page is most likely to be stale then
    document.addEventListener("visibilitychange", displayTickerInfo);
  }

  function getTickerEntry(ticker) {
    let item = document.evaluate(
      `//marquee//b[starts-with(., "${ticker} ")]`,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (!item) {
      console.log("Nothing found");
      return null;
    }

    let m = item.textContent.match(
      /(?<ticker>\w+) (?<price>\d+) (?<change>[+\-]\d+)/
    );
    return m.groups;
  }

  function getTimeDiffMinutes() {
    const timeNow = new Date();
    const diffMs = timeNow.getTime() - loadTime.getTime();
    return Math.floor(diffMs / 1000 / 60);
  }

  function checkStaleness() {
    const minutesStale = getTimeDiffMinutes();
    if (minutesStale >= updatedEveryMinutes) {
      div.style.color = "red";
      div.style.cursor = "pointer";
      div.innerHTML = `<strong>❗ Refresh the page ❗</strong><br><small><em>${minutesStale} minutes since prices updated</em><small>`;
      div.addEventListener("click", function () {
        location.reload();
      });
      return true;
    }

    return false;
  }

  function getMinPurchasePrice(defaultValue = 15) {
    const regex = /(\d+) NP per share/;
    const message = Array.from(document.querySelectorAll(".content b")).find(
      (b) => regex.test(b.textContent)
    );

    if (!message) {
      return defaultValue;
    }

    const matches = message.textContent.match(regex);
    if (!matches) {
      return defaultValue;
    }

    const minPrice = parseInt(matches[1]);

    if (isNaN(minPrice) || minPrice < 1) {
      return defaultValue;
    }

    return minPrice;
  }

  function displayTickerInfo() {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }

    if (checkStaleness()) {
      return;
    }

    const ticker = purchaseForm.ticker_symbol.value;
    const tickerEntry = getTickerEntry(ticker);
    const sinceMinutes = getTimeDiffMinutes();
    const timeSince =
      sinceMinutes == 0
        ? "just now"
        : `${sinceMinutes} minute${sinceMinutes == 1 ? "" : "s"} ago`;

    if (!ticker) {
      div.innerHTML = "";
      div.style.display = "none";
      return;
    } else {
      div.style.display = "";
    }

    div.title = "";

    if (!tickerEntry) {
      div.innerHTML = `<small>⚠️<em>Can't find ${ticker}</em></small>`;
      div.style.color = "red";
      return false;
    }

    let emoji = "";
    if (tickerEntry.price < minBuyPrice) {
      div.style.color = "red";
      emoji = "⛔";
      div.title =
        "This stock is less than the minimum purchase price - you can't buy it";
    } else if (tickerEntry.price > minBuyPrice) {
      div.style.color = "orange";
      emoji = "⚠️";
      div.title = "This stock costs more than the minimum purchase price";
    } else {
      div.style.color = "green";
      emoji = "❇️";
      div.title = "Nice! This stock is the same as the minimum purchase price.";
    }

    div.innerHTML = `<strong>${emoji} Cost: ${tickerEntry.price} NP</strong> ${emoji}<br><small><em>for ${ticker} ${timeSince}</em></small>`;

    refreshTimeout = setTimeout(displayTickerInfo, refreshInterval);

    return true;
  }

  init();
})();
