#!/bin/sh
echo "deploy.sh pwd: $(pwd)"
rm -rf dist
mkdir dist
ACTION="$1"
WSK="wsk"
if [ -e wsk ]
then
    WSK="./wsk"
fi
pushd $ACTION
npm install
popd
cp -r "${ACTION}/${ACTION}.js" "${ACTION}/node_modules" "${ACTION}/package.json" dist/.
if [ -e "${ACTION}/config.json" ]
then
    echo "Using config.json from $ACTION/ dir"
    cp "${ACTION}/config.json" dist/config.json
elif [ -e config.json ]
then
    echo "Using config.json from current dir"
    cp config.json dist/config.json
elif [ ! -z "${GITHUB_APP_ID}" ] && [ ! -z "${GITHUB_KEY}" ] && [ ! -z "${SIGN_CLIENT_ID}" ] && [ ! -z "${SIGN_CLIENT_SECRET}" ] && [ ! -z "${SIGN_REFRESH_TOKEN}" ]
then
    echo "Using config from environment variables"
    cat > dist/config.json <<EOF
{
  "signRefreshToken": "$SIGN_REFRESH_TOKEN",
  "signClientID": "$SIGN_CLIENT_ID",
  "signClientSecret": "$SIGN_CLIENT_SECRET",
  "githubKey": "$GITHUB_KEY",
  "githubAppId": "$GITHUB_APP_ID"
}
EOF
else
    echo "No config.json nor appropriate environment variables found, bombing 💥"
    exit 1
fi
cp utils.js dist/.
sed -i.bak 's/\.\.\/utils\.js/\.\/utils\.js/' "dist/${ACTION}.js"
pushd dist
zip -r "${ACTION}.zip" "${ACTION}.js" utils.js config.json package.json node_modules
popd
if [ -e ~/.wskprops ]
then
    $WSK action update "cla-${ACTION}" --kind nodejs:6 "dist/${ACTION}.zip" --web true
else
    $WSK property set --namespace io-solutions
    $WSK action update cla-lookup --kind nodejs:6 dist/lookup.zip --web true --apihost adobeioruntime.net --auth "${ADOBE_RUNTIME_AUTH}"
fi
