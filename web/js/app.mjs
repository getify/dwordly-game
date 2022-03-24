import IO from "monio/io";
import {
	applyIO,
	doIOBind,
	match,
	iAnd,
	iNot,
} from "monio/io/helpers";
import IOx from "monio/iox";
import {
	merge,
	filterIn,
} from "monio/iox/helpers";

import {
	doIOBackground,
	doIOxBackground,
	getElement,
	findElement,
	findElements,
	closest,
	matches,
	createElement,
	appendChild,
	removeElement,
	setElProp,
	getElProp,
	setElAttr,
	getElAttr,
	setInnerText,
	getInnerText,
	setInnerHTML,
	getInnerHTML,
	disableEl,
	enableEl,
	isEnabled,
	checkRadioButton,
	uncheckRadioButton,
	isChecked,
	addClass,
	removeClass,
	setCSSVar,
	cancelEvent,
	getLSValue,
	setLSValue,
	reportError,
} from "./util.mjs";

import {
	loadDictionary,
	selectDifficulty,
	getGame,
	movesPossible,
	checkNextWord,
	scoreGame,
} from "./games.mjs";

IO.do(main).run(window).catch(reportError);


// ************************************

function *main({ window: win, document: doc, } = {}) {
	var viewContext = {
		win,
		doc,
		docEventsCaptured: null,

		// get DOM element references
		loadingEl: yield getElement("loading"),
		handHintEl: null,
		helpBtn: yield getElement("help-btn"),
		scoreEl: yield getElement("game-score"),
		messageBanner: yield getElement("message-banner"),
		helpPopupEl: yield getElement("help-popup"),
		helpCloseBtn: yield getElement("close-help-btn"),
		helpContentTabsEl: yield getElement("help-content-tabs"),
		menuToggleBtn: yield getElement("menu-toggle-btn"),
		mainMenuEl: yield getElement("main-menu"),
		playAreaEl: yield getElement("play-area"),
		playedWordsEl: yield getElement("played-words"),
		playedWordsListEl: yield getElement("played-words-list"),
		undoAllBtn: yield getElement("undo-all-btn"),
		undoBtn: yield getElement("undo-btn"),
		nextPlayEl: yield getElement("next-play"),
		playActionBtnsEl: yield getElement("play-action-buttons"),
		insertLetterBtn: yield getElement("insert-letter-btn"),
		playWordBtn: yield getElement("play-word-btn"),
		resetWordBtn: yield getElement("reset-word-btn"),
		keyboardEl: yield getElement("keyboard"),

		state: {
			score: 0,
			playMode: 0,
			maxWordLength: 0,
			playedWords: [],
			pendingNextWord: null,
			hints: {
				letterHandHintShown: false,
				keyboardHandHintShown: false,
			},
		},
	};

	// pull hints state from local-storage (if any)
	viewContext.state.hints.letterHandHintShown =
		((yield applyIO(getLSValue("letter-hand-hint-shown"),viewContext)) === "true");
	viewContext.state.hints.keyboardHandHintShown =
		((yield applyIO(getLSValue("keyboard-hand-hint-shown"),viewContext)) === "true");

	// get more DOM element references
	viewContext.difficultySelectorEls =
		yield findElements("input[name=difficulty-selector]",viewContext.mainMenuEl);
	viewContext.nextPlayFormEl = yield findElement("form",viewContext.nextPlayEl);
	viewContext.keyboardFormEl = yield findElement("form",viewContext.keyboardEl);
	viewContext.keyboardBtns = yield findElements("button",viewContext.keyboardEl);

	// run the rest of the app in this view-context
	return applyIO(IO.do(runApp),viewContext);
}

