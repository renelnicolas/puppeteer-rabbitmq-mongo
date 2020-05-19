## Installing NodeJS

```bash
$ curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -

$ curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
$ echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

$ sudo apt update
$ sudo apt install -y nodejs yarn
OR
$ sudo apt install --no-install-recommends yarn
```

## Installing Chrome Stable

```
$ wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

$ sudo apt install -y ./google-chrome-stable_current_amd64.deb

$ whereis google-chrome
```

Keep the path for Puppeteer's executablePath

## Installing [PM2](https://travis-ci.org/Unitech/pm2)

With Yarn:

```bash
$ yarn global add pm2
```

### AutoReload

```bash
$ pm2 startup
```

Copy/paste into your terminal

### Remove init script via

```bash
$ pm2 unstartup launchd
```

### Launch process

```bash
$ pm2 start process.json --restart-delay=200
OR
$ pm2 start process.json --exp-backoff-restart-delay=100
```

## Manual launching

You can prefix by DEBUG=true ...

```bash
$ node src/amq/consumers/analyser.js
OR
$ node src/puppeteer/analyser.js
```
