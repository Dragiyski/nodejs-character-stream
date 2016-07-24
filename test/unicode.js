var fs = require('fs');
var path = require('path');
var assert = require('chai').assert;
var CharacterStream = require('..');

var encodings = [
    'utf8',
    'utf16le',
    'utf16be',
    'utf32le',
    'utf32be'
];

describe('Comparing unicode file against file', function () {
    encodings.forEach(function (encoding) {
        specify('with encoding ' + encoding, function (done) {
            var index = 0;
            var unicode = require('./encoded-files/unicode.json');
            fs.createReadStream(path.join(__dirname, 'encoded-files', encoding + '.txt')).pipe(CharacterStream({
                encoding: encoding
            })).on('data', function (code) {
                var i = index;
                var compareCode = unicode[index++];
                assert.strictEqual(code, compareCode, 'Code mismatch for encoding ' + encoding + ', expected ' + compareCode + ', but got ' + code + ', at index ' + i);
            }).once('error', function (err) {
                done(err);
            }).once('end', function () {
                done();
            });
        });
    });
});
