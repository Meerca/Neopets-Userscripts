// ==UserScript==
// @name         Neopets: Display Stock Price
// @namespace    https://nikkidelrosso.com
// @version      0.1
// @description  Displays the price of Neopets stocks on the purchase page, and pre-fill the number of shares to max.
// @author       Nikki DelRosso
// @include      http*://www.neopets.com/stockmarket.phtml?type=buy*
// @include      http*://www.neopets.com/stockmarket.phtml?ticker=*&type=buy*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const numberOfShares = 1000;
    const minBuyPrice = 15;
    const purchaseForm = document.querySelector('form[action="process_stockmarket.phtml"]');
    // const tickerMarquee = document.getElementsByTagName('marquee')[0];

    const div = document.createElement('div');

    function init() {
        purchaseForm.ticker_symbol.parentElement.appendChild(div);
        purchaseForm.amount_shares.value = numberOfShares;

        div.style.backgroundColor = "white";
        div.style.padding = "5px";
        div.style.borderRadius = "5px";
        div.style.textAlign = "center";

        displayTickerInfo();
        purchaseForm.ticker_symbol.addEventListener('change', displayTickerInfo);
    }

    function getTickerEntry(ticker) {
        let item = document.evaluate(`//marquee//b[starts-with(., "${ticker} ")]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (!item) {
            console.log("Nothing found");
            return null;
        }

        let m = item.textContent.match(/(?<ticker>\w+) (?<price>\d+) (?<change>[+\-]\d+)/);
        return m.groups;
    }

    function displayTickerInfo() {
        let ticker = purchaseForm.ticker_symbol.value;
        let tickerEntry = getTickerEntry(ticker);

        if (!tickerEntry) {
            div.innerHTML = `<small>⚠️<em>Can't find ${ticker}</em></small>`;
            div.style.color = 'red';
            return false;
        }

        let emoji = '';
        if (tickerEntry.price < minBuyPrice) {
            div.style.color = 'red';
            emoji = '⛔';
        } else if (tickerEntry.price > minBuyPrice) {
            div.style.color = 'orange';
            emoji = '⚠️';
        } else {
            div.style.color = 'green';
            emoji = '❇️';
        }

        div.innerHTML = `<b>${emoji} Cost: ${tickerEntry.price} NP</b> ${emoji}<br><small><em>For ${ticker} on page load</em></small>`;
        return true;
    }

    init();
})();
