# Water Way

An interactive charity: water inspired browser game built with plain HTML, CSS, and JavaScript. Pour from the blue zone, guide the water down the course, and fill the jerrycan before your limited supply runs out.

## Features

- Water physics on a canvas, running at a fixed rate so it plays the same on 60 Hz and 120 Hz screens
- Limited water per level: lose too much to the sand and the level fails
- 12 hand-built levels that teach one idea at a time:
  - **Easy** – ramps, switchbacks, and choosing where to pour
  - **Medium** – one moving part per level: trapdoor, moving can, switch, sliding bridge
  - **Hard** – smaller can, narrower pour zone, and moving parts combined, so you must pour in timed bursts
- Random courses that get harder as you win and easier when you fail; each one is test-poured before you play it so it is always beatable
- Star rating, sound effects, milestones, win and out-of-water screens
- Responsive layout for desktop and mobile

## Demo
Visit at https://sarimm6.github.io/charitywater/

## How to Run

1. Open `index.html` in a browser, or
2. Serve the folder with a local static server and open the page there.

If you want a quick local server, one simple option is:

```bash
python3 -m http.server
```

Then visit `http://localhost:8000` in your browser.

## Controls

- Press and hold inside the blue **POUR HERE** zone to pour water
- Release to stop pouring – on later levels, pour in short bursts timed to the moving parts
- Use the difficulty buttons to switch courses
- Use the reset button to restart the current level
- Jump straight to a level with a link such as `index.html#hard-3` or `index.html#random`

## Project Files

- `index.html` - page structure and game UI
- `style.css` - layout, colors, and responsive styling
- `game-core.js` - level data and water physics (no DOM, also runs in Node)
- `script.js` - rendering, input, scoring, and UI
- `tools/simulate.js` - headless level checker (see below)

## Checking levels

`tools/simulate.js` plays every level without a browser. For each level it measures how much water reaches the can when you hold the pour button, and when you pour in bursts timed to the level's moving parts. It reports levels that cannot be won, hard levels that can be won without timing, and timing windows that are too tight. It also checks a batch of random courses.

```bash
node tools/simulate.js            # every level, plus random courses
node tools/simulate.js hard       # one difficulty
node tools/simulate.js hard 2     # one level (0-based index)
```

Run it after changing a level or the physics constants.

## Credits

Inspired by the work of [charity: water](https://www.charitywater.org/).
