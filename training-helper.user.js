// ==UserScript==
// @name         Neopets Training Helper
// @author       Hiddenist
// @namespace    https://hiddenist.com
// @version      2024-10-30
// @description  Makes codestone training your pet require fewer clicks and less math.
// @match        https://www.neopets.com/island/fight_training.phtml*
// @match        https://www.neopets.com/island/training.phtml*
// @match        https://www.neopets.com/pirates/academy.phtml*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @updateURL    https://github.com/Meerca/Neopets-Userscripts/raw/main/training-helper.user.js
// @downloadURL  https://github.com/Meerca/Neopets-Userscripts/raw/main/training-helper.user.js
// @supportURL   https://github.com/Meerca/Neopets-Userscripts/issues
// ==/UserScript==
(function () {
  ("use strict");

  function getVersion() {
    if (typeof GM_info === "undefined") {
      return "2024-08-25";
    }

    return GM_info.script.version;
  }

  const store = makeStore("hiddenist.trainingHelper");

  const DEBUG = store.getValue("debug", false);
  const DUBLOON_TRAINING_MAX_LEVEL = 40;

  /**
   * @typedef {"strength" | "defence" | "agility" | "endurance" | "level"} StatName
   */
  const configuration = Object.freeze({
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
    /** @private */
    _isConfigPanelOpen: store.getValue("isConfigPanelOpen", false),
    get isConfigPanelOpen() {
      return this._isConfigPanelOpen;
    },
    set isConfigPanelOpen(value) {
      this._isConfigPanelOpen = value;
      store.setValue("isConfigPanelOpen", value);
    },
    notifications: {
      /** @private */
      _enabled:
        store.getValue(
          "notifications.enabled",
          Notification.permission === "granted"
        ) && Notification.permission === "granted",

      get enabled() {
        return this._enabled;
      },
      set enabled(value) {
        this.enabled = value && Notification.permission === "granted";
        store.setValue("notifications.enabled", value);
      },
    },
    freebies: {
      enabled: true,
    },
    quickrefLookup: {
      shouldCache: true,
    },
    // Neopets is too broken in Japanese, Chinese, and Korean to support it so far
    language: getLang(),
  });

  const lang = {
    neopets: {
      badCharacters: "�",
      universalStatNamePattern: {
        strength:
          /Strength|str|Kracht|kra|Força|Stärke|Frce|Force|Forza|Fuerza/i,
        defence:
          /Defence|def|Verdediging|Ver|Defesa|Verteidigung|Déf|Défense|Difesa|Defensa/i,
        agility:
          /Agility|mov|Beweeglijkheid|Bew|Agilidade|Movimento|Wendigkeit|Beweglichkeit|Mouv|Agilité|Agilità|Movimento|Movimiento|Agilidad/i,
        endurance:
          /Endurance|Hp|Uithoudingsvermogen|Resistência|Ausdauer|TP|Pf|Salute|Salud|Resistencia/i,
        level: /Level|lvl|Nível|Saúde|Niv|Niveau|Livello|Nivel/i,
      },
      petHeaderStatusPattern: {
        en: /^(?<petName>\w+).*(?:currently studying (?<stat>\w+)|(?<noCourse>not on a course))/,
        nl: /^(?<petName>\w+).*(?:studeert op het moment  ?(?<stat>\S+)|(?<noCourse>niet in een les))/,
        pt: /^(?<petName>\w+).*(?:está estudando (?<stat>\S+)|(?<noCourse>não está em um curso))/,
        de: /^(?<petName>\w+).*(?:studiert momentan Folgendes: (?<stat>\S+)|(?<noCourse>nimmt nicht an einem Kurs teil))/,
        fr: /^(?<petName>\w+).*(?:est en cours (?<stat>\S+)|(?<noCourse>n'est pas en cours))/,
        it: /^(?<petName>\w+).*(?:ha iniziato un corso di  ?(?<stat>\S+)|(?<noCourse>non ha iniziato nessun corso))/,
        es: /^(?<petName>\w+).*(?:está estudiando:  ?(?<stat>\S+)|(?<noCourse>no está en un curso))/,
      },
      timeTil: {
        en: "Time till course finishes",
        nl: "Tijd todat de les is afgelopen",
        pt: "Tempo restante para o curso",
        de: "Zeit bis zum Beenden des Kurses",
        fr: "Temps restant avant la fin du cours",
        it: "Tempo prima della fine del corso",
        es: "Tiempo en el que termina el curso",
      },
      timePattern: {
        en: /(?<hours>\d+) ?hrs, ?(?<minutes>\d+) ?minutes, ?(?<seconds>\d+) seconds/,
        nl: /(?<hours>\d+) ?uren, ?(?<minutes>\d+) ?minuten, ?(?<seconds>\d+) seconden/,
        pt: /(?<hours>\d+) ?horas, ?(?<minutes>\d+) ?minutos, ?(?<seconds>\d+) segundos/,
        de: /(?<hours>\d+) ?Stunden, ??<minutes>(\d+) ?Minuten, ?(?<seconds>\d+) Sekunden/, // does not work (because the bold tag is double nested?)
        fr: /(?<hours>\d+) ?hrs, ?(?<minutes>\d+) ?minutes, ?(?<seconds>\d+)secondes/, // ditto ^
        it: /(?<hours>\d+) ?ore, ?(?<minutes>\d+) ?minuti, ?(?<seconds>\d+) secondi/,
        es: /(?<hours>\d+) ?hrs, ?(?<minutes>\d+) ?minutos, ?(?<seconds>\d+) segundos/,
      },
      courseFinished: {
        en: "Course Finished!",
      },
      increasedStatPattern: {
        en: /increased (?<statName>strength|defence|endurance|agility|level)/i,
      },
      codestone: {
        en: "Codestone",
        nl: "Codesteen",
        pt: "Pedra M�stica", // literal value on Neopets, not a mistake in this script
        de: "Codestein",
        fr: "Codestone",
        it: "Sassocodice",
        es: "Piedra m�stica de",
      },
      dubloon: {
        en: "Dubloon",
        nl: "Dubloen",
        pt: "Dobrão",
        de: "Dublone",
        fr: "Doublon",
        it: "Doblone",
        es: "Doblón",
      },
      notFoundInSdb: {
        en: "Not finding any items with that criteria!",
        nl: "Kan geen items met die criteria vinden!",
        pt: "Não encontrando artigos com este critério!",
        de: "Es sind keine Gegenstände mit diesen Suchkriterien zu finden!",
        fr: "Aucun objet trouvé correspondant à ce critère!",
        it: "Non siamo riusciti a trovare nessun oggetto con quei criteri di ricerca!",
        es: "¡No encontramos ningún objeto con esas características!",
      },
    },
  };

  function main() {
    if (!TrainingPage.isStatusPage()) {
      return;
    }

    store.setValue("version", getVersion());

    UI.addStyles();
    UI.addConfigurationForm();

    const allPets = PetCourseInfo.getForAllPets();

    // feature to add: if a pet is too high of a level for the school, and not on a course, we should remove them from the big list and instead show a message at the bottom of who can't go
    allPets.forEach((pet) => {
      if (DEBUG) console.debug("Training info:", pet);
      switch (pet.status) {
        case PetCourseInfo.Status.noCourseStarted:
          return pet.addStartCourseForm();
        case PetCourseInfo.Status.active:
          return pet.startCountdownTracker();
        case PetCourseInfo.Status.finished:
          return pet.addAjaxListenerToCompleteCourseForm();
        case PetCourseInfo.Status.needsPayment:
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

  class TrainingPage {
    static SchoolType = Object.freeze({
      Pirate: "pirate",
      Regular: "regular",
      Secret: "secret",
    });

    static getTrainingSchool() {
      switch (window.location.pathname) {
        case "/pirates/academy.phtml":
          return TrainingPage.SchoolType.Pirate;
        case "/island/training.phtml":
          return TrainingPage.SchoolType.Regular;
        case "/island/fight_training.phtml":
          return TrainingPage.SchoolType.Secret;
        default:
          return null;
      }
    }

    static isPirateSchool() {
      return (
        TrainingPage.getTrainingSchool() === TrainingPage.SchoolType.Pirate
      );
    }

    static isRegularSchool() {
      return (
        TrainingPage.getTrainingSchool() === TrainingPage.SchoolType.Regular
      );
    }

    static isSecretSchool() {
      return (
        TrainingPage.getTrainingSchool() === TrainingPage.SchoolType.Secret
      );
    }

    static isStatusPage() {
      const query = new URLSearchParams(window.location.search);
      return query.get("type") === "status";
    }

    static getScriptName() {
      return window.location.pathname.split("/").pop();
    }

    static getNavBar() {
      return document
        .querySelector('.content center a[href*="type=status"]')
        ?.closest("center");
    }
  }

  class PetCourseInfo {
    /**
     * @typedef {(typeof PetCourseInfo.Status)[keyof typeof PetCourseInfo.Status]} PetTrainingStatus
     */
    static Status = Object.freeze({
      noCourseStarted: "noCourseStarted",
      active: "active",
      finished: "finished",
      needsPayment: "needsPayment",
    });

    /**
     * @param {HTMLTableRowElement} headerRow
     */
    constructor(headerRow) {
      const titleRegexMatches = headerRow.textContent.match(
        lang.neopets.petHeaderStatusPattern[configuration.language]
      );

      if (!titleRegexMatches) {
        throw new Error(
          "Unrecognized header row format for training info: " +
            headerRow.textContent
        );
      }
      const bodyRow = headerRow.nextElementSibling;

      /**
       * @type {PetTrainingStatus}
       * @public
       * @readonly
       */
      this.status = titleRegexMatches.groups.noCourse
        ? PetCourseInfo.Status.noCourseStarted
        : bodyRow.textContent.includes(
            lang.neopets.timeTil[configuration.language]
          )
        ? PetCourseInfo.Status.active
        : bodyRow.textContent.includes(
            lang.neopets.courseFinished[configuration.language]
          )
        ? PetCourseInfo.Status.finished
        : PetCourseInfo.Status.needsPayment;

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
      this.currentStats = PetCourseInfo.getCurrentStats(bodyRow.firstChild);

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
      this.countdowns = PetCourseInfo.getCountdowns(this.trainingCell);

      /**
       * @type {ItemInfo[]}
       * @public
       */
      this.trainingCost = PetCourseInfo.getTrainingCost(this.trainingCell);

      /**
       * @type {Date?}
       * @public
       */
      this.endTime = this.countdowns.find(
        ({ isActualTime }) => isActualTime
      )?.endTime;
    }

    /**
     * @returns {PetCourseInfo[]}
     */
    static getForAllPets() {
      return [...document.querySelectorAll("td.content tr")]
        .filter((tr) => {
          const pattern =
            lang.neopets.petHeaderStatusPattern[configuration.language];
          if (DEBUG) {
            console.debug("Checking pet header:", {
              pattern,
              text: tr.textContent,
              result: pattern.test(tr.textContent),
            });
          }
          return pattern.test(tr.textContent);
        })
        .map((tr) => new PetCourseInfo(tr));
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

      // broken in french because there's no bold tag lolol
      const enduranceText = elements.endurance?.textContent;
      const enduranceMatch = enduranceText?.match(
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
        const localizedMatch = lang.neopets.timePattern[configuration.language];
        const match = element.textContent.match(localizedMatch);

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
          const isCodestone = b.textContent.includes(
            lang.neopets.codestone[configuration.language]
          );
          const isDubloon = b.textContent.includes(
            lang.neopets.dubloon[configuration.language]
          );

          if (DEBUG) {
            console.debug("Item type check:", {
              isCodestone,
              isDubloon,
              text: b.textContent,
            });
          }

          return isCodestone || isDubloon;
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
          UI.getStartCourseForm(
            this.petName,
            TrainingCalculator.recommendLowestStat(this.currentStats)
          )
        );
        return;
      }

      const paragraphs = [...responseDom.querySelectorAll("p")];

      paragraphs.forEach((p) => this.trainingCell.append(p));

      let increasedStatName = undefined;

      try {
        // this won't work in other languages, but it's not critical
        increasedStatName = this.updateDisplayedStatsAfterIncrease(
          paragraphs.map((p) => p.textContent).join(" ")
        );
      } catch (e) {
        if (DEBUG) console.debug("Stat auto-increment didn't work", e);
        // reload the window to display updated stats
        window.location.reload();
      }

      const nextStat = TrainingCalculator.recommendLowestStat(
        this.currentStats,
        increasedStatName
      );

      this.trainingCell.append(UI.getStartCourseForm(this.petName, nextStat));
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
        .match(lang.neopets.increasedStatPattern[configuration.language])
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
      const recommendedStat = TrainingCalculator.recommendLowestStat(
        this.currentStats
      );

      this.trainingCell.append(
        UI.getStartCourseForm(this.petName, recommendedStat)
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
    // excludes level because we only recommend training when necessary
    static _statNames = ["strength", "defence", "agility", "endurance"];

    // to do: add UI to the course form for stat priorities and specified target values per pet for better recommendations
    // ideas for options:
    // - keep training last selected stat
    //   - warn if training the stat will make training other stats more costly?
    // - train lowest stat
    // - create a list of specific target stats (stat + target value) and train up to those values in order

    /**
     * This calculates a recommended stat to train based simply on which stat value is lowest.
     *
     * @param {Record<StatName, number>>} stats
     * @returns {StatName}
     */
    static recommendLowestStat(stats, fallbackValue = "level") {
      // to do: test cases for low current HP, negative stats, maxed out stats...

      const lowestTrainableStat =
        TrainingCalculator._getLowestTrainableStatName(stats);
      const highestStat = TrainingCalculator.getHighestStatName(stats);

      const mustTrainLevel = TrainingCalculator.isLevelUpRequired(
        stats,
        stats[highestStat],
        lowestTrainableStat === "endurance"
      );

      const recommendation = mustTrainLevel
        ? "level"
        : lowestTrainableStat ?? fallbackValue;

      if (DEBUG) {
        console.debug("Training Recommendation:", {
          lowestTrainableStat,
          highestStat,
          mustTrainLevel,
          recommendation,
        });
      }

      return recommendation;
    }

    static _getLowestTrainableStatName(stats) {
      let lowestTrainableStat = null;

      for (const statName of TrainingCalculator._statNames) {
        if (stats[statName] > configuration.maxStats[statName]) continue;
        if (
          !lowestTrainableStat ||
          stats[statName] < stats[lowestTrainableStat]
        ) {
          lowestTrainableStat = statName;
        }
      }

      return lowestTrainableStat;
    }

    static getHighestStatName(stats) {
      let highestStat = null;

      for (const statName of TrainingCalculator._statNames) {
        if (!highestStat || stats[statName] > stats[highestStat]) {
          highestStat = statName;
        }
      }

      return highestStat;
    }

    /**
     * Check if a level up is required before any other stats can be trained.
     *
     * @param {Record<StatName, number>>} stats
     * @param {number} highestStatValue
     * @param {boolean} isTrainingEndurance
     * @returns
     */
    static isLevelUpRequired(stats, highestStatValue, isTrainingEndurance) {
      if (isTrainingEndurance) {
        return stats.endurance > stats.level * 3;
      }

      return highestStatValue > stats.level * 2;
    }
  }

  class ItemInfo {
    /**
     * @typedef {(typeof ItemInfo.ItemType)[keyof typeof ItemInfo.ItemType]} ItemType
     */
    static ItemType = Object.freeze({
      codestone: "codestone",
      dubloon: "dubloon",
      unknown: "unknown",
    });

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
      this.itemType = nameElement.textContent.includes(
        lang.neopets.dubloon[configuration.language]
      )
        ? ItemInfo.ItemType.dubloon
        : nameElement.textContent.includes(
            lang.neopets.codestone[configuration.language]
          )
        ? ItemInfo.ItemType.codestone
        : ItemInfo.ItemType.unknown;

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
      return this.itemType === ItemInfo.ItemType.dubloon;
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

    static async searchSdb(searchTerm) {
      //   const request = await fetch(
      //     `/safetydeposit.phtml?obj_name=${encodeURIComponent(searchTerm)}`
      //   );
      //   const response = await request.text();
      //   const dom = new DOMParser().parseFromString(response, "text/html");
      //   const whichLang = getLang(dom);

      //   const notFound =
      //     dom.querySelector(".content p[align='center'] b")?.textContent ===
      //     lang.neopets.notFoundInSdb[whichLang];

      //   if (notFound) {
      //     alert(lang.neopets.notFoundInSdb[whichLang]);
      //     return dom;
      //   }

      //   return dom;
      // }

      // static openSdb(searchTerm) {
      window.open(
        `/safetydeposit.phtml?obj_name=${encodeURIComponent(searchTerm)}`
      );
    }

    static createItemSearchForm(itemName) {
      // if the bad character is in the name, get everything after it:
      const searchName = itemName.includes(lang.neopets.badCharacters)
        ? itemName.split(lang.neopets.badCharacters).pop()
        : itemName;

      return UI.createElement("div", {
        className: "item-search-form",
        children: [
          UI.createElement("button", {
            textContent: "Search SDB",
            listeners: {
              click: () => ItemInfo.searchSdb(searchName),
            },
          }),
          UI.createElement("button", {
            textContent: "Shop Wiz",
            listeners: {
              click: () => ItemInfo.searchShopWiz(searchName),
            },
          }),
        ],
      });
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
          /^(?<hour>\d+):(?<minute>\d+):(?<second>\d+) (?<amPm>am|pm)?\s*(?:NST|NSZ|HSN)$/
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
     * @param {PetInfo | null} petInfo
     * @param {PetCourseInfo} trainingInfo
     * @returns {void}
     */
    static checkFreebies(petInfo, trainingInfo) {
      if (!petInfo) {
        return;
      }
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
      const midnight = new Date();
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
     * @param {PetCourseInfo} trainingInfo
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
     * @param {PetCourseInfo} trainingInfo
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
            TrainingPage.isPirateSchool()
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
      if (store.getValue(gmKey, false)) return;
      store.setValue(gmKey, true);

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
      if (store.getValue(gmKey, false)) return;
      store.setValue(gmKey, true);

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
          cursor: pointer;
          color: #5C73A0;
          background: #fff;
          transition: background 0.2s;
        }

        .item-info-table button:hover {
          background: #eff4fc;
          box-shadow: 0 0 2px rgba(0, 0, 20, 0.1);
        }

        .item-info-table button:active {
          background: #d7dde8;
          box-shadow: inset 0 0 2px rgba(0, 0, 20, 0.2);
        }

        .item-search-form {
          display: flex;
          gap: 8px;
          flex-direction: column;
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
     * @property {Record<string, function>} listeners
     *
     * @param {string} tagName
     * @param {ElementProps?} props
     * @returns
     */
    static createElement(
      tagName,
      {
        children = [],
        textContent,
        className,
        listeners = {},
        ...attributes
      } = {}
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

      for (const [event, listener] of Object.entries(listeners)) {
        element.addEventListener(event, listener);
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

    static createInput({ label, checked, ...elementProps }) {
      const input = UI.createElement("input", elementProps);

      if (checked) {
        input.checked = true;
      }

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

      const labelElem = UI.createElement("label", labelProps);
      labelElem.classList.add(`${elementProps.type ?? "text"}-label`);
      return labelElem;
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
        action: "process_" + TrainingPage.getScriptName(),
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
    static getStartCourseForm(petName, selectedStat) {
      return UI.createForm({
        action: "process_" + TrainingPage.getScriptName(),
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
        details {
          margin: 16px;
          padding: 16px;
          border: 1px solid #ccc;
          border-radius: 4px;
          display: flex;
          gap: 8px;
          flex-direction: column;
        }

        p.version {
          font-size: 0.8em;
          margin-top: 16px;
          margin-bottom: 0;
          text-align: right;
        }

        summary {
          cursor: pointer;
          color: #5C73A0;
        }

        h2, h3 {
          margin: 0;
        }
  
        .training-helper-configuration {
          position: relative;
          width: fit-content;
          margin: 0;
          margin-top: 8px;
          text-align: left;
          padding: 16px;
          background: #fafafa;
        }

        .training-helper-configuration, fieldset {
          display: flex;
          flex-direction: column;
          gap: 16px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }

        fieldset {
          padding: 16px;
          background: #fefefe;
        }

        legend {
          padding: 0 4px;
          font-weight: bold;
        }
  
        label > input + span {
          margin-left: 4px;
        }
  
        label > span + input {
          display: block;
          margin-top: 4px;
        }

        .checkbox-label {
          cursor: pointer;
        }
  
        .save-button {
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

        .form-status-message {
          padding: 8px;
          border-radius: 4px;
          background: #f0f0f0;
          border: 1px solid #ccc;
          color: #333;
          animation: show 0.3s;
          box-sizing: border-box;
          overflow: hidden;
          position: absolute;
          top: 8px;
          left: 8px;
          width: calc(100% - 16px);
          pointer-events: none;
          box-shadow: 0 0 4px rgba(0, 0, 0, 0.1);
        }

        .form-status-message.type-success {
          background: #ebfaeb;
          color: #243115;
          border: 1px solid #bad49e;
        }

        .form-status-message.type-error {
          background: #f9ebeb;
          color: #4f2f2f;
          border: 1px solid #d9a5a5;
        }

        .form-status-message.hiding {
          animation: hide 0.3s forwards;
        }

        @keyframes show {
          from {
            opacity: 0;
            transform: scaleY(0);
          }
          to {
            opacity: 1;
            transform: scaleY(1);
          }
        }

        @keyframes hide {
          from {
            opacity: 1;
            transform: scaleY(1);
          }
          to {
            opacity: 0;
            transform: scaleY(0);
          }
        }
      `;

      shadow.append(styles);

      const statusMessage = {
        timeoutId: null,
        element: UI.createElement("div", {
          className: "form-status-message",
        }),
        _timeout(cb, ms) {
          if (this.timeoutId) clearTimeout(this.timeoutId);
          this.timeoutId = setTimeout(cb, ms);
        },
        show({ type, message, element, position = "append" }) {
          this.element.textContent = message;
          element[position](this.element);
          this.element.classList.remove("type-success", "type-error", "hiding");
          this.element.classList.add(`type-${type}`);
          this._timeout(() => this.startHideAnimation(), 3000);
        },
        startHideAnimation() {
          this.element.classList.add("hiding");
          this._timeout(() => this.hide(), 300);
        },
        hide() {
          if (this.timeoutId) clearTimeout(this.timeoutId);
          this.element.remove();
        },
      };

      const form = UI.createElement("div", {
        className: "training-helper-configuration",
        children: [
          UI.createElement("fieldset", {
            children: [
              UI.createElement("legend", {
                textContent: "Notification Settings",
              }),
              UI.createInput({
                label: "Enable Notifications",
                checked: configuration.notifications.enabled,
                type: "checkbox",
                listeners: {
                  async change(e) {
                    const target = e.target;
                    if (target.checked) {
                      const hasPermission =
                        await Notifier.enableNotifications().catch(() => {
                          statusMessage.show({
                            message:
                              "Oops, there was a problem enabling notifications.",
                            element: form,
                            type: "error",
                          });
                          return false;
                        });

                      if (!hasPermission) {
                        statusMessage.show({
                          message:
                            "Notifications permission is disabled by your browser!",
                          element: form,
                          type: "error",
                        });
                        target.checked = false;
                        return;
                      }

                      Notifier.sendNotification("Notifications enabled!", {
                        body: "You will now receive notifications from the Training Helper.",
                      });
                    }

                    let wasSuccess = false;
                    try {
                      configuration.notifications.enabled = target.checked;
                      wasSuccess = true;
                    } catch (e) {
                      console.error(e);
                    }

                    if (wasSuccess) {
                      statusMessage.show({
                        message: target.checked
                          ? "Notifications enabled"
                          : "Notifications disabled",
                        element: form,
                        type: "success",
                      });
                    } else {
                      statusMessage.show({
                        message:
                          "Oops, there was a problem saving your settings.",
                        element: form,
                        type: "error",
                      });
                    }
                  },
                },
              }),
            ],
          }),
        ],
      });

      const details = UI.createElement("details", {
        children: [
          UI.createElement("summary", {
            textContent: "Training Helper Configuration",
            listeners: {
              click() {
                if (!details.open) {
                  statusMessage.hide();
                }
              },
            },
          }),
          form,
          UI.createElement("p", {
            className: "version",
            textContent: `Version ${getVersion()}`,
          }),
        ],
        listeners: {
          toggle() {
            configuration.isConfigPanelOpen = details.open;
          },
        },
      });

      if (configuration.isConfigPanelOpen) {
        details.open = true;
      }

      shadow.append(details);

      const navBar = TrainingPage.getNavBar();
      if (navBar) {
        navBar.after(container);
      } else {
        const parent =
          document.querySelector("#content td.content") ?? document.body;

        parent.append(container);
      }
    }
  }

  class Notifier {
    static async enableNotifications() {
      let permission = Notification.permission;

      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      return permission === "granted";
    }

    static sendNotification(
      title,
      {
        body,
        petName = undefined,
        previousNotification = null,
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

      // the page does not reopen when clicking the notification if the browser tab was closed
      // We can listen on the homepage of neopets and check something like this to reopen the page if we want
      // store.setValue("notificationUrl", window.location.href);

      notification.onclick = () => {
        // store.deleteValue("notificationUrl");
        notification.close();
        document.title = previousTitle;
        onClickNotification?.();
      };
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
        // not going to delete existing cache right here, but we should probably include a way to clear it within the settings menu
        // store.deleteValue(`petInfo.${petName}`);
        return null;
      }
      const result = store.getValue(`petInfo.${petName}`, null);
      // if (DEBUG) console.debug("Got cached pet info for", petName, result);
      if (!result) return null;
      if (!this.isCachedValueValid(result)) {
        if (DEBUG)
          console.debug("Cached value is invalid or expired for", petName);
        store.deleteValue(`petInfo.${petName}`);
        return null;
      }
      return result.petInfo;
    }

    /**
     * @param {{ timestamp: number }}
     * @returns {boolean}
     * @private
     */
    isCachedValueValid(result) {
      if (
        typeof result !== "object" ||
        !result ||
        !("timestamp" in result) ||
        !result.timestamp
      ) {
        return false;
      }
      const midnightNstHour = -1 * DateTimeHelpers.getNstTimezoneOffset();
      const midnightNst = new Date();
      midnightNst.setUTCHours(midnightNstHour, 0, 0, 0);
      midnightNst.setUTCDate(midnightNst.getUTCDate() - 1);

      return result.timestamp > midnightNst.getTime();
    }

    setCachedPetInfo(petName, petInfo) {
      if (!configuration.quickrefLookup.shouldCache) return;

      const result = { petInfo, timestamp: Date.now() };

      store.setValue(`petInfo.${petName}`, result);

      // if (DEBUG) console.debug("Saved cached pet info for", petName, result);
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
     * @returns {Promise<PetInfo | null>} The pet's info as it's listed on the quickref page.
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

      if (!petDetails) {
        if (DEBUG) console.warn("No pet details found for", petName);
        return null;
      }

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

  /**
   * @typedef {Object} Storage
   * @property {function(string, string): string} getValue
   * @property {function(string, string): void} setValue
   * @property {function(string): void} deleteValue
   *
   * @returns {Storage}
   */
  function makeStore(localFallbackPrefix) {
    if (
      typeof GM_setValue === "function" &&
      typeof GM_getValue === "function"
    ) {
      return Object.freeze({
        getValue(key, defaultValue) {
          const value = GM_getValue(key, JSON.stringify(defaultValue));

          if (typeof value !== "string") {
            return value;
          }

          try {
            return JSON.parse(value);
          } catch (e) {
            console.error("Error parsing value", value);
            return defaultValue;
          }
        },
        setValue(key, value) {
          GM_setValue(key, JSON.stringify(value));
        },
        deleteValue(key) {
          GM_deleteValue(key);
        },
      });
    }
    const prefix = localFallbackPrefix;
    const getKey = (key) => `${prefix}.${key}`;

    return Object.freeze({
      getValue(key, defaultValue) {
        return JSON.parse(
          localStorage.getItem(getKey(key)) ?? JSON.stringify(defaultValue)
        );
      },
      setValue(key, value) {
        localStorage.setItem(getKey(key), JSON.stringify(value));
      },
      deleteValue(key) {
        localStorage.removeItem(getKey(key));
      },
    });
  }

  function getLang(dom = document) {
    return dom.querySelector("select[name='lang']")?.value || "en";
  }

  main();
})();
