// ==UserScript==
// @name         Neopets: Show Best Bargain Stocks
// @namespace    https://nikkidelrosso.com/
// @version      0.1
// @description  Shows a list of the best priced stocks on the Neopets bargain stocks page
// @author       You
// @match        http*://www.neopets.com/stockmarket.phtml?type=list&bargain=true*
// @grant        none
// @updateURL    https://github.com/Nikker/Neopets-Userscripts/raw/master/bargain-stocks.user.js
// ==/UserScript==

(function() {
    'use strict';

    var stocksTable = document.querySelector('.content table');
    var cheapest = [];
    var minPurchase = 15;
    var closestCurrent = 20;

    for (let row of stocksTable.rows) {
        let cost = parseInt(row.cells[5].textContent);
        if (cost < closestCurrent && cost >= minPurchase) {
            closestCurrent = cost;
            cheapest = [];
            cheapest.push(row);
        } else if (cost == closestCurrent) {
            cheapest.push(row);
        }
    }

    function s(num, plural = "s", singular = "") {
        if (num == 1) {
            return singular;
        } else {
            return plural;
        }
    }

    var content;
    if (cheapest.length) {
        content = `<p><b>The following ${cheapest.length} stock${s(cheapest.length)} can be purchased at ${closestCurrent} NP:</b></p><ul>`;

        for (let row of cheapest) {
            let ticker = row.cells[1].textContent;
            content += `<li><a href="http://www.neopets.com/stockmarket.phtml?type=buy&ticker=${ticker}">${ticker}</a></li>`;
        }

        content += `</ul>`;
    } else {
        content = `<p><b>No stocks are currently available between ${minPurchase} and ${closestCurrent} NP. :(`;
    }

    var container = document.createElement('div');
    container.innerHTML = content;

    stocksTable.parentNode.insertBefore(container, stocksTable);
})();
