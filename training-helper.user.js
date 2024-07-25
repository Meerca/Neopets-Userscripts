// ==UserScript==
// @name         Neopets Training Helper
// @author       Hiddenist
// @namespace    https://hiddenist.com
// @version      2024-07-24
// @description  Makes codestone training your pet require fewer clicks and less math.
// @match        http*://www.neopets.com/island/fight_training.phtml?type=status
// @match        http*://www.neopets.com/island/training.phtml?type=status
// @grant        unsafeWindow
// @updateURL    https://github.com/Meerca/Neopets-Userscripts/raw/main/training-helper.user.js
// @downloadURL  https://github.com/Meerca/Neopets-Userscripts/raw/main/training-helper.user.js
// @supportURL   https://github.com/Meerca/Neopets-Userscripts/issues
// ==/UserScript==
/* jshint -W097 */
'use strict';

// You can change these settings!
var maxTraining = {
	strength: 750,
	defence: 750,
	agility: 201,
	endurance: Number.MAX_SAFE_INTEGER
};
var playSound = true;


var $ = unsafeWindow.jQuery;

// These are the levels at which more codestones need to be used.
// Note: I skip the level 250 switch to the secret school, because it's better
// to jump directly into that instead of training up HP at 8 codestones a point for HP.
var courseLevels = [ 21, 41, 81, 101, 121, 151, 201, 300, 400, 500, 600, 750 ];

function trainingCost(level) {
	/*
	  Grasshopper   1-20     1 codestone     2 hours
	  Basic         21-40    2 codestones    3 hours
	  Intermediate  41-80    3 codestones    4 hours
	  Adept         81-100   4 codestones    6 hours
	  Advanced      101-120  5 codestones    8 hours
	  Expert        121-150  6 codestones    12 hours
	  Master        151-200  7 codestones    18 hours
	  Grand Master  201-250  8 codestones    24 hours

	  Intermediate  250      1 codestone     4 hours
	  Adept	        300      2 codestones    6 hours
	  Advanced      400      3 codestones    8 hours
	  Expert        500      4 codestones    10 hours
	  Master        600      5 codestones    12 hours
	  Grand Master  750+     6 codestones    12 hours
	*/

	if (level < 21) {
		return {codestones: 1, hours: 2, type: 'basic'};
	} else if (level < 41) {
		return {codestones: 2, hours: 3, type: 'basic'};
	} else if (level < 81) {
		return {codestones: 3, hours: 4, type: 'basic'};
	} else if (level < 101) {
		return {codestones: 4, hours: 6, type: 'basic'};
	} else if (level < 121) {
		return {codestones: 5, hours: 8, type: 'basic'};
	} else if (level < 151) {
		return {codestones: 6, hours: 12, type: 'basic'};
	} else if (level < 201) {
		return {codestones: 7, hours: 18, type: 'basic'};
	} else if (level < 250) {
		return {codestones: 8, hours: 24, type: 'basic'};
	} else if (level < 300) {
		return {codestones: 1, hours: 4, type: 'advanced'};
	} else if (level < 400) {
		return {codestones: 2, hours: 6, type: 'advanced'};
	} else if (level < 500) {
		return {codestones: 3, hours: 8, type: 'advanced'};
	} else if (level < 600) {
		return {codestones: 4, hours: 10, type: 'advanced'};
	} else if (level < 750) {
		return {codestones: 5, hours: 12, type: 'advanced'};
	} else {
		return {codestones: 6, hours: 12, type: 'advanced'};
	}
}

function simulate(stats, runs) {
	if (typeof runs == 'undefined') runs = 100;

	var totalCost = {time: 0, redStones: 0, tanStones: 0};

	for (var i = 0; i < runs; ++i) {
		var next = calculateNextStat(stats);

		var cost = trainingCost(stats.level);
		totalCost.time += cost.hours;
		if (cost.type == 'advanced') {
			totalCost.redStones += cost.codestones;
		} else {
			totalCost.tanStones += cost.codestones;
		}

		stats[next]++;

		console.log('Trained ' + next, stats, cost);
	}

	console.log('Raised ' + runs + ' stats.  Cost:', totalCost);
}
var scriptname = window.location.pathname.split('/').pop();

var sound = document.createElement('audio');
sound.src = 'https://dl.dropboxusercontent.com/s/6fjsg7f7sfp3coz/Gentle%20Roll.mp3';
sound.preload = 'auto';

var notification = null;
function sendNotification(title, body, petName) {
	if (playSound && sound.paused) sound.play();
	$('title').html(title);
	
	if (notification) {
		notification.close();
	}

	if (Notification.permission !== "granted")
		Notification.requestPermission();
	else {
		
		notification = new Notification(title, {
			icon: 'http://pets.neopets.com/cpn/' + petName.toLowerCase() + '/1/1.png',
			body: body,
		});

		var idleCheck = setIdleReminder(function() {
			sendNotification(title, body, petName);
		});

		notification.onclick = function(x) {
			window.focus();
			clearInterval(idleCheck);
			this.close();
			notification = null;
		};
	}
}

