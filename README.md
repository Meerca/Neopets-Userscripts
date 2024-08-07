# Neopets Userscripts

This is a set of basic scripts to help out with UI enhancements on various parts of Neopets.

> **⚠️ Use with caution**
>
> Use external scripts at your own risk! Using these scripts may or may not violate the Neopets terms of service.
>
> As with any script provided by someone you don't know, I highly recommend that you _look through the source code_ yourself.
> If you don't understand what you're installing, you could be installing something that could put your account at risk!

## Requirements

### You must first install [the Tampermonkey extension](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) on Chrome

You may also be able to use this on other browsers using Tampermonkey or Greasemonkey equivalent extensions. These scripts have only been tested in Chrome on a computer (and not on any mobile devices).

## The Scripts

- [Stock Highlighter](#stock-highlighter): Cleans up your Stock Portfolio
- [Bargain Stocks Helper](#bargain-stocks-helper): Helps you find stocks to purchase for the day
- [Stock Purchase Helper](#stock-purchase-helper): Helps you make sure you're purchasing the right stocks at the right price
- [Fancy Quickstock](#fancy-quickstock): Adds item images and info the the Quickstock page
- [Training Helper](#training-helper): Helps you track when your pet will be done with codestone or dubloon training

### Stock Highlighter

Sorts your stock portfolio with stocks listed by value, including configurable options to set your sell point, highlight color, etc. Also moves the PIN entry for selling stocks to the top of the screen.

[![Install the Stock Highlighter](https://img.shields.io/static/v1?label=&message=Install+Stock+Highlighter&color=2ea44f&style=for-the-badge)](https://github.com/Meerca/Neopets-Userscripts/raw/main/stock-highlighter.user.js)
<sup>(requires [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo))</sup>

#### Screenshots

<img style="width: 400px; max-width: 45%;" alt="Screenshot of the Neopets Portfolio View page with the Stock Highlighter enabled" src="https://user-images.githubusercontent.com/563879/160717689-022387c2-e5ed-42bf-a640-808512d07c41.png"> <img style="width: 400px; max-width: 45%;" alt="Settings" src="https://user-images.githubusercontent.com/563879/160717551-5b7ad85f-b0f0-4df8-ba85-8d73ae5c42f7.png">

### Bargain Stocks Helper

Adds a list of stocks that are at the minimum purchase price. This shows up on all stock pages as long as the ticker marquee is at the top of the page.

The default minimum price is 15 NP, but can be configured.

[![Install the Bargain Stocks Helper](https://img.shields.io/static/v1?label=&message=Install+Bargain+Stocks+Helper&color=2ea44f&style=for-the-badge)](https://github.com/Meerca/Neopets-Userscripts/raw/main/bargain-stocks.user.js)
<sup>(requires [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo))</sup>

#### Screenshots

<img style="width: 400px; max-width: 100%" alt="Screenshot of the Neopets Stocks page with the Bargain Stocks Helper enabled" src="screenshots/bargain-stocks-helper-v1.png">

### Stock Purchase Helper

Shows the price of the stock you're buying on the purchase page

[![Install the Stock Purchase Helper](https://img.shields.io/static/v1?label=&message=Install+Stock+Purchase+Helper&color=2ea44f&style=for-the-badge)](https://github.com/Meerca/Neopets-Userscripts/raw/main/stock-price.user.js)
<sup>(requires [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo))</sup>

#### Screenshots

<img style="width: 400px; max-width: 100%" alt="Screenshot of the Neopets Stocks Purchase page with the Stock Purchase Helper enabled" src="https://user-images.githubusercontent.com/563879/160718071-572e3385-bc8c-455f-bad4-e60e697f826a.png">

### Fancy Quickstock

Adds item images and information to the quickstock page.

Gathers data from your inventory page, so that when you visit the quick stock page it can display item images and rarity. Makes it way easier to tell what items you're stashing!

[![Install Fancy Quickstock](https://img.shields.io/static/v1?label=&message=Install+Fancy+Quickstock&color=2ea44f&style=for-the-badge)](https://github.com/Meerca/Neopets-Userscripts/raw/main/quickstock.user.js)
<sup>(requires [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo))</sup>

### Screenshots

<img style="width: 400px; max-width: 100%" alt="Screenshot of the Neopets Quickstock table with the Fancy Quickstock script running" src="screenshots/quickstock.png" />

---

### Training Helper

Makes codestone training your pet require fewer clicks and less math. Will send browser notifications training is complete.

[![Install the Training Helper](https://img.shields.io/static/v1?label=&message=Install+Training+Helper&color=bbe026&style=for-the-badge)](https://github.com/Meerca/Neopets-Userscripts/raw/main/training-helper.user.js)
<sup>(requires [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo))</sup>

> Disclaimer: This script has not been tested in quite a number of years!
