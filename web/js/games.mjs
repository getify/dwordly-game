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
	selectDifficulty,
	getGame,
	checkNextWord,
	scoreGame,
};


// *******************************************

function *loadDictionary({ state, }) {
	if (!state.dict) {
		state.dict = yield requestJSON("/dictionary.json");
		state.neighbors = findAllNeighbors(state.dict);
	}
}

function *selectDifficulty({ state, },difficulty) {
	state.games = yield matchReturned(match(
		difficulty == "easy", $=>iReturn(requestJSON("/easy.json")),
		difficulty == "medium", $=>iReturn(requestJSON("/medium.json")),
		difficulty == "hard", $=>iReturn(requestJSON("/hard.json"))
	));
}

function *getGame({ state: { neighbors, games, }, }) {
	var gameIdx = Math.round(Math.random() * 1E9) % games.length;

	// cheating at the game (temporarily)
	console.log( yield IO.do(findShortestPath,games[gameIdx][0]) );

	return games[gameIdx];
}

function *checkNextWord({ state: { neighbors, }, },words,nextWord) {
	var nextWords = [ ...neighbors[words[words.length - 1]] ].map(obj => obj.text);
	return (!words.includes(nextWord) && nextWords.includes(nextWord));
}

function scoreGame(game) {
	return 10;
}

function *findShortestPath({ state: { neighbors, }, },word) {
	var shortestWord = word;
	var pathTree = {};

	// localized scope block (for scope clarity)
	{
		let visited = new Set([ word ]);
		let queue = [ word ];

		// breadth-first traversal of word neighbors
		while (queue.length > 0) {
			let nextWord = queue.shift();

			// keep track of the shortest word we find
			// during the traversal
			if (nextWord.length < shortestWord.length) {
				shortestWord = nextWord;
			}

			for (let { text: neighbor } of neighbors[nextWord]) {
				// haven't seen (queued up) this word
				// yet?
				if (!visited.has(neighbor)) {
					// record path from this neighbor back
					// to the previous word
					pathTree[neighbor] = nextWord;

					// queue this word up for further
					// inspection
					queue[queue.length] = neighbor;

					// mark this word as having been
					// queued up for further inspection
					visited.add(neighbor);
				}
			}
		}
	}

	// localized scope block (for scope clarity)
	{
		// traverse the discovered paths in reverse
		// from shortest-found word back up to target
		// word
		let shortestPath = [];
		let pathWord = shortestWord;
		while (pathTree[pathWord]) {
			shortestPath[shortestPath.length] = pathWord;
			pathWord = pathTree[pathWord];
		}
		shortestPath.push(pathWord);

		// reverse the traversal path so it now
		// starts with the target word and moves
		// down toward the shortest-found word
		return shortestPath.reverse();
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
