
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define([], factory);
    } else if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.man = factory();
    }
} (this, function () {

if (!Array.isArray) {
    Array.isArray = function (arg) {
        return Object.prototype.toString.call(arg) === "[object Array]";
    };
}

if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (value, start) {
        start = start || 0;
        for (var i = start; i < this.length; i++) {
            if (value === this[i]) {
                return i;
            }
        }
        
        return -1;
    };
}

if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/^\s+|\s+$/g, "");
    };
}

var optionKeys = {
    duration: {
        type: "number",
        def: 1000
    },
    delay: {
        type: "number",
        def: 0
    },
    timing: {
        type: "string",
        def: "linear"
    },
    end: {
        type: "function",
        def: function(){}
    },
    // whether to use js to mock transition/transform
    nojs: {
        type: "boolean",
        def: false
    },

    // debug option for js mock
    debugjs: {
        type: "boolean",
        def: false
    }
};

var transformKeys = [
    "transform", "matrix",
    "rotate", "translate", "scale", "skew",
    "translateX", "translateY",
    "scaleX", "scaleY",
    "skewX", "skewY"
];

var transitionStyle = "transition";
var transitionEndEvent = "transitionend";
var transformStyle = "transform";
var filterStyle = "filter"
initPrefix();

function initPrefix() {
    var prefix = getStylePrefix(transitionStyle);
    if (prefix == null) {
        transitionStyle = "";
        transitionEndEvent = "";
    } else if (prefix != "") {
        transitionStyle = prefix + "Transition";
        transitionEndEvent = prefix.toLowerCase() + "TransitionEnd";
    }

    prefix = getStylePrefix(transformStyle);
    if (prefix == null) {
        transformStyle = "";
    } else if (prefix != "") {
        transformStyle = prefix + "Transform";
    }

    prefix = getStylePrefix(filterStyle);
    if (prefix == null) {
        filterStyle = "";
    } else if (prefix != "") {
        filterStyle = prefix + "Filter";
    }
}

function getStylePrefix(style) {
    var prefixes = ["webkit", "Moz", "O", "ms"];
    if (style in document.body.style) {
        return "";
    }

    style = style.charAt(0).toUpperCase() + style.slice(1);
    for (var i = 0; i < prefixes.length; i++) {
        var prefixStyle = prefixes[i] + style;
        if (prefixStyle in document.body.style) {
            return prefixes[i];
        }
    }

    return null;
}

var man = {};

man.def = function (key, value) {
    if (!(key in optionKeys)) {
       return; 
    }

    var attr = optionKeys[key];
    if (typeof value != attr.type) {
        return attr.def;
    }

    attr.def = value;
};

man.transit = function (nodes, targets) {
    if (!Array.isArray(nodes)) {
        nodes = [nodes];
    }
    if (!Array.isArray(targets)) {
        targets = [targets];
    }

    if (nodes.length == 1) {
        fill(nodes, nodes[0], targets.length);
    } else if (targets.length == 1) {
        fill(targets, targets[0], nodes.length);
    }

    removeTrailingComma(nodes);
    removeTrailingComma(targets);

    if (nodes.length != targets.length) {
        return;
    }

    var qs = [];
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].manq != qs) {
            clear(nodes[i].manq, nodes[i]);
            nodes[i].manq = qs;
        }
        qs.push(buildQueueItem(nodes[i], targets[i]));
    }

    run(qs);
};

function buildQueueItem(node, target) {
    var options = checkOptions(target);
    target = normalizeInput(target);
    
    return {node: node, options: options, target: target};
}

function normalizeInput(target) {
    var input = {};
    for (var key in target) {
        updateState(input, key, target[key]);
    }

    return input;
}

function checkOptions(target) {
    var options = {};
    for (var key in optionKeys) {
        var attr = optionKeys[key];
        if (!(key in target)) {
            options[key] = attr.def;
        }
        options[key] = checkOption(target[key], attr.type, attr.def);
        delete target[key];
    }

    return options;
}

function checkOption(value, type, def) {
    if (typeof value != type) {
        return def;
    }
    
    return value;
}