function *runApp({
	win,
	doc,
	menuToggleBtn,
	mainMenuEl,
	helpBtn,
	helpCloseBtn,
	helpContentTabsEl,
	undoAllBtn,
	undoBtn,
	insertLetterBtn,
	playWordBtn,
	resetWordBtn,
	nextPlayFormEl,
	keyboardFormEl,
	state,
}) {
	// load the word dictionary
	yield IO.do(loadDictionary);

	// compute viewport dimensions initially
	yield IO.do(computeViewportDimensions);

	// listen for screen-orientation changes,
	// which in some browsers fail to fire
	// resize events, and force re-compute
	// of viewport dimensions
	yield IO.do(listenToScreenOrientationChanges);

	// listen for window resizes and re-compute
	// the viewport dimensions, as used by the
	// CSS layout calculations
	yield doIOxBackground(computeViewportDimensions,[
		IOx.onEvent(win,"resize",{
			debounce: 75,
			maxDebounceDelay: 250
		}),
	]);

	// handle main-menu toggles
	yield doIOxBackground(onToggleMainMenu,[
		IOx.onEvent(menuToggleBtn,"click"),
	]);

	// handle help button
	yield doIOxBackground(onToggleHelp,[
		IOx.onEvent(helpBtn,"click"),
	]);

	// handle help close button
	yield doIOxBackground(closeHelp,[
		IOx.onEvent(helpCloseBtn,"click"),
	]);

	// handle help content tab switching
	yield doIOxBackground(onSwitchHelpContentTab,[
		IOx.onEvent(helpContentTabsEl,"change"),
	]);

	// handle main-menu clicks
	yield doIOxBackground(onMainMenuClicks,[
		IOx.onEvent(mainMenuEl,"click"),
	]);

	// cancel submit events from the `form` elements
	yield doIOxBackground(cancelEvent,[
		merge([
			IOx.onEvent(nextPlayFormEl,"submit"),
			IOx.onEvent(keyboardFormEl,"submit"),
		]),
	]);

	// handle undo button clicks
	yield doIOxBackground(onUndoAllWords,[
		IOx.onEvent(undoAllBtn,"click"),
	]);
	yield doIOxBackground(onUndoWord,[
		IOx.onEvent(undoBtn,"click"),
	]);

	// handle toggles of next-play letters
	yield doIOxBackground(onToggleOnNextPlayLetter,[
		IOx.onEvent(nextPlayFormEl,"change"),
	]);

	// handle clicks on any of the interactive
	// elements in the next-play-word control
	yield doIOxBackground(onNextPlayWordClicks,[
		IOx.onEvent(nextPlayFormEl,"click"),
	]);

	// handle start-insert-letter button
	yield doIOxBackground(onStartInsertLetter,[
		IOx.onEvent(insertLetterBtn,"click"),
	]);

	// handle reset-word button
	yield doIOxBackground(onResetWord,[
		IOx.onEvent(resetWordBtn,"click"),
	]);

	// handle play-word button
	yield doIOxBackground(onPlayWord,[
		IOx.onEvent(playWordBtn,"click"),
	]);

	// handle on-screen keyboard clicks
	yield doIOxBackground(onScreenKeyboardClick,[
		IOx.onEvent(keyboardFormEl,"click"),
	]);

	// handle hardware keyboard keystrokes
	yield doIOxBackground(onKeyboard,[
		IOx.onEvent(doc,"keydown",{
			debounce: 100,
			maxDebounceDelay: 500,
			evtOpts: { capture: true, },
		}),
	]);

	// start a new game
	yield IO.do(onNewGame);

	// init the play state
	yield IO.do(updatePlayMode,/*nextPlayMode=*/state.playMode);

	// show the hand-hint on the first next-play letter?
	if (!state.hints.letterHandHintShown) {
		state.hints.letterHandHintShown = true;
		yield setLSValue("letter-hand-hint-shown","true");

		let firstLetterEl = (yield findElements(".letter",nextPlayFormEl))[0];
		yield IO.do(showHandHint,firstLetterEl,{
			left: "50%",
			top: "85%",
			transform: "translateX(-50%)",
		});
	}

	// auto-popup the help?
	var hasHelpShown = ((yield getLSValue("help-shown")) === "true");
	if (!hasHelpShown) {
		yield setLSValue("help-shown","true");
		yield IO.do(onToggleHelp);
	}
}

function *onToggleMainMenu({ doc, menuToggleBtn, mainMenuEl, }) {
	// main menu currently closed?
	if (yield matches(".hidden",mainMenuEl)) {
		yield IO.do(hideMessageBanner);
		yield IO.do(closeHelp);
		yield removeClass("hidden",mainMenuEl);
		yield setElAttr("aria-hidden","false",mainMenuEl);
		yield setElAttr("aria-expanded","true",menuToggleBtn);

		// listen for doc events (outside menu) to close it
		let { all: docEvents, } =
			yield IO.do(initDocEventCapturing,/*subscribe=*/false);
		return doIOxBackground(function *onDocEvent(viewContext,evt){
			// click was NOT on the menu itself?
			if (!mainMenuEl.contains(evt.target)) {
				yield IO.do(cancelEvent,evt);
				return IO.do(closeMenu);
			}
		},[ docEvents, ]);
	}
	else {
		return IO.do(closeMenu);
	}
}

function *closeMenu(viewContext) {
	var { menuToggleBtn, mainMenuEl, } = viewContext;

	// main menu visible?
	if (yield iNot(matches(".hidden",mainMenuEl))) {
		yield addClass("hidden",mainMenuEl);
		yield setElAttr("aria-hidden","true",mainMenuEl);
		yield setElAttr("aria-expanded","false",menuToggleBtn);
		return IO.do(clearDocEventCapturing);
	}
}

