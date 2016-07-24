(function () {
    'use strict';
    var stream = require('stream');

    var CharacterStream = module.exports = function CharacterStream(options) {
        if (!(this instanceof CharacterStream)) {
            var instance = Object.create(CharacterStream.prototype);
            CharacterStream.apply(instance, arguments);
            return instance;
        }
        if (arguments.length >= 1) {
            if (options != null) {
                if (typeof options !== 'object') {
                    throw new TypeError('Expected first argument to be object');
                }
            } else {
                options = {};
            }
        } else {
            options = {};
        }
        var parentOptions = {
            encoding: null,
            objectMode: true
        };
        Object.keys(options).forEach(function (key) {
            if (key === 'encoding' || key === 'objectMode') {
                return;
            }
            parentOptions[key] = options[key];
        });
        stream.Transform.call(this, parentOptions);

        this._state = 0;
        this._index = 0;
        if (options.hasOwnProperty('encoding')) {
            if (typeof options.encoding !== 'string') {
                throw new TypeError('Expected encoding to be string');
            }
            this._encoding = options.encoding.toLowerCase();
        } else {
            this._encoding = 'utf-8';
        }
        if (CharacterStream.encodingAlias.hasOwnProperty(this._encoding)) {
            this._encoding = CharacterStream.encodingAlias[this._encoding];
        }
        if (!CharacterStream.encoding.hasOwnProperty(this._encoding)) {
            throw new TypeError('Unsupported encoding: ' + this._encoding);
        }
        if (typeof CharacterStream.encoding[this._encoding] !== 'function') {
            throw new TypeError('Invalid configuration for encoding: ' + this._encoding);
        }
        this._decoder = CharacterStream.encoding[this._encoding];
        if (typeof CharacterStream.encodingInit[this._encoding] === 'function') {
            CharacterStream.encodingInit[this._encoding].call(this);
        }
    };
    CharacterStream.prototype = Object.create(stream.Transform.prototype);
    CharacterStream.prototype.constructor = CharacterStream;
    CharacterStream.prototype._transform = function (chunk, encoding, callback) {
        // TODO: If chunk is a string, encoding is the chunk encoding. We must convert it to buffer to process it further.
        // TODO: If chunk is a buffer, encoding is "buffer". We can start processing it directly.
        if (encoding !== 'buffer') {
            chunk = Buffer.from(chunk, encoding);
        }
        if (chunk.length > 0) {
            this._decoder(chunk, callback);
        }
    };
    CharacterStream.prototype._flush = function (callback) {
        if (this._state !== 0) {
            var err = new Error('Unexpected end of input durring surrogate sequence');
            err.code = 'INVALID_CHAR';
            err.byteIndex = this._index;
            err.state = this._state;
            err.encoding = this._encoding;
            return void callback(err);
        }
        callback();
    };
    CharacterStream.encoding = {
        utf8: function (chunk, callback) {
            for (var i = 0; i < chunk.length; ++i, ++this._index) {
                switch (this._state) {
                case 1:
                    if (this._buffer != null) {
                        this._state = 0;
                        this._passCharacter(this._buffer);
                        this._buffer = null;
                    } else {
                        return function (i) {
                            var err = new Error('State 1 with empty buffer');
                            err.code = 'INVALID_STATE';
                            err.state = this._state;
                            err.byteIndex = this._index;
                            err.surrogate = this._surrogate;
                            err.byteCode = chunk[i];
                            callback(err);
                        }.call(this, i);
                    }
                    //noinspection FallThroughInSwitchStatementJS
                case 0:
                    if (chunk[i] < 0x80) {
                        this._passCharacter(chunk[i]);
                    } else {
                        this._surrogate = 1;
                        if (chunk[i] >= 0xC0 && chunk[i] <= 0xDF) {
                            this._state = 2;
                            this._buffer = chunk[i] & 0x1F;
                        } else if (chunk[i] >= 0xE0 && chunk[i] <= 0xEF) {
                            this._state = 3;
                            this._buffer = chunk[i] & 0x0F;
                        } else if (chunk[i] >= 0xF0 && chunk[i] <= 0xF7) {
                            this._state = 4;
                            this._buffer = chunk[i] & 0x07;
                        } else if (chunk[i] >= 0xF8 && chunk[i] <= 0xFB) {
                            this._state = 5;
                            this._buffer = chunk[i] & 0x03;
                        } else if (chunk[i] >= 0xFC && chunk[i] <= 0xFD) {
                            this._state = 6;
                            this._buffer = chunk[i] & 0x01;
                        } else {
                            return function (i) {
                                var err = new Error('Invalid character');
                                err.code = 'INVALID_CHAR';
                                err.byteIndex = this._index;
                                err.surrogate = 0;
                                err.byteCode = chunk[i];
                                callback(err);
                            }.call(this, i);
                        }
                    }
                    break;
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                    if (chunk[i] >= 0x80 && chunk[i] <= 0xBF) {
                        this._buffer <<= 6;
                        this._buffer |= (chunk[i] & 0x3F);
                        ++this._surrogate;
                        --this._state;
                    } else {
                        return function (i) {
                            var err = new Error('Invalid character');
                            err.code = 'INVALID_CHAR';
                            err.byteIndex = this._index;
                            err.surrogate = this._surrogate;
                            err.byteCode = chunk[i];
                            callback(err);
                        }.call(this, i);
                    }
                    break;
                default:
                    return function (i) {
                        var err = new Error('Invalid state: ' + this._state);
                        err.code = 'INVALID_STATE';
                        err.state = this._state;
                        err.byteIndex = this._index;
                        err.surrogate = this._surrogate;
                        err.byteCode = chunk[i];
                        callback(err);
                    }.call(this, i);
                }
            }
            callback();
        },
        utf16le: function (chunk, callback) {
            for (var i = 0; i < chunk.length; ++i, ++this._index) {
                switch (this._state) {
                case 0:
                    this._state = 1;
                    this._buffer = chunk[i];
                    break;
                case 1:
                    this._buffer = (chunk[i] << 8) | this._buffer;
                    if (this._buffer >= 0xD800 && this._buffer <= 0xDBFF) {
                        this._buffer = [this._buffer];
                        this._state = 2;
                    } else if (this._buffer >= 0xDC00 && this._buffer <= 0xDFFF) {
                        return function (i) {
                            var err = new Error('Unexpected low surrogate');
                            err.code = 'INVALID_CHAR';
                            err.byteIndex = this._index;
                            err.surrogate = 0;
                            err.byteCode = chunk[i];
                            err.charCode = this._buffer;
                            callback(err);
                        }.call(this, i);
                    } else {
                        this._passCharacter(this._buffer);
                        this._state = 0;
                    }
                    break;
                case 2:
                    this._state = 3;
                    this._buffer[1] = chunk[i];
                    break;
                case 3:
                    this._buffer[1] = (chunk[i] << 8) | this._buffer[1];
                    if (this._buffer[1] >= 0xDC00 && this._buffer[1] <= 0xDFFF) {
                        this._passCharacter(0x10000 + ((this._buffer[0] & 0x3FF) << 10) | (this._buffer[1] & 0x3FF));
                        this._state = 0;
                    } else {
                        return function (i) {
                            var err = new Error(
                                (this._buffer[1] >= 0xD800 && this._buffer[1] <= 0xDBFF)
                                    ? 'Unexpected high surrogate following high surrogate'
                                    : 'Unexpected non-surrogate following high surrogate'
                            );
                            err.code = 'INVALID_CHAR';
                            err.byteIndex = this._index;
                            err.surrogate = 1;
                            err.byteCode = chunk[i];
                            err.charCode = this._buffer[1];
                            callback(err);
                        }.call(this, i);
                    }
                    break;
                default:
                    return function (i) {
                        var err = new Error('Invalid state: ' + this._state);
                        err.code = 'INVALID_STATE';
                        err.state = this._state;
                        err.byteIndex = this._index;
                        err.surrogate = this._surrogate;
                        err.byteCode = chunk[i];
                        callback(err);
                    }.call(this, i);
                }
            }
            callback();
        },
        utf16be: function (chunk, callback) {
            for (var i = 0; i < chunk.length; ++i, ++this._index) {
                switch (this._state) {
                case 0:
                    this._state = 1;
                    this._buffer = chunk[i];
                    break;
                case 1:
                    this._buffer = (this._buffer << 8) | chunk[i];
                    if (this._buffer >= 0xD800 && this._buffer <= 0xDBFF) {
                        this._buffer = [this._buffer];
                        this._state = 2;
                    } else if (this._buffer >= 0xDC00 && this._buffer <= 0xDFFF) {
                        return function (i) {
                            var err = new Error('Unexpected low surrogate');
                            err.code = 'INVALID_CHAR';
                            err.byteIndex = this._index;
                            err.surrogate = 0;
                            err.byteCode = chunk[i];
                            err.charCode = this._buffer;
                            callback(err);
                        }.call(this, i);
                    } else {
                        this._passCharacter(this._buffer);
                        this._state = 0;
                    }
                    break;
                case 2:
                    this._state = 3;
                    this._buffer[1] = chunk[i];
                    break;
                case 3:
                    this._buffer[1] = (this._buffer[1] << 8) | chunk[i];
                    if (this._buffer[1] >= 0xDC00 && this._buffer[1] <= 0xDFFF) {
                        this._passCharacter(0x10000 + ((this._buffer[0] & 0x3FF) << 10) | (this._buffer[1] & 0x3FF));
                        this._state = 0;
                    } else {
                        return function (i) {
                            var err = new Error(
                                (this._buffer[1] >= 0xD800 && this._buffer[1] <= 0xDBFF)
                                    ? 'Unexpected high surrogate following high surrogate'
                                    : 'Unexpected non-surrogate following high surrogate'
                            );
                            err.code = 'INVALID_CHAR';
                            err.byteIndex = this._index;
                            err.surrogate = 1;
                            err.byteCode = chunk[i];
                            err.charCode = this._buffer[1];
                            callback(err);
                        }.call(this, i);
                    }
                    break;
                default:
                    return function (i) {
                        var err = new Error('Invalid state: ' + this._state);
                        err.code = 'INVALID_STATE';
                        err.state = this._state;
                        err.byteIndex = this._index;
                        err.surrogate = this._surrogate;
                        err.byteCode = chunk[i];
                        callback(err);
                    }.call(this, i);
                }
            }
            callback();
        },
        utf32le: function (chunk, callback) {
            for (var i = 0; i < chunk.length; ++i, ++this._index) {
                switch (this._state) {
                case 0:
                    this._buffer = chunk[i];
                    break;
                case 1:
                case 2:
                    this._buffer = (chunk[i] << 8) | this._buffer;
                    ++this._state;
                    break;
                case 3:
                    this._buffer = (chunk[i] << 8) | this._buffer;
                    this._passCharacter(this._buffer);
                    this._state = 0;
                    break;
                default:
                    return function (i) {
                        var err = new Error('Invalid state: ' + this._state);
                        err.code = 'INVALID_STATE';
                        err.state = this._state;
                        err.byteIndex = this._index;
                        err.surrogate = this._surrogate;
                        err.byteCode = chunk[i];
                        callback(err);
                    }.call(this, i);
                }
            }
            callback();
        },
        utf32be: function (chunk, callback) {
            for (var i = 0; i < chunk.length; ++i, ++this._index) {
                switch (this._state) {
                case 0:
                    this._buffer = chunk[i];
                    break;
                case 1:
                case 2:
                    this._buffer = (this._buffer << 8) | chunk[i];
                    ++this._state;
                    break;
                case 3:
                    this._buffer = (this._buffer << 8) | chunk[i];
                    this._passCharacter(this._buffer);
                    this._state = 0;
                    break;
                default:
                    return function (i) {
                        var err = new Error('Invalid state: ' + this._state);
                        err.code = 'INVALID_STATE';
                        err.state = this._state;
                        err.byteIndex = this._index;
                        err.surrogate = this._surrogate;
                        err.byteCode = chunk[i];
                        callback(err);
                    }.call(this, i);
                }
            }
            callback();
        },
        ascii: function (chunk, callback) {
            for (var i = 0; i < chunk.length; ++i, ++this._index) {
                if (chunk[i] >= 128) {
                    var err = new Error('Invalid character');
                    err.code = 'INVALID_CHAR';
                    err.byteIndex = this._index;
                    err.byteCode = chunk[i];
                    return void callback(err);
                }
                this.push(chunk[i]);
            }
            callback(null);
        }//,
        //cp37: function () {
        //},
        //cp930: function () {
        //},
        //cp1047: function () {
        //},
        //cp437: function () {
        //},
        //cp720: function () {
        //},
        //cp737: function () {
        //},
        //cp850: function () {
        //},
        //cp852: function () {
        //},
        //cp855: function () {
        //},
        //cp857: function () {
        //},
        //cp858: function () {
        //},
        //cp860: function () {
        //},
        //cp861: function () {
        //},
        //cp862: function () {
        //},
        //cp863: function () {
        //},
        //cp865: function () {
        //},
        //cp866: function () {
        //},
        //cp869: function () {
        //},
        //cp872: function () {
        //},
        //cp1251: function () {
        //},
        //cp1252: function () {
        //},
        //cp1253: function () {
        //},
        //cp1254: function () {
        //},
        //cp1255: function () {
        //},
        //cp1256: function () {
        //},
        //cp1257: function () {
        //},
        //cp1258: function () {
        //},
        //iso8859_1: function () {
        //},
        //iso8859_2: function () {
        //},
        //iso8859_3: function () {
        //},
        //iso8859_4: function () {
        //},
        //iso8859_5: function () {
        //},
        //iso8859_6: function () {
        //},
        //iso8859_7: function () {
        //},
        //iso8859_8: function () {
        //},
        //iso8859_9: function () {
        //},
        //iso8859_10: function () {
        //},
        //iso8859_11: function () {
        //},
        //iso8859_13: function () {
        //},
        //iso8859_14: function () {
        //},
        //iso8859_15: function () {
        //},
        //iso8859_16: function () {
        //},
        //koi8_r: function () {
        //},
        //koi8_u: function () {
        //},
        //koi7: function () {
        //},
        //mik: function () {
        //},
        //iscii: function () {
        //},
        //tscii: function () {
        //},
        //vscii: function () {
        //}
    };
    CharacterStream.encodingInit = {
        utf8: initWithUnicodeBOM,
        utf16le: initWithUnicodeBOM,
        utf16be: initWithUnicodeBOM,
        utf32le: initWithUnicodeBOM,
        utf32be: initWithUnicodeBOM
    };
    CharacterStream.encodingAlias = {
        'utf-8': 'utf8',
        'utf-16 le': 'utf16le',
        'utf-16 be': 'utf16be',
        'utf-32 le': 'utf32le',
        'utf-32 be': 'utf32be',
        'windows-1251': 'cp1251'
    };
    function initWithUnicodeBOM() {
        this._buffer = null;
        var passCharacter = function passCharacter(code) {
            return void this.push(code);
        }.bind(this);
        this._passCharacter = function ignoreBOM(code) {
            if (!(this.hasBOM = code === 0xFEFF)) {
                this.push(code);
            }
            this._passCharacter = passCharacter;
        }.bind(this);
        this._surrogate = 0;
        this.hasBOM = null;
    }
})();