// Runs a callback if a machine returns from idle.
function setIdleReminder( cb, interval, threshold ) {
	if (typeof interval == 'undefined') interval = 1000*60;
	if (typeof threshold == 'undefined') threshold = 1000*60;
	var lastRan = new Date();
	var idleCheck = setInterval(function() {
		var now = new Date();
		var passed = now.getTime() - lastRan.getTime();
		lastRan = now;
		if ( passed > (interval + threshold)  ) {
			cb();
		}
	}, interval);
	return idleCheck;
}

function getFormObject( form ) {
	var data = $(form).find(":input").serializeArray();
	var postData = {};
	for (var i in data) {
		postData[data[i].name] = data[i].value;
	}
	return postData;
}

function increaseStat(td, stats, increased) {
	if (increased) {
		var matchStat = increased.match(/now has increased (strength|defence|endurance|agility|level)/i);
		if (matchStat && matchStat[1]) {
			var stat = matchStat[1].toLowerCase();
			if (!stats[stat]) {
				return stats;
			}
			var points = 1;
			var matchBonus = increased.match(/You went up (\d+) points/i);
			if (matchBonus && matchBonus[1]) {
				points = parseInt(matchBonus[1]);
			}
			stats[stat] += points;

			var b = $(td).find('b');
			var e = {
				level: b.eq(0),
				strength: b.eq(1),
				defence: b.eq(2),
				agility: b.eq(3),
				endurance: b.eq(4),
			};

			if ( stat == 'endurance' ) {
				e[stat].html( e[stat].text().replace(/(\d+ \/ )\d+/, '$1' + stats[stat]) );
			} else {
				e[stat].html(stats[stat]);
			}
		}
	}
	return stats;
}

function getNextCourseLevel( level ) {
	for (var i in courseLevels) {
		if (courseLevels[i] > level) {
			return courseLevels[i];
		}
	}
}

function getNextStat( td, increased ) {
	var statText = td.text();
	function getStat( abbr ) {
		var regex = new RegExp(abbr + '\\s*:\\s*(?:\\d+\\s*\\/\\s*)?(\\d+)', 'i');
		var m = statText.match(regex);
		if (m) {
			return parseInt(m[1]);
		}
		return 0;
	}

	var stats = {
		strength: getStat('Str'),
		defence: getStat('Def'),
		agility: getStat('Mov'),
		endurance: getStat('Hp'),
		level: getStat('Lvl'),
	};

	if (increased) {
		increaseStat(td, stats, increased);
	}

	return calculateNextStat(stats);
}

function calculateNextStat(stats) {
	var nextLevel = getNextCourseLevel(stats.level);

	var minStat = null;
	var maxStat = null;
	for (var stat in stats) {
		var value = stats[stat];
		if (!maxStat || value > stats[maxStat]) {
			maxStat = stat;
		}

		if (stat == 'level' || (maxTraining[stat] <= value)) {
			continue;
		}

		if (!minStat || value < stats[minStat]) {
			minStat = stat;
		}
	}

	//console.log(minStat, maxStat, stats.level*2, canTrain(minStat, stats), canTrain('endurance', stats));

	if (canTrain(minStat, stats) && stats[maxStat] <= stats.level * 2) {
		return minStat;
	} else if (canTrain('endurance', stats) && (maxStat == 'endurance' || stats[maxStat] <= stats.level * 2)) {
		return 'endurance';
	} else {
		return 'level';
	}

}

// Check whether or not a stat is possible and safe to train
function canTrain(stat, stats) {
	var currentValue = stats[stat],
		nextLevel = getNextCourseLevel(stats.level),
		maxValue;

	if (maxTraining[stat] <= currentValue) {
		return false;
	}

	var nextHpLevel = Math.max( Math.ceil(stats.endurance / 2), nextLevel);
	var nextNextLevel = getNextCourseLevel(nextHpLevel);
	var maxHp = (nextNextLevel - 3) * 2;

	if (stat == 'endurance') {
	   maxValue = maxHp; // Leave three levels in case of accidental level increases or bonus stats
	} else {
	   maxValue = (nextLevel - 1) * 2;
	}

	// console.log(stat, maxValue, currentValue + 2);

	return currentValue + 2 <= maxValue;
}

function getStartForm(pet_name, selected) {
	function isSelected(stat) {
		if (selected && stat.toLowerCase() == selected.toLowerCase()) return 'selected';
		else return '';
	}
	return $(
/*jshint multistr: true*/
'<form action="process_' + scriptname + '" method="post">\
  <p>Start a new course: </p>\
  <input type="hidden" name="type" value="start">\
  <input type="hidden" name="pet_name" value="' + pet_name + '">\
  <select name="course_type">\
	<option value="Strength" '+ isSelected('strength') +'>Strength</option>\
	<option value="Defence" '+ isSelected('defence') +'>Defence</option>\
	<option value="Agility" '+ isSelected('agility') +'>Agility</option>\
	<option value="Endurance" '+ isSelected('endurance') +'>Endurance</option>\
	<option value="Level" '+ isSelected('level') +'>Level</option>\
  </select>\
  <p><input type="submit" value="Start Course"></p>\
</form>'
	);
}

