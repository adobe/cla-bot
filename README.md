# CLA-BOT

## Runtime actions

These instructions assume you already have openwhisk and a runtime namespace setup. See [this workshop](https://hirenoble.github.io/Marriott-Workshop/) if you haven't. 

### Deploy

If you haven't created a runtime action yet, run the following command

```
wsk action create cla-checker checker.js --web true
```

If you need to update a runtime action, run the following command

```
wsk action update cla-checker checker.js
```

Protip, run the following command to get the URL of the action to use for hooks

```
wsk action get cla-checker --url
```

Note: We will probably have to update these deploy scripts to upload a zip which includes `package.json` and `config.json` files. For this to work, the main file will need `exports.main = main;` at the bottom. The command to deploys will look like:

```
zip -r action.zip .
wsk action create cla-checker --kind nodejs:6 action.zip --web true
```

### Debug

Get list of actions running on our namespace and see the logs

```
wsk activation list
wsk action get ACTIVATION-LIST-NUMBER
```


