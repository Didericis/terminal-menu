var createCharm = require('charm');
var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var resumer = require('resumer');

module.exports = function (opts) {
    return new Menu(opts || {});
}

function Menu (opts) {
    var self = this;
    self.width = opts.width || 50;
    self.x = opts.x || 1;
    self.y = opts.y || 1;
    self.init = { x: self.x, y: self.y };
    self.items = [];
    self.lines = {};
    self.selected = 0;
    self.padding = opts.padding || {
        left: 2,
        right: 2,
        top: 1,
        bottom: 1
    };
    if (typeof self.padding === 'number') {
        self.padding = {
            left: self.padding,
            right: self.padding,
            top: self.padding,
            bottom: self.padding
        };
    }
    self.x += self.padding.left;
    self.y += self.padding.top;
    
    self.charm = createCharm();
    self.stream = self.charm.pipe(resumer());
    self.charm.display('reset');
    self.charm.display('bright');
    
    self._ondata = function (buf) {
        self._ondataHandler(buf);
    };
    
    process.nextTick(function () {
        self.charm.cursor(false);
        process.on('exit', function () { self.charm.cursor(true) });
        self._draw();
    });
    
    process.stdin.on('data', self._ondata);
    process.stdin.setRawMode(true);
    process.stdin.resume();
};

inherits(Menu, EventEmitter);

Menu.prototype.createStream = function () {
    return this.stream;
};

Menu.prototype.add = function (label) {
    this.items.push({
        x: this.x,
        y: this.y,
        label: label
    });
    this._fillLine(this.y);
    this.y ++;
};

Menu.prototype._fillLine = function (y) {
    if (!this.lines[y]) {
        this.charm.position(this.init.x, y);
        this.charm.write(Array(
            1 + this.width
            + this.padding.left + this.padding.right
        ).join(' '));
        this.lines[y] = true;
    }
};

Menu.prototype.close = function () {
    process.stdin.setRawMode(false);
    process.stdin.removeListener('data', this._ondata);
};

Menu.prototype.reset = function () {
    this.charm.reset();
};

Menu.prototype.write = function (msg) {
    this.charm.background('magenta');
    this.charm.foreground('white');
    this._fillLine(this.y);
    
    var parts = msg.split('\n');
    
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].length) {
            this.charm.position(this.x, this.y);
            this.charm.write(parts[i]);
        }
        if (i !== parts.length - 1) {
            this.x = this.init.x + this.padding.left;
            this._fillLine(this.y);
            this.y ++;
        }
    }
};

Menu.prototype._draw = function () {
    for (var i = 0; i < this.items.length; i++) this._drawRow(i);
};

Menu.prototype._drawRow = function (index) {
    index = (index + this.items.length) % this.items.length;
    var item = this.items[index];
    this.charm.position(item.x, item.y);
    
    if (this.selected === index) {
        this.charm.background('white');
        this.charm.foreground('magenta');
    }
    else {
        this.charm.background('magenta');
        this.charm.foreground('white');
    }
    
    this.charm.write(
        item.label
        + Array(Math.max(0, this.width - item.label.length)).join(' ')
    );
};

Menu.prototype._ondataHandler = function ondata (buf) {
    var codes = [].join.call(buf, '.');
    if (codes === '27.91.65') { // up
        this.selected = (this.selected - 1 + this.items.length)
            % this.items.length
        ;
        this._drawRow(this.selected + 1);
        this._drawRow(this.selected);
    }
    else if (codes === '27.91.66') { // down
        this.selected = (this.selected + 1) % this.items.length;
        this._drawRow(this.selected - 1);
        this._drawRow(this.selected);
    }
    else if (codes === '3') { // ^C
        process.stdin.setRawMode(false);
        this.charm.reset();
        process.exit();
    }
    else if (codes === '13') { // enter
        this.emit('select', this.items[this.selected], this.selected);
    }
};