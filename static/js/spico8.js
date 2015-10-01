(function () {
    ///////////
    // SETUP //
    ///////////

    // CONSTANTS //
    var PICO_SCREEN_WIDTH  = 128;
    var PICO_SCREEN_HEIGHT = 128;

    var SPICO_SCREEN_WIDTH  = 256;
    var SPICO_SCREEN_HEIGHT = 224;

    var SCALE_FACTOR = 4;

    var DEFAULT_COLORS_VALUES = [
        [0, 0, 0],
        [29, 43, 83],
        [126, 37, 83],
        [0, 135, 81],
        [171, 82, 54],
        [95, 87, 79],
        [194, 195, 199],
        [255, 241, 232],
        [255, 0, 77],
        [255, 163, 0],
        [255, 255, 39],
        [0, 231, 86],
        [41, 173, 255],
        [131, 118, 156],
        [255, 119, 168],
        [255, 204, 17]
    ];

    var SPRITE_WIDTH  = 8;
    var SPRITE_HEIGHT = 8;

    var PICO8_SYSTEMFONT = {
        CHARSET:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ"\'`-_/1234567890!?[](){}.,;:<>+=%#^*~ ',
        CHAR_W:    4,
        CHAR_H:    6,
        UPPERCASE: true,
        DATA:     'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAAGCAYAAAAsXEDPAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAZxJREFUeNrsV9kOg0AIVP//n601HjgdzuWliSRNRXc5BhbYed1oumnefg9+o0msub5/Pxyv0/uPvStbz3hcvwv9Phj6T/s0+9E+zR9vv2bfCG/JZ/ZKPI7HyeNRXzSelfiN8F58vHjjfsYjHhU8M3hn5Hv5ouWD/A76H7RMcpVE7TZiFyjfCQUXj9+Fkz/7mS7tv0LSvlO/5x/6o/nfYZ9ne0Y22h4hiQnDRotl1GbEy8I/wnv4ROJrYYZ4VPD0eEs+2nKShgWzXa6X+qQsRotncAcA3vpMwlpFpGqvp88DsVKcUL53QPGAWf6P2Mv2RniWxF35Mpo/FVkZHSMFCP9nQZoM9iwPPNpvFXF1AugCgAGaPbCVqpzpWAxgDEhXR2AV20uYzikiIp919MyEEJGfnTBGpqSM7IgPmQKpdXytwOMEwOJlnYXspLp4Dp4OYBJnOk7kG6tcmS5VnSCwcmq6rP2suEUTVOu4XQUPE8rDH/VHYjsyAVYnjq4DGLkyateFyBUzeyVlE0CmgbIrrVkAGxvrSy+99Gf0EWAAZy4AUlI12mIAAAAASUVORK5CYII='
    };

    // SPICO VARIABLES

    var screenWidth  = PICO_SCREEN_WIDTH;
    var screenHeight = PICO_SCREEN_HEIGHT;

    // will never change. this is the setting of the palette for the current game
    var palette = DEFAULT_COLORS_VALUES;

    // originally set = to palette, it can be altered by pal() and palt()
    // the drawing functions refer to this
    var colors = _.cloneDeep(palette);

    // a dictionary that maps a string representing the color to the color index
    // for example '0,0,0': 0
    // it always refers to the _original_ colors and is not affected by calls to pal() or palt()
    var colorDecoding;

    // remaps a color to another. this is used in the display phase for colors remapped
    // by pal(c0, c1, p)
    // a dictionary like '0,0,0': [0, 0, 0]
    var colorRemappings;

    var transparentColors = [0];

    var globalCounter = 0;
    var currentColor  = 6; // grey

    var screenBitmap;
    var screenBitmapData;
    var screenImage;

    var spritesheet;
    var spritesheetRowLength;
    var spritesheetSpritesPerRow;
    var spriteFlags;

    var cameraOffsetX = 0;
    var cameraOffsetY = 0;

    var clipping = null;

    var systemfont = {};
    var cursorX = 0;
    var cursorY = 0;

    // setup the game
    var game  = new Phaser.Game(screenWidth, screenHeight,
                                Phaser.CANVAS,
                                '',
                                {
                                     init:    init,
                                     preload: preload,
                                     update:  update,
                                     render:  render
                                 },
                                 false, false);
    var retroDisplay = { scale: SCALE_FACTOR, canvas: null, context: null, width: 0, height: 0 };

    // INNER FUNCTIONS
    // generate the color remappings out the palette
    function generateColorRemappings () {
        colorRemappings = _.reduce(palette, function (acc, c, idx) {
            acc[c.join()] = _.cloneDeep(c);
            return acc;
        }, {});
    }

    function generateRetroFont () {
        var fontImg = new Image();
        fontImg.src = PICO8_SYSTEMFONT.DATA;

        var fontCanvas = document.createElement('canvas');
        fontCanvas.width   = fontImg.width;
        fontCanvas.height  = fontImg.height;
        fontCanvas.getContext('2d').drawImage(fontImg, 0, 0, fontImg.width, fontImg.height);

        _.each(PICO8_SYSTEMFONT.CHARSET, function (c, i) {
            var letter = fontCanvas.getContext('2d').getImageData(i * PICO8_SYSTEMFONT.CHAR_W, 0, PICO8_SYSTEMFONT.CHAR_W, PICO8_SYSTEMFONT.CHAR_H).data;
            systemfont[c] = _.map(_.range(PICO8_SYSTEMFONT.CHAR_H), function () { return _.map(_.range(PICO8_SYSTEMFONT.CHAR_W), function () { return 0; }) });

            for (var p = letter.length; p >= 0; p -= 4) {
                // skip if transparent
                if (letter[p + 3] > 0) {
                    var x = (p / 4) % PICO8_SYSTEMFONT.CHAR_W;
                    var y = Math.floor((p / 4) / PICO8_SYSTEMFONT.CHAR_W);

                    systemfont[c][y][x] = 1;
                }
            }
        });
    }

    // EXPOSED FUNCTIONS //

    // graphics
    window.clip = function (x, y, w, h) {
        if (arguments.length === 0) {
            clipping = null;
        } else {
            clipping = {
                x0: x,
                y0: y,
                x1: x + w,
                y1: y + h
            };
        }
    };
    window.pget = function (x, y) {
        try {
            return colorDecoding(screenBitmapData[flr(y)][flr(x)].join());
        } catch (err) {
           return 0;
        }
    };
    window.pset = function (x, y, c) {
        c = c || currentColor;

        // skip transparent colors
        if (_.contains(transparentColors, c)) return;

        // skip pixels outside the clipping region, if set
        if (clipping !== null && (x < clipping.x0 || x >= clipping.x1 || y < clipping.y0 || y >= clipping.y1)) return;

        try {
            screenBitmapData[flr(y) - cameraOffsetY][flr(x) - cameraOffsetX] = colors[c];
        } catch (err) {}
    };
    window.sget = function (x, y) {};
    window.sset = function (x, y, c) {};
    window.fget = function (n, f) {
        var flag = spriteFlags[n] || 0;

        // return the number or the nth bit of it as boolean
        return f !== undefined ? ((flag & ( 1 << f )) >> f) === 1 : flag
    };
    window.fset = function (n, f, v) {
        // sets the number of the flag or a specific bit
        if (arguments.length === 2) {
            spriteFlags[n] = f;
        } else if (arguments.length === 3) {
            var flagBinary = (spriteFlags[n] >>> 0).toString(2).split('');

            flagBinary[f]  = v === true ? '1' : '0';
            spriteFlags[n] = parseInt(flagBinary.join(''), 2);
        }
    };
    window.print = function (str, x, y, c) {
        x = x || cursorX;
        y = y || cursorY;

        _.each(str.split(''), function (character, i) {
            _.times(PICO8_SYSTEMFONT.CHAR_H, function (yy) {
                _.times(PICO8_SYSTEMFONT.CHAR_W, function (xx) {
                    try {
                        if (systemfont[character][yy][xx] === 1) pset(x + xx + (i * PICO8_SYSTEMFONT.CHAR_W), y + yy);
                    } catch (err) {}
                });
            });
        });

        // advance the carriage
        cursorY += PICO8_SYSTEMFONT.CHAR_H;
    };
    window.cursor = function (x, y) {
        cursorX = x;
        cursorY = y;
    };
    window.color = function (c) {
        currentColor = c;
    };
    window.cls = function (c) {
        screenBitmapData = _.map(_.range(screenHeight), function () { return _.map(_.range(screenWidth), function () { return palette[0]; }) });
    };
    window.camera = function (x, y) {
        x = x || 0;
        y = y || 0;

        cameraOffsetX = x;
        cameraOffsetY = y;
    };
    window.circ = function (x, y, r, c) {
        c = c || currentColor;

        // bresenham midpoint circle algorithm to draw a pixel-perfect line
        var xx = r;
        var yy = 0;
        var radiusError = 1 - xx;

        while (xx >= yy) {
            pset( xx + x,  yy + y, c);
            pset( yy + x,  xx + y, c);
            pset(-xx + x,  yy + y, c);
            pset(-yy + x,  xx + y, c);
            pset(-xx + x, -yy + y, c);
            pset(-yy + x, -xx + y, c);
            pset( xx + x, -yy + y, c);
            pset( yy + x, -xx + y, c);

            yy++;

            if (radiusError < 0) {
                radiusError += 2 * yy + 1;
            }
            else {
                xx--;
                radiusError+= 2 * (yy - xx + 1);
            }
        }
    };
    window.circfill = function (x, y, r, c) {
        c = c || currentColor;

        // bresenham midpoint circle algorithm to draw a pixel-perfect line
        var xx = r;
        var yy = 0;
        var radiusError = 1 - xx;

        var imageData = screenBitmap.imageData;
        var data = imageData.data;
        var index;

        while (xx >= yy) {
            line( xx + x,  yy + y, -xx + x,  yy + y, c);
            line( yy + x,  xx + y, -yy + x,  xx + y, c);
            line(-xx + x, -yy + y,  xx + x, -yy + y, c);
            line(-yy + x, -xx + y,  yy + x, -xx + y, c);

            yy++;

            if (radiusError < 0) {
                radiusError += 2 * yy + 1;
            }
            else {
                xx--;
                radiusError+= 2 * (yy - xx + 1);
            }
        }
    };
    window.line = function (x0, y0, x1, y1, c) {
        c = c || currentColor;

        // bresenham midpoint circle algorithm to draw a pixel-perfect line
        var dx = Math.abs(x1 - x0);
        var dy = Math.abs(y1 - y0);
        var sx = (x0 < x1) ? 1 : -1;
        var sy = (y0 < y1) ? 1 : -1;
        var err = dx - dy;

        while(true) {
            pset(x0, y0, c);

            if ((x0 === x1) && (y0 === y1)) break;

            var e2 = 2 * err;
            if (e2 >- dy) { err -= dy; x0  += sx; }
            if (e2 <  dx) { err += dx; y0  += sy; }
        }
    };
    window.rect = function (x0, y0, x1, y1, c) {
        line(x0, y0, x1, y0, c);
        line(x1, y0, x1, y1, c);
        line(x1, y1, x0, y1, c);
        line(x0, y1, x0, y0, c);
    };
    window.rectfill = function (x0, y0, x1, y1, c) {
        _.each(_.range(y0, y1-y0 + 1), function (y) {
            _.each(_.range(x0, x1-x0 + 1), function (x) {
                pset(x, y, c);
            });
        });
    };
    window.pal = function (c0, c1, p) {
        p = p || 0;

        // reset colors and colorRemappings if no argument is supplied
        if (arguments.length === 0) {
            colors = _.cloneDeep(palette);
            generateColorRemappings();
        } else {
            // alters the colors at draw time or display time
            if (p === 0) {
                colors[c0] = _.cloneDeep(palette[c1]);
            } else {
                colorRemappings[palette[c0].join()] = palette[c1];
            }
        }
    };
    window.palt = function (c, t) {
        // sets the given color to transparent or opaque or reset transparency
        if (c !== undefined && t !== undefined) {
            if (t === true)
                transparentColors = _.uniq(transparentColors.concat([c]));
            else
                transparentColors = _.remove(transparentColors, c);
        }
        else {
            transparentColors = [0];
        }
    };
    window.spr = function (n, x, y, w, h, flipX, flipY) {
        w = w || 1;
        h = h || 1;

        var spriteX = (n * SPRITE_WIDTH) % spritesheetRowLength;
        var spriteY = flr(n / spritesheetSpritesPerRow) * SPRITE_HEIGHT;
        var spriteW = spriteX + (SPRITE_WIDTH * w);
        var spriteH = spriteY + (SPRITE_HEIGHT * h);

        sspr(spriteX,
             spriteY,
             spriteW, spriteH,
             x, y,
             spriteW, spriteH,
             flipX, flipY);
    };
    window.sspr = function (sx, sy, sw, sh, dx, dy, dw, dh, flipX, flipY) {
        // reproduces pico behaviour
        if (dw !== undefined && dh === undefined) {
            dh = 0;
        } else {
            dw = dw || sw;
            dh = dh || sh;
        }

        var ratioX = sw / dw;
        var ratioY = sh / dh;

        // use the nearest neighbour algorythm to scale the image
        _.each(_.range(dh), function (y) {
            _.each(_.range(dw), function (x) {
                var xx = flipX === true ?  dw - 1 - x : x;
                var yy = flipY === true ?  dh - 1 - y : y;
                var scaledX = flr(xx * ratioX);
                var scaledY = flr(yy * ratioY);

                pset(dx + x, dy + y, spritesheet[sy + scaledY][sx + scaledX]);
            });
        })
    };

    // input
    window.btn = function (i, p) {};
    window.btnp = function (i, p) {};

    // map
    window.mget = function (x, y) {};
    window.mset = function (x, y, v) {};
    window.map = function (celX, celY, sx, sy, celW, celH, layer) {};

    // math
    window.max = Math.max;
    window.min = Math.min;
    window.mid = function (x, y, z) { /* return x > y and x or y > z and z or y */ };
    window.flr = Math.floor;
    window.sin = Math.sin;
    window.cos = Math.cos;
    window.sinp8 = function (x) { return Math.sin(Math.PI*x); }
    window.cosp8 = function (x) { return Math.cos(Math.PI*x); }
    window.atan2 = function (dx, dy) {
        // function __pico_angle(a)
        //     -- FIXME: why does this work?
        //     return (((a - math.pi) / (math.pi*2)) + 0.25) % 1.0
        // end

        // atan2 = function(y,x) return __pico_angle(math.atan2(y,x)) end
    };
    window.sqrt = Math.sqrt;
    window.abs = Math.abs;
    window.rnd = function (x) { return Math.random() * (x || 1); };
    // NOTE: srand() not implemented since it doesn's make sense in javascript

    // bitwise operations
    window.band = function (x, y) { return x & y; };
    window.bor = function (x, y) { return x | y; };
    window.bxor = function (x, y) { return x ^ y; };
    window.bnot = function (x) { return !x; };
    window.shl = function (x, y) { return x << y; };
    window.shr = function (x, y) { return x >> y; };

    // GAME FUNCTIONS
    function preload () {
        // game.load.image('picosystemfont', 'static/img/picosystemfont.png');
    }

    function init () {
        // setup the retro display
        game.canvas.style['display'] = 'none';
        retroDisplay.canvas = Phaser.Canvas.create(this, game.width * retroDisplay.scale, game.height * retroDisplay.scale);
        retroDisplay.context = retroDisplay.canvas.getContext('2d');
        Phaser.Canvas.addToDOM(retroDisplay.canvas);
        Phaser.Canvas.setSmoothingEnabled(retroDisplay.context, false);
        Phaser.Canvas.setSmoothingEnabled(game.context, false);
        retroDisplay.width = retroDisplay.canvas.width;
        retroDisplay.height = retroDisplay.canvas.height;

        // initialize the main display object
        screenBitmap = game.make.bitmapData(screenWidth, screenHeight);
        screenImage  = game.add.image(0, 0, screenBitmap);

        // generate the system font
        generateRetroFont();

        // generate the bitmapData array
        cls();

        // TODO spritesheet as ints
        spritesheet = _.map(SPRITES, function (row) {
            return _.map(row, function (cell) {
                return parseInt(cell, 16);
            })
        });
        spritesheetRowLength     = spritesheet[0].length;
        spritesheetSpritesPerRow = spritesheetRowLength / SPRITE_WIDTH;

        colorDecoding = _.reduce(palette, function (acc, c, idx) {
            acc[c.join()] = idx;
            return acc;
        }, {});

        generateColorRemappings();

        spriteFlags = _.map(_.chunk(SPRITE_FLAGS.join('').split(''), 2), function (f) { return parseInt(f.join(''), 16) });

        // call the game _init() function if exists
        if (window._init) window._init();
    }

    function update () {
        globalCounter++;

        // each frame the print cursor is updated
        cursorY = 0;
        cursorX = 0;

        // force 30 FPS-like mode (like pico8)
        // call the game _update() function if exists
        if (globalCounter % 2 === 0) {
            if (window._update) window._update();
        }
    }

    function render () {
        // call the game _draw() function if exists
        if (window._draw) window._draw();

        screenBitmap.processPixelRGB(function (p, x, y) {
            var color         = screenBitmapData[y][x];
            var remappedColor = colorRemappings[color.join()];

            p.r = remappedColor[0];
            p.g = remappedColor[1];
            p.b = remappedColor[2];
            p.a = 255;
            return p;
        });

        // show the retro display
        retroDisplay.context.drawImage(game.canvas, 0, 0, game.width, game.height, 0, 0, retroDisplay.width, retroDisplay.height);
    }
})(this);