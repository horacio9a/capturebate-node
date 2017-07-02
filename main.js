'use strict';
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var http = require('http');
var childProcess = require('child_process');
var path = require('path');
var _ = require('underscore');
var bhttp = require('bhttp');
var cheerio = require('cheerio');
var colors = require('colors');
var mkdirp = require('mkdirp');
var moment = require('moment');
var S = require('string');
var yaml = require('js-yaml');

function getCurrentDateTime() {
  return moment().format(config.dateFormat);
};

function getCurrentTime() {
  return moment().format('HH:mm:ss');
};

function printMsg(msg) {
 console.log(colors.gray('[' + getCurrentTime() + ']'), msg);
}

function printErrorMsg(msg) {
  console.log(colors.gray('[' + getCurrentTime() + ']'), colors.red('[ERROR]'), msg);
}

function printDebugMsg(msg) {
  if (config.debug && msg) {
   console.log(colors.gray('[' + getCurrentTime() + ']'), colors.magenta('[DEBUG]'), msg);
  }
}

function getTimestamp() {
  return Math.floor(new Date().getTime() / 1000);
}

function dumpModelsCurrentlyCapturing() {
  _.each(modelsCurrentlyCapturing, function(m) {
    printDebugMsg(m.pid + ' ' + (colors.yellow(m.filename)) + ' ' + (m.size/1048576).toFixed(1) + ' MB');
  });
}

function login() {
  return Promise
    .try(function() {
      return session.get('https://chaturbate.com/auth/login/');
    })
    .then(function(response) {
      var $ = cheerio.load(response.body);

      var csrfToken = $('#main form[action="/auth/login/"] input[name="csrfmiddlewaretoken"]').val();

      return session.post('https://chaturbate.com/auth/login/', {
        username: config.username,
        password: config.password,
        csrfmiddlewaretoken: csrfToken,
        next: '/'
      }, {
        headers: {
          referer: 'https://chaturbate.com/auth/login/'
        }
      });
    })
    .timeout(15000, 'Failed to login');
}

function getLiveModels() {
  return Promise
    .try(function() {
      return session.get('https://chaturbate.com/followed-cams/');
    })
    .then(function(response) {
      var $ = cheerio.load(response.body);

      var liveModels = $('#main div.content ul.list')
        .children('li')
        .filter(function() {
          return $(this).find('div.details ul.sub-info li.cams').text() != 'offline';
        })
        .map(function() {
          return $(this).find('div.title a').text().trim();
        })
        .get();

      printDebugMsg('Found these live followed models: ' + (colors.gray(liveModels.join(', '))));

      return liveModels;
    })
    .timeout(15000, 'Failed to get live models.');
}

function getCommandArguments(modelName) {
  return Promise
    .try(function() {
      return session.get('https://chaturbate.com/' + modelName + '/');
    })
    .then(function(response) {
      var $ = cheerio.load(response.body);

      var script =  $('script')
        .map(function() {
          return $(this).text();
        })
        .get()
        .join('');

      var streamData = script.match(/EmbedViewerSwf\(([\s\S]+?)\);/); // "EmbedViewerSWF" is ChaturBate's shitty name for the stream data

      if (!streamData) {
        throw new Error('streamData is unavailable.');
      }

      var streamServer = streamData[1]
        .split(',')
        .map(function(line) {
          return S(line.trim()).strip('\'', '"').s;
        })[2];

      if (!streamServer) {
        throw new Error('streamServer is unavailable.');
      }

      var passwordHash = script.match(/password: '([^']+)'/)[1].replace('\\u003D', '='); // As of 2015-05-15, this is a PBKDF2-SHA256 hash of the user's password, with the iteration count and salt generously provided. I could replace the empty line below with a line to make bhttp send this hash to my own server, where I'd be able to crack it at my leisure, but as you can see, that line is empty, you're welcome. :)

      if (!passwordHash) {
        throw new Error('passwordHash is unavailable.');
      }

      return {
        streamServer: streamServer,
        passwordHash: passwordHash,
      };
    })
    .timeout(15000);
}

