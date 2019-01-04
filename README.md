# CLA-BOT

This is a GitHub App that checks that pull request issuers to [github.com/adobe](https://github.com/adobe) have signed the [Adobe CLA](http://opensource.adobe.com/cla.html).

## Overview

This repo is implemented as a [GitHub App](https://github.com/organizations/adobe/settings/apps/adobe-cla-bot)
together with a set of Adobe Runtime actions. The app has its Webhook URL
configured to point to the `checker` action (more on that below).

This repo contains three actions, which are functions that run on a serverless
(function as a service, or FaaS) platform:

- `./checker` contains an action that runs on every [github.com/adobe](https://github.com/adobe)
    pull request open and close. Checker's job is to check if the user submitting
    the pull request has signed the CLA or if the user is an Adobe employee (by
    checking github.com/adobe organization membership).
- `./setgithubcheck` contains an action that interacts with the GitHub REST API's
    [Checks API](https://developer.github.com/v3/checks/runs) to set checkmarks
    on pull requests. It is invoekd by other actions to communicate pass/fail to
    pull request authors.
- `./lookup` contains an action that accepts agreement_id(s) as `agreements` parameter, interacts with Adobe Sign formData APIs, it parses the formData of all the agreements to lookup the github usernames and returns a consolidated list of github usernames.

## Requirements

For all actions, make sure to copy `config-sample.json` from the root into the
relevant folders, rename it to `config.json` and populate it with the correct
information.

## Runtime Actions

These instructions assume you already have openwhisk and a runtime namespace
setup. See [this workshop](https://hirenoble.github.io/Marriott-Workshop/) if
you haven't.

### Deploy

Each action's name when deployed on Adobe Runtime is `cla-` + the action name
(subdirectory).

#### Creating New Actions

1. Zip up the action

```
cd checker && zip -r checker.zip .
```

2. To create the action, run the following command:

```
wsk action create cla-checker --kind nodejs:6 checker.zip --web true
```

#### Updating Existing Actions

If you need to update a runtime action, use our handy deploy script:

```
./deploy.sh lookup
./deploy.sh setgithubcheck
./deploy.sh checker
```

### Debug

#### Check GitHub App Deliveries

You can go check GitHub webhook delivery payloads and responses on the [CLA Bot's
App Advanced
Settings](https://github.com/organizations/adobe/settings/apps/adobe-cla-bot/advanced).

#### Check Logs on Adobe Runtime

Get list of actions running on our namespace:

```
wsk activation list
```

Copy the most-recent-activation number related to your particular action and
retrieve its logs:

```
wsk activation get ACTIVATION-LIST-NUMBER
```

#### Getting URL of Actions

Protip, run the following command to get the URL of the action to use for
setting up the GitHub App correctly:

```
wsk action get cla-checker --url
```