// node: clear all of this "node" in q
// or, clear all nodes 
function clear(queue, node) {
    if (!queue) {
        return;
    }

    for (var i = 0; i < queue.length; i++) {
        if (!queue[i]) {
            continue;
        }

        if (node && node != queue[i].node) {
            continue;
        }

        var n = queue[i].node;
        n.manq = null;
        queue[i] = null;
    }
}

function run(queue, start) {
    if (!start) {
        start = 0;
    }

    if (start >= queue.length) {
        clear(queue);
        return;
    }

    runOne(queue[start], function () {
        run(queue, ++start);
    });
}

function runOne(q, end) {
    if (!q) {
        if (end) {
            end();
        }
        return;
    }

    if ((isCssAvailable() || q.options.nojs)
            && !q.options.debugjs) {
        runOneCss(q, end);
    } else {
        runOneJs(q, end);
    }
}

function runOneCss(q, end) {
    var node = q.node;

    var styles = buildStyles(q.target, q.options);

    // "" is not allowed in node.style in IE8
    if (isTransitionAvailable()) {
        node.style[transitionStyle] = styles[transitionStyle];
    }

    for (var key in styles) {
        if (key == transitionStyle) {
            continue;
        }

        node.style[key] = styles[key];
    }

    // transitionEnd for every property
    function transitionEndHandler() {
        if (isTransitionAvailable()) {
            node.removeEventListener(transitionEndEvent, transitionEndHandler);
            node.style[transitionStyle] = "";
        }
        
        if (q.options.end) {
            q.options.end();
        }
        
        if (end) {
            end();
        }
    }

    // no support transition, no addEventListener
    if (isTransitionAvailable()) {
        node.addEventListener(transitionEndEvent, transitionEndHandler);
    } else {
        transitionEndHandler();
    }
}

var raf = window.requestAnimationFrame
    || window.webkitRequestAnimationFrame
    || window.mozRequestAnimationFrame
    || window.oRequestAnimationFrame
    || window.msRequestAnimationFrame
    || function (callback) {
        window.setTimeout(callback, 16);
    };

function runOneJs(q, end) {
    var node = q.node;
    var options = q.options;
    var target = q.target;
    var timing = createTimingFunction(options.timing);

    var transforms = [];
    var state = {};
    for (var key in target) {
        if (transformKeys.indexOf(key) != -1) {
            transforms.push(target[key]);
        } else {
            updateState(state, key, getComputedStyle(node, key));
        }
    }

    if (transforms.length > 0) {
        if (isTransformAvailable()) {
            var v = buildState("transform", getComputedStyle(node, transformStyle));
            updateTransform(state, unmatrix(v[0].value.target));
        } else if (isFilterAvailable()) {
            var v = buildState("filter", getComputedStyle(node, filterStyle));
            updateTransform(state, unmatrix(v.target));
        }
    }
    
    var startTime = (new Date()).getTime();
    var queue = node.manq;

    function loop() {
        if (node.manq != queue) {
            return;
        }

        var now = (new Date()).getTime();
        var percent = (now - startTime) / options.duration;
        if (percent >= 1) {
            percent = 1;
        }
        updateStyles(node, state, target, percent, timing);

        if (percent >= 1) {
            if (end) {
                end();
            }
            return;
        }

        raf(loop);
    }

    loop();
}

function updateTransform(state, transforms) {
    for (var key in transforms) {
        var value = transforms[key];
        var isArray = Array.isArray(value);
        state[key] = {
            target: isArray ? value : [value],
            unit: fill([], value.length, defaultUnit(key))
        };

        if (!isArray) {
            continue;
        }

        state[key + "X"] = {
            target: [value[0]],
            unit: [defaultUnit(key)]
        };
        state[key + "Y"] = {
            target: [value[1]],
            unit: [defaultUnit(key)]
        };
    }
}

var timingFunctions = {
    "ease": [0.25, 0.1, 0.25, 1],
    "linear": [0, 0, 1, 1],
    "ease-in": [0.42, 0, 1, 1],
    "ease-out": [0, 0, 0.58, 1],
    "ease-in-out": [0.42, 0, 0.58, 1]
};

function createTimingFunction(name) {
    name = name.trim();

    var params;
    if (name in timingFunctions) {
        params = timingFunctions[name];
    } else {
        params = name.replace(/^cubic\-bezier\(|\)$/g, "").split(",");
        for (var i = 0; i < params.length; i++) {
            params[i] = parseFloat(params[i]);
        }
    }

    return bezier(params[0], params[1], params[2], params[3]);
}

