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


### Training Helper

Makes codestone training your pet require fewer clicks and less math. Will send browser notifications when training is complete.

[![Install the Training Helper](https://img.shields.io/static/v1?label=&message=Install+Training+Helper&color=bbe026&style=for-the-badge)](https://github.com/Meerca/Neopets-Userscripts/raw/main/training-helper.user.js)
<sup>(requires [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo))</sup>

#### Screenshots

<table><tr><td><img src="https://github.com/user-attachments/assets/31e7d2d1-9922-443c-bf07-3893322aa17c" /></td>
<td><img src="https://github.com/user-attachments/assets/ada7daee-7525-4cc6-9402-a83a1efc8d23" /></td></tr>
<tr><td><img src="https://github.com/user-attachments/assets/8f31c072-6f23-4f64-ad0a-89466f360d8d"></td><td><img src="https://github.com/user-attachments/assets/9097a207-19d6-42f3-a7d2-c3d5887013f8"></td></tr></table>


#### Features
* Partial[^1] multi-language[^2] support (based on current language on Neopets)
* Allows you to start a training course from the status page in each of the three training schools
* Lets you search the shop wiz (SSW if you have premium) or your SDB for codestones and dubloons with a single click  
* Automatically recommends the next stat you should train (note: does not currently recommend optimized hitpoint levelling to minimize codestone use, instead it recommends your lowest stat and level only when necessary)
* Shows a live countdown of how much time you have left in your course
* Allows you to opt in to notifications when your pet's training is complete (note: the notification requires that you keep the browser tab open, there is no way to schedule a notification outside of the script)
* Shows your training results directly on the page when you complete a course
* Notifies you when it's your pet's birthday, to remind you to get your birthday muffin from their lookup
* Notifies you if your pet is eligible for free training in the Swashbuckling Academy during the pet's official species day
* Functions with or without Neopets Premium
* Functions with or without a Training Fortune Cookie active

[^1]: Currently, the user interface items are not translated and display in English. Not all features are fully tested in all languages.
[^2]: Does not support Chinese, Japanese, or Korean scripts, as the item names in Neopets are broken. In German and French, the countdown ticker does not function correctly right now.
