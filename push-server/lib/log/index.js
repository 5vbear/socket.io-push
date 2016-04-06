var winston = require('winston-levelonly');
var fs = require('fs');

var dir = 'log';
var workerId = 1;
var transports = [];
var formatter = function (options) {
    return options.timestamp() + " " + 'work:' + workerId + ' ' + options.level.substring(0, 1).toUpperCase() + '/' + (undefined !== options.message ? options.message : '');
}

var opts = {
    name: 'error',
    json: false,
    level: 'error',
    datePattern: 'yyyy-MM-dd_error.log',
    filename: dir + "/" + "log",
    timestamp: function () {
        return new Date().toLocaleString();
    },
    formatter: formatter
};

var logger;

function setArgs(args) {
    if (args.workId) {
        workerId = args.workId;
    }
    if (args.dir) {
        dir = args.dir;
    }
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    if(args.count >= 10){
        if(workerId < 10){
            workerId = '0' + workerId;
        }
    }

    transports.push(new (winston.transports.DailyRotateFile)(opts));

    opts.name = 'info';
    opts.level = 'info';
    opts.datePattern = 'yyyy-MM-dd_info.log';
    transports.push(new (winston.transports.DailyRotateFile)(opts))

    if (args.foreground) {
        opts.name = 'console';
        opts.levelOnly = false;
        delete opts.filename;
        delete opts.datePattern;
        if (args.debug) {
            opts.level = 'debug';
        } else if (args.verbose) {
            opts.level = 'verbose';
        } else {
            opts.level = 'info';
        }
        transports.push(new (winston.transports.Console)(opts));
    }

    logger = new (winston.Logger)({
        transports: transports
    });

}

var LogProxy = function (logger, tag) {
    this.logger = logger;
    this.tag = tag;
};

var meta = {};

['debug', 'verbose', 'info', 'error'].forEach(function (command) {

    LogProxy.prototype[command] = function (key, arg, callback) {
        arguments[0] = this.tag + ' ' + arguments[0];
        var mainArguments = Array.prototype.slice.call(arguments);
        mainArguments.push(meta);
        this.logger[command].apply(this, mainArguments);
    }

});

var Logger = function Logger(tag, args) {
    if (args) {
        setArgs(args);
        return;
    }
    return new LogProxy(logger, tag);
};

module.exports = Logger;