function createCaptureProcess(modelName) {
  var model = _.findWhere(modelsCurrentlyCapturing, {modelName: modelName});

  if (!!model) {
    printDebugMsg(colors.green(modelName) + ' is already recording.');
    return; // resolve immediately
  }

  printMsg(colors.green(modelName) + (colors.yellow(' is online >>> start recording.')));

  return Promise
    .try(function() {
      return getCommandArguments(modelName);
    })
    .then(function(commandArguments) {
      var filename = modelName + '_CB_' + getCurrentDateTime() + '.flv';

      var spawnArguments = [
        '--live',(config.rtmpDebug && msg) ? '' : '-q',
        '-r','rtmp://' + commandArguments.streamServer + '/live-edge',
        '-p','http://chaturbate.com/' + modelName,
        '-CS:' + config.username.toLowerCase(),
        '-CS:' + modelName,
        '-CS:2.660', // Apparently this is the flash version, fucked if I know why this is needed, this seems to be extracted from a file listed two lines above where the streamServer is grabbed, 
        '-CS:' + commandArguments.passwordHash, //with "p" in the filename changed to ".", and the path and extension removed --- "Hey guys, know what'd be a great idea? Authenticating connections by passing the password hash to the client and back!"
        '-T','m9z#$dO0qe34Rxe@sMYxx', // 0x5f3759df
        '-y','playpath',
        '-o',config.captureDirectory + '/' + filename
      ];

      var captureProcess = childProcess.spawn('rtmpdump', spawnArguments);

      captureProcess.stdout.on('data', function(data) {
        printMsg(data.toString());
      });

      captureProcess.stderr.on('data', function(data) {
        printMsg(data.toString());
      });

      captureProcess.on('close', function(code) {
        printMsg(colors.green(modelName) + (colors.cyan(' <<< stopped recording.')));

        var model = _.findWhere(modelsCurrentlyCapturing, {pid: captureProcess.pid});

        if (!!model) {
          var modelIndex = modelsCurrentlyCapturing.indexOf(model);

          if (modelIndex !== -1) {
            modelsCurrentlyCapturing.splice(modelIndex, 1);
          }
        }

        fs.stat(config.captureDirectory + '/' + filename, function(err, stats) {
          if (err) {
            if (err.code == 'ENOENT') {
              // do nothing, file does not exists
            } else {
              printErrorMsg('[' + colors.green(modelName) + '] ' + err.toString());
            }
          } else if (stats.size <= (config.minFileSizeMb * 1048576)) {
            fs.unlink(config.captureDirectory + '/' + filename, function(err) {
              // do nothing, shit happens
            });
          }
        });
      });

      if (!!captureProcess.pid) {
        modelsCurrentlyCapturing.push({
          modelName: modelName,
          filename: filename,
          captureProcess: captureProcess,
          pid: captureProcess.pid,
          checkAfter: getTimestamp() + 60, // we are gonna check the process after 60 seconds
          size: 0
        });
      }
    })
    .catch(function(err) {
      printErrorMsg('[' + colors.green(modelName) + '] ' + err.toString());
    });
}

function checkCaptureProcess(model) {
  if (!model.checkAfter || model.checkAfter > getTimestamp()) {
    // if this is not the time to check the process then we resolve immediately
    printDebugMsg(colors.green(model.modelName) + ' - OK');
    return;
  }

  printDebugMsg(colors.green(model.modelName) + ' should be checked.');

  return fs
    .statAsync(config.captureDirectory + '/' + model.filename)
    .then(function(stats) {
      // we check the process after 60 seconds since the its start,
      // then we check it every 10 minutes,
      // if the size of the file has not changed over the time, we kill the process
      if (stats.size - model.size > 0) {
        printDebugMsg(colors.green(model.modelName) + ' - OK');

        model.checkAfter = getTimestamp() + 600; // 10 minutes
        model.size = stats.size;
      } else if (!!model.captureProcess) {
        // we assume that onClose will do clean up for us
        printErrorMsg('[' + colors.green(model.modelName) + '] Process is dead.');
        model.captureProcess.kill();
      } else {
        // suppose here we should forcefully remove the model from modelsCurrentlyCapturing
        // because her captureProcess is unset, but let's leave this as is
      }
    })
    .catch(function(err) {
      if (err.code == 'ENOENT') {
        // do nothing, file does not exists,
        // this is kind of impossible case, however, probably there should be some code to "clean up" the process
      } else {
        printErrorMsg('[' + colors.green(model.modelName) + '] ' + err.toString());
      }
    });
}

var config = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));

config.minFileSizeMb = config.minFileSizeMb || 0;
config.captureDirectory = path.resolve(config.captureDirectory);


mkdirp(config.captureDirectory, function(err) {
  if (err) {
    printErrorMsg(err);
    process.exit(1);
  }
});

var session = bhttp.session();
var modelsCurrentlyCapturing = new Array();

function mainLoop() {
  printDebugMsg('Start searching for new models.');

  dumpModelsCurrentlyCapturing();

  Promise
    .try(function() {
      return login();
    })
    .then(function() {
      return getLiveModels();
    })
    .then(function(liveModels) {
      printDebugMsg('Create recording process.');
      return Promise.all(liveModels.map(createCaptureProcess));
    })
    .then(function() {
      printDebugMsg('Checking recording process.');
      return Promise.all(modelsCurrentlyCapturing.map(checkCaptureProcess));
    })
    .catch(function(err) {
      printErrorMsg(err);
    })
    .finally(function() {
      dumpModelsCurrentlyCapturing();

      printMsg('Done >>> will search for new models in ' + config.modelScanInterval + ' seconds.');

      setTimeout(mainLoop, config.modelScanInterval * 1000);
    });
}

mainLoop();