function updateStyles(node, state, target, percent, timing) {
    var transforms = [];
    for (var key in state) {
        if (!(key in target)) {
            continue;
        }

        var starts = state[key].target;
        var lasts = target[key].target;

        var values;
        if (percent >= 1) {
            values = lasts;
        } else {
            values = [];
            for (var i = 0; i < starts.length; i++) {
                values.push(updateValue(starts[i], lasts[i], timing(percent)));
            }
        }

        target[key].value = values;
        if (transformKeys.indexOf(key) != -1) {
            transforms.push({key: key, value: values});
        }
    }

    var styles = buildStyles(target);

    for (var key in styles) {
        if (key == transitionStyle) {
            continue;
        }

        node.style[key] = styles[key];
    }

    if (!isTransformAvailable() && isFilterAvailable()
            && transforms.length > 0) {
        node.style[filterStyle] = buildFilter(transforms);
    }
}

function updateValue(start, last, percent) {
    return (1 - percent) * start + percent * last;
}

var filterMatrixArray = ["M11", "M21", "M12", "M22", "Dx", "Dy"];
var filterMatrixMap = buildFilterMatrixMap(filterMatrixArray);

function buildFilterMatrixMap(arr) {
    var map = {};
    for (var i = 0; i < arr.length; i++) {
        map[arr[i]] = i;
    }

    return map;
}

function buildFilter(transforms) {
    var matrix = buildTransform(transforms);
    var filter = "progid:DXImageTransform.Microsoft.Matrix(";
    filter += "sizingMethod='auto expand'";
    for (var i = 0; i < matrix.length; i++) {
        filter += "," + filterMatrixArray[i] + "=" + matrix[i];
    }
    filter += ")";

    return filter;
}

function buildTransform(transforms) {
    var matrix = [1, 0, 0, 1, 0, 0];
    for (var i = 0; i < transforms.length; i++) {
        var m = buildMatrix(transforms[i].key, transforms[i].value);
        if (m) {
            matrix = multiplyMatrix(matrix, m);
        }
    }

    return matrix;
}

function buildMatrix(key, value) {
    var x, y;
    // array has 1 or 2 items
    if (Array.isArray(value)) {
        x = value[0];
        y = value[value.length - 1];
    } else {
        x = value;
        y = value;
    }

    switch (key) {
        case "matrix":
            return value;

        case "rotate":
            return [Math.cos(x), Math.sin(x), - Math.sin(x), Math.cos(x), 0, 0];

        case "translate":
            return [1, 0, 0, 1, x, y];

        case "translateX":
            return [1, 0, 0, 1, x, 0];

        case "translateY":
            return [1, 0, 0, 1, 0, x];

        case "scale":
            return [x, 0, 0, y, 0, 0];

        case "scaleX":
            return [x, 0, 0, 1, 0, 0];

        case "scaleY":
            return [1, 0, 0, x, 0, 0];

        case "skew":
            return [1, Math.tan(y), Math.tan(x), 1, 0, 0];

        case "skewX":
            return [1, 0, Math.tan(x), 1, 0, 0];

        case "skewY":
            return [1, Math.tan(x), 0, 1, 0, 0];

        default:
            return null;
    }
}

// m1/m2 has 6 items
function multiplyMatrix(m1, m2) {
    return [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
    ];
}


// puer number: z-index, opacity, matrix, scale
// "deg": rotate, skew
// "px": most of others
function defaultUnit(key) {
    if (/[Cc]olor/.test(key)) {
        return "";
    }

    switch (key) {
        case "rotate":
        case "skew":
            return "deg";

        case "matrix":
        case "scale":
        case "z-index":
        case "opacity":
            return "";

        default:
            return "px";
    }
}

// key: {target: t | [t], unit: u | [u]}
function updateState(state, key, value) {
    var v = buildState(key, value);
    if (Array.isArray(v)) {
        for (var i = 0; i < v.length; i++) {
            if (v[i].value != null) {
                state[v[i].key] = v[i].value;
            }
        }
    } else if (v != null) {
        state[key] = v;
    }
}

