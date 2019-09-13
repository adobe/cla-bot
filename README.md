# Adobe CLA Bot [![Build Status](https://travis-ci.com/adobe/cla-bot.svg?branch=master)](https://travis-ci.com/adobe/cla-bot)

This is a GitHub App that checks that pull request issuers to [github.com/adobe]
have signed the [Adobe CLA][cla].

You can install the app by visiting the [GitHub App page for it][apppage].

## Overview

This repo is implemented as a [GitHub App][apppage] together with a set of Adobe
Runtime actions. The app has its Webhook URL configured to point to the `checker`
action (more on that below).

This repo contains three actions, which are functions that run on a serverless
(function as a service, or FaaS) platform:

- [`./checker`][checker] contains an action that runs on every [github.com/adobe]
  pull request open, close and synchronize. Checker's job is to check if the user
  submitting the pull request has signed the [CLA][cla] or if the user is an Adobe or
  Magento employee (by checking [github.com/adobe] or magento organization membership).
- [`./setgithubcheck`][setgithubcheck] contains an action that interacts with the
  GitHub REST API's [Checks API](https://developer.github.com/v3/checks/runs) to
  set checkmarks on pull requests. It is invoked by other actions to communicate
  pass/fail to pull request authors.
- [`./lookup`][lookup] contains an action that accepts `agreement_id`s as `agreements`
  parameter, interacts with [Adobe Sign formData APIs][formdataapi], it parses the
  formData of all the agreements to lookup the GitHub usernames in the agreements
  and returns a consolidated list of GitHub usernames.
- [`./signwebhook`][signwebhook] contains an action that receives event payloads
  from Adobe Sign when users sign our CLA agreement. This enables a push-based
  flow and foregoes the user having to take additional steps after they sign our
  CLA. This action will look up the details of the signed agreement, extract the
  user's GitHub username, and then search through our orgs for any open pull
  requests from the user, and finally invoke the [`./setgithubcheck`][setgithubcheck]
  action to set a nice green checkmark on their PRs.

## Requirements

For all actions, make sure to copy `config-sample.json` from the root into the
relevant folders, rename it to `config.json` and populate it with the correct
information.

## Running Tests

Make sure you've `npm install`ed, then simply `npm test`. This will run the lint
and unit tests. You can also invoke each of these individually with `npm run
lint` and `npm run test:unit`.

There are also integration tests against github.com, though you need several
special environment variables representing github.com personal access tokens to
run them. It is expected only maintainers of this repo have access to them, and
they are also stored in travis-ci as encrypted environment variables. These
tests can be run via `npm run test:integration`.

## Runtime Actions

These instructions assume you already have openwhisk and a runtime namespace
setup. See [this workshop](https://hirenoble.github.io/Marriott-Workshop/) if
you haven't.

### Deploy

Deployment is automated via the [`deploy.sh`](https://github.com/adobe/cla-bot/tree/master/deploy.sh)
script.

We maintain two environments, and thus two apps: the production environment and
a staging environment. We also have a [staging GitHub app][stagingapppage] for
use with running integration tests.

Each action's name when deployed on Adobe Runtime is `cla-` + the action name
(subdirectory), i.e. `cla-lookup`, `cla-checker`, `cla-setgithubcheck` and
`cla-signwebhook`. When deploying to the staging environment, these action names
are additionally suffixed with `-stage`.

#### Creating New Actions

It is best to create a new directory by copying one of the existing action
directories and editing the `deploy.sh` script to `create` rather than `update`
using the `wsk` CLI tools.

#### Updating Existing Actions

If you need to update a runtime action, use our handy deploy script:

```
./deploy.sh lookup
./deploy.sh setgithubcheck
./deploy.sh checker
./deploy.sh signwebhook
```

The above will deploy these actions to our staging environment for use by our
[staging GitHub app][stagingapppage]. You can deploy to production via:

```
./deploy.sh lookup production
./deploy.sh setgithubcheck production
./deploy.sh checker production
./deploy.sh signwebhook production
```

**NOTE**: The `signwebhook` action _only runs in production_.

#### Creating a GitHub App

This bot is implemented as a [GitHub
App](https://developer.github.com/apps/building-github-apps/). It can be
installed on individual repositories or organizations, and sends GitHub webhook
events from repos/orgs it is installed on to the [`./checker`][checker]
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

[cla]: https://opensource.adobe.com/cla.html
[apppage]: https://github.com/apps/adobe-cla-bot
[stagingapppage]: https://github.com/apps/adobe-cla-bot-staging
[checker]: https://github.com/adobe/cla-bot/tree/master/checker
[setgithubcheck]: https://github.com/adobe/cla-bot/tree/master/setgithubcheck
[lookup]: https://github.com/adobe/cla-bot/tree/master/lookup
[signwebhook]: https://github.com/adobe/cla-bot/tree/master/signwebhook
[formdataapi]: https://corporate.na1.echosign.com/public/docs/restapi/v5#!/agreements/getFormData
