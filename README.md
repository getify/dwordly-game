# Dwirdle

Dwirdle (Dwindling **Wordle**... or [this](https://www.urbandictionary.com/define.php?term=Dwirdle) 😂) is a flip-twist of the viral famous game. In this game, words dwindle down to the shortest possible!

## Game Concept

You are given the start word. For each move:

1. Flip one letter to a different letter
2. Remove a letter
3. Insert a letter

Each move has to result in a real word! To score better, dwindle down to the shortest word *and path* possible.

## Undo

You get one undo per game. But if you flip on **EASY** mode, you get unlimited undos.

## Example Games

```
B O U N D

B O N D

B I N D

B I N

I N

I
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

If you'd only seen it, the above game *could* have been played with 5 fewer moves and a much better score!

```
S P E C K

P E C K

P A C K

P A C T

P A T

A T

A
```

## License

[![License](https://img.shields.io/badge/license-MIT-a1356a)](LICENSE.txt)

All code and documentation are (c) 2022 Kyle Simpson and released under the [MIT License](http://getify.mit-license.org/). A copy of the MIT License [is also included](LICENSE.txt).