function buildState(key, value) {
    if (key == "transform") {
        return buildStateFromTransform(key, value);
    } else if (key == "filter") {
        return buildStateFromFilter(key, value);
    }

    if (typeof value == "string") {
        value = value.trim().replace(/^(rgb)?\(|\)$/g, "").split(/\s*,\s*/);
    }

    if (typeof value == "number") {
        return buildStateFromNumber(key, value);
    } else if (Array.isArray(value)) {
        return buildStateFromArray(key, value);
    } else {
        return null;
    }
}

function buildStateFromTransform(key, value) {
    if (typeof value != "string") {
        return null;
    }

    value = value.trim();
    if (value == "" || value == "none") {
        value = "matrix(1, 0, 0, 1, 0, 0)";
    }

    var vs = value.split(/(\([^\)]+\))/);
    if (vs.length % 2 == 0) {
        return null;
    }

    var transforms = [];
    for (var i = 0; i + 1 < vs.length; i += 2) {
        var k = vs[i].trim();
        var v = vs[i + 1].trim();
        transforms.push({key: k, value: buildState(k, v)});
    }

    return transforms;
}

// FIXME: only deal with Matrix
function buildStateFromFilter(key, value) {
    var matrix = [1, 0, 0, 1, 0, 0];
    if (value == "") {
        return {target: matrix, unit: ""};
    }

    var vs = value.split(/(\([^\)]+\))/);
    if (vs.length % 2 == 0) {
        return null;
    }
    vs = vs[1].slice(1, vs[1].length - 1).split(/\s*,\s*/);

    for (var i = 0; i < vs.length; i++) {
        var v = vs[i].split(/\s*=\s*/);
        var pos = filterMatrixMap[v[0]];
        matrix[pos] = parseFloat(v[1]);
    }

    return {target: matrix, unit: ""};
}

// value: n | [ns]
function buildStateFromNumber(key, value, unit) {
    if (!Array.isArray(value)) {
        value = [value];
        unit = [unit || defaultUnit(key)];
    }

    // add default value
    if (value.length == 1) {
        switch (key) {
            case "translate":
                value.push(0);
                unit.push(unit[0]);
                break;

            case "scale":
                value.push(1);
                unit.push(unit[0]);
                break;

            case "skew":
                value.push(0);
                unit.push(unit[0]);
                break;

            default:
                break;
        }
    }
    
    return {
        target: value,
        unit: unit || defaultUnit(key)
    };
}

function buildStateFromArray(key, values) {
    if (/[Cc]olor/.test(key)) {
        return buildStateFromColor(key, values);
    }

    var unit = defaultUnit(key);
    var units = [];
    var nums = [];
    for (var i = 0; i < values.length; i++) {
        var value = values[i];
        if (typeof value == "string") {
            var vs = value.trim().split(/(px|deg|%|em)$/);
            if (vs.length == 3) {
                unit = vs[1];
            } else {
                unit = defaultUnit(key);
            }
        }

        // FIXME: "" doesn't mean "0"
        nums.push(parseFloat(value) || 0);
        units.push(unit);
    }

    return buildStateFromNumber(key, nums, units);
}

