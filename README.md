# Bored in Class

A single-page collection of "look-busy" mini games — Wordle (with a solver
bot), a typing speed test, chess puzzles, a Curveball-style 3D pong,
Klondike solitaire, four-player Spades against bots, a Seterra-style
map quiz (continents to start, room for more levels), a Letter Boxed
word puzzle (4 sides × 3 letters, with generated always-2-solveable
rounds), and a reaction-time tester. Vanilla HTML / CSS / JS — no
build step, no dependencies. Regenerate the optional word list with
`node scripts/build-letterbox-words.cjs` if you want to refresh it.

## Features

- **Wordle** — full game with 6 guesses, animated tile flips, color-coded
  on-screen and physical keyboard, win/lose detection, give-up button.
- **Inline stats** — played, win %, current and max streak, and guess
  distribution, shown directly on the Wordle page.
- **Wordle bot** (always on the Wordle tab, below stats) — information-theoretic analysis:
  - Expected info (Shannon entropy) of each guess over the current
    answer pool.
  - Per-guess **skill** (your expected info ÷ optimal expected info) and
    **luck** (actual info gained − expected info).
  - Top-N optimal alternatives for each guess.
  - Suggests the best next word while the game is still in progress.
  - Final summary with average skill and total luck.
- **Typing speed test** — 15 / 30 / 60 second timed test with live WPM,
  accuracy, color-coded errors, and best score saved per duration.
- **Chess puzzles** — 20 hand-verified mate-in-1 and mate-in-2 positions
  (back-rank, Anastasia's-style, smothered, supported queen, Philidor's,
  lawnmower, two-rook ladder, and several king-and-queen corner mates).
  Puzzles are randomized each session. Click-to-move with a hint button,
  "show solution" replay, and persistent solved-count + best streak.
- **Curveball** — pseudo-3D pong with mouse-controlled paddle, an AI
  opponent, off-center hits add curve via spin, first to 5 wins.
- **Klondike solitaire** — full 52-card Klondike: stock, waste, four
  foundations, seven tableau piles. Drag cards (or stacks) to move them,
  or click to select then click a destination. Double-click sends a
  card straight to its foundation. Easy / Hard mode toggle deals 1 or
  3 from the stock; in hard mode the waste fans the last 3 cards with
  only the top card in play. Wins counter persists.
- **Spades** — 4-player partnership trick-taking against three bots.
  Bid the tricks you'll take (including Nil), follow suit, spades are
  trump and can't lead until "broken". Bots use a simple bidding
  heuristic and play to support their partner. Standard scoring with
  bags, 10-bag penalty, and Nil bonuses. First team to 500 wins.
- **Map quiz** — find the named continent on a stylized world map; wrong
  clicks are labeled and the streak resets. Score includes a small streak
  bonus; best streak is saved. Data is set up to add more levels (e.g.
  countries) without rewriting the game loop.
- **Letter Boxed** — type or click a path around a square of 12 letters
  (3 per side), submit words of 3+ letters from the list, and never use two
  consecutive letters from the same side (including the join between
  words). Puzzles are **generated** to always include a valid **two-word**
  solution. Tracks how often you clear a board in 2.
- **Reaction time** — quick side game; remembers your best time.
- **Light / dark theme** toggle, saved across sessions.
- **Tab** / **Shift+Tab** cycles between games.

## How to run

Just open `index.html` in a browser. There's no install step.

```text
bored-in-class/
├── index.html      # markup
├── styles.css      # themes, Wordle, stats, bot, …, map quiz
├── words.js        # Wordle answer + valid-guess word lists
├── bot.js          # entropy-based Wordle solver + skill/luck UI
├── games.js        # typing test, chess, curveball, Klondike solitaire, spades
├── map-quiz.js     # Seterra-style map quiz (continents, extensible)
├── letterbox-words.js  # 3-8 letter word list (see scripts/build-…cjs)
├── letterboxed.js  # NYT-style Letter Boxed + 2-solve generator
├── app.js          # tabs, theming, Wordle game logic, reaction game
├── scripts/        # optional: build / debug letterbox word list
└── README.md
```

## Keyboard shortcuts

| Key             | Action                                |
| --------------- | ------------------------------------- |
| A–Z             | Type a Wordle letter / typing test    |
| Enter           | Submit Wordle guess                   |
| Backspace       | Delete last letter                    |
| Tab / Shift+Tab | Switch between games                  |

## Notes

- Stats, best scores, and the in-progress Wordle game are saved to
  `localStorage`, so a refresh won't lose your progress.
- The chess puzzles are hand-verified — only the puzzle's exact solution
  move is accepted; "Hint" highlights the right piece, "Show solution"
  plays it through.
- The Curveball ball curves over time when you hit it off-center; centered
  hits send it straight back.
