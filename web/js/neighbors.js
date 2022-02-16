"use strict";

var dict = [
	"a",
	"able",
	"abled",
	"ably",
	"ah",
	"am",
	"amp",
	"an",
	"and",
	"any",
	"ap",
	"at",
	"bach",
	"back",
	"bah",
	"bam",
	"ban",
	"band",
	"bang",
	"bank",
	"beach",
	"bind",
	"cable",
	"cam",
	"camp",
	"can",
	"cap",
	"damn",
	"dance",
	"dang",
	"dank",
	"damp",
	"ding",
	"find",
	"lamp",
];

var neighbors = {};

buildNeighbors();
// printNeighbors();
// var allPaths = findAllPaths("beach");
// console.log(allPaths);

var shortestPath = findShortestPath("beach");
console.log(shortestPath);


// *******************************************

function findShortestPath(word) {
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

			// consider the neighbors of current word
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

function findAllPaths(word) {
	var paths = [];

	// localized scope block (for scope clarity)
	{
		let stack = [ [ word ] ];
		while (stack.length > 0) {
			let subpath = stack.pop();
			let nextWord = subpath[subpath.length - 1];

			// is current path already (likely) too long?
			if (subpath.length >= 12) {
				// bail on current path
				continue;
			}
			// did we find a single-letter word?
			else if (nextWord.length == 1) {
				paths.push(optimizePath(subpath));
				continue;
			}

			let insertStackEntries = [];

			// consider the neighbors of current word
			for (let { text: neighbor } of neighbors[nextWord]) {
				// haven't seen (queued up) this word
				// yet?
				if (!subpath.includes(neighbor)) {
					insertStackEntries[insertStackEntries.length] = [ ...subpath, neighbor ];
				}
			}

			// do we have any neighbors to traverse?
			if (insertStackEntries.length > 0) {
				for (let i = insertStackEntries.length - 1; i >= 0; i--) {
					stack[stack.length] = insertStackEntries[i];
				}
			}
			// otherwise, we reached the end of a path
			else {
				// save this subpath into the overall
				// paths list
				paths.push(optimizePath(subpath));
			}
		}
	}

	// remove duplicate paths
	var pathsSet = new Set();
	var allPaths = [];
	for (let path of paths) {
		let pathStr = path.join();
		if (!pathsSet.has(pathStr)) {
			pathsSet.add(pathStr);
			allPaths[allPaths.length] = path;
		}
	}

	// sort from shortest to longest paths
	allPaths.sort((p1,p2)=>{
		if (p1[p1.length-1].length < p2[p2.length-1].length) return -1;
		else if (p1[p1.length-1].length > p2[p2.length-1].length) return 1;
		else return (p1.length - p2.length);
	});

	return allPaths;

	// ****************************

	function optimizePath(path) {
		var shortestWordLen = path[0].length;
		var shortestWordIdx = 0;
		for (let i = 1; i < path.length; i++) {
			// current word shorter than the previous one?
			if (path[i].length < shortestWordLen) {
				shortestWordLen = path[i].length;
				shortestWordIdx = i;
			}
		}
		// shortest word found was NOT at the end of
		// the path (thus need to truncate)?
		if (shortestWordIdx < path.length - 1) {
			return path.slice(0,shortestWordIdx + 1);
		}
		return path;
	}
}

function printNeighbors() {
	for (let [ word, neighborList ] of Object.entries(neighbors)) {
		let wordNeighbors = [ ...neighborList ].map(v => v.text);
		console.log(word,wordNeighbors);
	}
}

function buildNeighbors() {
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

		// single letter word (no analysis needed)?
		if (word.text.length == 1) {
			continue;
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
}