// FIXME: "" should reset, not being black
var colorMap = {
    "": "#ffffff",
    "aliceblue": "#f0f8ff",
    "antiquewhite": "#faebd7",
    "aqua": "#00ffff",
    "aquamarine": "#7fffd4",
    "azure": "#f0ffff",
    "beige": "#f5f5dc",
    "bisque": "#ffe4c4",
    "black": "#000000",
    "blanchedalmond": "#ffebcd",
    "blue": "#0000ff",
    "blueviolet": "#8a2be2",
    "brown": "#a52a2a",
    "burlywood": "#deb887",
    "cadetblue": "#5f9ea0",
    "chartreuse": "#7fff00",
    "chocolate": "#d2691e",
    "coral": "#ff7f50",
    "cornflowerblue": "#6495ed",
    "cornsilk": "#fff8dc",
    "crimson": "#dc143c",
    "cyan": "#00ffff",
    "darkblue": "#00008b",
    "darkcyan": "#008b8b",
    "darkgoldenrod": "#b8860b",
    "darkgray": "#a9a9a9",
    "darkgreen": "#006400",
    "darkkhaki": "#bdb76b",
    "darkmagenta": "#8b008b",
    "darkolivegreen": "#556b2f",
    "darkorange": "#ff8c00",
    "darkorchid": "#9932cc",
    "darkred": "#8b0000",
    "darksalmon": "#e9967a",
    "darkseagreen": "#8fbc8f",
    "darkslateblue": "#483d8b",
    "darkslategray": "#2f4f4f",
    "darkturquoise": "#00ced1",
    "darkviolet": "#9400d3",
    "deeppink": "#ff1493",
    "deepskyblue": "#00bfff",
    "dimgray": "#696969",
    "dodgerblue": "#1e90ff",
    "firebrick": "#b22222",
    "floralwhite": "#fffaf0",
    "forestgreen": "#228b22",
    "fuchsia": "#ff00ff",
    "gainsboro": "#dcdcdc",
    "ghostwhite": "#f8f8ff",
    "gold": "#ffd700",
    "goldenrod": "#daa520",
    "gray": "#808080",
    "green": "#008000",
    "greenyellow": "#adff2f",
    "honeydew": "#f0fff0",
    "hotpink": "#ff69b4",
    "indianred ": "#cd5c5c",
    "indigo": "#4b0082",
    "ivory": "#fffff0",
    "khaki": "#f0e68c",
    "lavender": "#e6e6fa",
    "lavenderblush": "#fff0f5",
    "lawngreen": "#7cfc00",
    "lemonchiffon": "#fffacd",
    "lightblue": "#add8e6",
    "lightcoral": "#f08080",
    "lightcyan": "#e0ffff",
    "lightgoldenrodyellow": "#fafad2",
    "lightgrey": "#d3d3d3",
    "lightgreen": "#90ee90",
    "lightpink": "#ffb6c1",
    "lightsalmon": "#ffa07a",
    "lightseagreen": "#20b2aa",
    "lightskyblue": "#87cefa",
    "lightslategray": "#778899",
    "lightsteelblue": "#b0c4de",
    "lightyellow": "#ffffe0",
    "lime": "#00ff00",
    "limegreen": "#32cd32",
    "linen": "#faf0e6",
    "magenta": "#ff00ff",
    "maroon": "#800000",
    "mediumaquamarine": "#66cdaa",
    "mediumblue": "#0000cd",
    "mediumorchid": "#ba55d3",
    "mediumpurple": "#9370d8",
    "mediumseagreen": "#3cb371",
    "mediumslateblue": "#7b68ee",
    "mediumspringgreen": "#00fa9a",
    "mediumturquoise": "#48d1cc",
    "mediumvioletred": "#c71585",
    "midnightblue": "#191970",
    "mintcream": "#f5fffa",
    "mistyrose": "#ffe4e1",
    "moccasin": "#ffe4b5",
    "navajowhite": "#ffdead",
    "navy": "#000080",
    "oldlace": "#fdf5e6",
    "olive": "#808000",
    "olivedrab": "#6b8e23",
    "orange": "#ffa500",
    "orangered": "#ff4500",
    "orchid": "#da70d6",
    "palegoldenrod": "#eee8aa",
    "palegreen": "#98fb98",
    "paleturquoise": "#afeeee",
    "palevioletred": "#d87093",
    "papayawhip": "#ffefd5",
    "peachpuff": "#ffdab9",
    "peru": "#cd853f",
    "pink": "#ffc0cb",
    "plum": "#dda0dd",
    "powderblue": "#b0e0e6",
    "purple": "#800080",
    "red": "#ff0000",
    "rosybrown": "#bc8f8f",
    "royalblue": "#4169e1",
    "saddlebrown": "#8b4513",
    "salmon": "#fa8072",
    "sandybrown": "#f4a460",
    "seagreen": "#2e8b57",
    "seashell": "#fff5ee",
    "sienna": "#a0522d",
    "silver": "#c0c0c0",
    "skyblue": "#87ceeb",
    "slateblue": "#6a5acd",
    "slategray": "#708090",
    "snow": "#fffafa",
    "springgreen": "#00ff7f",
    "steelblue": "#4682b4",
    "tan": "#d2b48c",
    "teal": "#008080",
    "thistle": "#d8bfd8",
    "tomato": "#ff6347",
    "turquoise": "#40e0d0",
    "violet": "#ee82ee",
    "wheat": "#f5deb3",
    "white": "#ffffff",
    "whitesmoke": "#f5f5f5",
    "yellow": "#ffff00",
    "yellowgreen": "#9acd32"
};

