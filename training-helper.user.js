// ==UserScript==
// @name         Neopets Training Helper
// @author       Hiddenist
// @namespace    https://hiddenist.com
// @version      2024-08-19-beta0
// @description  Makes codestone training your pet require fewer clicks and less math.
// @match        http*://www.neopets.com/island/fight_training.phtml*
// @match        http*://www.neopets.com/island/training.phtml*
// @match        http*://www.neopets.com/pirates/academy.phtml*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @updateURL    https://github.com/Meerca/Neopets-Userscripts/raw/main/training-helper.user.js
// @downloadURL  https://github.com/Meerca/Neopets-Userscripts/raw/main/training-helper.user.js
// @supportURL   https://github.com/Meerca/Neopets-Userscripts/issues
// ==/UserScript==
(function () {
  ("use strict");

  const DEBUG = GM_getValue("debug", false);
  const DUBLOON_TRAINING_MAX_LEVEL = 40;

  /**
   * @typedef {"strength" | "defence" | "agility" | "endurance" | "level"} StatName
   * @typedef {keyof typeof ItemType} ItemType
   * @typedef {keyof typeof TrainingStatus} TrainingStatus
   */

  const configuration = Object.seal({
    /**
     * The maximum level to train each stat to.
     */
    maxStats: {
      strength: 750, // Does nothing after 750
      defence: 750, // Does nothing after 750
      agility: 201, // Not useful after 201, only used for equipping certain items
      endurance: Infinity,
      level: Infinity,
    },
    notifications: {
      enabled:
        GM_getValue(
          "notifications.enabled",
          Notification.permission === "granted"
        ) && Notification.permission === "granted",
      idleReminder: {
        enabled: GM_getValue("notifications.idleReminder.enabled", false),
        intervalInMs: 1000 * 60,
        thresholdInMs: GM_getValue(
          "notifications.idleReminder.thresholdInMs",
          1000 * 60
        ),
      },
    },
    freebies: {
      enabled: true
    },
    quickrefLookup: {
      shouldCache: true,
    },
  });

  const ItemType = {
    codestone: "codestone",
    dubloon: "dubloon",
    unknown: "unknown",
  };

  const TrainingStatus = {
    noCourseStarted: "noCourseStarted",
    active: "active",
    finished: "finished",
    needsPayment: "needsPayment",
  };

  function main() {
    if (!CurrentPage.isStatusPage()) {
      return;
    }

    UI.addStyles();
    UI.addConfigurationForm();

    const allPets = PetTrainingInfo.getForAllPets();

    allPets.forEach((pet) => {
      if (DEBUG) console.debug("Training info:", pet);
      switch (pet.status) {
        case TrainingStatus.noCourseStarted:
          return pet.addStartCourseForm();
        case TrainingStatus.active:
          return pet.startCountdownTracker();
        case TrainingStatus.finished:
          return pet.addAjaxListenerToCompleteCourseForm();
        case TrainingStatus.needsPayment:
          return pet.updatePaymentUI();
      }
    });

    if (configuration.freebies.enabled) {
      const quickref = new QuickrefLookup();
      allPets.forEach(async (trainingInfo) => {
        const petInfo = await quickref.getPetInfo(trainingInfo.petName);
        Freebies.checkFreebies(petInfo, trainingInfo);
      });
    }
  }

  class CurrentPage {
    static PirateSchool = "pirate";
    static RegularSchool = "regular";
    static SecretSchool = "secret";

    static getTrainingSchool() {
      switch (window.location.pathname) {
        case "/pirates/academy.phtml":
          return CurrentPage.PirateSchool;
        case "/island/training.phtml":
          return CurrentPage.RegularSchool;
        case "/island/fight_training.phtml":
          return CurrentPage.SecretSchool;
        default:
          return null;
      }
    }

    static isPirateSchool() {
      return CurrentPage.getTrainingSchool() === CurrentPage.PirateSchool;
    }

    static isRegularSchool() {
      return CurrentPage.getTrainingSchool() === CurrentPage.RegularSchool;
    }

    static isSecretSchool() {
      return CurrentPage.getTrainingSchool() === CurrentPage.SecretSchool;
    }

    static isStatusPage() {
      const query = new URLSearchParams(window.location.search);
      return query.get("type") === "status";
    }

    static getScriptName() {
      return window.location.pathname.split("/").pop();
    }
  }

  class PetTrainingInfo {
    /**
     * @param {HTMLTableRowElement} headerRow
     */
    constructor(headerRow) {
      const titleRegexMatches = headerRow.textContent.match(
        /^(?<petName>\w+).*(?:currently studying (?<stat>\w+)|not on a course)/
      );

      if (!titleRegexMatches) {
        throw new Error(
          "Unrecognized header row format for training info: " +
            headerRow.textContent
        );
      }
      const bodyRow = headerRow.nextElementSibling;

      /**
       * @type {TrainingStatus}
       * @public
       * @readonly
       */
      this.status = headerRow.textContent.includes("is not on a course")
        ? TrainingStatus.noCourseStarted
        : bodyRow.textContent.includes("Time till course finishes")
        ? TrainingStatus.active
        : bodyRow.textContent.includes("Course Finished!")
        ? TrainingStatus.finished
        : TrainingStatus.needsPayment;

      /**
       * @type {HTMLElement}
       * @public
       * @readonly
       */
      this.trainingCell = bodyRow.lastChild;

      /**
       * @type {StatsWithElements}
       * @public
       * @readonly
       */
      this.currentStats = PetTrainingInfo.getCurrentStats(bodyRow.firstChild);

      /**
       * @type {string}
       * @public
       * @readonly
       */
      this.petName = titleRegexMatches.groups.petName;

      /**
       * @type {StatName?}
       * @public
       */
      this.currentCourseStat = titleRegexMatches.groups.stat?.toLowerCase();

      /**
       * @type {Countdown[]}
       * @public
       * @readonly
       */
      this.countdowns = PetTrainingInfo.getCountdowns(this.trainingCell);

      /**
       * @type {ItemInfo[]}
       * @public
       */
      this.trainingCost = PetTrainingInfo.getTrainingCost(this.trainingCell);

      /**
       * @type {Date?}
       * @public
       */
      this.endTime = this.countdowns.find(
        ({ isActualTime }) => isActualTime
      )?.endTime;
    }

    /**
     * @returns {PetTrainingInfo[]}
     */
    static getForAllPets() {
      return [...document.querySelectorAll("td.content tr")]
        .filter(
          (tr) =>
            tr.textContent.includes("is currently studying") ||
            tr.textContent.includes("is not on a course")
        )
        .map((tr) => new PetTrainingInfo(tr));
    }

    /**
     * @typedef {Object} StatsWithElements
     * @property {number} level
     * @property {number} strength
     * @property {number} defence
     * @property {number} agility
     * @property {number} endurance
     * @property {number} currentHitpoints
     *
     * @property {Record<StatName, HTMLElement>} elements
     * @param {HTMLElement} currentStatsCell
     * @returns {StatsWithElements}
     * @private
     */
    static getCurrentStats(currentStatsCell) {
      const boldTags = currentStatsCell.querySelectorAll("b");
      var elements = {
        level: boldTags[0],
        strength: boldTags[1],
        defence: boldTags[2],
        agility: boldTags[3],
        endurance: boldTags[4],
      };

      const enduranceText = elements.endurance.textContent;
      const enduranceMatch = enduranceText.match(
        /(?<currentHp>\d+) ?\/ ?(?<maxHp>\d+)/
      );

      return {
        elements,
        level: parseInt(elements.level.textContent),
        strength: parseInt(elements.strength.textContent),
        defence: parseInt(elements.defence.textContent),
        agility: parseInt(elements.agility.textContent),
        endurance: parseInt(enduranceMatch?.groups.maxHp),
        currentHitpoints: parseInt(enduranceMatch?.groups.currentHp),
      };
    }

    /**
     * @typedef {Object} TimeLeft
     * @property {number} hours
     * @property {number} minutes
     * @property {number} seconds
     *
     * @typedef {Object} Countdown
     * @property {HTMLElement} element
     * @property {boolean} isActualTime
     * @property {TimeLeft} timeLeft
     * @property {Date} endTime
     *
     * @param {HTMLTableCellElement} trainingCell
     * @returns {Countdown[]}
     * @private
     */
    static getCountdowns(trainingCell) {
      return [...trainingCell.querySelectorAll("b")].flatMap((element) => {
        const match = element.textContent.match(
          /(?<hours>\d+) ?hrs, ?(?<minutes>\d+) ?minutes, ?(?<seconds>\d+) ?seconds/
        );
        if (!match) return [];

        // Training fortune cookie original time before it's reduced
        const isActualTime =
          !element.parentElement.classList.contains("strikethrough");
        const timeLeft = {
          hours: parseInt(match.groups.hours),
          minutes: parseInt(match.groups.minutes),
          seconds: parseInt(match.groups.seconds),
        };
        const endTime = new Date();
        endTime.setSeconds(endTime.getSeconds() + timeLeft.seconds);
        endTime.setMinutes(endTime.getMinutes() + timeLeft.minutes);
        endTime.setHours(endTime.getHours() + timeLeft.hours);
        return [
          {
            element,
            isActualTime,
            timeLeft,
            endTime,
          },
        ];
      });
    }

    /**
     * @param {HTMLTableCellElement} trainingCell
     * @returns {ItemInfo[]}
     * @private
     */
    static getTrainingCost(trainingCell) {
      const itemElements = [...trainingCell.querySelectorAll("b")].filter(
        (b) => {
          return (
            b.textContent.includes("Codestone") ||
            b.textContent.includes("Dubloon")
          );
        }
      );

      return itemElements.map((el) => new ItemInfo(el));
    }

    updatePaymentUI() {
      this.trainingCost.forEach((item) => {
        item.updateItemUI();
      });
    }

    /**
     * Attaches an event listener to a complete course submission form to handle the submission as an AJAX request.
     * @param {HTMLFormElement?} existingForm An existing form to attach the event listener to, or null to find the form in the training cell.
     * @returns {function} A function to remove the event listener
     */
    addAjaxListenerToCompleteCourseForm(existingForm = null) {
      const form =
        existingForm ??
        this.trainingCell.querySelector('form[action^="process_"]');
      if (form?.type?.value !== "complete") {
        console.warn("No complete course form found", form);
        return;
      }

      const listener = async (e) => {
        e.preventDefault();
        await this.onCourseCompletedFormSubmit(form);
      };

      form.addEventListener("submit", listener);

      return () => form.removeEventListener("submit", listener);
    }

    /**
     * @param {HTMLFormElement} form
     * @private
     */
    async onCourseCompletedFormSubmit(form) {
      const response = await fetch(form.action, {
        method: form.method?.toUpperCase() || "GET",
        body: new FormData(form),
      });

      // for testing:
      const _errorBody = `<div class="errorMessage"><b>Error: </b>Sorry, this pet does not seem to be on a course!</div>`;
      const _statName = "Endurance";
      const _successBody = `<style type=text/css>
  A{COLOR:#000099;FONT-FAMILY:verdana,arial,helvetica;FONT-SIZE:9pt;TEXT-DECORATION:none}
  TD,P,body{FONT-FAMILY:verdana,arial,helvetica;FONT-SIZE:9pt;}
  A:hover{COLOR:#990000;}
  .smallfont, .sf{FONT-SIZE:7.5pt;}
  </style>
  <center><IMG src="//pets.neopets.com/cpn/${this.petName}/1/2.png" width="150" height="150" border="0"><br><b>Woohoo!</b><p>Congratulations! <b>${this.petName}</b> now has increased ${_statName}!!!<p><p><form action='academy.phtml' method='get'><input type='submit' value='Back to the Swashbuckling Academy'></form>`;

      const body = await response.text();

      const responseDom = new DOMParser().parseFromString(body, "text/html");

      this.trainingCell.innerHTML = "";

      const errorMessage = responseDom.querySelector(".errorMessage");
      if (errorMessage) {
        this.trainingCell.append(errorMessage);
        this.trainingCell.append(document.createElement("br"));
        this.trainingCell.append(
          UI.createStartCourseForm(
            this.petName,
            TrainingCalculator.recommendNextStatToTrain(this.currentStats)
          )
        );
        return;
      }

      const paragraphs = [...responseDom.querySelectorAll("p")];

      paragraphs.forEach((p) => this.trainingCell.append(p));

      const increasedStatName = this.updateDisplayedStatsAfterIncrease(
        paragraphs.map((p) => p.textContent).join(" ")
      );

      const nextStat = TrainingCalculator.recommendNextStatToTrain(
        this.currentStats,
        increasedStatName
      );

      this.trainingCell.append(
        UI.createStartCourseForm(this.petName, nextStat)
      );
    }

    /**
     * Updates the stats based on the message received from the server.
     *
     * This updates both the stats object and the DOM elements.
     *
     * @param {HTMLTableCellElement} td
     * @param {StatsWithElements} stats
     * @param {string} increasedStatsMessage
     * @returns {StatName | null} The name of the stat that was increased, or null if the message was not recognized.
     * @private
     */
    updateDisplayedStatsAfterIncrease(increasedStatsMessage) {
      const stats = this.currentStats;

      /**
       * @type {StatName?}
       */
      var increasedStat = increasedStatsMessage
        .match(
          /increased (?<statName>strength|defence|endurance|agility|level)/i
        )
        ?.groups.statName?.toLowerCase();

      if (DEBUG)
        console.debug("Increased stat:", increasedStatsMessage, increasedStat);

      if (!increasedStat) {
        return null;
      }

      if (!(increasedStat in stats)) {
        console.warn(
          "Unknown stat increased:",
          increasedStat,
          increasedStatsMessage
        );
        return stats;
      }

      let pointsIncreased = 1;
      const bonusPoints = increasedStatsMessage.match(
        /went up (?<bonusPoints>\d+) points/i
      )?.groups.bonusPoints;
      if (bonusPoints) {
        pointsIncreased = parseInt(bonusPoints);
      }

      stats[increasedStat] += pointsIncreased;

      if (increasedStat === "endurance") {
        stats.currentHitpoints += pointsIncreased;
        stats.elements.endurance.textContent = `${stats.currentHitpoints} / ${stats.endurance}`;
      } else {
        stats.elements[increasedStat].textContent = stats[increasedStat];
      }

      if (DEBUG) console.debug("Updated stats", stats);

      return increasedStat;
    }

    addStartCourseForm() {
      this.trainingCell.append(
        UI.createStartCourseForm(
          this.petName,
          TrainingCalculator.recommendNextStatToTrain(this.currentStats)
        )
      );
    }

    handleTrainingComplete() {
      Notifier.sendNotification("Course Finished!", {
        body:
          this.petName +
          " has finished studying " +
          this.currentCourseStat +
          ".",
        petName: this.petName,
      });

      this.countdowns.forEach(({ element, isActualTime }) => {
        if (!isActualTime) {
          element.remove();
          return;
        }

        element.textContent = "Course Finished!";
      });

      this.trainingCell.innerHTML = "";

      const form = UI.createCompleteCourseForm(this.petName);
      this.trainingCell.append(form);
      this.addAjaxListenerToCompleteCourseForm(form);
    }

    startCountdownTracker() {
      let timeoutId;
      const tick = () => {
        if (timeoutId) clearTimeout(timeoutId);
        const remainingMs = this.endTime.getTime() - new Date().getTime();
        if (remainingMs <= 0) {
          this.handleTrainingComplete();
          return;
        }
        this.updateCountdowns();
        timeoutId = setTimeout(tick, remainingMs % 1000);
      };
      tick();
    }

    updateCountdowns() {
      this.countdowns.forEach(({ element, endTime }) => {
        const timeLeft = DateTimeHelpers.getTimeLeftUntil(endTime);
        element.textContent = `${timeLeft.hours} hrs, ${timeLeft.minutes} minutes, ${timeLeft.seconds} seconds`;
      });
    }
  }

  class TrainingCalculator {
    /**
     * @param {Record<StatName, number>>} stats
     * @returns {StatName}
     */
    static recommendNextStatToTrain(stats, fallbackValue = "level") {
      let lowestStat = null;
      let highestStat = null;

      const statNames = ["strength", "defence", "agility", "endurance"];

      // test cases: low current HP, negative stats, maxed out stats...

      // Current logic just trains the lowest stat that isn't maxed out yet, but there's some stuff we should add for recommending training endurance up to 3x instead of when it's lowest.
      for (const stat of statNames) {
        if (stats[stat] > configuration.maxStats[stat]) continue;
        if (!lowestStat || stats[stat] < stats[lowestStat]) {
          lowestStat = stat;
        }
      }

      for (const stat of statNames) {
        if (!highestStat || stats[stat] > stats[highestStat]) {
          highestStat = stat;
        }
      }

      const mustTrainLevel =
        (lowestStat === "endurance" && stats.endurance >= stats.level * 3) ||
        stats[highestStat] >= stats.level * 2;

      const recommendation = mustTrainLevel
        ? "level"
        : lowestStat ?? fallbackValue;

      if (DEBUG) {
        console.debug("Training Recommendation:", {
          lowestStat,
          highestStat,
          mustTrainLevel,
          recommendation,
        });
      }

      return recommendation;
    }
  }

  class ItemInfo {
    /**
     * @param {HTMLElement} nameElement The element containing the item name
     */
    constructor(nameElement) {
      /**
       * @type {HTMLElement}
       * @private
       * @readonly
       */
      this.nameElement = nameElement;

      /**
       * @type {string}
       * @public
       * @readonly
       */
      this.itemName = nameElement.textContent;

      /**
       * @type {ItemType}
       * @public
       * @readonly
       */
      this.itemType = nameElement.textContent.includes("Dubloon")
        ? ItemType.dubloon
        : nameElement.textContent.includes("Codestone")
        ? ItemType.codestone
        : ItemType.unknown;

      let image =
        nameElement.nextSibling?.tagName === "IMG"
          ? nameElement.nextSibling
          : null;

      /**
       * @type {HTMLTableElement | null}
       */
      this.dubloonTable = null;

      if (this.isDubloon()) {
        this.dubloonTable = nameElement.closest("table");
        image = this.dubloonTable?.querySelector("img");
      }

      /**
       * @type {HTMLImageElement?}
       * @public
       * @readonly
       */
      this.image = image;
    }

    isDubloon() {
      return this.itemType === ItemType.dubloon;
    }

    updateItemUI() {
      const searchForm = ItemInfo.createItemSearchForm(this.itemName);

      if (this.isDubloon()) {
        this.nameElement.after(ItemInfo.createItemSearchForm(this.itemName));
        this.image.parentElement.append(this.nameElement);
        this.image.parentElement.align = "center";
        this.dubloonTable.className = "item-info-table";

        return;
      }

      const newItemUI = UI.createElement("table", {
        className: "item-info-table",
        children: [
          UI.createElement("tr", {
            children: [
              UI.createElement("td", {
                align: "center",
                children: [
                  this.image,
                  document.createElement("br"),
                  UI.createElement("b", { textContent: this.itemName }),
                ],
              }),
              UI.createElement("td", {
                children: [searchForm],
              }),
            ],
          }),
        ],
      });

      this.nameElement.after(newItemUI);
      const nextSib = this.nameElement.nextElementSibling;

      if (nextSib.tagName === "BR") {
        nextSib.remove();
      }
      this.nameElement.remove();
    }

    static searchShopWiz(searchTerm) {
      const ssw = document.getElementById("sswmenu");
      if (!ssw) {
        return ItemInfo.searchRegularShopWiz(searchTerm);
      }

      if (!ssw.querySelector(".sswdrop")?.checkVisibility()) {
        ssw.querySelector(".imgmenu").click();
      }
      ssw.querySelector("#searchstr").value = searchTerm;
      ssw.querySelector("#ssw-criteria").value = "exact";
      ssw.querySelector("#button-search").click();
    }

    static searchRegularShopWiz(searchTerm) {
      window.open(
        `/shops/wizard.phtml?string=${encodeURIComponent(searchTerm)}`
      );
    }

    static searchSdb(searchTerm) {
      window.open(
        `/safetydeposit.phtml?obj_name=${encodeURIComponent(searchTerm)}`
      );
    }

    static createItemSearchForm(itemName) {
      const buttonContainer = document.createElement("div");
      buttonContainer.style.display = "grid";
      buttonContainer.style.gap = "16px";
      buttonContainer.style.margin = "16px auto";
      buttonContainer.style.maxWidth = "150px";

      const sdbButton = document.createElement("button");
      sdbButton.textContent = "Search SDB";
      sdbButton.addEventListener("click", () => ItemInfo.searchSdb(itemName));
      buttonContainer.append(sdbButton);

      const wizbutton = document.createElement("button");
      wizbutton.textContent = "Shop Wiz";
      wizbutton.addEventListener("click", () =>
        ItemInfo.searchShopWiz(itemName)
      );
      buttonContainer.append(wizbutton);

      return buttonContainer;
    }
  }

  class DateTimeHelpers {
    /**
     * @param {DateTime} date
     * @returns {TimeLeft}
     */
    static getTimeLeftUntil(date) {
      var remainingMs = date.getTime() - new Date().getTime();
      var remainingSeconds = parseInt(remainingMs / 1000);

      var seconds = remainingSeconds % 60;
      var minutes = parseInt(remainingSeconds / 60) % 60;
      var hours = parseInt(remainingSeconds / (60 * 60));

      return {
        hours,
        minutes,
        seconds,
      };
    }

    static getNstTimezoneOffset() {
      const nst = document
        .querySelector("#nst, .nst")
        ?.textContent.match(
          /^(?<hour>\d+):(?<minute>\d+):(?<second>\d+) (?<amPm>am|pm) NST$/
        )?.groups;

      if (!nst) {
        console.warn(
          "No NST time found, setting NST timezone offset to -8 but this does not reflect daylight saving time."
        );

        return -8;
      }

      const nstHour = parseInt(nst.hour);
      let nst24Hour = nstHour;

      if (nst.amPm === "am" && nstHour === 12) {
        nst24Hour = 0;
      } else if (nst.amPm === "pm" && nstHour < 12) {
        nst24Hour = nstHour + 12;
      }

      let utcHour = new Date().getUTCHours();

      if (utcHour < nst24Hour) {
        utcHour += 24;
      }

      const nstTimezoneOffset = nst24Hour - utcHour;

      return nstTimezoneOffset;
    }

    static getNstDate() {
      const now = new Date();

      now.setHours(-1 * DateTimeHelpers.getNstTimezoneOffset());
      const nstMonth = now.getUTCMonth() + 1;
      const nstDay = now.getUTCDate();

      return { month: nstMonth, day: nstDay };
    }
  }

  class Freebies {
    /**
     * @param {PetInfo} petInfo
     * @param {PetTrainingInfo} trainingInfo
     * @returns {void}
     */
    static checkFreebies(petInfo, trainingInfo) {
      if (Freebies.isPetsBirthday(petInfo)) {
        Freebies.sendBirthdayNotification(petInfo.petName);
        Freebies.addBirthdayNotice(trainingInfo);
      }

      if (
        Freebies.isPetSpeciesDay(petInfo.species) &&
        trainingInfo.currentStats.level < DUBLOON_TRAINING_MAX_LEVEL
      ) {
        Freebies.sendPetDayNotification(petInfo.petName, petInfo.species);
        Freebies.addPetDayNotice(trainingInfo, petInfo.species);
      }
    }

    /**
     * @param {PetInfo} petInfo
     * @returns {boolean}
     */
    static isPetsBirthday(petInfo) {
      const age = QuickrefLookup.parsePetAge(petInfo.age);

      if (!age) {
        return false;
      }

      if (!age.hours) {
        return age.days % 365 === 0;
      }

      // test case: pet was born less than 1 day ago, but the has passed
      const midnight = new Date(now);
      midnight.setHours(-1 * DateTimeHelpers.getNstTimezoneOffset(), 0, 0, 0);

      const petBirth = new Date();
      petBirth.setHours(petBirth.getHours() - age.hours);

      return petBirth >= midnight;
    }

    /**
     * @see https://www.neopets.com/calendar.phtml
     *
     * @param {string} species The species of the pet
     * @returns Whether or not it's the pet's species day on Neopets
     */
    static isPetSpeciesDay(species) {
      if (!species || typeof species !== "string") {
        if (DEBUG) console.warn("Invalid species", species);
        return;
      }
      const petDays = {
        aisha: { month: 1, day: 3 },
        gnorbu: { month: 1, day: 6 },
        buzz: { month: 1, day: 11 },
        elephante: { month: 1, day: 16 },
        kacheek: { month: 1, day: 29 },
        zafara: { month: 2, day: 3 },
        lenny: { month: 2, day: 12 },
        chia: { month: 2, day: 18 },
        tonu: { month: 2, day: 21 },
        mynci: { month: 2, day: 22 },
        uni: { month: 3, day: 2 },
        gelert: { month: 3, day: 6 },
        scorchio: { month: 3, day: 14 },
        chomby: { month: 3, day: 22 },
        shoyru: { month: 4, day: 2 },
        krawk: { month: 4, day: 16 },
        lutari: { month: 4, day: 19 },
        kougra: { month: 4, day: 22 },
        cybunny: { month: 4, day: 27 },
        lupe: { month: 5, day: 2 },
        hissi: { month: 5, day: 4 },
        moehog: { month: 5, day: 14 },
        koi: { month: 5, day: 25 },
        yurble: { month: 5, day: 28 },
        jubJub: { month: 6, day: 6 },
        quiggle: { month: 6, day: 13 },
        nimmo: { month: 6, day: 15 },
        kau: { month: 6, day: 19 },
        acara: { month: 6, day: 28 },
        flotsam: { month: 7, day: 3 },
        ixi: { month: 7, day: 11 },
        tuskanniny: { month: 7, day: 12 },
        kiko: { month: 7, day: 17 },
        peophin: { month: 7, day: 26 },
        ruki: { month: 7, day: 29 },
        blumaroo: { month: 8, day: 8 },
        meerca: { month: 8, day: 18 },
        grundo: { month: 8, day: 24 },
        kyrii: { month: 8, day: 29 },
        draik: { month: 9, day: 9 },
        techo: { month: 9, day: 13 },
        poogle: { month: 9, day: 19 },
        skeith: { month: 9, day: 25 },
        grarrl: { month: 10, day: 4 },
        eyrie: { month: 10, day: 10 },
        bori: { month: 10, day: 13 },
        jetsam: { month: 10, day: 16 },
        korbat: { month: 10, day: 26 },
        pteri: { month: 11, day: 8 },
        vandagyre: { month: 11, day: 12 },
        // special mention: Neopets' official birthday is Nov 15th
        usul: { month: 11, day: 27 },
        xweetok: { month: 11, day: 29 },
        bruce: { month: 12, day: 5 },
        wocky: { month: 12, day: 12 },
        ogrin: { month: 12, day: 28 },
      };

      const petDay = petDays[species.toLowerCase()];

      if (!petDay) {
        if (DEBUG) console.warn("No pet day found for", species);
        return;
      }

      const nstDate = DateTimeHelpers.getNstDate();

      return petDay.month === nstDate.month && petDay.day === nstDate.day;
    }

    /**
     * @param {PetTrainingInfo} trainingInfo
     * @returns {void}
     * @private
     */
    static addBirthdayNotice(trainingInfo) {
      const petName = trainingInfo.petName;
      trainingInfo.trainingCell.append(
        UI.createElement("div", {
          className: "training-helper-notice",
          children: [
            UI.createElement("strong", {
              textContent: `🎂 Happy Birthday ${petName}!!!`,
            }),
            UI.createElement("p", {
              children: [
                "Don't forget to get your free birthday cupcake on ",
                UI.createElement("a", {
                  textContent: `${petName}'s lookup`,
                  href: `/petlookup.phtml?pet=${petName}`,
                }),
                " before the day ends.",
              ],
            }),
          ],
        })
      );
    }

    /**
     * @param {PetTrainingInfo} trainingInfo
     * @param {string} species
     * @returns {void}
     * @private
     */
    static addPetDayNotice(trainingInfo, species) {
      trainingInfo.trainingCell.prepend(
        UI.createElement("div", {
          className: "training-helper-notice",
          children: [
            UI.createElement("strong", {
              textContent: `Happy ${species} Day!`,
            }),
            CurrentPage.isPirateSchool()
              ? UI.createElement("p", {
                  textContent: "Your training is free here today!",
                })
              : UI.createElement("p", {
                  children: [
                    "Head over to the ",
                    UI.createElement("a", {
                      textContent: "Swashbuckling Academy",
                      href: "/pirates/academy.phtml?type=status",
                    }),
                    " for free training today!",
                  ],
                }),
          ],
        })
      );
    }

    /**
     * @param {string} petName
     * @returns {void}
     * @private
     */
    static sendBirthdayNotification(petName) {
      if (!configuration.notifications.enabled) return;

      const gmKey = `birthdayRemindersSent.${petName}.${new Date().getUTCFullYear()}`;
      if (GM_getValue(gmKey, false)) return;
      GM_setValue(gmKey, true);

      Notifier.sendNotification(`🎂 Happy Birthday ${petName}!!!`, {
        body: `Get your free birthday cupcake on ${petName}'s lookup before the day ends.`,
        petName: petName,
        onClickNotification() {
          window.location = `/petlookup.phtml?pet=${petName}`;
        },
      });
    }

    /**
     * @param {string} petName
     * @param {string} species
     * @returns {void}
     * @private
     */
    static sendPetDayNotification(petName, species) {
      if (!configuration.notifications.enabled) return;

      const gmKey = `petDayNotificationSent.${species}.${new Date().getUTCFullYear()}`;
      if (GM_getValue(gmKey, false)) return;
      GM_setValue(gmKey, true);

      Notifier.sendNotification(`It's ${species} day!`, {
        body: `Train for free in the Swashbuckling Academy today!`,
        petName: petName,
        onClickNotification() {
          if (window.location.pathname !== "/pirates/academy.phtml") {
            window.location = "/pirates/academy.phtml?type=status";
          }
        },
      });
    }
  }

  class UI {
    static addStyles() {
      const style = document.createElement("style");
      style.textContent = `
        .training-helper-notice {
          margin: 16px 0;
          padding: 8px;
          background: #f0f0f0;
          border: 1px solid #ccc;
          border-radius: 4px;
        }

        .item-info-table {
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #ccc;
          width: 100%;
          border-radius: 4px;
        }

        .item-info-table td {
          padding: 8px;
        }

        .item-info-table td:last-child {
          width: 90px;
          background: #efefef;
        }

        .item-info-table button {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          color: #5C73A0;
          transition: background 0.2s;
        }

        .item-info-table button:hover {
          background: #f0f0f0;
        }

        .item-info-table button:active {
          background: #e0e0e0;
        }
      `;
      document.head.append(style);
    }

    /**
     * @typedef {Object} ElementProps
     * @property {string?} textContent
     * @property {Array<Node> | Node | undefined} children
     * @property {string?} className
     * @property {string?} id
     *
     * @param {string} tagName
     * @param {ElementProps?} props
     * @returns
     */
    static createElement(
      tagName,
      { children = [], textContent, className, ...attributes } = {}
    ) {
      const element = document.createElement(tagName);
      for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
      }

      if (className) {
        element.className = className;
      }
      if (textContent) {
        element.textContent = textContent;
      }

      if (!Array.isArray(children) && children) {
        children = [children];
      }
      children.forEach((child) => child && element.append(child));
      return element;
    }

    static createForm({ onSubmit, ...elementProps }) {
      const form = UI.createElement("form", elementProps);
      if (onSubmit) form.addEventListener("submit", onSubmit);
      return form;
    }

    static createInput({ label, ...elementProps }) {
      const input = UI.createElement("input", elementProps);

      if (!label) return input;

      const type = elementProps.type ?? "text";
      const labelProps = typeof label === "object" ? label : {};
      const labelString =
        typeof label === "string" ? label : labelProps.textContent;

      if (!labelProps.children) labelProps.children = [];

      const labelSpan = UI.createElement("span", { textContent: labelString });

      if (type === "checkbox" || type === "radio") {
        labelProps.children.unshift(input, labelSpan);
      } else {
        labelProps.children.unshift(labelSpan, input);
      }

      return UI.createElement("label", labelProps);
    }

    static createSelect({ value, options, ...elementProps }) {
      const select = UI.createElement("select", elementProps);

      options.forEach((option) => {
        const optionElement = document.createElement("option");
        optionElement.value = option;
        optionElement.textContent = option;
        optionElement.selected = option.toLowerCase() === value?.toLowerCase();
        select.append(optionElement);
      });

      return select;
    }

    /**
     * @param {string} petName
     * @returns {HTMLFormElement}
     */
    static createCompleteCourseForm(petName) {
      return UI.createForm({
        action: "process_" + CurrentPage.getScriptName(),
        method: "post",
        children: [
          UI.createInput({ name: "type", value: "complete", type: "hidden" }),
          UI.createInput({
            name: "pet_name",
            value: petName,
            type: "hidden",
          }),
          UI.createInput({ type: "submit", value: "Complete Course" }),
        ],
      });
    }

    /**
     * @param {string} petName
     * @param {StatName} selectedStat
     * @returns {HTMLFormElement}
     */
    static createStartCourseForm(petName, selectedStat) {
      return UI.createForm({
        action: "process_" + CurrentPage.getScriptName(),
        method: "post",
        children: [
          UI.createInput({ name: "type", value: "start", type: "hidden" }),
          UI.createInput({ name: "pet_name", value: petName, type: "hidden" }),
          UI.createSelect({
            name: "course_type",
            value: selectedStat,
            options: ["Strength", "Defence", "Agility", "Endurance", "Level"],
          }),
          " ",
          UI.createInput({ type: "submit", value: "Start Course" }),
        ],
      });
    }

    static addConfigurationForm() {
      const container = document.createElement("div");
      const shadow = container.attachShadow({ mode: "open" });

      const styles = document.createElement("style");
      styles.textContent = `
        h2, h3 {
          margin: 0;
        }
  
        form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: fit-content;
          margin: 16px;
          text-align: left;
          padding: 16px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
  
        label > input + span {
          margin-left: 4px;
        }
  
        label > span + input {
          display: block;
          margin-top: 4px;
        }
  
        .save-button {
          margin-top: 16px;
          padding: 8px;
          background: #5C73A0;
          color: white;
          border: none;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .save-button:hover {
          background: #4A5F8C;
        }

        .save-button:active {
          background: #3A4F7C;
        }
      `;

      shadow.append(styles);

      shadow.append(
        UI.createForm({
          shadowRoot: true,
          children: [
            UI.createElement("h2", { textContent: "Training Helper" }),
            UI.createElement("h3", { textContent: "Configuration" }),
            UI.createInput({
              label: "Enable Notifications",
              name: "notificationsEnabled",
              checked: configuration.notifications.enabled,
              type: "checkbox",
            }),
            UI.createInput({
              label: "Enable Idle Reminder",
              name: "idleReminderEnabled",
              checked: configuration.notifications.idleReminder.enabled,
              type: "checkbox",
            }),
            UI.createInput({
              label: "Idle Threshold (minutes)",
              name: "idleThreshold",
              value: Math.round(
                configuration.notifications.idleReminder.thresholdInMs /
                  (1000 * 60)
              ),
              type: "number",
            }),
            UI.createInput({
              type: "submit",
              value: "Save",
              className: "save-button",
            }),
          ],
          onSubmit: (e) => {
            e.preventDefault();
            configuration.notifications.enabled =
              e.target.notificationsEnabled.checked;
            GM_setValue(
              "notifications.enabled",
              configuration.notifications.enabled
            );

            if (configuration.notifications.enabled) {
              Notifier.requestNotificationPermission();
            }

            configuration.notifications.idleReminder.enabled =
              e.target.idleReminderEnabled.checked;
            GM_setValue(
              "notifications.idleReminder.enabled",
              configuration.notifications.idleReminder.enabled
            );

            configuration.notifications.idleReminder.thresholdInMs =
              e.target.idleThreshold.value * 1000 * 60;
            GM_setValue(
              "notifications.idleReminder.thresholdInMs",
              configuration.notifications.idleReminder.thresholdInMs
            );
          },
        })
      );

      const parent =
        document.querySelector("#content td.content") ?? document.body;

      parent.append(container);
    }
  }

  class Notifier {
    static requestNotificationPermission() {
      if (Notification.permission === "granted") {
        return;
      }

      Notification.requestPermission().then((result) => {
        if (result === "denied") {
          console.warn("Notifications denied");
          alert(
            "Notifications are disbled by your browser settings, they can't be enabled here until you allow them for Neopets."
          );
          return;
        }
        if (result !== "granted") return;
        Notifier.sendNotification("Notifications enabled!", {
          body: "You will now receive notifications from the Training Helper.",
        });
      });
    }

    static sendNotification(
      title,
      {
        body,
        petName = undefined,
        previousNotification = null,
        idleCheckId = null,
        shouldAddIdleCheck = true,
        previousTitle = document.title,
        onClickNotification = null,
      }
    ) {
      document.title = title;

      if (
        Notification.permission !== "granted" ||
        !configuration.notifications.enabled
      )
        return;

      if (previousNotification) {
        previousNotification.close();
      }

      const notification = new Notification(title, {
        icon:
          petName &&
          "http://pets.neopets.com/cpn/" + petName.toLowerCase() + "/1/1.png",
        body: body,
      });

      if (!idleCheckId && shouldAddIdleCheck) {
        idleCheckId = Notifier.setReturnFromIdleReminder(() => {
          Notifier.sendNotification(title, {
            body,
            petName,
            previousNotification: notification,
            idleCheckId,
            shouldAddIdleCheck,
            previousTitle,
            onClickNotification,
          });
        });
      }

      // the page does not reopen when clicking the notification if the browser tab was closed
      // We can listen on the homepage of neopets and check something like this to reopen the page if we want
      // GM_setValue("notificationUrl", window.location.href);

      notification.onclick = () => {
        // GM_deleteValue("notificationUrl");
        if (idleCheckId) clearInterval(idleCheckId);
        notification.close();
        document.title = previousTitle;
        onClickNotification?.();
      };
    }

    /**
     * Runs a callback if a machine returns from idle.
     * @param {function} onReturnFromIdleDetected - Callback to run when the machine returns from idle.
     * @param {number} intervalInMs - How often to check for idle in milliseconds.
     * @param {number} idleThresholdInMs - How long the machine must be idle before running the callback.
     */
    static setReturnFromIdleReminder(
      onReturnFromIdleDetected,
      intervalInMs = 1000 * 60,
      idleThresholdInMs = 1000 * 60
    ) {
      let intervalLastChecked = new Date();

      return setInterval(function () {
        const now = new Date();
        const timePassedSinceLastInterval =
          now.getTime() - intervalLastChecked.getTime();
        intervalLastChecked = now;
        if (timePassedSinceLastInterval > intervalInMs + idleThresholdInMs) {
          onReturnFromIdleDetected();
        }
      }, intervalInMs);
    }
  }

  class QuickrefLookup {
    /**
     * @type {Document}
     * @private
     */
    _dom = null;
    /**
     * @type {Promise<Document> | null}
     * @private
     */
    _domPromise = null;

    async load() {
      if (this._domPromise) {
        await this._domPromise;
        return this;
      }

      return this.fetch();
    }

    async fetch(clearCache = false) {
      if (clearCache) {
        this._dom = null;
      }

      this._domPromise = fetch("/quickref.phtml")
        .then((r) => r.text())
        .then((body) => new DOMParser().parseFromString(body, "text/html"));

      this._dom = await this._domPromise;

      return this;
    }

    getCachedPetInfo(petName) {
      if (!configuration.quickrefLookup.shouldCache) {
        GM_deleteValue(`petInfo.${petName}`);
        return null;
      }
      const result = JSON.parse(GM_getValue(`petInfo.${petName}`, "null"));
      if (DEBUG) console.debug("Got cached pet info for", petName, result);
      if (!result) return null;
      if (!result.expiresAt || Date.now() > result.expiresAt) {
        GM_deleteValue(`petInfo.${petName}`);
        return null;
      }
      return result.petInfo;
    }

    setCachedPetInfo(petName, petInfo) {
      if (!configuration.quickrefLookup.shouldCache) return;

      const midnightNstHour = -1 * DateTimeHelpers.getNstTimezoneOffset();
      const midnightNstTomorrow = new Date();
      midnightNstTomorrow.setUTCHours(midnightNstHour, 0, 0, 0);
      midnightNstTomorrow.setUTCDate(midnightNstTomorrow.getUTCDate() + 1);

      const result = { petInfo, expiresAt: midnightNstTomorrow.getTime() };

      GM_setValue(`petInfo.${petName}`, JSON.stringify(result));

      if (DEBUG) console.debug("Saved cached pet info for", petName, result);
    }

    /**
     * @typedef {Object} PetInfo
     * @property {string} petName
     * @property {string} species
     * @property {string} level
     * @property {string} strength
     * @property {string} defence
     * @property {string} move
     * @property {string} intelligence
     * @property {string} age
     * @property {string} hunger
     * @property {string} mood
     *
     * @param {string} petName
     * @param {boolean} loadFreshData
     * @returns {Promise<PetInfo>} The pet's info as it's listed on the quickref page.
     */
    async getPetInfo(petName, loadFreshData = false) {
      const cachedInfo = this.getCachedPetInfo(petName);
      if (!loadFreshData && cachedInfo) {
        return cachedInfo;
      }

      if (loadFreshData) {
        await this.fetch(true);
      } else {
        await this.load();
      }

      const petDetails = this._dom.querySelector(`#${petName}_details`);
      const petStatsTable = petDetails.querySelector(".pet_stats");
      const statRows = [...petStatsTable.querySelectorAll("tr")];

      const petInfo = {
        petName,
      };

      for (const row of statRows) {
        const header = row.querySelector("th");
        const data = row.querySelector("td");
        if (!header || !data) continue;
        const statName = header.textContent.replace(/:$/, "").toLowerCase();
        const statValue = data.textContent;
        petInfo[statName] = statValue;
      }

      this.setCachedPetInfo(petName, petInfo);

      return petInfo;
    }

    /**
     * @param {string} age
     * @returns {{ days?: number, hours?: number } | null} The pet's age in days
     */
    static parsePetAge(age) {
      if (!age || typeof age !== "string") {
        if (DEBUG) console.warn("Invalid age", age);
        return null;
      }

      const ageMatch = age.match(/(?<value>[\d,]+) (?<unit>hours|days)/);
      if (!ageMatch) {
        if (DEBUG) console.warn("Invalid age format", age);
        return null;
      }

      const { value, unit } = ageMatch.groups;

      const ageValue = parseInt(value.replace(/,/g, ""));

      if (unit === "hours") {
        return { days: Math.floor(ageValue / 24), hours: ageValue };
      }

      return { days: ageValue, hours: 0 };
    }
  }

  main();
})();
