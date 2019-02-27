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

## Running Tests

Make sure you've `npm install`ed, then simply `npm test`.

## Runtime Actions

These instructions assume you already have openwhisk and a runtime namespace
setup. See [this workshop](https://hirenoble.github.io/Marriott-Workshop/) if
you haven't.

### Deploy

Each action's name when deployed on Adobe Runtime is `cla-` + the action name
(subdirectory).

#### Creating New Actions

1. Install any dependencies of the action:

```
cd checker
npm install
```

2. Zip up the action:

```
zip -r checker.zip .
```

3. Upload the action to Runtime via the following command:

```
wsk action create cla-checker --kind nodejs:10 checker.zip --web true
```

#### Updating Existing Actions

If you need to update a runtime action, use our handy deploy script:

```
./deploy.sh lookup
./deploy.sh setgithubcheck
./deploy.sh checker
```

#### Creating a GitHub App

This bot is implemented as a [GitHub
App](https://developer.github.com/apps/building-github-apps/). It can be
installed on individual repositories or organizations, and sends GitHub webhook
events from repos/orgs it is installed on to the [`./checker`](./checker)
action. To set the GitHub App up:

1. In your Organization Settings, under Developer Settings, click on GitHub
   Apps.
2. Click New GitHub App.
3. Fill out a name and description for your App.
4. Fill out the Webhook URL to match the URL of your `checker` action. If you
   have not deployed the `checker` action yet, follow the above instructions on
   [Creating New Actions](#creating-new-actions). If you have already deployed
   this action, see below for information on [how to retrieve the URL of the
   action](#getting-urls-of-actions).
5. Under the Permissions section, give the App Read and Write access to Checks,
   Read-only access to Repository Metadata, Read-only access to Pull Requests
   and Read and Write access to Commit Statuses.
6. Leave the User Permissions as-is.
7. Under Subscribe to Events, check Pull Requests.

Once created, you will have the chance to generate and store a Private Key. Keep
this and add it to your `config.json` file! You will also want to make note of
the GitHub App ID - again, this goes into your `config.json`. Finally, you will
want to Install the app in to your organizations or repositories of choice. You
can do so from the same Settings page of the App.

### Debug

#### Check GitHub App Deliveries

You can go check GitHub webhook delivery payloads and responses on the [CLA Bot's
App Advanced
Settings](https://github.com/organizations/adobe/settings/apps/adobe-cla-bot/advanced).

#### Check Logs on Adobe Runtime

Get list of action invocations, or _activations_, that executed in our namespace:

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
