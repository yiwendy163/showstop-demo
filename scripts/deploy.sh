#!/bin/sh
# Build the demo and publish dist/ to the gh-pages branch of yiwendy163/showstop-demo.
# GitHub Pages serves that branch. Usage (from app/): npm run deploy
set -e
REPO="https://github.com/yiwendy163/showstop-demo.git"
npm run build
TMP=$(mktemp -d)
cp -R dist/. "$TMP"/
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q -b gh-pages
git add -A
git commit -qm "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -fq "$REPO" gh-pages
echo "Deployed to https://yiwendy163.github.io/showstop-demo/"