function searchShopWiz(searchTerm) {
	const ssw = document.getElementById('sswmenu');
	if (!ssw) {
		return searchRegularShopWiz(searchTerm);
	}
	
	if (!ssw.querySelector('.sswdrop')?.checkVisibility()) {
		ssw.querySelector('.imgmenu').click();
	}
	ssw.querySelector('#searchstr').value = searchTerm;
	ssw.querySelector('#ssw-criteria').value = 'exact';
	ssw.querySelector('#button-search').click();
}

function searchRegularShopWiz(searchTerm) {
	window.open(`/shops/wizard.phtml?string=${encodeURIComponent(searchTerm)}`);
}

function searchSdb(searchTerm) {
	window.open(`/safetydeposit.phtml?obj_name=${encodeURIComponent(searchTerm)}`);
}

function getItemSearchForm(itemName) {
	const buttonContainer = document.createElement('div');
	buttonContainer.style.display = "grid";
	buttonContainer.style.gap = "16px";
	buttonContainer.style.margin = "16px auto";
	buttonContainer.style.maxWidth = "150px";

	const sdbButton = document.createElement('button');
	sdbButton.textContent = "Search SDB";
	sdbButton.addEventListener('click', () => searchSdb(itemName));
	buttonContainer.append(sdbButton);

	const wizbutton = document.createElement('button');
	wizbutton.textContent = "Shop Wiz";
	wizbutton.addEventListener('click', () => searchShopWiz(itemName));
	buttonContainer.append(wizbutton);

	return buttonContainer;
}

function getCompleteForm( pet_name ) {
	var form = $(
/*jshint multistr: true*/
'<b>Course Finished!</b>\
<form action="process_' + scriptname + '" method="post">\
  <input type="hidden" name="type" value="complete">\
  <input type="hidden" name="pet_name" value="' + pet_name + '">\
  <p><input type="submit" value="Complete Course"></p>\
</form>'
	);
	form.submit(submitComplete);
	return form;
}

function submitComplete(e) {
	e.preventDefault();
	var url = $(this).attr('action');
	var method = $(this).attr('method') || 'GET';
	var postData = getFormObject(this);
	var form = $(this);
	$.ajax( url, {
		method: method,
		data: postData
	}).done (function(html) {
		var p = $(html).find('p');
		form.parent().append(p);
		form.parent().append(getStartForm( postData.pet_name, getNextStat(form.closest('td').prev('td'), p.text()) ));
		form.remove();
	}).fail(function() {
		unsafeWindow.alert('Post failure :(');
	});
}

$('form[action="process_' + scriptname + '"]').submit(submitComplete);

$('b:contains("is not on a course")').each(function() {
	var pet = $(this).text().split(' ')[0];
	var container = $(this).closest('tr').next('tr').children('td').last();
	container.append(getStartForm( pet, getNextStat(container.prev('td')) ));
});

$('tr:contains("is currently studying") + tr > td:contains("Time till course finishes")').each(function() {
	var displayTime = $(this).find('b');
	var m = displayTime.text().match(/(\d+) hrs, (\d+) minutes, (\d+) seconds/);
	if (!m) return;

	var time = {
		hours: parseInt(m[1]),
		minutes: parseInt(m[2]),
		seconds: parseInt(m[3])
	};
	var t = new Date();

	t.setSeconds( t.getSeconds() + time.seconds );
	t.setMinutes( t.getMinutes() + time.minutes );
	t.setHours( t.getHours() + time.hours );

	var studying = $(this).closest('tr').prev('tr').text();
	m = studying.match(/^(\w+).*currently studying (\w+)/);
	var petName = m[1];
	var stat = m[2];

	var tick = function() {
		var ms = t.getTime() - (new Date()).getTime();

		if ( ms > 0 ) {
			setTimeout(tick, ms % 1000);
		} else {
			sendNotification(
				"Course Finished!",
				petName + " has finished studying " + stat +  ".",
				petName
			);

			displayTime.closest('td').html(getCompleteForm( petName ));
		}

		var remaining = parseInt(ms / 1000);
		var seconds = remaining % 60;
		var minutes = parseInt( remaining / 60 ) % 60;
		var hours = parseInt( remaining / ( 60 * 60 ) );

		displayTime.html(hours + " hrs, " + minutes + " minutes, " + seconds + " seconds" );
	};
	tick();

});

$('p b:contains("Codestone")').each(function() {
	var codestone = $(this).text();
	$(this).next('img').css('margin-bottom','10px');
	$(this).after(getItemSearchForm(codestone));
});

if (Notification.permission !== "granted") Notification.requestPermission();
