const path          = require('path');
const crypto        = require('crypto');
const pino          = require('pino');

const logFileExt    = `log`;

let _useDebugConsole;
let _useSeed;
let _useLogStack;
let lastSeed;

//#region Public

    module.exports = Logger;
    function Logger(logDirPath, logFileName, logLevel, useDebugConsole, useSeed, useLogStack)
    {
        _useDebugConsole = useDebugConsole;
        _useSeed = useSeed;
        _useLogStack = useLogStack;

        const nowDate = getNowDate();
        const fileDateStr = `${nowDate.getDate()}_${nowDate.getMonth() + 1}_${nowDate.getFullYear()}`;
 
        const fullLogFileName = path.join(logDirPath, `${logFileName}_${fileDateStr}.${logFileExt}`);

        let transport;
        if(_useDebugConsole)
        {
            transport = pino.transport({
                target: 'pino/file',
                level: logLevel,
                options: {
                    destination: fullLogFileName,
                    mkdir: true,
                    sync: false   
                }
            });
        }
        else
        {
            transport = pino.transport({
                targets: [{
                    level: logLevel,
                    target: 'pino/file',
                    options: {
                                destination: fullLogFileName,
                                mkdir: true,
                                sync: false           
                             },
                },{
                    level: logLevel,
                    target: 'pino-pretty', // npm install pino-pretty
                    options: {
                        ignore: 'seed,tags,stack'
                    }
                  }
                ]
            });
        }

        this.pinoLogger = pino({
                level: logLevel//,
                //timestamp: () => `,"time":"${(new Date()).toUTCString()}"`,
            }, 
            transport
        );
    }

    Logger.prototype.trace = function()
    {
        const params = checkAndProcessParams(arguments);

        if(_useDebugConsole)
            logToConsole(params.message, params.tags, params.dataObg);

        const seed = generateSeed();
        const childLogger = this.pinoLogger.child(params.childLogObj);
        childLogger.trace(params.dataObg, params.message);

        return seed;
    }

    Logger.prototype.debug = function()
    {
        const params = checkAndProcessParams(arguments);

        if(_useDebugConsole)
            logToConsole(params.message, params.tags, params.dataObg);

        const seed = generateSeed();
        const childLogger = this.pinoLogger.child(params.childLogObj);
        childLogger.debug(params.dataObg, params.message);

        return seed;
    }

    Logger.prototype.info = function()
    {
        const params = checkAndProcessParams(arguments);

        if(_useDebugConsole)
            logToConsole(params.message, params.tags, params.dataObg);

        const childLogger = this.pinoLogger.child(params.childLogObj);
        childLogger.info(params.dataObg, params.message);

        return params.seed;
    }

    Logger.prototype.warn = function()
    {
        const params = checkAndProcessParams(arguments);

        if(_useDebugConsole)
            logToConsole(params.message, params.tags, params.dataObg);

        const seed = generateSeed();
        const childLogger = this.pinoLogger.child(params.childLogObj);
        childLogger.warn(params.dataObg, params.message);

        return seed;
    }

    Logger.prototype.error = function()
    {
        const params = checkAndProcessParams(arguments);

        if(_useDebugConsole)
            logToConsole(params.message, params.tags, params.dataObg);

        const seed = generateSeed();
        const childLogger = this.pinoLogger.child(params.childLogObj);
        childLogger.error(params.dataObg, params.message);

        return seed;
    }

    Logger.prototype.fatal = function()
    {
        const params = checkAndProcessParams(arguments);

        if(_useDebugConsole)
            logToConsole(params.message, params.tags, params.dataObg);

        const seed = generateSeed();
        const childLogger = this.pinoLogger.child(params.childLogObj);
        childLogger.fatal(params.dataObg, params.message);

        return seed;
    }

    Logger.prototype.flush = function()
    {
        this.pinoLogger.flush();
    }

    Logger.prototype.setLevel = function(level)
    {
        this.pinoLogger.level = level;
    }

    Logger.prototype.getLevel = function()
    {
        return this.pinoLogger.level;
    }

//#endregion

//#region Private

    function checkAndProcessParams(args)
    {
        let dataObg, message, tags, seed, childLogObj;
        if (args.length < 2) {
            throw new TypeError(`Too few arguments`);
        }
        else if(args.length > 3) {
            throw new TypeError(`Too many arguments`);
        }
        else if(args.length == 2) {
            message = args[0];
            tags = args[1];
        }
        else {
            message = args[0];
            dataObg = args[1];
            tags = args[2];

            if(typeof(dataObg) != 'object' || !dataObg) {
                throw new TypeError(`Param 'dataObg' must be an object`);
            }
        }

        childLogObj = { tags: tags };

        if(_useSeed)
        {
            seed = generateSeed();
            childLogObj.seed = seed;
        }

        if(_useLogStack)
        {
            const logStack = getStackTrace();
            childLogObj.stack = logStack;
        }

        return {dataObg: dataObg, message: message, tags: tags, seed: seed, childLogObj: childLogObj};
    }

    function logToConsole(message, tags, dataObg)
    {
        let consoleText = `${getNowDateStr()} ${getTagsStr(tags)} ${message}`;
        if(dataObg) {
            console.log(consoleText, dataObg);
        }
        else {
            console.log(consoleText);
        }
    }

    function getTagsStr(tags)
    {
        if(!tags || !(tags instanceof Array))
            throw new TypeError(`Param 'tags' must be an array`);

        tags.forEach(tag => {
            if(typeof(tag) != 'string')
                throw new TypeError(`Param 'tags' must be an array of strings`);
        });

        let tagsStr = '';
        tags.forEach(tag => {
            tagsStr += '[' + tag + ']';
        });

        return tagsStr;
    }

    function generateSeed()
    {
        lastSeed = crypto.randomBytes(10).toString("hex");
        return lastSeed;
    }

    function getStackTrace()
    {
        const stack = new Error().stack;
        const stackArr = stack.split('\n');
        const slisedArray = stackArr.slice(4);  // Убрать первые 4 строки из стека - это внутренние вызовы в логгере

        for(let i = 0; i < slisedArray.length - 1; i++)
        {
            if(i == 0)
            {
                slisedArray[i] = slisedArray[i].trim();
            }
            slisedArray[i] += "\n";
        }

        return slisedArray.join('');
    }

    function getNowDateStr()
    {
        const nowDate = getNowDate();
        const dateStr = (nowDate).toLocaleString("ru", {
            year:   'numeric',
            month:  '2-digit',
            day:    '2-digit',
            hour:   'numeric',
            minute: 'numeric',
            second: 'numeric'
        });

        const milliseconds = nowDate.getMilliseconds();
        let millisecondsStr = '';
        if(milliseconds < 10) {
            millisecondsStr = '00' + milliseconds;
        }
        else if (milliseconds < 100) {
            millisecondsStr = '0' + milliseconds;
        }
        else {
            millisecondsStr = '' + milliseconds;
        }

        return dateStr + "." + millisecondsStr;
    }

    function getNowDate()
    {
        return new Date();
    }

//#endregion