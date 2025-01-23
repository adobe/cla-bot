#!/bin/sh
echo "pwd: $(pwd)"
rm -rf dist
mkdir dist
ACTION="$1"
if [ -z "${ACTION}" ]
then
    echo "Missing action name as first parameter to script, exiting"
    exit 1
fi
if ! [[ "$ACTION" =~ ^(checker|lookup|setgithubcheck|signwebhook)$ ]]
then
    echo "Action name must be one of 'checker', 'lookup', 'setgithubcheck' or 'signwebhook', exiting"
    exit 2
fi
ENV="$2"
if [ -z "${ENV}" ]
then
    ENV="stage"
fi
echo $ENV
echo $GITHUB_APP_ID

# make sure we have all our credentials sorted
if [ -e "${ACTION}/config.json" ]
then
    echo "Using config.json from $ACTION/ dir"
    cp "${ACTION}/config.json" dist/config.json
elif [ -e config.json ]
then
    echo "Using config.json from root dir"
    cp config.json dist/config.json
elif [ ! -z "${GITHUB_APP_ID}" ] && [ ! -z "${GITHUB_KEY}" ] && [ ! -z "${SIGN_CLIENT_ID}" ] && [ ! -z "${SIGN_CLIENT_SECRET}" ] && [ ! -z "${SIGN_REFRESH_TOKEN}" ]
then
    echo "Using config from environment variables"
    cat > dist/config.json <<EOF
{
  "signRefreshToken": "$SIGN_REFRESH_TOKEN",
  "signClientID": "$SIGN_CLIENT_ID",
  "signClientSecret": "$SIGN_CLIENT_SECRET",
  "githubKey": "$APP_KEY_GITHUB",
  "githubAppId": "$APP_ID_GITHUB"
}
EOF
else
    echo "No config.json nor appropriate environment variables found, bombing 💥"
    exit 1
fi

# set up action names based on environment
ACTION_NAME="cla-${ACTION}"
if [[ "$ENV" = "stage" ]]
then
    ACTION_NAME="cla-${ACTION}-stage"
elif [[ "$ENV" = "production" ]]
then
    ACTION_NAME="cla-${ACTION}"
fi
echo "Environment assumed to be ${ENV} and deployed action name will be ${ACTION_NAME}"

WSK="wsk"
if [ -e wsk ]
then
    WSK="./wsk"
fi
echo "wsk binary used is ${WSK}"

# get files for deployed action ready
pushd $ACTION
npm install
popd
cp -r "${ACTION}/${ACTION}.js" "${ACTION}/node_modules" "${ACTION}/package.json" dist/.
# replace having the action load utils from the root of repo dir and instead use
# flat directory structure of the deployed action
sed -i.bak 's/\.\.\/utils\.js/\.\/utils\.js/' "dist/${ACTION}.js"
cp utils.js dist/.
# set the correct action name which may differ based on $ENV
if [[ $ENV = "stage" ]]
then
    echo "Setting action names to -stage in utils.js..."
    sed -i.bak "s/\(cla-[a-z]*\)/\1-stage/" dist/utils.js
fi
rm dist/*.bak

pushd dist
echo "dist/ content listing:"
ls -al
echo "Zipping dist/..."
zip -q -r "${ACTION}.zip" "${ACTION}.js" utils.js config.json package.json node_modules
popd
echo "Deploying ${ACTION_NAME}..."
if [ -e ~/.wskprops ]
then
    $WSK action update "${ACTION_NAME}" --kind nodejs:10 "dist/${ACTION}.zip" --web true
else
    echo "Setting runtime host and auth properties..."
    $WSK property set --apihost adobeioruntime.net --auth "${ADOBE_RUNTIME_AUTH}"
    $WSK action update "${ACTION_NAME}" --kind nodejs:14 "dist/${ACTION}.zip" --web true --apihost adobeioruntime.net --auth "${ADOBE_RUNTIME_AUTH}"
fi
echo "🌈✅"
