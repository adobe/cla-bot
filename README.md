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
- `./confirmer` contains an action that runs when an agreement on Adobe Sign is
    signed. This action will pull the github username of the signeefrom the
    agreement and comment on any open PRs from that user on one of our supported
    github orgs.
- `./setgithubcheck` contains an action that interacts with the GitHub REST API's
    [Checks API](https://developer.github.com/v3/checks/runs) to set checkmarks
    on pull requests. It is invoekd by other actions to communicate pass/fail to
    pull request authors.

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

Zip up the action

```
cd checker && zip -r checker.zip .
```

If you haven't created a runtime action yet, run the following command:

```
wsk action create cla-checker --kind nodejs:6 checker.zip --web true
```

If you need to update a runtime action, run the following command:

```
wsk action update cla-checker --kind nodejs:6 checker.zip --web true
```

Protip, run the following command to get the URL of the action to use for
setting up the GitHub App correctly:

```
wsk action get cla-checker --url
```

### Debug

Get list of actions running on our namespace:

```
wsk activation list
```

Copy the most-recent-activation number related to your particular action and
retrieve its logs:

```
wsk activation get ACTIVATION-LIST-NUMBER
```

... convenience script to retrieve response body:

```
./debug ACTIVATION-LIST-NUMBER
```