function *onToggleHelp({ doc, helpBtn, helpPopupEl, }) {
	// help popup currently closed?
	if (yield matches(".hidden",helpPopupEl)) {
		yield IO.do(hideMessageBanner);
		yield IO.do(closeMenu);

		yield removeClass("hidden",helpPopupEl);
		yield setElAttr("aria-hidden","false",helpPopupEl);
		yield setElAttr("aria-expanded","true",helpBtn);

		// listen for doc events (outside help) to close it
		let { all: docEvents, } =
			yield IO.do(initDocEventCapturing,/*subscribe=*/false);
		return doIOxBackground(function *onDocEvent(viewContext,evt){
			// click was NOT on the help-popup itself?
			if (!helpPopupEl.contains(evt.target)) {
				yield IO.do(cancelEvent,evt);
				return IO.do(closeHelp);
			}
		},[ docEvents, ]);
	}
	else {
		return IO.do(closeHelp);
	}
}

function *onSwitchHelpContentTab({ helpPopupEl, helpContentTabsEl, },evt) {
	var radioEl = (yield matches("input[type=radio]",evt.target)) ? evt.target : undefined;

	// help content tab switched?
	if (radioEl) {
		let helpTabs = yield findElements("input[type=radio]",helpContentTabsEl);
		let helpContents = yield findElements("section",helpPopupEl);

		// switch aria attributes for tabs
		for (let tabEl of helpTabs) {
			yield setElAttr("aria-selected","false",tabEl);
		}
		let selectedTabEl = yield IO(() => helpTabs.find(el => el.checked));
		yield setElAttr("aria-selected","true",selectedTabEl);

		// toggle on the selected tab's content
		for (let tabContentEl of helpContents) {
			yield addClass("hidden",tabContentEl);
		}
		let selectedTabControlsID = yield getElAttr("aria-controls",selectedTabEl);
		let selectedTabContentEl = yield getElement(selectedTabControlsID);
		yield removeClass("hidden",selectedTabContentEl);
	}
}

function *closeHelp({ helpBtn, helpPopupEl, }) {
	if (!(yield matches(".hidden",helpPopupEl))) {
		yield addClass("hidden",helpPopupEl);
		yield setElAttr("aria-hidden","true",helpPopupEl);
		yield setElAttr("aria-expanded","false",helpBtn);
		return IO.do(clearDocEventCapturing);
	}
}

function *onMainMenuClicks({ mainMenuEl, },evt) {
	var target = evt.target;

	// main menu visible?
	if (yield iNot(matches(".hidden",mainMenuEl))) {
		return match(
			// clicked on close button?
			$=>matches("#close-menu-btn",target), $=>[
				onToggleMainMenu,
			],
			$=>matches("#menu-help-btn",target), $=>[
				onToggleHelp,
			],
			$=>matches("#new-game-btn",target), $=>[
				onNewGame,
			]
		);
	}
}

function *getSelectedDifficulty({ difficultySelectorEls, }) {
	var selectedDifficultyEl = yield IO(() => (
		difficultySelectorEls.find(el => el.checked)
	));
	return getElProp("value",selectedDifficultyEl);
}

function *onNewGame({
	loadingEl,
	playAreaEl,
	undoAllBtn,
	undoBtn,
	state,
}) {
	yield addClass("hidden",playAreaEl);
	yield removeClass("hidden",loadingEl);
	yield IO.do(closeMenu);

	var difficulty = yield IO.do(getSelectedDifficulty);
	yield IO.do(selectDifficulty,difficulty);
	var game = yield IO.do(getGame);

	state.maxWordLength = game[0].length;
	state.playedWords = [ game[0], ];

	// update the scoreboard
	yield IO.do(updateGameScore);

	// render the initial played-words list
	yield IO.do(renderPlayedWords);

	// render the initial next-play word
	yield IO.do(renderNextPlayWord);

	// cheating at the game (temporarily)
	console.log([ ...state.neighbors[state.pendingNextWord] ].map(obj => obj.text));

	yield addClass("hidden",loadingEl);
	yield removeClass("hidden",playAreaEl);
	yield disableEl(undoAllBtn);
	yield disableEl(undoBtn);

	return IO.do(updatePlayMode,/*nextPlayMode=*/0);
}