// single: "#rrggbb", "green"
// 3items: ["rr", "gg", "bb"], [rr, gg, bb]
function buildStateFromColor(key, values) {
    if (values.length != 1 && values.length != 3) {
        return null;
    }

    var nums = [];
    if (values.length == 1) {
        var value = values[0].trim();
        if (value.charAt(0) != "#") {
            if (!colorMap[value]) {
                return null;
            }

            value = colorMap[value];
        }

        if (value.charAt(0) == "#") {
            if (value.length != 7) {
                return null;
            }

            for (var i = 1; i < value.length; i += 2) {
                nums.push(parseInt(value.slice(i, i + 2), 16));
            }
        }
    } else {
        for (var i = 0; i < values.length; i++) {
            nums.push(parseInt(values[i]));
        }
    }

    return buildStateFromNumber(key, nums);
}

function buildStyles(target, options) {
    var postfix = "";
    if (options) {
        postfix = " " + options.duration + "ms " + options.timing + " " + options.delay + "ms";
    }

    var style = {};

    var transitions = [];
    var transforms = [];
    for (var key in target) {
        if (transformKeys.indexOf(key) != -1) {
            transforms.push(buildStyle(key, target[key]));
        } else if (key in document.body.style) {
            transitions.push(convertStyleToCss(key) + postfix);
            style[key] = buildStyle(key, target[key]);
        }
    }

    if (transforms.length > 0) {
        transitions.push("transform" + postfix);
        style[transformStyle] = transforms.join(" ");
    }

    if (postfix) {
        style[transitionStyle] = transitions.join(",");
    }

    return style;
}

function buildStyle(key, value) {
    // use value.value first, then value.target
    var target = value.value || value.target;

    if (/[Cc]olor/.test(key)) {
        return buildStyleFromColor(key, target);
    } else if (transformKeys.indexOf(key) != -1) {
        return buildStyleFromTransform(key, target, value.unit);
    }

    var style = [];
    for (var i = 0; i < target.length; i++) {
        style.push(target[i] + value.unit[i]);
    }

    return style.join(",");
}

function buildStyleFromColor(key, target) {
    var style = "#";
    for (var i = 0; i < target.length; i++) {
        var v = Math.floor(target[i]).toString(16);
        if (v.length == 1) {
            v = "0" + v;
        }

        style += v;
    }

    return style;
}

function buildStyleFromTransform(key, target, unit) {
    if (key == "transform") {
        return "";
    }

    if (!Array.isArray(target)) {
        target = [target];
        unit = [unit];
    }

    var style = [];
    for (var i = 0; i < target.length; i++) {
        style.push(target[i] + unit[i]);
    }

    return key + "(" + style.join(",") + ")";
}

// fix IE8 bug: array with trailing comma
function removeTrailingComma(arr) {
    if (!Array.isArray(arr)) {
        return;
    }

    // only deal with undefined
    if (arr[arr.length - 1] == undefined) {
        arr.pop();
    }
}

function isCssAvailable() {
    return isTransitionAvailable() && isTransformAvailable();
}

function isTransitionAvailable() {
    return transitionStyle != "" && transitionEndEvent != "";
}

function isTransformAvailable() {
    return transformStyle != "";
}

function isFilterAvailable() {
    return filterStyle != "";
}

function convertCssToStyle(name) {
    return name.replace(/(\-[a-z])/g, function (x) {
        return x.charAt(1).toUpperCase();
    });
}

function convertStyleToCss(name) {
    return name.replace(/([A-Z])/g, function (x) {
        return "-" + x.toLowerCase();
    });
}

function fill(arr, value, length) {
    var len = arr.length;
    while (len < length) {
        arr.push(value);
        len++;
    }

    return arr;
}

function getComputedStyle(node, key) {
    function helper(node, key) {
        if (window.getComputedStyle) {
            return window.getComputedStyle(node).getPropertyValue(key);
        } else if (node.currentStyle) {
            return node.currentStyle[key];
        }

        return "";
    }

    key = convertStyleToCss(key);
    var value = helper(node, key);
    if (!value) {
        key = convertCssToStyle(key);
        value = helper(node, key);
    }

    return value;
}


// modification of a well-tuned implemention

