# CLA-BOT

We have two actions in this repo. One under the checker folder which runs on every github pull request. Checker's job is to check if the user submitting the pull request has signed the CLA.

The second action is under the confirmer folder. This action will run on an agreement signed hook which comes from adobe sign. This action will pull the github username from the agreement and comment on any open PRs from that user on one of our supported github orgs. 

For both actions, make sure to copy `config-sample.json` from the root into the folders and populate it with the correct information.

## Runtime actions

These instructions assume you already have openwhisk and a runtime namespace setup. See [this workshop](https://hirenoble.github.io/Marriott-Workshop/) if you haven't. 

### Deploy

Zip up the action

```
zip -r checker.zip checker/.
```

If you haven't created a runtime action yet, run the following command

```
wsk action create cla-checker --kind nodejs:6 checker.zip --web true
```

If you need to update a runtime action, run the following command

```
wsk action update cla-checker --kind nodejs:6 checker.zip --web true
```

Protip, run the following command to get the URL of the action to use for hooks

```
wsk action get cla-checker --url
```

### Debug

Get list of actions running on our namespace and see the logs

```
wsk activation list
wsk activation get ACTIVATION-LIST-NUMBER
```


