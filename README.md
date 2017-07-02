capturebate-node
================
capturebate-node lets you follow and archive your favorite models' shows on chaturbate.com

Requirements
============
[RTMPDump(ksv)](https://github.com/K-S-V/Scripts/releases) used to capture the streams.
[Node.js](https://nodejs.org/download/) used to run capturebate-node, hence the name.

Setup
=====
Install requirements, run `npm install` in the same folder as main.js is.
Get a [chaturbate account](https://chaturbate.com/accounts/register/), once you're signed up put your credentials in the `config.yml` file and - if needed - adjust the other options.

Setup
=====
1. Install [Node.js](https://nodejs.org/download/release/) (tested with `7.9.0` and `8.1.3`).
2. Download and unpack the [code](https://codeload.github.com/horacio9a/capturebate-node/zip/master).
3. Open console and go into the directory where you unpacked the files.
4. Install requirements by running `npm install` in the same directory as `main.js` is.
5. Edit `config.yml` file and set desirable values for `username`, `password`, `captureDirectory`, `dateFormat` and `modelScanInterval`.

Running & Output
================
Be mindful when capturing many streams at once to have plenty of space on disk and the bandwidth available or you'll end up dropping a lot of frames and the files will be useless.
Before you can start capturing streams you first need to [follow](https://i.imgur.com/o9QyAVC.png) the models you want on the site, once you've done this you're ready to start capturebate-node by running `node main.js`
To start capturing streams you need to run `node main.js` I reccomend you do this in [screen](https://www.gnu.org/software/screen/) as that'll keep running if you lose connection to the machine or otherwise close your shell.
Standard output should look something this when recording streams:

  [04:48:02] Start searching for new models.
  [04:48:06] Found these live followed models: do_it_hard
  [04:48:06] Create recording process.
  [04:48:06] do_it_hard is online >>> start recording.