function *renderPlayedWords({
	playAreaEl,
	playedWordsEl,
	playedWordsListEl,
	state: {
		maxWordLength,
		playedWords,
	},
}) {
	yield removeClass("complete",playedWordsEl);
	yield setCSSVar("max-letter-count",maxWordLength,playAreaEl);
	yield setInnerHTML("",playedWordsListEl);

	for (let [idx,word] of playedWords.entries()) {
		let wordEl = yield createElement("li");
		yield addClass("word",wordEl);
		yield setElAttr("aria-label",`Word: ${word}`);

		for (let letter of word) {
			let letterEl = yield createElement("div");
			yield addClass("letter",letterEl);
			yield setElAttr("aria-hidden","true");

			let spanEl = yield createElement("span");
			yield setInnerText(letter,spanEl);
			yield appendChild(letterEl,spanEl);
			yield appendChild(wordEl,letterEl);
		}

		yield appendChild(playedWordsListEl,wordEl);
	}
}

function *renderNextPlayWord(
	{
		nextPlayEl,
		nextPlayFormEl,
		state,
		state: {
			playedWords = [],
		},
	},
	nextWord = playedWords[playedWords.length - 1],
	selectLetterIdx = -1
) {
	state.pendingNextWord = nextWord;

	yield removeClass("hidden",nextPlayEl);

	var wordEl = yield createElement("div");
	yield addClass("word",wordEl);
	yield setElAttr("aria-label",`Playing next word: ${nextWord}`,wordEl);
	for (let [idx,char] of [...nextWord].entries()) {
		let letterEl = yield createElement("div");
		yield addClass("letter",letterEl);

		let insertHereBtn = yield createElement("button");
		yield setElProp("type","button",insertHereBtn);
		yield addClass("insert-here-btn",insertHereBtn);
		yield setElAttr("aria-label",
			(idx == 0 ?
				`Insert new letter at the beginning, before '${char}'` :
				`Insert new letter between '${nextWord[idx-1]}' and '${char}'`
			),
			insertHereBtn
		);
		yield setInnerText("+",insertHereBtn);
		yield disableEl(insertHereBtn);
		yield appendChild(letterEl,insertHereBtn);

		let radioBtn = yield createElement("input");
		yield setElProp("type","radio",radioBtn);
		yield setElProp("name","next_word",radioBtn);
		yield setElProp("id",`next_word_letter_${idx}`,radioBtn);
		yield setElAttr("aria-label",`Select letter '${char}'`,radioBtn);
		if (idx == selectLetterIdx) {
			yield checkRadioButton(radioBtn);
		}
		if (selectLetterIdx != -1) {
			yield disableEl(radioBtn);
		}
		yield appendChild(letterEl,radioBtn);

		let labelEl = yield createElement("label");
		yield setElAttr("for",`next_word_letter_${idx}`,labelEl);
		yield setInnerText(char,labelEl);
		yield appendChild(letterEl,labelEl);

		let removeBtn = yield createElement("button");
		yield setElProp("type","button",removeBtn);
		yield addClass("remove-letter-btn",removeBtn);
		yield setElAttr("aria-label",`Remove the letter '${char}' from the word`,removeBtn);
		yield disableEl(removeBtn);
		yield appendChild(letterEl,removeBtn);

		if (idx == nextWord.length - 1) {
			insertHereBtn = yield createElement("button");
			yield setElProp("type","button",insertHereBtn);
			yield addClass("insert-here-btn",insertHereBtn);
			yield addClass("insert-at-end",insertHereBtn);
			yield setElAttr("aria-label",`Insert new letter at the end, after '${char}'`,insertHereBtn);
			yield disableEl(insertHereBtn);
			yield appendChild(letterEl,insertHereBtn);
		}
		yield appendChild(wordEl,letterEl);
	}

	var prevWordEl = yield findElement(".word",nextPlayFormEl);
	return IO(() => prevWordEl.replaceWith(wordEl));
}

function *onNextPlayWordClicks(viewContext,evt) {
	var evtTarget = evt.target;
	return match(
		matches("label",evtTarget), $=>[
			IO.do(onToggleOffNextPlayLetter,evt),
			closeMenu,
			scrollDownPlayArea,
		],
		$=>matches(".insert-here-btn",evtTarget), $=>[
			IO.do(onPickInsertPosition,evt),
			closeMenu,
			scrollDownPlayArea,
		],
		$=>matches(".remove-letter-btn",evtTarget), $=>[
			IO.do(onRemoveLetter,evt),
			closeMenu,
			scrollDownPlayArea,
		]
	);
}

