// ==UserScript==
// @name         Beauty Contest List Improvements
// @namespace    http://tampermonkey.net/
// @version      2024-09-06
// @description  try to take over the world!
// @author       Hiddenist
// @match        https://www.neopets.com/beauty/vote.phtml*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=neopets.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  function main() {
    const actions = [fixImageDimensions, fixSpeciesSelectForm];

    actions.forEach(tryCatch);
    if (document.layers) {
      document.captureEvents(Event.MOUSEDOWN);
      document.onmousedown = function () {
        return true;
      };
    } else if (document.all && !document.getElementById) {
      document.onmousedown = function () {
        return true;
      };
    }
    document.oncontextmenu = function () {
      return true;
    };
  }

  function tryCatch(fn) {
    try {
      return fn();
    } catch (e) {
      console.error(e);
    }
  }

  function fixSpeciesSelectForm() {
    const form = document.querySelector(`form[action="vote.phtml"]`);
    form.method = "GET";

    const query = new URLSearchParams(window.location.search);
    const species = query.get("cat");

    if (species) {
      form.cat.value = species;
    }
  }

  function fixImageDimensions() {
    const images = document.querySelectorAll(".content a[href^='details'] img");
    images.forEach((image) => {
      delete image.width;
      delete image.height;
      image.style.width = "auto";
      image.style.height = "auto";
      image.style.maxWidth = "100%";
      image.style.maxHeight = "300px";

      image.closest("td").vAlign = "bottom";
    });

    if (images.length < 12) {
      // remove the next button when there aren't enough entries
      document.querySelector("img[src*='pics_next']")?.closest("a").remove();
    }

    const table = document
      .querySelector(".content a[href^='details']")
      .closest("table");
    table.style.width = "100%";
  }

  main();
})();
