// ==UserScript==
// @name         Neopets Stock Highlighter
// @author       Hiddenist
// @namespace    https://hiddenist.com
// @version      2024-07-20-patch1
// @description  Highlights Neopets stocks which are high enough to sell. Also sorts the list of stocks, and makes the UI a little nicer. Now with configurable settings!
// @match        https://www.neopets.com/stockmarket.phtml?type=portfolio
// @match        http://www.neopets.com/stockmarket.phtml?type=portfolio
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://github.com/Meerca/Neopets-Userscripts/raw/main/stock-highlighter.user.js
// @downloadURL  https://github.com/Meerca/Neopets-Userscripts/raw/main/stock-highlighter.user.js
// @supportURL   https://github.com/Meerca/Neopets-Userscripts/issues
// ==/UserScript==

(function () {
  "use strict";

  // Settings
  var settings = {
    highlightRows: GM_getValue("highlightRows", true),
    sortRows: GM_getValue("sortRows", true),
    moveSellButton: GM_getValue("moveSellButton", true),
    styleTweaks: GM_getValue("styleTweaks", true),

    highlights: {
      sellable: {
        backgroundColor:
          GM_getValue("highlights.sellable.backgroundColor") || "#afa",
        color: GM_getValue("highlights.sellable.color") || "",
        percentage: GM_getValue("highlights.sellable.percentage") || 400,
      },
      growing: {
        backgroundColor:
          GM_getValue("highlights.growing.backgroundColor") || "#ffa",
        color: GM_getValue("highlights.growing.color") || "",
        percentage: GM_getValue("highlights.growing.percentage") || 200,
      },
      bankrupt: {
        backgroundColor:
          GM_getValue("highlights.bankrupt.backgroundColor") || "#333",
        color: GM_getValue("highlights.bankrupt.color") || "#ccc",
        percentage: -100,
      },
      loss: {
        backgroundColor:
          GM_getValue("highlights.loss.backgroundColor") || "#fcc",
        color: GM_getValue("highlights.loss.color") || "",
      },
      default: {
        backgroundColor:
          GM_getValue("highlights.default.backgroundColor") || "white",
        color: GM_getValue("highlights.default.color") || "black",
      },
    },

    headerRows: 2,
    rowGroupSize: 2,

    // Defines configurable settings
    form: {
      boolean: {
        highlightRows: "Highlight Rows",
        sortRows: "Sort Rows",
        moveSellButton: "Move Sell Button to Top",
        styleTweaks: "Clean Up Table Styles",
      },
      highlight: {
        sellable: "Sell point",
        growing: "Growing stocks",

        bankrupt: {
          label: "Bankrupt stocks (-100%)",
          percentage: false,
        },
        loss: {
          label: "Profit loss (< 0%)",
          percentage: false,
        },
        default: {
          label: "Default colors",
          percentage: false,
        },
      },
    },
  };

  function main() {
    addSettingsForm();
    modifyTable();
  }

  function addSettingsForm() {
    const content = document.querySelector("#content td.content");

    var s = document.createElement("div");
    s.setAttribute("id", "stockHighlight_Settings");

    content.appendChild(s);

    var title = document.createElement("div");
    title.innerHTML = "Stock Highlighter Settings";
    title.style.fontWeight = "bold";
    title.style.fontSize = "110%";

    s.appendChild(title);

    var t = document.createElement("em");
    t.appendChild(
      document.createTextNode("Refresh the page to see settings changes.")
    );
    s.appendChild(t);

    for (var key in settings.form.boolean) {
      var bool = createSettingCheckbox(key, settings.form.boolean[key]);
      var wrap = document.createElement("div");
      wrap.style.padding = "10px";
      wrap.appendChild(bool);
      s.appendChild(wrap);
    }

    s.appendChild(document.createElement("hr"));

    for (var ckey in settings.form.highlight) {
      var set = createColorSetting(ckey, settings.form.highlight[ckey]);
      addSetting(s, set);
    }
  }

  function addSetting(form, item) {
    var wrap = document.createElement("div");
    wrap.style.margin = "15px 0";
    wrap.style.display = "inline-block";
    wrap.style.maxWidth = "25%";
    wrap.style.verticalAlign = "top";
    wrap.style.padding = "10px";
    wrap.appendChild(item);
    form.appendChild(wrap);
    return wrap;
  }

  // http://stackoverflow.com/a/6394168/1232123
  // Allows dot access to get nested object parameters
  function index(obj, is, value) {
    if (typeof is == "string") {
      return index(obj, is.split("."), value);
    } else if (is.length == 1 && typeof value !== "undefined") {
      obj[is[0]] = value;
      return value;
    } else if (is.length == 0 || typeof is === "undefined") {
      return obj;
    } else {
      return index(obj[is[0]], is.slice(1), value);
    }
  }

  function getSetting(key) {
    return index(settings, key);
  }

  function setSetting(key, value) {
    GM_setValue(key, value);
    return index(settings, key, value);
  }

  function createColorSetting(group, val) {
    if (typeof val === "string") {
      val = {
        label: val,
        percentage: true,
      };
    }

    var div = document.createElement("div");
    var title = document.createElement("div");
    title.appendChild(document.createTextNode(val.label));
    title.style.fontWeight = "bold";

    div.appendChild(title);

    if (val.percentage) {
      var percentage = createColorInput(
        group,
        "percentage",
        "Percent",
        "number"
      );
      div.appendChild(percentage);
    }

    var color = createColorInput(group, "color", "Text Color");
    var bg = createColorInput(group, "backgroundColor", "Highlight Color");
    div.appendChild(color);
    div.appendChild(bg);

    return div;
  }

  function createColorInput(group, key, label, type) {
    var colorLbl = document.createElement("label");
    var color = document.createElement("input");
    color.setAttribute("type", type || "text");
    var colorKey = (color.settingsKey = "highlights." + group + "." + key);
    var colorSet = getSetting(colorKey);

    if (colorSet) {
      color.value = colorSet;
    }

    colorLbl.appendChild(document.createTextNode(label));
    colorLbl.appendChild(document.createElement("br"));
    colorLbl.appendChild(color);
    colorLbl.style.display = "block";

    var update = function (event) {
      var color = event.target;
      setSetting(color.settingsKey, color.value);
    };

    color.addEventListener("change", update);
    color.addEventListener("keyup", update);

    return colorLbl;
  }

  function createSettingCheckbox(setting, text) {
    var lbl = document.createElement("label");

    var cb = document.createElement("input");
    cb.setAttribute("type", "checkbox");

    if (getSetting(setting)) {
      cb.checked = true;
    }

    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(text));
    cb.settingsKey = setting;

    cb.addEventListener("change", function (event) {
      var cb = event.target;
      setSetting(cb.settingsKey, !!cb.checked);
    });

    return lbl;
  }

  function modifyTable() {
    const stocksTable = document.querySelector("#postForm table");
    const stocksRows = document.querySelectorAll(
      "#postForm > table > tbody > tr"
    );

    if (settings.sortRows) {
      sortRows(stocksRows);
    }

    if (settings.moveSellButton) {
      moveSellButton(stocksTable);
    }

    if (settings.styleTweaks) {
      cleanupTableStyles(stocksTable);
    }
  }

  function setRowColors(row, c) {
    row.style.backgroundColor =
      c.backgroundColor || settings.highlights.default.backgroundColor;
    row.style.color = c.color || settings.highlights.default.color;
  }

  function highlight(row, percent) {
    var hl = settings.highlights;

    if (percent >= hl.sellable.percentage) {
      setRowColors(row, hl.sellable);
    } else if (percent >= hl.growing.percentage) {
      setRowColors(row, hl.growing);
    } else if (percent == hl.bankrupt.percentage) {
      setRowColors(row, hl.bankrupt);
    } else if (percent < 0) {
      setRowColors(row, hl.loss);
    } else {
      setRowColors(row, hl.default);
    }
  }

  function hasNeopetsPremium() {
    return document.querySelector("#sswmenu") !== null;
  }

  function parseRows(rows, skip, groupSize) {
    var rowGroups = {};
    var percentages = [];

    // Starting at row 3 (first two rows are header rows), and skipping every other row (the first row holds the data, the row after it has the form to sell that stock)
    for (var i = skip; i < rows.length - groupSize; i += groupSize) {
      var row = rows[i];
      var cells = row.cells;

      if (cells.length < 9) {
        continue;
      }

      var cell = cells[8];
      var val = parseInt(cell.textContent);

      if (settings.highlightRows) {
        highlight(rows[i], val);
      }

      if (!rowGroups[val]) {
        rowGroups[val] = [];
        percentages.push(val);
      }

      // Move grouped rows together
      var group = [];
      for (var j = 0; j < groupSize; ++j) {
        group.push(rows[i + j]);
      }
      rowGroups[val].push(group);
    }

    return {
      groups: rowGroups,
      percentages: percentages,
    };
  }

  function getPinEntryTable() {
    try {
      return document.getElementById("pin_field")?.parentNode.parentNode
        .parentNode.parentNode;
    } catch (e) {
      console.error(
        "Error getting PIN table, you might not have a PIN configured on your account",
        e
      );
      return null;
    }
  }

  /**
   * @param {HTMLTableElement} stocksTable
   */
  function moveSellButton(stocksTable) {
    // Put the sell and pin fields at the top of the table
    const sellInput = document.getElementById("show_sell");
    const pinTable = getPinEntryTable();

    if (pinTable) {
      stocksTable.parentNode.insertBefore(pinTable, stocksTable);
      pinTable.style.marginBottom = "16px";
      pinTable.style.marginTop = "16px";
    } else {
      stocksTable.style.marginTop = "32px";
    }
    stocksTable.parentNode.insertBefore(sellInput, stocksTable);

    sellInput.style.marginTop = "16px";
    sellInput.style.marginBottom = "16px";
  }

  /**
   * @param {HTMLTableElement} stocksTable
   */
  function sortRows(stocksRows) {
    const { percentages, groups } = parseRows(
      stocksRows,
      settings.headerRows,
      settings.rowGroupSize
    );
    // Sort numbers descending
    const sortedPercentages = percentages.sort(function (a, b) {
      return a - b;
    });

    // Go through the percentages in descending order and sort the rows
    for (var i in sortedPercentages) {
      const percentage = sortedPercentages[i];
      const g = groups[percentage];

      for (const j in g) {
        const group = g[j];

        for (var k = group.length - 1; k >= 0; --k) {
          const row = group[k];
          const parent = row.parentNode;
          parent.removeChild(row);
          parent.replaceChild(row, parent.insertRow(2));
        }
      }
    }
  }

  /**
   * @param {HTMLTableElement} stocksTable
   */
  function cleanupTableStyles(stocksTable) {
    const stocksRows = stocksTable.querySelectorAll("tbody tr");
    if (!hasNeopetsPremium()) {
      const content = document.querySelector("#content td.content");
      content.querySelector("div").remove();
      content.querySelector("div").style.width = "100%";
    }
    stocksTable.setAttribute("border", "0");
    stocksTable.style.width = "100%";
    for (const r in stocksRows) {
      for (const c in stocksRows[r].cells) {
        const cell = stocksRows[r].cells[c];

        if (cell && cell.style) {
          cell.style.borderBottom = "1px solid rgba(20,20,20,0.2)";
          cell.style.padding = "7px 0";
        }
      }
    }
  }

  main();
})();