function *updatePlayMode(
	{
		nextPlayFormEl,
		insertLetterBtn,
		playWordBtn,
		resetWordBtn,
		state,
	},
	playMode
) {
	state.playMode = playMode;

	// make sure the main menu is closed
	yield IO.do(closeMenu);

	// make sure message-banner is closed
	yield IO.do(hideMessageBanner);

	// make sure help-popup is closed
	yield IO.do(closeHelp);

	return match(
		// initial (or reset) state?
		playMode == 0, $=>[
			((state.playedWords[state.playedWords.length - 1].length >= state.maxDictWordLength) ?
				disableEl(insertLetterBtn) :
				enableEl(insertLetterBtn)
			),
			disableEl(playWordBtn),
			disableEl(resetWordBtn),
			IO.do(updateNextPlayLetters,/*enable=*/true),
			IO.do(updateInsertButtons,/*enable=*/false),
			IO.do(updateRemoveButtons,/*enable=*/false),
			IO.do(updateKeyboard,/*enable=*/false),
		],
		// letter selected?
		playMode == 1, $=>[
			disableEl(insertLetterBtn),
			disableEl(playWordBtn),
			enableEl(resetWordBtn),
			IO.do(updateNextPlayLetters,/*enable=*/true),
			IO.do(updateInsertButtons,/*enable=*/false),
			IO.do(updateRemoveButtons,/*enable=*/true),
			IO.do(updateKeyboard,/*enable=*/true),
		],
		// letter changed/inserted?
		playMode == 2, $=>[
			disableEl(insertLetterBtn),
			enableEl(playWordBtn),
			enableEl(resetWordBtn),
			IO.do(updateNextPlayLetters,/*enable=*/false),
			IO.do(updateInsertButtons,/*enable=*/false),
			IO.do(updateRemoveButtons,/*enable=*/false),
			IO.do(updateKeyboard,/*enable=*/true),
		],
		// picking letter insertion position?
		playMode == 3, $=>[
			disableEl(insertLetterBtn),
			disableEl(playWordBtn),
			enableEl(resetWordBtn),
			IO.do(updateNextPlayLetters,/*enable=*/false),
			IO.do(updateInsertButtons,/*enable=*/true),
			IO.do(updateRemoveButtons,/*enable=*/false),
			IO.do(updateKeyboard,/*enable=*/false),
		],
		// letter insertion ready
		playMode == 4, $=>[
			disableEl(insertLetterBtn),
			disableEl(playWordBtn),
			enableEl(resetWordBtn),
			IO.do(updateNextPlayLetters,/*enable=*/false),
			IO.do(updateInsertButtons,/*enable=*/false),
			IO.do(updateRemoveButtons,/*enable=*/false),
			IO.do(updateKeyboard,/*enable=*/true),
		],
		// letter removed?
		playMode == 5, $=>[
			disableEl(insertLetterBtn),
			enableEl(playWordBtn),
			enableEl(resetWordBtn),
			IO.do(updateNextPlayLetters,/*enable=*/false),
			IO.do(updateInsertButtons,/*enable=*/false),
			IO.do(updateRemoveButtons,/*enable=*/false),
			IO.do(updateKeyboard,/*enable=*/false),
		],
		// game over?
		playMode == 6, $=>[
			disableEl(insertLetterBtn),
			disableEl(playWordBtn),
			disableEl(resetWordBtn),
			IO.do(updateNextPlayLetters,/*enable=*/false),
			IO.do(updateInsertButtons,/*enable=*/false),
			IO.do(updateRemoveButtons,/*enable=*/false),
			IO.do(updateKeyboard,/*enable=*/false),
		]
	);
}

function *onToggleOnNextPlayLetter(viewContext,evt) {
	// make sure to hide the hand hint
	yield IO.do(hideHandHint);

	var radioEl = (yield matches("input[type=radio]",evt.target)) ? evt.target : undefined;

	// toggling on a letter?
	if (radioEl) {
		yield IO.do(scrollDownPlayArea);
		return IO.do(updatePlayMode,/*nextPlayMode=*/1);
	}
}

function *onToggleOffNextPlayLetter({ state, },evt) {
	// make sure to hide the hand hint
	yield IO.do(hideHandHint);

	var radioEl = yield getElement(evt.target.getAttribute("for"));

	// toggling off an already-active letter?
	if (yield iAnd(state.playMode == 1,isChecked(radioEl))) {
		yield uncheckRadioButton(radioEl);
		yield IO.do(cancelEvent,evt);
		return IO.do(updatePlayMode,/*nextPlayMode=*/0);
	}
}

function *onStartInsertLetter(viewContext) {
	// make sure to hide the hand hint
	yield IO.do(hideHandHint);

	yield IO.do(scrollDownPlayArea);
	return IO.do(updatePlayMode,/*nextPlayMode=*/3);
}

