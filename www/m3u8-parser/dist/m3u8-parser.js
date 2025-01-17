/*! @name m3u8-parser @version 7.1.0 @license Apache-2.0 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.m3u8Parser = {}));
})(this, (function (exports) { 'use strict';

  /**
   * @file stream.js
   */

  /**
   * A lightweight readable stream implemention that handles event dispatching.
   *
   * @class Stream
   */
  var Stream = /*#__PURE__*/function () {
    function Stream() {
      this.listeners = {};
    }
    /**
     * Add a listener for a specified event type.
     *
     * @param {string} type the event name
     * @param {Function} listener the callback to be invoked when an event of
     * the specified type occurs
     */


    var _proto = Stream.prototype;

    _proto.on = function on(type, listener) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }

      this.listeners[type].push(listener);
    }
    /**
     * Remove a listener for a specified event type.
     *
     * @param {string} type the event name
     * @param {Function} listener  a function previously registered for this
     * type of event through `on`
     * @return {boolean} if we could turn it off or not
     */
    ;

    _proto.off = function off(type, listener) {
      if (!this.listeners[type]) {
        return false;
      }

      var index = this.listeners[type].indexOf(listener); // TODO: which is better?
      // In Video.js we slice listener functions
      // on trigger so that it does not mess up the order
      // while we loop through.
      //
      // Here we slice on off so that the loop in trigger
      // can continue using it's old reference to loop without
      // messing up the order.

      this.listeners[type] = this.listeners[type].slice(0);
      this.listeners[type].splice(index, 1);
      return index > -1;
    }
    /**
     * Trigger an event of the specified type on this stream. Any additional
     * arguments to this function are passed as parameters to event listeners.
     *
     * @param {string} type the event name
     */
    ;

    _proto.trigger = function trigger(type) {
      var callbacks = this.listeners[type];

      if (!callbacks) {
        return;
      } // Slicing the arguments on every invocation of this method
      // can add a significant amount of overhead. Avoid the
      // intermediate object creation for the common case of a
      // single callback argument


      if (arguments.length === 2) {
        var length = callbacks.length;

        for (var i = 0; i < length; ++i) {
          callbacks[i].call(this, arguments[1]);
        }
      } else {
        var args = Array.prototype.slice.call(arguments, 1);
        var _length = callbacks.length;

        for (var _i = 0; _i < _length; ++_i) {
          callbacks[_i].apply(this, args);
        }
      }
    }
    /**
     * Destroys the stream and cleans up.
     */
    ;

    _proto.dispose = function dispose() {
      this.listeners = {};
    }
    /**
     * Forwards all `data` events on this stream to the destination stream. The
     * destination stream should provide a method `push` to receive the data
     * events as they arrive.
     *
     * @param {Stream} destination the stream that will receive all `data` events
     * @see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
     */
    ;

    _proto.pipe = function pipe(destination) {
      this.on('data', function (data) {
        destination.push(data);
      });
    };

    return Stream;
  }();

  /**
   * @file m3u8/line-stream.js
   */
  /**
   * A stream that buffers string input and generates a `data` event for each
   * line.
   *
   * @class LineStream
   * @extends Stream
   */

  class LineStream extends Stream {
    constructor() {
      super();
      this.buffer = '';
    }
    /**
     * Add new data to be parsed.
     *
     * @param {string} data the text to process
     */


    push(data) {
      let nextNewline;
      this.buffer += data;
      nextNewline = this.buffer.indexOf('\n');

      for (; nextNewline > -1; nextNewline = this.buffer.indexOf('\n')) {
        this.trigger('data', this.buffer.substring(0, nextNewline));
        this.buffer = this.buffer.substring(nextNewline + 1);
      }
    }

  }

  function _extends() {
    _extends_1 = _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }

      return target;
    };

    return _extends.apply(this, arguments);
  }

  var _extends_1 = _extends;
  var _extends$1 = _extends_1;

  const TAB = String.fromCharCode(0x09);

  const parseByterange = function (byterangeString) {
    // optionally match and capture 0+ digits before `@`
    // optionally match and capture 0+ digits after `@`
    const match = /([0-9.]*)?@?([0-9.]*)?/.exec(byterangeString || '');
    const result = {};

    if (match[1]) {
      result.length = parseInt(match[1], 10);
    }

    if (match[2]) {
      result.offset = parseInt(match[2], 10);
    }

    return result;
  };
  /**
   * "forgiving" attribute list psuedo-grammar:
   * attributes -> keyvalue (',' keyvalue)*
   * keyvalue   -> key '=' value
   * key        -> [^=]*
   * value      -> '"' [^"]* '"' | [^,]*
   */


  const attributeSeparator = function () {
    const key = '[^=]*';
    const value = '"[^"]*"|[^,]*';
    const keyvalue = '(?:' + key + ')=(?:' + value + ')';
    return new RegExp('(?:^|,)(' + keyvalue + ')');
  };
  /**
   * Parse attributes from a line given the separator
   *
   * @param {string} attributes the attribute line to parse
   */


  const parseAttributes = function (attributes) {
    const result = {};

    if (!attributes) {
      return result;
    } // split the string using attributes as the separator


    const attrs = attributes.split(attributeSeparator());
    let i = attrs.length;
    let attr;

    while (i--) {
      // filter out unmatched portions of the string
      if (attrs[i] === '') {
        continue;
      } // split the key and value


      attr = /([^=]*)=(.*)/.exec(attrs[i]).slice(1); // trim whitespace and remove optional quotes around the value

      attr[0] = attr[0].replace(/^\s+|\s+$/g, '');
      attr[1] = attr[1].replace(/^\s+|\s+$/g, '');
      attr[1] = attr[1].replace(/^['"](.*)['"]$/g, '$1');
      result[attr[0]] = attr[1];
    }

    return result;
  };
  /**
   * A line-level M3U8 parser event stream. It expects to receive input one
   * line at a time and performs a context-free parse of its contents. A stream
   * interpretation of a manifest can be useful if the manifest is expected to
   * be too large to fit comfortably into memory or the entirety of the input
   * is not immediately available. Otherwise, it's probably much easier to work
   * with a regular `Parser` object.
   *
   * Produces `data` events with an object that captures the parser's
   * interpretation of the input. That object has a property `tag` that is one
   * of `uri`, `comment`, or `tag`. URIs only have a single additional
   * property, `line`, which captures the entirety of the input without
   * interpretation. Comments similarly have a single additional property
   * `text` which is the input without the leading `#`.
   *
   * Tags always have a property `tagType` which is the lower-cased version of
   * the M3U8 directive without the `#EXT` or `#EXT-X-` prefix. For instance,
   * `#EXT-X-MEDIA-SEQUENCE` becomes `media-sequence` when parsed. Unrecognized
   * tags are given the tag type `unknown` and a single additional property
   * `data` with the remainder of the input.
   *
   * @class ParseStream
   * @extends Stream
   */


  class ParseStream extends Stream {
    constructor() {
      super();
      this.customParsers = [];
      this.tagMappers = [];
    }
    /**
     * Parses an additional line of input.
     *
     * @param {string} line a single line of an M3U8 file to parse
     */


    push(line) {
      let match;
      let event; // strip whitespace

      line = line.trim();

      if (line.length === 0) {
        // ignore empty lines
        return;
      } // URIs


      if (line[0] !== '#') {
        this.trigger('data', {
          type: 'uri',
          uri: line
        });
        return;
      } // map tags


      const newLines = this.tagMappers.reduce((acc, mapper) => {
        const mappedLine = mapper(line); // skip if unchanged

        if (mappedLine === line) {
          return acc;
        }

        return acc.concat([mappedLine]);
      }, [line]);
      newLines.forEach(newLine => {
        for (let i = 0; i < this.customParsers.length; i++) {
          if (this.customParsers[i].call(this, newLine)) {
            return;
          }
        } // Comments


        if (newLine.indexOf('#EXT') !== 0) {
          this.trigger('data', {
            type: 'comment',
            text: newLine.slice(1)
          });
          return;
        } // strip off any carriage returns here so the regex matching
        // doesn't have to account for them.


        newLine = newLine.replace('\r', ''); // Tags

        match = /^#EXTM3U/.exec(newLine);

        if (match) {
          this.trigger('data', {
            type: 'tag',
            tagType: 'm3u'
          });
          return;
        }

        match = /^#EXTINF:([0-9\.]*)?,?(.*)?$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'inf'
          };

          if (match[1]) {
            event.duration = parseFloat(match[1]);
          }

          if (match[2]) {
            event.title = match[2];
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-TARGETDURATION:([0-9.]*)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'targetduration'
          };

          if (match[1]) {
            event.duration = parseInt(match[1], 10);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-VERSION:([0-9.]*)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'version'
          };

          if (match[1]) {
            event.version = parseInt(match[1], 10);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-MEDIA-SEQUENCE:(\-?[0-9.]*)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'media-sequence'
          };

          if (match[1]) {
            event.number = parseInt(match[1], 10);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-DISCONTINUITY-SEQUENCE:(\-?[0-9.]*)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'discontinuity-sequence'
          };

          if (match[1]) {
            event.number = parseInt(match[1], 10);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-PLAYLIST-TYPE:(.*)?$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'playlist-type'
          };

          if (match[1]) {
            event.playlistType = match[1];
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-BYTERANGE:(.*)?$/.exec(newLine);

        if (match) {
          event = _extends$1(parseByterange(match[1]), {
            type: 'tag',
            tagType: 'byterange'
          });
          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-ALLOW-CACHE:(YES|NO)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'allow-cache'
          };

          if (match[1]) {
            event.allowed = !/NO/.test(match[1]);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-MAP:(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'map'
          };

          if (match[1]) {
            const attributes = parseAttributes(match[1]);

            if (attributes.URI) {
              event.uri = attributes.URI;
            }

            if (attributes.BYTERANGE) {
              event.byterange = parseByterange(attributes.BYTERANGE);
            }
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-STREAM-INF:(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'stream-inf'
          };

          if (match[1]) {
            event.attributes = parseAttributes(match[1]);

            if (event.attributes.RESOLUTION) {
              const split = event.attributes.RESOLUTION.split('x');
              const resolution = {};

              if (split[0]) {
                resolution.width = parseInt(split[0], 10);
              }

              if (split[1]) {
                resolution.height = parseInt(split[1], 10);
              }

              event.attributes.RESOLUTION = resolution;
            }

            if (event.attributes.BANDWIDTH) {
              event.attributes.BANDWIDTH = parseInt(event.attributes.BANDWIDTH, 10);
            }

            if (event.attributes['FRAME-RATE']) {
              event.attributes['FRAME-RATE'] = parseFloat(event.attributes['FRAME-RATE']);
            }

            if (event.attributes['PROGRAM-ID']) {
              event.attributes['PROGRAM-ID'] = parseInt(event.attributes['PROGRAM-ID'], 10);
            }
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-MEDIA:(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'media'
          };

          if (match[1]) {
            event.attributes = parseAttributes(match[1]);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-ENDLIST/.exec(newLine);

        if (match) {
          this.trigger('data', {
            type: 'tag',
            tagType: 'endlist'
          });
          return;
        }

        match = /^#EXT-X-DISCONTINUITY/.exec(newLine);

        if (match) {
          this.trigger('data', {
            type: 'tag',
            tagType: 'discontinuity'
          });
          return;
        }

        match = /^#EXT-X-PROGRAM-DATE-TIME:(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'program-date-time'
          };

          if (match[1]) {
            event.dateTimeString = match[1];
            event.dateTimeObject = new Date(match[1]);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-KEY:(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'key'
          };

          if (match[1]) {
            event.attributes = parseAttributes(match[1]); // parse the IV string into a Uint32Array

            if (event.attributes.IV) {
              if (event.attributes.IV.substring(0, 2).toLowerCase() === '0x') {
                event.attributes.IV = event.attributes.IV.substring(2);
              }

              event.attributes.IV = event.attributes.IV.match(/.{8}/g);
              event.attributes.IV[0] = parseInt(event.attributes.IV[0], 16);
              event.attributes.IV[1] = parseInt(event.attributes.IV[1], 16);
              event.attributes.IV[2] = parseInt(event.attributes.IV[2], 16);
              event.attributes.IV[3] = parseInt(event.attributes.IV[3], 16);
              event.attributes.IV = new Uint32Array(event.attributes.IV);
            }
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-START:(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'start'
          };

          if (match[1]) {
            event.attributes = parseAttributes(match[1]);
            event.attributes['TIME-OFFSET'] = parseFloat(event.attributes['TIME-OFFSET']);
            event.attributes.PRECISE = /YES/.test(event.attributes.PRECISE);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-CUE-OUT-CONT:(.*)?$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'cue-out-cont'
          };

          if (match[1]) {
            event.data = match[1];
          } else {
            event.data = '';
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-CUE-OUT:(.*)?$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'cue-out'
          };

          if (match[1]) {
            event.data = match[1];
          } else {
            event.data = '';
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-CUE-IN:(.*)?$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'cue-in'
          };

          if (match[1]) {
            event.data = match[1];
          } else {
            event.data = '';
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-SKIP:(.*)$/.exec(newLine);

        if (match && match[1]) {
          event = {
            type: 'tag',
            tagType: 'skip'
          };
          event.attributes = parseAttributes(match[1]);

          if (event.attributes.hasOwnProperty('SKIPPED-SEGMENTS')) {
            event.attributes['SKIPPED-SEGMENTS'] = parseInt(event.attributes['SKIPPED-SEGMENTS'], 10);
          }

          if (event.attributes.hasOwnProperty('RECENTLY-REMOVED-DATERANGES')) {
            event.attributes['RECENTLY-REMOVED-DATERANGES'] = event.attributes['RECENTLY-REMOVED-DATERANGES'].split(TAB);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-PART:(.*)$/.exec(newLine);

        if (match && match[1]) {
          event = {
            type: 'tag',
            tagType: 'part'
          };
          event.attributes = parseAttributes(match[1]);
          ['DURATION'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = parseFloat(event.attributes[key]);
            }
          });
          ['INDEPENDENT', 'GAP'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = /YES/.test(event.attributes[key]);
            }
          });

          if (event.attributes.hasOwnProperty('BYTERANGE')) {
            event.attributes.byterange = parseByterange(event.attributes.BYTERANGE);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-SERVER-CONTROL:(.*)$/.exec(newLine);

        if (match && match[1]) {
          event = {
            type: 'tag',
            tagType: 'server-control'
          };
          event.attributes = parseAttributes(match[1]);
          ['CAN-SKIP-UNTIL', 'PART-HOLD-BACK', 'HOLD-BACK'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = parseFloat(event.attributes[key]);
            }
          });
          ['CAN-SKIP-DATERANGES', 'CAN-BLOCK-RELOAD'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = /YES/.test(event.attributes[key]);
            }
          });
          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-PART-INF:(.*)$/.exec(newLine);

        if (match && match[1]) {
          event = {
            type: 'tag',
            tagType: 'part-inf'
          };
          event.attributes = parseAttributes(match[1]);
          ['PART-TARGET'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = parseFloat(event.attributes[key]);
            }
          });
          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-PRELOAD-HINT:(.*)$/.exec(newLine);

        if (match && match[1]) {
          event = {
            type: 'tag',
            tagType: 'preload-hint'
          };
          event.attributes = parseAttributes(match[1]);
          ['BYTERANGE-START', 'BYTERANGE-LENGTH'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = parseInt(event.attributes[key], 10);
              const subkey = key === 'BYTERANGE-LENGTH' ? 'length' : 'offset';
              event.attributes.byterange = event.attributes.byterange || {};
              event.attributes.byterange[subkey] = event.attributes[key]; // only keep the parsed byterange object.

              delete event.attributes[key];
            }
          });
          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-RENDITION-REPORT:(.*)$/.exec(newLine);

        if (match && match[1]) {
          event = {
            type: 'tag',
            tagType: 'rendition-report'
          };
          event.attributes = parseAttributes(match[1]);
          ['LAST-MSN', 'LAST-PART'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = parseInt(event.attributes[key], 10);
            }
          });
          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-DATERANGE:(.*)$/.exec(newLine);

        if (match && match[1]) {
          event = {
            type: 'tag',
            tagType: 'daterange'
          };
          event.attributes = parseAttributes(match[1]);
          ['ID', 'CLASS'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = String(event.attributes[key]);
            }
          });
          ['START-DATE', 'END-DATE'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = new Date(event.attributes[key]);
            }
          });
          ['DURATION', 'PLANNED-DURATION'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = parseFloat(event.attributes[key]);
            }
          });
          ['END-ON-NEXT'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = /YES/i.test(event.attributes[key]);
            }
          });
          ['SCTE35-CMD', ' SCTE35-OUT', 'SCTE35-IN'].forEach(function (key) {
            if (event.attributes.hasOwnProperty(key)) {
              event.attributes[key] = event.attributes[key].toString(16);
            }
          });
          const clientAttributePattern = /^X-([A-Z]+-)+[A-Z]+$/;

          for (const key in event.attributes) {
            if (!clientAttributePattern.test(key)) {
              continue;
            }

            const isHexaDecimal = /[0-9A-Fa-f]{6}/g.test(event.attributes[key]);
            const isDecimalFloating = /^\d+(\.\d+)?$/.test(event.attributes[key]);
            event.attributes[key] = isHexaDecimal ? event.attributes[key].toString(16) : isDecimalFloating ? parseFloat(event.attributes[key]) : String(event.attributes[key]);
          }

          this.trigger('data', event);
          return;
        }

        match = /^#EXT-X-INDEPENDENT-SEGMENTS/.exec(newLine);

        if (match) {
          this.trigger('data', {
            type: 'tag',
            tagType: 'independent-segments'
          });
          return;
        }

        match = /^#EXT-X-CONTENT-STEERING:(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'content-steering'
          };
          event.attributes = parseAttributes(match[1]);
          this.trigger('data', event);
          return;
        } // unknown tag type


        this.trigger('data', {
          type: 'tag',
          data: newLine.slice(4)
        });
      });
    }
    /**
     * Add a parser for custom headers
     *
     * @param {Object}   options              a map of options for the added parser
     * @param {RegExp}   options.expression   a regular expression to match the custom header
     * @param {string}   options.customType   the custom type to register to the output
     * @param {Function} [options.dataParser] function to parse the line into an object
     * @param {boolean}  [options.segment]    should tag data be attached to the segment object
     */


    addParser({
      expression,
      customType,
      dataParser,
      segment
    }) {
      if (typeof dataParser !== 'function') {
        dataParser = line => line;
      }

      this.customParsers.push(line => {
        const match = expression.exec(line);

        if (match) {
          this.trigger('data', {
            type: 'custom',
            data: dataParser(line),
            customType,
            segment
          });
          return true;
        }
      });
    }
    /**
     * Add a custom header mapper
     *
     * @param {Object}   options
     * @param {RegExp}   options.expression   a regular expression to match the custom header
     * @param {Function} options.map          function to translate tag into a different tag
     */


    addTagMapper({
      expression,
      map
    }) {
      const mapFn = line => {
        if (expression.test(line)) {
          return map(line);
        }

        return line;
      };

      this.tagMappers.push(mapFn);
    }

  }

  var atob = function atob(s) {
    return window.atob ? window.atob(s) : Buffer.from(s, 'base64').toString('binary');
  };

  function decodeB64ToUint8Array(b64Text) {
    var decodedString = atob(b64Text);
    var array = new Uint8Array(decodedString.length);

    for (var i = 0; i < decodedString.length; i++) {
      array[i] = decodedString.charCodeAt(i);
    }

    return array;
  }

  const camelCase = str => str.toLowerCase().replace(/-(\w)/g, a => a[1].toUpperCase());

  const camelCaseKeys = function (attributes) {
    const result = {};
    Object.keys(attributes).forEach(function (key) {
      result[camelCase(key)] = attributes[key];
    });
    return result;
  }; // set SERVER-CONTROL hold back based upon targetDuration and partTargetDuration
  // we need this helper because defaults are based upon targetDuration and
  // partTargetDuration being set, but they may not be if SERVER-CONTROL appears before
  // target durations are set.


  const setHoldBack = function (manifest) {
    const {
      serverControl,
      targetDuration,
      partTargetDuration
    } = manifest;

    if (!serverControl) {
      return;
    }

    const tag = '#EXT-X-SERVER-CONTROL';
    const hb = 'holdBack';
    const phb = 'partHoldBack';
    const minTargetDuration = targetDuration && targetDuration * 3;
    const minPartDuration = partTargetDuration && partTargetDuration * 2;

    if (targetDuration && !serverControl.hasOwnProperty(hb)) {
      serverControl[hb] = minTargetDuration;
      this.trigger('info', {
        message: `${tag} defaulting HOLD-BACK to targetDuration * 3 (${minTargetDuration}).`
      });
    }

    if (minTargetDuration && serverControl[hb] < minTargetDuration) {
      this.trigger('warn', {
        message: `${tag} clamping HOLD-BACK (${serverControl[hb]}) to targetDuration * 3 (${minTargetDuration})`
      });
      serverControl[hb] = minTargetDuration;
    } // default no part hold back to part target duration * 3


    if (partTargetDuration && !serverControl.hasOwnProperty(phb)) {
      serverControl[phb] = partTargetDuration * 3;
      this.trigger('info', {
        message: `${tag} defaulting PART-HOLD-BACK to partTargetDuration * 3 (${serverControl[phb]}).`
      });
    } // if part hold back is too small default it to part target duration * 2


    if (partTargetDuration && serverControl[phb] < minPartDuration) {
      this.trigger('warn', {
        message: `${tag} clamping PART-HOLD-BACK (${serverControl[phb]}) to partTargetDuration * 2 (${minPartDuration}).`
      });
      serverControl[phb] = minPartDuration;
    }
  };
  /**
   * A parser for M3U8 files. The current interpretation of the input is
   * exposed as a property `manifest` on parser objects. It's just two lines to
   * create and parse a manifest once you have the contents available as a string:
   *
   * ```js
   * var parser = new m3u8.Parser();
   * parser.push(xhr.responseText);
   * ```
   *
   * New input can later be applied to update the manifest object by calling
   * `push` again.
   *
   * The parser attempts to create a usable manifest object even if the
   * underlying input is somewhat nonsensical. It emits `info` and `warning`
   * events during the parse if it encounters input that seems invalid or
   * requires some property of the manifest object to be defaulted.
   *
   * @class Parser
   * @extends Stream
   */


  class Parser extends Stream {
    constructor() {
      super();
      this.lineStream = new LineStream();
      this.parseStream = new ParseStream();
      this.lineStream.pipe(this.parseStream);
      this.lastProgramDateTime = null;
      /* eslint-disable consistent-this */

      const self = this;
      /* eslint-enable consistent-this */

      const uris = [];
      let currentUri = {}; // if specified, the active EXT-X-MAP definition

      let currentMap; // if specified, the active decryption key

      let key;
      let hasParts = false;

      const noop = function () {};

      const defaultMediaGroups = {
        'AUDIO': {},
        'VIDEO': {},
        'CLOSED-CAPTIONS': {},
        'SUBTITLES': {}
      }; // This is the Widevine UUID from DASH IF IOP. The same exact string is
      // used in MPDs with Widevine encrypted streams.

      const widevineUuid = 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed'; // group segments into numbered timelines delineated by discontinuities

      let currentTimeline = 0; // the manifest is empty until the parse stream begins delivering data

      this.manifest = {
        allowCache: true,
        discontinuityStarts: [],
        dateRanges: [],
        segments: []
      }; // keep track of the last seen segment's byte range end, as segments are not required
      // to provide the offset, in which case it defaults to the next byte after the
      // previous segment

      let lastByterangeEnd = 0; // keep track of the last seen part's byte range end.

      let lastPartByterangeEnd = 0;
      const dateRangeTags = {};
      this.on('end', () => {
        // only add preloadSegment if we don't yet have a uri for it.
        // and we actually have parts/preloadHints
        if (currentUri.uri || !currentUri.parts && !currentUri.preloadHints) {
          return;
        }

        if (!currentUri.map && currentMap) {
          currentUri.map = currentMap;
        }

        if (!currentUri.key && key) {
          currentUri.key = key;
        }

        if (!currentUri.timeline && typeof currentTimeline === 'number') {
          currentUri.timeline = currentTimeline;
        }

        this.manifest.preloadSegment = currentUri;
      }); // update the manifest with the m3u8 entry from the parse stream

      this.parseStream.on('data', function (entry) {
        let mediaGroup;
        let rendition;
        ({
          tag() {
            // switch based on the tag type
            (({
              version() {
                if (entry.version) {
                  this.manifest.version = entry.version;
                }
              },

              'allow-cache'() {
                this.manifest.allowCache = entry.allowed;

                if (!('allowed' in entry)) {
                  this.trigger('info', {
                    message: 'defaulting allowCache to YES'
                  });
                  this.manifest.allowCache = true;
                }
              },

              byterange() {
                const byterange = {};

                if ('length' in entry) {
                  currentUri.byterange = byterange;
                  byterange.length = entry.length;

                  if (!('offset' in entry)) {
                    /*
                     * From the latest spec (as of this writing):
                     * https://tools.ietf.org/html/draft-pantos-http-live-streaming-23#section-4.3.2.2
                     *
                     * Same text since EXT-X-BYTERANGE's introduction in draft 7:
                     * https://tools.ietf.org/html/draft-pantos-http-live-streaming-07#section-3.3.1)
                     *
                     * "If o [offset] is not present, the sub-range begins at the next byte
                     * following the sub-range of the previous media segment."
                     */
                    entry.offset = lastByterangeEnd;
                  }
                }

                if ('offset' in entry) {
                  currentUri.byterange = byterange;
                  byterange.offset = entry.offset;
                }

                lastByterangeEnd = byterange.offset + byterange.length;
              },

              endlist() {
                this.manifest.endList = true;
              },

              inf() {
                if (!('mediaSequence' in this.manifest)) {
                  this.manifest.mediaSequence = 0;
                  this.trigger('info', {
                    message: 'defaulting media sequence to zero'
                  });
                }

                if (!('discontinuitySequence' in this.manifest)) {
                  this.manifest.discontinuitySequence = 0;
                  this.trigger('info', {
                    message: 'defaulting discontinuity sequence to zero'
                  });
                }

                if (entry.title) {
                  currentUri.title = entry.title;
                }

                if (entry.duration > 0) {
                  currentUri.duration = entry.duration;
                }

                if (entry.duration === 0) {
                  currentUri.duration = 0.01;
                  this.trigger('info', {
                    message: 'updating zero segment duration to a small value'
                  });
                }

                this.manifest.segments = uris;
              },

              key() {
                if (!entry.attributes) {
                  this.trigger('warn', {
                    message: 'ignoring key declaration without attribute list'
                  });
                  return;
                } // clear the active encryption key


                if (entry.attributes.METHOD === 'NONE') {
                  key = null;
                  return;
                }

                if (!entry.attributes.URI) {
                  this.trigger('warn', {
                    message: 'ignoring key declaration without URI'
                  });
                  return;
                }

                if (entry.attributes.KEYFORMAT === 'com.apple.streamingkeydelivery') {
                  this.manifest.contentProtection = this.manifest.contentProtection || {}; // TODO: add full support for this.

                  this.manifest.contentProtection['com.apple.fps.1_0'] = {
                    attributes: entry.attributes
                  };
                  return;
                }

                if (entry.attributes.KEYFORMAT === 'com.microsoft.playready') {
                  this.manifest.contentProtection = this.manifest.contentProtection || {}; // TODO: add full support for this.

                  this.manifest.contentProtection['com.microsoft.playready'] = {
                    uri: entry.attributes.URI
                  };
                  return;
                } // check if the content is encrypted for Widevine
                // Widevine/HLS spec: https://storage.googleapis.com/wvdocs/Widevine_DRM_HLS.pdf


                if (entry.attributes.KEYFORMAT === widevineUuid) {
                  const VALID_METHODS = ['SAMPLE-AES', 'SAMPLE-AES-CTR', 'SAMPLE-AES-CENC'];

                  if (VALID_METHODS.indexOf(entry.attributes.METHOD) === -1) {
                    this.trigger('warn', {
                      message: 'invalid key method provided for Widevine'
                    });
                    return;
                  }

                  if (entry.attributes.METHOD === 'SAMPLE-AES-CENC') {
                    this.trigger('warn', {
                      message: 'SAMPLE-AES-CENC is deprecated, please use SAMPLE-AES-CTR instead'
                    });
                  }

                  if (entry.attributes.URI.substring(0, 23) !== 'data:text/plain;base64,') {
                    this.trigger('warn', {
                      message: 'invalid key URI provided for Widevine'
                    });
                    return;
                  }

                  if (!(entry.attributes.KEYID && entry.attributes.KEYID.substring(0, 2) === '0x')) {
                    this.trigger('warn', {
                      message: 'invalid key ID provided for Widevine'
                    });
                    return;
                  } // if Widevine key attributes are valid, store them as `contentProtection`
                  // on the manifest to emulate Widevine tag structure in a DASH mpd


                  this.manifest.contentProtection = this.manifest.contentProtection || {};
                  this.manifest.contentProtection['com.widevine.alpha'] = {
                    attributes: {
                      schemeIdUri: entry.attributes.KEYFORMAT,
                      // remove '0x' from the key id string
                      keyId: entry.attributes.KEYID.substring(2)
                    },
                    // decode the base64-encoded PSSH box
                    pssh: decodeB64ToUint8Array(entry.attributes.URI.split(',')[1])
                  };
                  return;
                }

                if (!entry.attributes.METHOD) {
                  this.trigger('warn', {
                    message: 'defaulting key method to AES-128'
                  });
                } // setup an encryption key for upcoming segments


                key = {
                  method: entry.attributes.METHOD || 'AES-128',
                  uri: entry.attributes.URI
                };

                if (typeof entry.attributes.IV !== 'undefined') {
                  key.iv = entry.attributes.IV;
                }
              },

              'media-sequence'() {
                if (!isFinite(entry.number)) {
                  this.trigger('warn', {
                    message: 'ignoring invalid media sequence: ' + entry.number
                  });
                  return;
                }

                this.manifest.mediaSequence = entry.number;
              },

              'discontinuity-sequence'() {
                if (!isFinite(entry.number)) {
                  this.trigger('warn', {
                    message: 'ignoring invalid discontinuity sequence: ' + entry.number
                  });
                  return;
                }

                this.manifest.discontinuitySequence = entry.number;
                currentTimeline = entry.number;
              },

              'playlist-type'() {
                if (!/VOD|EVENT/.test(entry.playlistType)) {
                  this.trigger('warn', {
                    message: 'ignoring unknown playlist type: ' + entry.playlist
                  });
                  return;
                }

                this.manifest.playlistType = entry.playlistType;
              },

              map() {
                currentMap = {};

                if (entry.uri) {
                  currentMap.uri = entry.uri;
                }

                if (entry.byterange) {
                  currentMap.byterange = entry.byterange;
                }

                if (key) {
                  currentMap.key = key;
                }
              },

              'stream-inf'() {
                this.manifest.playlists = uris;
                this.manifest.mediaGroups = this.manifest.mediaGroups || defaultMediaGroups;

                if (!entry.attributes) {
                  this.trigger('warn', {
                    message: 'ignoring empty stream-inf attributes'
                  });
                  return;
                }

                if (!currentUri.attributes) {
                  currentUri.attributes = {};
                }

                _extends$1(currentUri.attributes, entry.attributes);
              },

              media() {
                this.manifest.mediaGroups = this.manifest.mediaGroups || defaultMediaGroups;

                if (!(entry.attributes && entry.attributes.TYPE && entry.attributes['GROUP-ID'] && entry.attributes.NAME)) {
                  this.trigger('warn', {
                    message: 'ignoring incomplete or missing media group'
                  });
                  return;
                } // find the media group, creating defaults as necessary


                const mediaGroupType = this.manifest.mediaGroups[entry.attributes.TYPE];
                mediaGroupType[entry.attributes['GROUP-ID']] = mediaGroupType[entry.attributes['GROUP-ID']] || {};
                mediaGroup = mediaGroupType[entry.attributes['GROUP-ID']]; // collect the rendition metadata

                rendition = {
                  default: /yes/i.test(entry.attributes.DEFAULT)
                };

                if (rendition.default) {
                  rendition.autoselect = true;
                } else {
                  rendition.autoselect = /yes/i.test(entry.attributes.AUTOSELECT);
                }

                if (entry.attributes.LANGUAGE) {
                  rendition.language = entry.attributes.LANGUAGE;
                }

                if (entry.attributes.URI) {
                  rendition.uri = entry.attributes.URI;
                }

                if (entry.attributes['INSTREAM-ID']) {
                  rendition.instreamId = entry.attributes['INSTREAM-ID'];
                }

                if (entry.attributes.CHARACTERISTICS) {
                  rendition.characteristics = entry.attributes.CHARACTERISTICS;
                }

                if (entry.attributes.FORCED) {
                  rendition.forced = /yes/i.test(entry.attributes.FORCED);
                } // insert the new rendition


                mediaGroup[entry.attributes.NAME] = rendition;
              },

              discontinuity() {
                currentTimeline += 1;
                currentUri.discontinuity = true;
                this.manifest.discontinuityStarts.push(uris.length);
              },

              'program-date-time'() {
                if (typeof this.manifest.dateTimeString === 'undefined') {
                  // PROGRAM-DATE-TIME is a media-segment tag, but for backwards
                  // compatibility, we add the first occurence of the PROGRAM-DATE-TIME tag
                  // to the manifest object
                  // TODO: Consider removing this in future major version
                  this.manifest.dateTimeString = entry.dateTimeString;
                  this.manifest.dateTimeObject = entry.dateTimeObject;
                }

                currentUri.dateTimeString = entry.dateTimeString;
                currentUri.dateTimeObject = entry.dateTimeObject;
                const {
                  lastProgramDateTime
                } = this;
                this.lastProgramDateTime = new Date(entry.dateTimeString).getTime(); // We should extrapolate Program Date Time backward only during first program date time occurrence.
                // Once we have at least one program date time point, we can always extrapolate it forward using lastProgramDateTime reference.

                if (lastProgramDateTime === null) {
                  // Extrapolate Program Date Time backward
                  // Since it is first program date time occurrence we're assuming that
                  // all this.manifest.segments have no program date time info
                  this.manifest.segments.reduceRight((programDateTime, segment) => {
                    segment.programDateTime = programDateTime - segment.duration * 1000;
                    return segment.programDateTime;
                  }, this.lastProgramDateTime);
                }
              },

              targetduration() {
                if (!isFinite(entry.duration) || entry.duration < 0) {
                  this.trigger('warn', {
                    message: 'ignoring invalid target duration: ' + entry.duration
                  });
                  return;
                }

                this.manifest.targetDuration = entry.duration;
                setHoldBack.call(this, this.manifest);
              },

              start() {
                if (!entry.attributes || isNaN(entry.attributes['TIME-OFFSET'])) {
                  this.trigger('warn', {
                    message: 'ignoring start declaration without appropriate attribute list'
                  });
                  return;
                }

                this.manifest.start = {
                  timeOffset: entry.attributes['TIME-OFFSET'],
                  precise: entry.attributes.PRECISE
                };
              },

              'cue-out'() {
                currentUri.cueOut = entry.data;
              },

              'cue-out-cont'() {
                currentUri.cueOutCont = entry.data;
              },

              'cue-in'() {
                currentUri.cueIn = entry.data;
              },

              'skip'() {
                this.manifest.skip = camelCaseKeys(entry.attributes);
                this.warnOnMissingAttributes_('#EXT-X-SKIP', entry.attributes, ['SKIPPED-SEGMENTS']);
              },

              'part'() {
                hasParts = true; // parts are always specifed before a segment

                const segmentIndex = this.manifest.segments.length;
                const part = camelCaseKeys(entry.attributes);
                currentUri.parts = currentUri.parts || [];
                currentUri.parts.push(part);

                if (part.byterange) {
                  if (!part.byterange.hasOwnProperty('offset')) {
                    part.byterange.offset = lastPartByterangeEnd;
                  }

                  lastPartByterangeEnd = part.byterange.offset + part.byterange.length;
                }

                const partIndex = currentUri.parts.length - 1;
                this.warnOnMissingAttributes_(`#EXT-X-PART #${partIndex} for segment #${segmentIndex}`, entry.attributes, ['URI', 'DURATION']);

                if (this.manifest.renditionReports) {
                  this.manifest.renditionReports.forEach((r, i) => {
                    if (!r.hasOwnProperty('lastPart')) {
                      this.trigger('warn', {
                        message: `#EXT-X-RENDITION-REPORT #${i} lacks required attribute(s): LAST-PART`
                      });
                    }
                  });
                }
              },

              'server-control'() {
                const attrs = this.manifest.serverControl = camelCaseKeys(entry.attributes);

                if (!attrs.hasOwnProperty('canBlockReload')) {
                  attrs.canBlockReload = false;
                  this.trigger('info', {
                    message: '#EXT-X-SERVER-CONTROL defaulting CAN-BLOCK-RELOAD to false'
                  });
                }

                setHoldBack.call(this, this.manifest);

                if (attrs.canSkipDateranges && !attrs.hasOwnProperty('canSkipUntil')) {
                  this.trigger('warn', {
                    message: '#EXT-X-SERVER-CONTROL lacks required attribute CAN-SKIP-UNTIL which is required when CAN-SKIP-DATERANGES is set'
                  });
                }
              },

              'preload-hint'() {
                // parts are always specifed before a segment
                const segmentIndex = this.manifest.segments.length;
                const hint = camelCaseKeys(entry.attributes);
                const isPart = hint.type && hint.type === 'PART';
                currentUri.preloadHints = currentUri.preloadHints || [];
                currentUri.preloadHints.push(hint);

                if (hint.byterange) {
                  if (!hint.byterange.hasOwnProperty('offset')) {
                    // use last part byterange end or zero if not a part.
                    hint.byterange.offset = isPart ? lastPartByterangeEnd : 0;

                    if (isPart) {
                      lastPartByterangeEnd = hint.byterange.offset + hint.byterange.length;
                    }
                  }
                }

                const index = currentUri.preloadHints.length - 1;
                this.warnOnMissingAttributes_(`#EXT-X-PRELOAD-HINT #${index} for segment #${segmentIndex}`, entry.attributes, ['TYPE', 'URI']);

                if (!hint.type) {
                  return;
                } // search through all preload hints except for the current one for
                // a duplicate type.


                for (let i = 0; i < currentUri.preloadHints.length - 1; i++) {
                  const otherHint = currentUri.preloadHints[i];

                  if (!otherHint.type) {
                    continue;
                  }

                  if (otherHint.type === hint.type) {
                    this.trigger('warn', {
                      message: `#EXT-X-PRELOAD-HINT #${index} for segment #${segmentIndex} has the same TYPE ${hint.type} as preload hint #${i}`
                    });
                  }
                }
              },

              'rendition-report'() {
                const report = camelCaseKeys(entry.attributes);
                this.manifest.renditionReports = this.manifest.renditionReports || [];
                this.manifest.renditionReports.push(report);
                const index = this.manifest.renditionReports.length - 1;
                const required = ['LAST-MSN', 'URI'];

                if (hasParts) {
                  required.push('LAST-PART');
                }

                this.warnOnMissingAttributes_(`#EXT-X-RENDITION-REPORT #${index}`, entry.attributes, required);
              },

              'part-inf'() {
                this.manifest.partInf = camelCaseKeys(entry.attributes);
                this.warnOnMissingAttributes_('#EXT-X-PART-INF', entry.attributes, ['PART-TARGET']);

                if (this.manifest.partInf.partTarget) {
                  this.manifest.partTargetDuration = this.manifest.partInf.partTarget;
                }

                setHoldBack.call(this, this.manifest);
              },

              'daterange'() {
                this.manifest.dateRanges.push(camelCaseKeys(entry.attributes));
                const index = this.manifest.dateRanges.length - 1;
                this.warnOnMissingAttributes_(`#EXT-X-DATERANGE #${index}`, entry.attributes, ['ID', 'START-DATE']);
                const dateRange = this.manifest.dateRanges[index];

                if (dateRange.endDate && dateRange.startDate && new Date(dateRange.endDate) < new Date(dateRange.startDate)) {
                  this.trigger('warn', {
                    message: 'EXT-X-DATERANGE END-DATE must be equal to or later than the value of the START-DATE'
                  });
                }

                if (dateRange.duration && dateRange.duration < 0) {
                  this.trigger('warn', {
                    message: 'EXT-X-DATERANGE DURATION must not be negative'
                  });
                }

                if (dateRange.plannedDuration && dateRange.plannedDuration < 0) {
                  this.trigger('warn', {
                    message: 'EXT-X-DATERANGE PLANNED-DURATION must not be negative'
                  });
                }

                const endOnNextYes = !!dateRange.endOnNext;

                if (endOnNextYes && !dateRange.class) {
                  this.trigger('warn', {
                    message: 'EXT-X-DATERANGE with an END-ON-NEXT=YES attribute must have a CLASS attribute'
                  });
                }

                if (endOnNextYes && (dateRange.duration || dateRange.endDate)) {
                  this.trigger('warn', {
                    message: 'EXT-X-DATERANGE with an END-ON-NEXT=YES attribute must not contain DURATION or END-DATE attributes'
                  });
                }

                if (dateRange.duration && dateRange.endDate) {
                  const startDate = dateRange.startDate;
                  const newDateInSeconds = startDate.getTime() + dateRange.duration * 1000;
                  this.manifest.dateRanges[index].endDate = new Date(newDateInSeconds);
                }

                if (!dateRangeTags[dateRange.id]) {
                  dateRangeTags[dateRange.id] = dateRange;
                } else {
                  for (const attribute in dateRangeTags[dateRange.id]) {
                    if (!!dateRange[attribute] && JSON.stringify(dateRangeTags[dateRange.id][attribute]) !== JSON.stringify(dateRange[attribute])) {
                      this.trigger('warn', {
                        message: 'EXT-X-DATERANGE tags with the same ID in a playlist must have the same attributes values'
                      });
                      break;
                    }
                  } // if tags with the same ID do not have conflicting attributes, merge them


                  const dateRangeWithSameId = this.manifest.dateRanges.findIndex(dateRangeToFind => dateRangeToFind.id === dateRange.id);
                  this.manifest.dateRanges[dateRangeWithSameId] = _extends$1(this.manifest.dateRanges[dateRangeWithSameId], dateRange);
                  dateRangeTags[dateRange.id] = _extends$1(dateRangeTags[dateRange.id], dateRange); // after merging, delete the duplicate dateRange that was added last

                  this.manifest.dateRanges.pop();
                }
              },

              'independent-segments'() {
                this.manifest.independentSegments = true;
              },

              'content-steering'() {
                this.manifest.contentSteering = camelCaseKeys(entry.attributes);
                this.warnOnMissingAttributes_('#EXT-X-CONTENT-STEERING', entry.attributes, ['SERVER-URI']);
              }

            })[entry.tagType] || noop).call(self);
          },

          uri() {
            currentUri.uri = entry.uri;
            uris.push(currentUri); // if no explicit duration was declared, use the target duration

            if (this.manifest.targetDuration && !('duration' in currentUri)) {
              this.trigger('warn', {
                message: 'defaulting segment duration to the target duration'
              });
              currentUri.duration = this.manifest.targetDuration;
            } // annotate with encryption information, if necessary


            if (key) {
              currentUri.key = key;
            }

            currentUri.timeline = currentTimeline; // annotate with initialization segment information, if necessary

            if (currentMap) {
              currentUri.map = currentMap;
            } // reset the last byterange end as it needs to be 0 between parts


            lastPartByterangeEnd = 0; // Once we have at least one program date time we can always extrapolate it forward

            if (this.lastProgramDateTime !== null) {
              currentUri.programDateTime = this.lastProgramDateTime;
              this.lastProgramDateTime += currentUri.duration * 1000;
            } // prepare for the next URI


            currentUri = {};
          },

          comment() {// comments are not important for playback
          },

          custom() {
            // if this is segment-level data attach the output to the segment
            if (entry.segment) {
              currentUri.custom = currentUri.custom || {};
              currentUri.custom[entry.customType] = entry.data; // if this is manifest-level data attach to the top level manifest object
            } else {
              this.manifest.custom = this.manifest.custom || {};
              this.manifest.custom[entry.customType] = entry.data;
            }
          }

        })[entry.type].call(self);
      });
    }

    warnOnMissingAttributes_(identifier, attributes, required) {
      const missing = [];
      required.forEach(function (key) {
        if (!attributes.hasOwnProperty(key)) {
          missing.push(key);
        }
      });

      if (missing.length) {
        this.trigger('warn', {
          message: `${identifier} lacks required attribute(s): ${missing.join(', ')}`
        });
      }
    }
    /**
     * Parse the input string and update the manifest object.
     *
     * @param {string} chunk a potentially incomplete portion of the manifest
     */


    push(chunk) {
      this.lineStream.push(chunk);
    }
    /**
     * Flush any remaining input. This can be handy if the last line of an M3U8
     * manifest did not contain a trailing newline but the file has been
     * completely received.
     */


    end() {
      // flush any buffered input
      this.lineStream.push('\n');

      if (this.manifest.dateRanges.length && this.lastProgramDateTime === null) {
        this.trigger('warn', {
          message: 'A playlist with EXT-X-DATERANGE tag must contain atleast one EXT-X-PROGRAM-DATE-TIME tag'
        });
      }

      this.lastProgramDateTime = null;
      this.trigger('end');
    }
    /**
     * Add an additional parser for non-standard tags
     *
     * @param {Object}   options              a map of options for the added parser
     * @param {RegExp}   options.expression   a regular expression to match the custom header
     * @param {string}   options.customType   the custom type to register to the output
     * @param {Function} [options.dataParser] function to parse the line into an object
     * @param {boolean}  [options.segment]    should tag data be attached to the segment object
     */


    addParser(options) {
      this.parseStream.addParser(options);
    }
    /**
     * Add a custom header mapper
     *
     * @param {Object}   options
     * @param {RegExp}   options.expression   a regular expression to match the custom header
     * @param {Function} options.map          function to translate tag into a different tag
     */


    addTagMapper(options) {
      this.parseStream.addTagMapper(options);
    }

  }

  exports.LineStream = LineStream;
  exports.ParseStream = ParseStream;
  exports.Parser = Parser;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