function bezier (mX1, mY1, mX2, mY2) {
    /**
     * https://github.com/gre/bezier-easing
     * BezierEasing - use bezier curve for transition easing function
     * by Gaëtan Renaudeau 2014 - 2015 ? MIT License
     */

    // These values are established by empiricism with tests (tradeoff: performance VS precision)
    var NEWTON_ITERATIONS = 4;
    var NEWTON_MIN_SLOPE = 0.001;
    var SUBDIVISION_PRECISION = 0.0000001;
    var SUBDIVISION_MAX_ITERATIONS = 10;

    var kSplineTableSize = 11;
    var kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

    var float32ArraySupported = typeof Float32Array === 'function';

    function A (aA1, aA2) { return 1.0 - 3.0 * aA2 + 3.0 * aA1; }
    function B (aA1, aA2) { return 3.0 * aA2 - 6.0 * aA1; }
    function C (aA1)      { return 3.0 * aA1; }

    // Returns x(t) given t, x1, and x2, or y(t) given t, y1, and y2.
    function calcBezier (aT, aA1, aA2) { return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT; }

    // Returns dx/dt given t, x1, and x2, or dy/dt given t, y1, and y2.
    function getSlope (aT, aA1, aA2) { return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1); }

    function binarySubdivide (aX, aA, aB, mX1, mX2) {
        var currentX, currentT, i = 0;
        do {
            currentT = aA + (aB - aA) / 2.0;
            currentX = calcBezier(currentT, mX1, mX2) - aX;
            if (currentX > 0.0) {
                aB = currentT;
            } else {
                aA = currentT;
            }
        } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
        return currentT;
    }

    function newtonRaphsonIterate (aX, aGuessT, mX1, mX2) {
        for (var i = 0; i < NEWTON_ITERATIONS; ++i) {
            var currentSlope = getSlope(aGuessT, mX1, mX2);
            if (currentSlope === 0.0) {
                return aGuessT;
            }
            var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
            aGuessT -= currentX / currentSlope;
        }
        return aGuessT;
    }

    // update
    if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) {
        throw new Error('bezier x values must be in [0, 1] range');
    }

    // Precompute samples table
    var sampleValues = float32ArraySupported ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);
    if (mX1 !== mY1 || mX2 !== mY2) {
        for (var i = 0; i < kSplineTableSize; ++i) {
            sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
        }
    }

    function getTForX (aX) {
        var intervalStart = 0.0;
        var currentSample = 1;
        var lastSample = kSplineTableSize - 1;

        for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
            intervalStart += kSampleStepSize;
        }
        --currentSample;

        // Interpolate to provide an initial guess for t
        var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
        var guessForT = intervalStart + dist * kSampleStepSize;

        var initialSlope = getSlope(guessForT, mX1, mX2);
        if (initialSlope >= NEWTON_MIN_SLOPE) {
            return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
        } else if (initialSlope === 0.0) {
            return guessForT;
        } else {
            return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
        }
    }

    return function BezierEasing (x) {
        if (mX1 === mY1 && mX2 === mY2) {
            return x; // linear
        }
        // Because JavaScript number are imprecise, we should guarantee the extremes are right.
        if (x === 0) {
            return 0;
        }
        if (x === 1) {
            return 1;
        }
        return calcBezier(getTForX(x), mY1, mY2);
    };
};

// http://stackoverflow.com/questions/5107134/find-the-rotation-and-skew-of-a-matrix-transformation
function unmatrix(a) {
    var rotate = Math.atan2(a[1], a[0]);
    var denom = Math.pow(a[0], 2) + Math.pow(a[1], 2);
    var scaleX = Math.sqrt(denom);
    var scaleY = (a[0] * a[3] - a[2] * a [1]) / scaleX;
    var skewX = Math.atan2(a[0] * a[2] + a[1] * a [3], denom);

    // normally we use positive deg
    rotate = rotate / (Math.PI / 180);
    if (rotate < 0) {
        rotate += 360;
    }
    skewX = skewX / (Math.PI / 180);
    if (skewX < 0) {
        skewX += 360;
    }
    return {
        rotate: rotate,
        scale: [scaleX, scaleY],
        skew: [skewX, 0],
        translate: [a[4], a[5]]
    };
}

return man;

}));

