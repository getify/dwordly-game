# Dwordly

Dwordly (Dwindling **Wordle**) is a flip-twist of the famous viral game. In Dwordly, you dwindle words down to the shortest possible!

----
----

**[Play Here](https://dwordly.fun)**

----
----

## Game Concept

You are given the start word. For each move:

1. Flip one letter to a different letter
2. Remove a letter
3. Insert a letter

Each move has to result in a real word! To score better, dwindle down to the shortest word *and path* possible.

## Scoring Strategies

The goal is to get both the shortest final word (ideally, one character, like `A` or `I`), but also the shortest path (fewest number of words) to that final short word.

As such, your scoring strategy has to balance these (sometimes competing) goals. For example, you may score more for a path that ends in the word "OR" than if you continued the path from "OR" to "ON" to "AN" to "A". Even though the single letter word is a main goal of the game, adding 3 extra moves to get there may not provide a better outcome.

You'll also score more for a path that prioritizes dwindling down to shorter words more quickly, as opposed to a path with several subsequent words of the same length (like 3 or 4), where each word was a letter swap to different word. The downside, of course is, if you quickly dwindle down to a 3-letter or 4-letter word, you may have limited yourself in terms of further path moves.

## Undo

You're allowed one undo per game. But if you flip on **EASY** mode, you get unlimited undos.

## Example Games

```
B O U N D

B O N D

B A N D

A N D

A D

A
```

You may get a little stuck; perhaps add a letter to jump to a different dwindling word path:

```
S P E C K

P E C K

P I C K

I C K

I C E

A C E        <-- stuck!?

P A C E      <-- add a letter

P A L E

P A L

P A T

A T

A
```

But if you'd only *seen it*, the above game *could* have been played with 6 fewer moves and a much better score!

```
S P E C K

P E C K

P E A K

P E A

P A

A
```

## License

[![License](https://img.shields.io/badge/license-MIT-a1356a)](LICENSE.txt)

All code and documentation are (c) 2022 Kyle Simpson and released under the [MIT License](http://getify.mit-license.org/). A copy of the MIT License [is also included](LICENSE.txt).
