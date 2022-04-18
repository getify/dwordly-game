import IO from "monio/io";
import {
	applyIO,
	doIOBind,
	match,
	matchReturned,
	iReturn,
	iAnd,
} from "monio/io/helpers";
import IOx from "monio/iox";
import {
	merge,
} from "monio/iox/helpers";

import {
	requestJSON,
} from "./util.mjs";

export {
	loadDictionary,
	loadDifficulty,
	getGame,
	movesPossible,
	checkNextWord,
	scoreGame,
};


// *******************************************

function *loadDictionary({ state, }) {
	if (!state.dict) {
		state.dict = yield requestJSON("/dictionary.json");
		state.neighbors = findAllNeighbors(state.dict);
		state.maxDictWordLength = 0;
		for (let { text: word, } of state.dict) {
			if (word.length > state.maxDictWordLength) {
				state.maxDictWordLength = word.length;
			}
		}
	}
}

function *loadDifficulty({ state, },difficulty) {
	state.games = yield matchReturned(match(
		difficulty == "easy", $=>iReturn(requestJSON("/easy.json")),
		difficulty == "medium", $=>iReturn(requestJSON("/medium.json")),
		difficulty == "hard", $=>iReturn(requestJSON("/hard.json"))
	));

	// compute min/max difficulties for this level
	state.minDifficultyRating = Infinity;
	state.maxDifficultyRating = 0;
	for (let game of state.games) {
		if (game[1] < state.minDifficultyRating) {
			state.minDifficultyRating = game[1];
		}
		if (game[1] > state.maxDifficultyRating) {
			state.maxDifficultyRating = game[1];
		}
	}
}

function *getGame({ state, }) {
	var { neighbors, games, } = state;
	var gameIdx = Math.round(Math.random() * 1E9) % games.length;
	var game = games[gameIdx];
	state.difficultyRating = game[1];
	state.optimalPath = yield IO.do(findShortestPath,game[0]);
	return game;
}

function *movesPossible({ state: { optimalPath, neighbors, }, },playedWords) {
	var mostRecentWord = playedWords[playedWords.length - 1];

	// already at a single-letter word?
	if (
		// already at a single-letter word?
		mostRecentWord.length == 1 ||

		// too many words played already?
		playedWords.length > (optimalPath.length + 4)
	) {
		return false;
	}

	// check all neighbor words to see if any can be
	// played?
	for (let { text: nextWord } of neighbors[mostRecentWord]) {
		// found an available (not already used) word
		// to play?
		if (!playedWords.includes(nextWord)) {
			return true;
		}
	}
	return false;
}

function *checkNextWord({ state: { neighbors, }, },words,nextWord) {
	var nextWords = [ ...neighbors[words[words.length - 1]] ].map(obj => obj.text);
	return (!words.includes(nextWord) && nextWords.includes(nextWord));
}

function *scoreGame(
	{
		state: {
			optimalPath,
			difficultyRating,
			minDifficultyRating,
			maxDifficultyRating,
		},
	},
	fullGame
) {
	var playScores = [];
	var difficultyFactor =
		(difficultyRating - minDifficultyRating) / (maxDifficultyRating - minDifficultyRating);

	// compute cummulative score percentage for each word in the game
	for (let i = 1; i <= fullGame.length; i++) {
		let game = fullGame.slice(0,i);
		let score = 0;

		// 65% of the score: overall character count
		let gameTotalCharCount = game.join("").length;
		let optimalTotalCharCount = optimalPath.join("").length;
		score += Math.min(65,(65 * (optimalTotalCharCount / gameTotalCharCount)));

		// 20% of the score: length of the dwordly path
		score += (20 * (
			Math.min(game.length,optimalPath.length) /
			Math.max(game.length,optimalPath.length)
		));

		// 15% of the score: length of final word
		var gameFinalWordLength = game[game.length - 1].length;
		var optimalFinalWordLength = optimalPath[optimalPath.length - 1].length;
		score += Math.min(15,(15 * optimalFinalWordLength / gameFinalWordLength));

		// scale the raw score by the difficulty-factor
		score = score * (1 - ((100 - score) * (1 - difficultyFactor) / 100));

		// drop any decimal places
		playScores.push(Math.floor(score));
	}

	return playScores;
}

