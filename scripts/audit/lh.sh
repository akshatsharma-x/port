#!/bin/sh
# Lighthouse 12.8.2 (devtools throttling) over a route: N mobile runs and one desktop run, all four
# categories, into .artifacts/<tag>/lh/<name>-m<i>.json / -d1.json.   sh scripts/audit/lh.sh <tag> <name> <path> [runs]
TAG=$1; NAME=$2; ROUTE=$3; RUNS=${4:-3}
OUT=.artifacts/$TAG/lh; mkdir -p "$OUT"
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CATS=performance,accessibility,best-practices,seo
i=1
while [ $i -le "$RUNS" ]; do
  npx -y lighthouse@12.8.2 "http://localhost:3200$ROUTE" --only-categories=$CATS --form-factor=mobile --throttling-method=devtools --chrome-flags="--headless=new" --output=json --output-path="$OUT/$NAME-m$i.json" --quiet || exit 1
  i=$((i + 1))
done
npx -y lighthouse@12.8.2 "http://localhost:3200$ROUTE" --only-categories=$CATS --preset=desktop --throttling-method=devtools --chrome-flags="--headless=new" --output=json --output-path="$OUT/$NAME-d1.json" --quiet