function *onPickInsertPosition({ playAreaEl, nextPlayFormEl, state, },evt) {
	var insertAtEnd = yield matches(".insert-at-end",evt.target);
	var insertIdx;
	var nextWord;

	if (insertAtEnd) {
		nextWord = `${state.pendingNextWord} `;
		insertIdx = nextWord.length - 1;
	}
	else {
		let btns = yield findElements(".letter > .insert-here-btn",nextPlayFormEl);
		insertIdx = btns.findIndex(btn => btn === evt.target);
		nextWord = `${state.pendingNextWord.slice(0,insertIdx)} ${state.pendingNextWord.slice(insertIdx)}`;
	}

	// need to update the max-word-length for
	// display layout purposes
	if (nextWord.length > state.maxWordLength) {
		yield setCSSVar("max-letter-count",nextWord.length,playAreaEl);
	}

	yield IO.do(renderNextPlayWord,nextWord,insertIdx);
	return IO.do(updatePlayMode,/*nextPlayMode=*/4);
}

function *onRemoveLetter({ nextPlayFormEl, state, },evt) {
	var letterEl = yield closest(".letter",evt.target);
	var letters = yield findElements(".letter",nextPlayFormEl);
	var removeIdx = letters.findIndex(el => el === letterEl);
	var nextWord =
		`${state.pendingNextWord.slice(0,removeIdx)}${state.pendingNextWord.slice(removeIdx+1)}`;
	yield IO.do(renderNextPlayWord,nextWord);
	return IO.do(updatePlayMode,/*nextPlayMode=*/5);
}

function *onResetWord({
	playAreaEl,
	state: {
		maxWordLength,
	}
}) {
	yield IO.do(renderNextPlayWord);
	yield setCSSVar("max-letter-count",maxWordLength,playAreaEl);
	yield IO.do(scrollDownPlayArea);
	return IO.do(updatePlayMode,/*nextPlayMode=*/0);
}

function *onPlayWord({
	playedWordsEl,
	playedWordsListEl,
	undoAllBtn,
	undoBtn,
	nextPlayEl,
	state,
}) {
	if ([ 2, 5, ].includes(state.playMode)) {
		let wordAllowed = yield IO.do(checkNextWord,state.playedWords,state.pendingNextWord);

		if (wordAllowed) {
			state.maxWordLength = Math.max(state.maxWordLength,state.pendingNextWord.length);
			state.playedWords.push(state.pendingNextWord);

			// down to a two-letter word that we can just auto-play
			// a final one-letter word from?
			if (
				state.pendingNextWord.length == 2 &&
				/[AI]/.test(state.pendingNextWord)
			) {
				state.pendingNextWord = state.pendingNextWord.replace(/[^AI]/g,"");
				state.playedWords.push(state.pendingNextWord);
			}

			yield IO.do(renderPlayedWords);

			// make sure undo/undo-all buttons are available
			if (state.playedWords.length >= 3) {
				yield enableEl(undoAllBtn);
			}
			yield enableEl(undoBtn);

			// update the scoreboard
			yield IO.do(updateGameScore);

			let moreMovedAllowed = yield IO.do(movesPossible,state.playedWords);
			if (moreMovedAllowed) {
				yield IO.do(renderNextPlayWord);
				yield IO.do(scrollDownPlayArea);
				yield IO.do(updatePlayMode,/*nextPlayMode=*/0);

				// cheating at the game (temporarily)
				console.log([ ...state.neighbors[state.pendingNextWord] ].map(obj => obj.text));
			}
			else {
				yield addClass("complete",playedWordsEl);
				yield addClass("hidden",nextPlayEl);
				let nextPlayWordEl = yield findElement(".word",nextPlayEl);
				yield setElAttr("aria-label","",nextPlayWordEl);
				yield setInnerHTML("",nextPlayWordEl);
				yield IO.do(scrollDownPlayArea);
				yield IO.do(updatePlayMode,/*nextPlayMode=*/6);
				let gameOverMsg = `Score: ${state.score}%<br>${
					(state.score == 100) ? "Awesome!" : "Undo moves and try again?"
				}`;
				return IO.do(showMessageBanner,gameOverMsg);
			}
		}
		else {
			return IO.do(showMessageBanner,"Not Allowed");
		}
	}
}

function *onUndoAllWords({
	playedWordsEl,
	undoAllBtn,
	undoBtn,
	nextPlayEl,
	state,
}) {
	if (state.playedWords.length > 1) {
		state.playedWords.length = 1;

		// update the scoreboard
		yield IO.do(updateGameScore);

		state.maxWordLength = state.playedWords[state.playedWords.length - 1].length;

		yield disableEl(undoAllBtn);
		yield disableEl(undoBtn);

		// if the game was complete, make sure
		// to undo the associated styling
		yield removeClass("complete",playedWordsEl);
		yield removeClass("hidden",nextPlayEl);

		// re-render the playable game area
		yield IO.do(renderPlayedWords);
		yield IO.do(renderNextPlayWord);
		yield IO.do(scrollDownPlayArea);

		return IO.do(updatePlayMode,/*nextPlayMode=*/0);
	}
}

