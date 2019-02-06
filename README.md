# Factorio Calculator

This is the repostory for the [Factorio Calculator](https://kirkmcdonald.github.io/calc.html), a tool for calculating resource requirements and production ratios in the game [Factorio](https://factorio.com/).

## Running locally

The calculator consists entirely of static files (HTML, JS, CSS), and may be run locally using any HTTP server. If you have Python 3 installed, you can start a simple development server on port 8000 with:

```text
$ python3 -m http.server 8000
```

An experimental standalone version of the calculator named `factoriocalc`, which will automatically obtain the game data from your locally installed mods, is also available from the [factorio-tools](https://github.com/KirkMcDonald/factorio-tools) repository. A Windows build is available from [the project's releases page](https://github.com/KirkMcDonald/factorio-tools/releases).

## Dumping new datasets

The utility for dumping datasets from the game, as well as assembling the sprite sheets, is called `factoriodump`, and may be found in the [factorio-tools](https://github.com/KirkMcDonald/factorio-tools) repository.

## Support the calculator

Please consider donating to [my Patreon campaign](https://www.patreon.com/kirkmcdonald). Any amount helps. And thank you!