function *findShortestPath({ state: { neighbors, }, },startingWord) {
	var queue = [
		[ null, startingWord, startingWord.length ]
	];
	var pathCharCounts = {
		[startingWord]: startingWord.length,
	};
	var backtrace = {};
	var bestPathCharCount = Infinity;
	var terminalWordPathCharCount = Infinity;
	var terminalWord = startingWord;

	while (queue.length > 0) {
		let [ prevWord, nextWord, pathCharCount ] = queue.shift();

		// candidate path is shorter than the best
		// candidate path already identified (if any)?
		if (pathCharCount < bestPathCharCount) {
			if (
				// found a shorter terminal word?
				nextWord.length < terminalWord.length ||

				(
					// same length terminal word?
					nextWord.length == terminalWord.length &&

					// ...on a shorter overall path?
					pathCharCount < terminalWordPathCharCount
				)
			) {
				terminalWord = nextWord;
				terminalWordPathCharCount = pathCharCount;
			}

			// found a best-path candidate ending in a
			// single-letter word?
			if (nextWord.length == 1) {
				terminalWord = nextWord;
				bestPathCharCount = terminalWordPathCharCount = pathCharCount;
				continue;
			}

			// any neighbors of current word to consider?
			if (neighbors[nextWord]) {
				for (let { text: neighbor } of neighbors[nextWord]) {
					// prevent a cyclic back-track to the
					// previous word
					if (neighbor != prevWord) {
						// not yet previously computed the
						// a path-character-length to this
						// neighbor word?
						if (!pathCharCounts[neighbor]) {
							pathCharCounts[neighbor] = Infinity;
						}
						// compute current path-character
						// length to this neighbor word
						let neighborPathCharCount = pathCharCounts[nextWord] + neighbor.length;
						if (neighborPathCharCount < pathCharCounts[neighbor]) {
							pathCharCounts[neighbor] = neighborPathCharCount;
							backtrace[neighbor] = nextWord;
							insertIntoQueue(nextWord,neighbor,neighborPathCharCount);
						}
					}
				}
			}
			// because it's a priority queue, once this
			// is true, we can bail
			else if (pathCharCount > bestPathCharCount) {
				break;
			}
		}
	}

	var path = [ terminalWord ];
	var word = terminalWord;
	while (word != startingWord) {
		word = backtrace[word];
		path.unshift(word);
	}
	return path;

	// *****************************

	function insertIntoQueue(prevWord,nextWord,pathCharCount) {
		let insertIdx = queue.length;
		for (let i = 0; i < queue.length; i++) {
			let [ ,, entryPathCharCount, ] = queue[i];
			if (entryPathCharCount > pathCharCount) {
				insertIdx = i;
				break;
			}
		}
		queue.splice(insertIdx,0,[ prevWord, nextWord, pathCharCount, ]);
	}
}

function findAllNeighbors(dict) {
	var neighbors = {};
	var meta = {};
	var patternEntries = {};
	var wordPatterns = [];

	for (let i = 0; i < dict.length; i++) {
		let word = dict[i] = { text: dict[i] };
		if (!neighbors[word.text]) {
			neighbors[word.text] = new Set();
		}
		if (!meta[word.text]) {
			meta[word.text] = new Set();
		}

		// generate all the letter-switch and letter-removal
		// patterns for this word
		wordPatterns.length = 0;
		for (let i = 0; i < word.text.length; i++) {
			let patternTexts = [
				`${word.text.substring(0,i)}_${word.text.substring(i+1)}`,
				`${word.text.substring(0,i)}${word.text.substring(i+1)}`
			];
			for (let text of patternTexts) {
				wordPatterns[wordPatterns.length] = patternEntries[text] || { text, };
			}
		}

		// does this word match a pattern for another
		// (previous) word?
		for (let mp of meta[word.text]) {
			if (neighbors[mp.text]) {
				neighbors[word.text].add(mp);
				neighbors[mp.text].add(word);
			}
		}

		// store this word's patterns, and look for any
		// matches to other words
		for (let pattern of wordPatterns) {
			if (!meta[pattern.text]) {
				meta[pattern.text] = new Set();
			}
			meta[pattern.text].add(word);
			meta[word.text].add(pattern);

			// is pattern the same as an already known word?
			if (neighbors[pattern.text]) {
				neighbors[pattern.text].add(word);
				neighbors[word.text].add(pattern);
			}

			// is this pattern shared with any other word?
			for (let mp of meta[pattern.text]) {
				if (
					neighbors[mp.text] &&
					mp.text != word.text &&
					pattern.text.length == word.text.length &&
					mp.text.length == word.text.length
				) {
					neighbors[mp.text].add(word);
					neighbors[word.text].add(mp);
				}
			}
		}
	}

	return neighbors;
}
