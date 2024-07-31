// ==UserScript==
// @name         Neopets: Show Best Bargain Stocks
// @author       Hiddenist
// @namespace    https://hiddenist.com
// @version      2024-07-29
// @description  Shows a list of the best priced stocks on any of the stock market pages
// @match        http*://www.neopets.com/stockmarket.phtml*
// @grant        none
// @updateURL    https://github.com/Meerca/Neopets-Userscripts/raw/main/bargain-stocks.user.js
// @downloadURL  https://github.com/Meerca/Neopets-Userscripts/raw/main/bargain-stocks.user.js
// @supportURL   https://github.com/Meerca/Neopets-Userscripts/issues
// ==/UserScript==

(function () {
  "use strict";

  function main() {
    customElements.define("bargain-stocks-list", BargainStocksListElement);
    const list = new BargainStocksListElement();
    const sibling = document.querySelector(
      "td.content > div:not([style~=float]) > center, td.content > center"
    );

    if (!sibling) {
      console.warn("Unable to find somewhere to put the bargain stocks list.");
      return;
    }

    sibling.after(list);
  }

  class BargainStocksListElement extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      const shadow = this.attachShadow({ mode: "closed" });

      this.message = document.createElement("p");
      this.list = document.createElement("ul");

      const container = document.createElement("div");
      const header = document.createElement("h2");
      header.textContent = "Bargain Stocks Helper";

      container.append(header, this.minPriceConfig, this.message, this.list);

      shadow.append(this.stylesheet, container);
      this._updateUI();
    }

    get minPrice() {
      const hasCheaperByTheDozen = document.querySelector(".perkBar") != null;
      const defaultMinPrice = hasCheaperByTheDozen ? 10 : 15;

      return this._getNumericAttributeValue("minPrice") || defaultMinPrice;
    }

    get maxPrice() {
      const defaultMaxPrice = this.minPrice + 5;
      return this._getNumericAttributeValue("maxPrice") || defaultMaxPrice;
    }

    get stocksList() {
      if (!this._stocksList) {
        this._stocksList = parseStockTicker();
      }
      return this._stocksList;
    }

    _updateUI() {
      const stocks = findCheapestPurchaseableStocks(
        this.stocksList,
        this.minPrice,
        this.maxPrice
      );
      this._setContent(stocks);
    }

    get stylesheet() {
      if (this._stylesheet) return this._stylesheet;

      this._stylesheet = document.createElement("style");
      this._stylesheet.textContent = `
          div {
              border: 2px solid #eee;
              padding: 24px;
              margin-top: 16px;
              display: grid;
              gap: 16px;
              border-radius: 4px;
              grid-template:
              "header header button" auto
              "message message message" auto
              "list list list" auto;
          }

          h2 {
              font-size: 16px;
              margin: 0;
              grid-area: header;
          }

          p {
              margin: 0;
              grid-area: message;
          }

          ul {
              list-style: none;
              margin: 0;
              padding: 0;
              display: grid;
              gap: 8px;
              grid-area: list;
          }

          a {
              font-size: 14px;
          }

          button {
              grid-area: button;
          }
      `;
      return this._stylesheet;
    }

    get minPriceConfig() {
      if (this._minPriceConfigElement) return this._minPriceConfigElement;

      const elem = document.createElement("button");
      elem.textContent = "Set min price";
      elem.addEventListener("click", () => {
        this._handleMinPriceConfig();
        this._updateUI();
      });
      this._minPriceConfigElement = elem;

      return this._minPriceConfigElement;
    }

    _handleMinPriceConfig() {
      const promptMessage = "Set a minimum purchase price";
      let newMin;
      do {
        newMin = prompt(
          newMin
            ? `Please specify a numeric value.\n${promptMessage}`
            : promptMessage,
          this.minPrice
        );
        if (!newMin) {
          return;
        }
      } while (isNaN(parseInt(newMin)));
      this.setAttribute("minPrice", newMin);
    }

    _getNumericAttributeValue(attributeName) {
      const value = parseInt(this.getAttribute(attributeName));

      if (typeof value !== "number" || isNaN(value)) {
        return null;
      }

      return value;
    }

    _setContent(stocks) {
      this.list.textContent = "";

      if (stocks.length === 0) {
        this.message.textContent = `No stocks are currently available between ${this.minPrice} and ${this.maxPrice} NP. :(`;
        return;
      }

      this.message.textContent =
        `The following ${stocks.length} ${pluralize(
          stocks.length,
          "stock"
        )} are available to purchase at or near ${this.minPrice} NP.` +
        " Click the stock ticker to go to the purchase page.";

      this.list.append(
        ...stocks.map(({ ticker, price }) => {
          const item = document.createElement("li");
          const url = `http://www.neopets.com/stockmarket.phtml?type=buy&ticker=${ticker}`;
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.textContent = ticker;
          item.append(anchor);
          if (price !== this.minPrice) {
            item.append(` (${price} NP)`);
          }
          return item;
        })
      );
    }
  }

  function pluralize(num, singular, plural = `${singular}s`) {
    if (num == 1) {
      return singular;
    } else {
      return plural;
    }
  }

  function parseStockTicker() {
    const stocks = document.querySelectorAll("marquee a");
    const regex = /^([A-Z]+) (\d+)/;

    return [...stocks].reduce((map, stock) => {
      const [_, ticker, priceString] = regex.exec(stock.textContent);
      if (ticker in map) {
        return map;
      }
      return {
        ...map,
        [ticker]: parseInt(priceString),
      };
    }, {});
  }

  function findCheapestPurchaseableStocks(
    stocksMap,
    minPrice = 15,
    maxPrice = minPrice + 5
  ) {
    let cheapest = [];
    let currentMin = maxPrice;

    Object.entries(stocksMap).forEach(([ticker, price]) => {
      const stock = { ticker, price };
      if (stock.price < minPrice || stock.price > maxPrice) {
        return;
      }

      if (stock.price < currentMin) {
        currentMin = stock.price;
        cheapest = [];
        cheapest.push(stock);
      } else if (stock.price === currentMin) {
        cheapest.push(stock);
      }
    });

    return cheapest;
  }

  main();
})();
