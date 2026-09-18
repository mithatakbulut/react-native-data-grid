# Screenshot regression

Pinned-column screenshot flows live in `e2e/maestro/screenshots/`. They capture three positions per
scenario:

1. Initial grid
2. Mid horizontal scroll
3. Mid vertical scroll

## Profile

Use one stable simulator profile for baselines. The reference profile is **iPhone 15** on iOS 17+.
Re-run the same flows on that profile when reviewing visual changes.

## Capture workflow

```sh
# 1. Run the screenshot flows on a booted simulator with the demo dev build installed
pnpm test:e2e:screenshots

# 2. Copy Maestro outputs into the captured folder (adjust the source path if needed)
cp ~/.maestro/tests/*/multi-left-pinned-*.png e2e/screenshots/captured/
cp ~/.maestro/tests/*/right-pinned-*.png e2e/screenshots/captured/

# 3. Seed or compare baselines
node e2e/scripts/compare-screenshots.mjs --update   # first run / accepted visual change
node e2e/scripts/compare-screenshots.mjs            # regression check
```

## Tolerance

`compare-screenshots.mjs` allows up to **0.1%** mismatched pixels (`MAX_MISMATCH_RATIO = 0.001`).
Failed comparisons write diff images to `e2e/screenshots/diff/`.

Only update baselines for intentional visual changes after manual review.