function *onUndoWord({
	playedWordsEl,
	undoAllBtn,
	undoBtn,
	nextPlayEl,
	state,
}) {
	if (state.playedWords.length > 1) {
		state.playedWords.pop();

		// update the scoreboard
		yield IO.do(updateGameScore);

		// re-compute the max word length
		let maxWordLength = 0;
		for (let word of state.playedWords) {
			if (word.length > maxWordLength) {
				maxWordLength = word.length;
			}
		}
		state.maxWordLength = maxWordLength;

		// need to disable the undo/undo-all buttons now?
		if (state.playedWords.length <= 2) {
			yield disableEl(undoAllBtn);

			if (state.playedWords.length == 1) {
				yield disableEl(undoBtn);
			}
		}

		// if the game was complete, make sure
		// to undo the associated styling
		yield removeClass("complete",playedWordsEl);
		yield removeClass("hidden",nextPlayEl);

		// re-render the playable game area
		yield IO.do(renderPlayedWords);
		yield IO.do(renderNextPlayWord);
		yield IO.do(scrollDownPlayArea);

		return IO.do(updatePlayMode,/*nextPlayMode=*/0);
	}
}

function *onScreenKeyboardClick(viewContext,evt) {
	var keyboardBtn = (yield matches("#keyboard > form > button",evt.target)) ? evt.target : undefined;
	if (keyboardBtn) {
		let letter = yield getInnerText(keyboardBtn);
		yield IO.do(setLetter,letter);
		return IO.do(scrollDownPlayArea);
	}
}

function *onKeyboard(viewContext,evt) {
	if (/^[a-z]$/i.test(evt.key)) {
		yield IO.do(setLetter,evt.key);
		return IO.do(scrollDownPlayArea);
	}
}

function *setLetter({ nextPlayFormEl, state, },letter) {
	if ([ 1, 2, 4 ].includes(state.playMode)) {
		let checkedRadioEl = yield findElement("input[type=radio]:checked",nextPlayFormEl);
		if (checkedRadioEl) {
			let letterEl = yield closest(".letter",checkedRadioEl);
			let letters = yield findElements(".letter",nextPlayFormEl);
			let updateIdx = letters.findIndex(el => el === letterEl);
			let nextWord =
				`${state.pendingNextWord.slice(0,updateIdx)}${letter.toUpperCase()}${state.pendingNextWord.slice(updateIdx+1)}`;
			yield IO.do(renderNextPlayWord,nextWord,updateIdx);
			return IO.do(updatePlayMode,/*nextPlayMode=*/2);
		}
	}
}

function *updateElements(viewContext,elems,enable = true) {
	for (let el of elems) {
		if (enable) {
			yield enableEl(el);
		}
		else {
			yield disableEl(el);
		}
	}
}

function *updateNextPlayLetters({ nextPlayFormEl, },enable = true) {
	var radioEls = yield findElements("input[type=radio]",nextPlayFormEl);
	return IO.do(updateElements,radioEls,enable);
}

function *updateInsertButtons({ nextPlayFormEl, },enable = true) {
	var buttons = yield findElements("button.insert-here-btn",nextPlayFormEl);
	return IO.do(updateElements,buttons,enable);
}

function *updateRemoveButtons({ nextPlayFormEl, },enable = true) {
	var buttons = yield findElements("button.remove-letter-btn",nextPlayFormEl);
	return IO.do(updateElements,buttons,enable);
}

function *updateKeyboard({ keyboardBtns, state, },enable) {
	// make sure any previous hand hint has been hidden
	yield IO.do(hideHandHint);

	// should we show the hand hint on the keyboard?
	if (enable && !state.hints.keyboardHandHintShown) {
		state.hints.keyboardHandHintShown = true;
		yield setLSValue("keyboard-hand-hint-shown","true");

		let aKeyEl = keyboardBtns[10];
		yield IO.do(showHandHint,aKeyEl,{
			left: "50%",
			top: "85%",
			transform: "translateX(-50%)",
		});
	}

	return IO.do(updateElements,keyboardBtns,enable);
}

function *scrollDownPlayArea({ playAreaEl, }) {
	return setElProp("scrollTop",1E9,playAreaEl);
}

