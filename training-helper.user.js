// ==UserScript==
// @name         Neopets Training Helper
// @author       Hiddenist
// @namespace    https://hiddenist.com
// @version      2024-08-17-alpha3
// @description  Makes codestone training your pet require fewer clicks and less math.
// @match        http*://www.neopets.com/island/fight_training.phtml*
// @match        http*://www.neopets.com/island/training.phtml*
// @match        http*://www.neopets.com/pirates/academy.phtml*
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://github.com/Meerca/Neopets-Userscripts/raw/main/training-helper.user.js
// @downloadURL  https://github.com/Meerca/Neopets-Userscripts/raw/main/training-helper.user.js
// @supportURL   https://github.com/Meerca/Neopets-Userscripts/issues
// ==/UserScript==
(function () {
  ("use strict");
  const DEBUG = true;

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
      enabled: GM_getValue("notifications.enabled", false),
      idleReminder: {
        enabled: GM_getValue("notifications.idleReminder.enabled", false),
        intervalInMs: 1000 * 60,
        thresholdInMs: GM_getValue(
          "notifications.idleReminder.thresholdInMs",
          1000 * 60
        ),
      },
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
    if (!isStatusPage()) {
      return;
    }

    getAllPetsTrainingInfo().forEach((trainingInfo) => {
      if (DEBUG) console.debug("Training info:", trainingInfo);

      switch (trainingInfo.status) {
        case TrainingStatus.noCourseStarted:
          return addStartCourseForm(trainingInfo);
        case TrainingStatus.active:
          return startCountdownTracker(trainingInfo);
        case TrainingStatus.finished:
          return addListenerToCompleteCourseButton(trainingInfo);
        case TrainingStatus.needsPayment:
          return handleTrainingItems(trainingInfo);
      }
    });

    addConfigurationForm();
  }

  function isStatusPage() {
    const query = new URLSearchParams(window.location.search);
    return query.get("type") === "status";
  }

  function getScriptName() {
    return window.location.pathname.split("/").pop();
  }

  function sendNotification(
    title,
    {
      body,
      petName = undefined,
      previousNotification = null,
      idleCheckId = null,
      previousTitle = document.title,
    }
  ) {
    document.title = title;

    if (Notification.permission !== "granted") return;

    if (previousNotification) {
      previousNotification.close();
    }

    const notification = new Notification(title, {
      icon:
        petName &&
        "http://pets.neopets.com/cpn/" + petName.toLowerCase() + "/1/1.png",
      body: body,
    });

    if (!idleCheckId) {
      idleCheckId = setReturnFromIdleReminder(() => {
        sendNotification(title, {
          body,
          petName,
          previousNotification: notification,
          idleCheckId,
          previousTitle,
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
    };
  }

  /**
   * Runs a callback if a machine returns from idle.
   * @param {function} onReturnFromIdleDetected - Callback to run when the machine returns from idle.
   * @param {number} intervalInMs - How often to check for idle in milliseconds.
   * @param {number} idleThresholdInMs - How long the machine must be idle before running the callback.
   */
  function setReturnFromIdleReminder(
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

  /**
   * Updates the stats based on the message received from the server.
   *
   * This updates both the stats object and the DOM elements.
   *
   * @param {HTMLTableCellElement} td
   * @param {StatsWithElements} stats
   * @param {string} increasedStatsMessage
   * @returns {StatName | null} The name of the stat that was increased
   */
  function increaseStat(stats, increasedStatsMessage) {
    /**
     * @type {StatName?}
     */
    var increasedStat = increasedStatsMessage
      .match(/increased (?<statName>strength|defence|endurance|agility|level)/i)
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

    if (DEBUG) console.debug(stats);

    // Minor thing to check: when training HP and the pet has reduced HP, does it increased the current HP or only the max?

    stats.elements[increasedStat].textContent =
      increasedStat === "endurance"
        ? `${stats.currentHitpoints} / ${stats.endurance}`
        : stats[increasedStat];

    return increasedStat;
  }

  /**
   * @typedef {Object} StatsWithElements
   * @property {number} level
   * @property {number} strength
   * @property {number} defence
   * @property {number} agility
   * @property {number} endurance
   * @property {number} currentHitpoints
   * @property {Record<StatName, HTMLElement>} elements
   *
   * @param {HTMLElement} currentStatsCell
   * @returns
   */
  function getCurrentStats(currentStatsCell) {
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
   * @param {Record<StatName, number>} stats
   * @returns {StatName}
   */
  function recommendNextStatToTrain(stats, fallbackValue = "level") {
    // todo: For now, just recommend the last trained stat. I need to rebuild and test the stat simulator.
    return fallbackValue;
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
  function createElement(
    tagName,
    { textContent, children = [], className, id } = {}
  ) {
    const element = document.createElement(tagName);
    if (textContent) element.textContent = textContent;
    if (className) element.className = className;
    if (id) element.id = id;

    if (!Array.isArray(children) && children) {
      children = [children];
    }
    children.forEach((child) => element.append(child));
    return element;
  }

  function createForm({ action, method, onSubmit, ...elementProps }) {
    const form = createElement("form", elementProps);
    if (action) form.action = action;
    if (method) form.method = method;
    if (onSubmit) form.addEventListener("submit", onSubmit);
    return form;
  }

  function createInput({ label, name, value, type, ...elementProps }) {
    const input = createElement("input", elementProps);
    if (name) input.name = name;
    if (value) input.value = value;
    if (type) input.type = type;

    if (!label) return input;

    const labelElement = document.createElement("label");
    const labelText = document.createElement("span");
    labelText.textContent = label;
    labelElement.append(labelText);

    if (type === "checkbox" || type === "radio") {
      labelElement.prepend(input);
    } else {
      labelElement.append(input);
    }
    return labelElement;
  }

  function createSelect({ name, value, options, ...elementProps }) {
    const select = createElement("select", elementProps);
    if (name) select.name = name;

    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option;
      optionElement.textContent = option;
      optionElement.selected = option.toLowerCase() === value?.toLowerCase();
      select.append(optionElement);
    });

    return select;
  }

  function createStartCourseForm(petName, selected) {
    return createForm({
      action: "process_" + getScriptName(),
      method: "post",
      children: [
        createInput({ name: "type", value: "start", type: "hidden" }),
        createInput({ name: "pet_name", value: petName, type: "hidden" }),
        createSelect({
          name: "course_type",
          value: selected,
          options: ["Strength", "Defence", "Agility", "Endurance", "Level"],
        }),
        " ",
        createInput({ type: "submit", value: "Start Course" }),
      ],
    });
  }

  function searchShopWiz(searchTerm) {
    const ssw = document.getElementById("sswmenu");
    if (!ssw) {
      return searchRegularShopWiz(searchTerm);
    }

    if (!ssw.querySelector(".sswdrop")?.checkVisibility()) {
      ssw.querySelector(".imgmenu").click();
    }
    ssw.querySelector("#searchstr").value = searchTerm;
    ssw.querySelector("#ssw-criteria").value = "exact";
    ssw.querySelector("#button-search").click();
  }

  function searchRegularShopWiz(searchTerm) {
    window.open(`/shops/wizard.phtml?string=${encodeURIComponent(searchTerm)}`);
  }

  function searchSdb(searchTerm) {
    window.open(
      `/safetydeposit.phtml?obj_name=${encodeURIComponent(searchTerm)}`
    );
  }

  function createItemSearchForm(itemName) {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "grid";
    buttonContainer.style.gap = "16px";
    buttonContainer.style.margin = "16px auto";
    buttonContainer.style.maxWidth = "150px";

    const sdbButton = document.createElement("button");
    sdbButton.textContent = "Search SDB";
    sdbButton.addEventListener("click", () => searchSdb(itemName));
    buttonContainer.append(sdbButton);

    const wizbutton = document.createElement("button");
    wizbutton.textContent = "Shop Wiz";
    wizbutton.addEventListener("click", () => searchShopWiz(itemName));
    buttonContainer.append(wizbutton);

    return buttonContainer;
  }

  /**
   * Creates a form to complete a course.
   * @param {PetTrainingInfo} trainingInfo
   */
  function createCompleteCourseForm(trainingInfo) {
    return createForm({
      action: "process_" + getScriptName(),
      method: "post",
      children: [
        createInput({ name: "type", value: "complete", type: "hidden" }),
        createInput({
          name: "pet_name",
          value: trainingInfo.petName,
          type: "hidden",
        }),
        createInput({ type: "submit", value: "Complete Course" }),
      ],
    });
  }

  /**
   * @param {PetTrainingInfo} trainingInfo
   */
  function addStartCourseForm(trainingInfo) {
    trainingInfo.trainingCell.append(
      createStartCourseForm(
        trainingInfo.petName,
        recommendNextStatToTrain(trainingInfo.currentStats)
      )
    );
  }

  /**
   * Attaches an event listener to a complete course submission form to handle the submission as an AJAX request.
   * @param {PetTrainingInfo} trainingInfo
   * @returns {function} A function to remove the event listener
   */
  function addListenerToCompleteCourseButton(
    trainingInfo,
    existingForm = null
  ) {
    const form =
      existingForm ??
      trainingInfo.trainingCell.querySelector('form[action^="process_"]');
    if (form?.type?.value !== "complete") {
      console.warn("No complete course form found", form);
      return;
    }

    const listener = async (e) => {
      e.preventDefault();
      await submitCourseCompletedForm(form, trainingInfo);
    };

    form.addEventListener("submit", listener);

    return () => form.removeEventListener("submit", listener);
  }

  /**
   * @param {HTMLFormElement} form
   * @param {PetTrainingInfo} trainingInfo
   */
  async function submitCourseCompletedForm(form, trainingInfo) {
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
<center><IMG src="//pets.neopets.com/cpn/${trainingInfo.petName}/1/2.png" width="150" height="150" border="0"><br><b>Woohoo!</b><p>Congratulations! <b>${trainingInfo.petName}</b> now has increased ${_statName}!!!<p><p><form action='academy.phtml' method='get'><input type='submit' value='Back to the Swashbuckling Academy'></form>`;

    const body = await response.text();

    const responseDom = new DOMParser().parseFromString(body, "text/html");

    trainingInfo.trainingCell.innerHTML = "";

    const errorMessage = responseDom.querySelector(".errorMessage");
    if (errorMessage) {
      trainingInfo.trainingCell.append(errorMessage);
      trainingInfo.trainingCell.append(document.createElement("br"));
      trainingInfo.trainingCell.append(
        createStartCourseForm(
          trainingInfo.petName,
          recommendNextStatToTrain(trainingInfo.currentStats)
        )
      );
      return;
    }

    const paragraphs = [...responseDom.querySelectorAll("p")];

    paragraphs.forEach((p) => trainingInfo.trainingCell.append(p));

    const increasedStatName = increaseStat(
      trainingInfo.currentStats,
      paragraphs.map((p) => p.textContent).join(" ")
    );

    const nextStat = recommendNextStatToTrain(
      trainingInfo.currentStats,
      increasedStatName
    );

    trainingInfo.trainingCell.append(
      createStartCourseForm(trainingInfo.petName, nextStat)
    );
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
   */
  function getCountdowns(trainingCell) {
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
   * @typedef {Object} ItemInfo
   * @property {string} itemName
   * @property {HTMLElement} element
   * @property {ItemType} itemType
   * @property {HTMLImageElement?} image
   *
   * @param {HTMLElement} nameElement The element containing the item name
   */
  function getItemInfo(nameElement) {
    const itemName = nameElement.textContent;
    const itemType = nameElement.textContent.includes("Dubloon")
      ? ItemType.dubloon
      : nameElement.textContent.includes("Codestone")
      ? ItemType.codestone
      : ItemType.unknown;

    let image =
      nameElement.nextSibling?.tagName === "IMG"
        ? nameElement.nextSibling
        : null;

    if (!image && itemType === ItemType.dubloon) {
      image = nameElement.parentElement.querySelector("img");
    }

    return {
      itemName,
      itemType,
      image,
      element: nameElement,
    };
  }

  /**
   *
   * @param {HTMLTableCellElement} trainingCell
   * @returns {ItemInfo[]}
   */
  function getTrainingCost(trainingCell) {
    const itemElements = [...trainingCell.querySelectorAll("b")].filter((b) => {
      return (
        b.textContent.includes("Codestone") || b.textContent.includes("Dubloon")
      );
    });

    return itemElements.map(getItemInfo);
  }

  /**
   * @typedef {Object} PetTrainingInfo
   * @property {TrainingStatus} status
   * @property {StatsWithElements} currentStats
   * @property {Date?} endTime
   * @property {Countdown[]} countdowns
   * @property {string} petName
   * @property {StatName} stat
   * @property {ItemInfo[]} trainingCost
   * @property {HTMLElement} trainingCell
   *
   * @param {HTMLTableRowElement} headerRow
   * @returns {PetTrainingInfo}
   */
  function getTrainingInfo(headerRow) {
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
    const trainingCell = bodyRow.lastChild;
    const countdowns = getCountdowns(trainingCell);

    const status = headerRow.textContent.includes("is not on a course")
      ? TrainingStatus.noCourseStarted
      : bodyRow.textContent.includes("Time till course finishes")
      ? TrainingStatus.active
      : bodyRow.textContent.includes("Course Finished!")
      ? TrainingStatus.finished
      : TrainingStatus.needsPayment;

    const currentStatsCell = bodyRow.firstChild;
    const currentStats = getCurrentStats(currentStatsCell);

    return {
      status,
      trainingCell,
      currentStats,
      petName: titleRegexMatches.groups.petName,
      stat: titleRegexMatches.groups.stat?.toLowerCase(),
      countdowns,
      trainingCost: getTrainingCost(trainingCell),
      endTime: countdowns.find(({ isActualTime }) => isActualTime)?.endTime,
    };
  }

  /**
   * @returns {PetTrainingInfo[]}
   */
  function getAllPetsTrainingInfo() {
    return [...document.querySelectorAll("td.content tr")]
      .filter(
        (tr) =>
          tr.textContent.includes("is currently studying") ||
          tr.textContent.includes("is not on a course")
      )
      .map(getTrainingInfo);
  }

  /**
   * @param {PetTrainingInfo} trainingInfo
   */
  function handleTrainingItems(trainingInfo) {
    trainingInfo.trainingCost.forEach(({ element }) => {
      if (element.nextSibling && element.nextSibling.tagName === "IMG") {
        element.nextSibling.style = { marginBottom: "10px" };
      }
      element.append(createItemSearchForm(element.textContent));
    });
  }

  /**
   * @param {DateTime} date
   * @returns {TimeLeft}
   */
  function getTimeLeftUntil(date) {
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

  function addCourseCompleteForm(trainingInfo) {
    const form = createCompleteCourseForm(trainingInfo);
    trainingInfo.trainingCell.append(form);
    addListenerToCompleteCourseButton(trainingInfo, form);
  }

  /**
   * @param {PetTrainingInfo} trainingInfo
   */
  function handleTrainingComplete(trainingInfo) {
    const { petName, stat, trainingCell, countdowns } = trainingInfo;

    sendNotification("Course Finished!", {
      body: petName + " has finished studying " + stat + ".",
      petName,
    });

    countdowns.forEach(({ element, isActualTime }) => {
      if (!isActualTime) {
        element.remove();
        return;
      }

      element.textContent = "Course Finished!";
    });

    trainingCell.innerHtml = "";
    addCourseCompleteForm(trainingInfo);
  }

  /**
   * @param {PetTrainingInfo} trainingInfo
   */
  function updateCountdowns(trainingInfo) {
    trainingInfo.countdowns.forEach(({ element, endTime }) => {
      const timeLeft = getTimeLeftUntil(endTime);
      element.textContent = `${timeLeft.hours} hrs, ${timeLeft.minutes} minutes, ${timeLeft.seconds} seconds`;
    });
  }

  /**
   *
   * @param {PetTrainingInfo} trainingInfo
   */
  function startCountdownTracker(trainingInfo) {
    let timeoutId;
    function tick() {
      if (timeoutId) clearTimeout(timeoutId);
      const remainingMs = trainingInfo.endTime.getTime() - new Date().getTime();
      if (remainingMs <= 0) {
        handleTrainingComplete(trainingInfo);
        return;
      }
      updateCountdowns(trainingInfo);
      timeoutId = setTimeout(tick, remainingMs % 1000);
    }
    tick();
  }

  function addConfigurationForm() {
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
        max-width: 300px;
        margin: 16px;
        text-align: left;
        padding: 16px;
        border: 1px solid #ccc;
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
      }
    `;

    shadow.append(styles);

    shadow.append(createForm({
      shadowRoot: true,
      children: [
        createElement("h2", { textContent: "Training Helper" }),
        createElement("h3", { textContent: "Configuration" }),
        createInput({
          label: "Enable Notifications",
          name: "notificationsEnabled",
          value: configuration.notifications.enabled,
          type: "checkbox",
        }),
        createInput({
          label: "Enable Idle Reminder",
          name: "idleReminderEnabled",
          value: configuration.notifications.idleReminder.enabled,
          type: "checkbox",
        }),
        createInput({
          label: "Idle Threshold (minutes)",
          name: "idleThreshold",
          value: Math.round(configuration.notifications.idleReminder.thresholdInMs / (1000 * 60)),
          type: "number",
        }),
        createInput({ type: "submit", value: "Save", className: "save-button" }),
        
        createElement("small", { textContent: "Note: Right now this form doesn't save, sorry!" }),
      ],
      onSubmit: (e) => {
        if (DEBUG) console.debug("Form submitted", e);
        e.preventDefault();
        configuration.notifications.enabled = e.target.notificationsEnabled.checked;
        GM_setValue("notifications.enabled", configuration.notifications.enabled);

        configuration.notifications.idleReminder.enabled = e.target.idleReminderEnabled.checked;
        GM_setValue("notifications.idleReminder.enabled", configuration.notifications.idleReminder.enabled);

        configuration.notifications.idleReminder.thresholdInMs = e.target.idleThreshold.value * 1000 * 60;
        GM_setValue("notifications.idleReminder.thresholdInMs", configuration.notifications.idleReminder.thresholdInMs);

        if (configuration.notifications.idleReminder.enabled) {
          requestNotificationPermission();
        }
      },
    }));

    const parent = document.querySelector("#content td.content") ?? document.body;

    parent.append(container);
  }

  function requestNotificationPermission() {
    if (Notification.permission === "granted") {
      return;
    }

    Notification.requestPermission().then((result) => {
      if (result === "granted") {
        sendNotification("Notifications enabled!", {
          body: "You will now receive notifications from the Training Helper.",
        });
        button.remove();
      }
    });
  }

  main();
})();
