(function () {
    'use strict';
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
        this._state = 0;
        if ('encoding' in options) {
            if (typeof options.encoding !== 'string') {
                throw new TypeError('Expected encoding to be string');
            }
            this._encoding = options.encoding.toLowerCase();
        } else {
            this._encoding = 'utf-8';
        }
    };
    CharacterStream.prototype._transform = function(chunk, encoding, callback) {
        // TODO: If chunk is a string, encoding is the chunk encoding. We must convert it to buffer to process it further.
        // TODO: If chunk is a buffer, encoding is "buffer". We can start processing it directly.
    };
    CharacterStream.encoding = {
        utf8: function() {},
        utf16le: function() {},
        utf16be: function() {},
        utf32le: function() {},
        utf32be: function() {},
        ascii: function() {},
        cp37: function() {},
        cp930: function() {},
        cp1047: function() {},
        cp437: function() {},
        cp720: function() {},
        cp737: function() {},
        cp850: function() {},
        cp852: function() {},
        cp855: function() {},
        cp857: function() {},
        cp858: function() {},
        cp860: function() {},
        cp861: function() {},
        cp862: function() {},
        cp863: function() {},
        cp865: function() {},
        cp866: function() {},
        cp869: function() {},
        cp872: function() {},
        cp1251: function() {},
        cp1252: function() {},
        cp1253: function() {},
        cp1254: function() {},
        cp1255: function() {},
        cp1256: function() {},
        cp1257: function() {},
        cp1258: function() {},
        iso8859_1: function() {},
        iso8859_2: function() {},
        iso8859_3: function() {},
        iso8859_4: function() {},
        iso8859_5: function() {},
        iso8859_6: function() {},
        iso8859_7: function() {},
        iso8859_8: function() {},
        iso8859_9: function() {},
        iso8859_10: function() {},
        iso8859_11: function() {},
        iso8859_13: function() {},
        iso8859_14: function() {},
        iso8859_15: function() {},
        iso8859_16: function() {},
        koi8_r: function() {},
        koi8_u: function() {},
        koi7: function() {},
        mik: function() {},
        iscii: function() {},
        tscii: function() {},
        vscii: function() {}
    };
    CharacterStream.encodingAlias = {
        'utf-8': 'utf8',
        'utf-16 le': 'utf16le',
        'utf-16 be': 'utf16be',
        'utf-32 le': 'utf32le',
        'utf-32 be': 'utf32be',
        'windows-1251': 'cp1251'
    };
})();