function *showMessageBanner({ doc, messageBanner, },message) {
	yield setInnerHTML(message,messageBanner);
	yield setElAttr("aria-live","polite",messageBanner);
	if (yield matches(".hidden",messageBanner)) {
		yield removeClass("hidden",messageBanner);

		// doc events close the message banner
		let { all: docEvents, } =
			yield IO.do(initDocEventCapturing,/*subscribe=*/true);
		return doIOxBackground(hideMessageBanner,[ docEvents, ]);
	}
}

function *hideMessageBanner({ messageBanner, }) {
	if (!(yield matches(".hidden",messageBanner))) {
		yield addClass("hidden",messageBanner);
		yield setElAttr("aria-live","off",messageBanner);
		return setInnerHTML("",messageBanner);
	}
}

function *updateGameScore({ scoreEl, state, }) {
	if (state.playedWords.length > 1) {
		yield setElAttr("aria-live","polite",scoreEl);
		state.score = yield IO.do(scoreGame,state.playedWords);
		if (state.score > 85) {
			yield addClass("good",scoreEl);
		}
		else {
			yield removeClass("good",scoreEl);
		}
		return setInnerText(`${state.score}%`,scoreEl);
	}
	else {
		yield setElAttr("aria-live","off",scoreEl);
		yield removeClass("good",scoreEl);
		return setInnerText("",scoreEl);
	}
}

function *showHandHint(viewContext,targetEl,position = {}) {
	// (re)create element (to reset any style positioning)
	viewContext.handHintEl = yield createElement("div");
	yield setElProp("id","hand-hint",viewContext.handHintEl);
	yield appendChild(targetEl,viewContext.handHintEl);

	// set inline style positioning props (if any)
	for (let [ styleProp, val ] of Object.entries(position)) {
		yield IO(() => viewContext.handHintEl.style[styleProp] = val);
	}
}

function *hideHandHint(viewContext) {
	if (viewContext.handHintEl) {
		yield removeElement(viewContext.handHintEl);
	}
}

function *initDocEventCapturing(viewContext,subscribe = true) {
	if (!viewContext.docEventsCaptured) {
		// listen for all clicks/keyboard events on document
		// (in capturing phase)
		let evts = {
			click: IOx.onEvent(viewContext.doc,"click",{
				evtOpts: { capture: true, },
			}),
			keydown: (
				IOx.onEvent(viewContext.doc,"keydown",{
					evtOps: { capture: true, },
				})
				.chain(filterIn(evt => evt.key == "Escape"))
			),
			all: null,
		};
		evts.all = merge([ evts.click, evts.keydown, ]);
		if (subscribe) {
			yield doIOxBackground(clearDocEventCapturing,[ evts.all, ]);
		}
		viewContext.docEventsCaptured = evts;
	}
	return viewContext.docEventsCaptured;
}

function *clearDocEventCapturing(viewContext,evt) {
	if (viewContext.docEventsCaptured) {
		// hack to defer asynchronously
		yield Promise.resolve();

		// quit listening for click/keyboard events
		yield IO(({ docEventsCaptured: { click, keydown, all, }, }) => {
			click.close();
			keydown.close();
			all.close();
		});
		viewContext.docEventsCaptured = null;
	}
}

// compute the vw/vh units more reliably than CSS does itself
function *computeViewportDimensions({ doc, }) {
	var docEl = doc.documentElement;
	var width = Math.max(300,docEl.clientWidth);
	var height = Math.max(300,docEl.clientHeight);
	yield setCSSVar("vw-unit",`${(width / 100).toFixed(1)}px`,docEl);
	yield setCSSVar("vh-unit",`${(height / 100).toFixed(1)}px`,docEl);
	return IO.do(scrollDownPlayArea);
}

function *listenToScreenOrientationChanges(viewContext) {
	var computeCB = doIOBind(computeViewportDimensions,viewContext);
	var { win, } = viewContext;

	// work-arounds for browsers that don't fire "resize" when
	// the orientation changes
	// ref: https://developer.mozilla.org/en-US/docs/Web/API/
	//    ScreenOrientation/onchange
	if (
		typeof win.screen != "undefined" &&
		typeof win.screen.orientation != "undefined"
	) {
		win.screen.orientation.addEventListener("change",computeCB,false);
	}
	// ref: https://www.reddit.com/r/javascript/comments/lttxdy/js_workaround_for_
	//    fixing_how_css_vwvh_units_arent/gp61ghe/
	// ref: https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/matches
	else if (typeof win.matchMedia != "undefined") {
		let query = win.matchMedia("(orientation: landscape)");

		// handle variances in the event handling in various older browsers
		if (typeof query.addEventListener != "undefined") {
			query.addEventListener("change",computeCB,false);
		}
		else if (typeof query.addListener != "undefined") {
			query.addListener(computeCB);
		}
		else {
			query.onchange = computeCB;
		}
	}
}
