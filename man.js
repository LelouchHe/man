(function () {

var man = window.man = {};

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
        def: true
    },

    // debug option for js mock
    debugjs: {
        type: "boolean",
        def: false
    },
};

var transformKeys = [
    "transform", "matrix", "translate", "scale", "rotate", "skew",
];

var transitionStyle = "transition";
var transitionEndEvent = "transitionend";
var transformStyle = "transform";
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

/*
    value: {
        options: options (used in control)
        cssValues: string (used in assignment for node.style)
        jsValues: (used in downgrade)
    }
*/
function buildQueueItem(node, target) {
    var transitions = [];
    var transforms = [];
    var cssValues = {};
    var jsValues = {};

    var options = checkOptions(target);
    options.node = node;
    
    var postfix = " " + options.duration + "ms " + options.timing + " " + options.delay + "ms";
    
    for (var key in target) {
        if (transformKeys.indexOf(key) != -1) {
            updateCssTransforms(transforms, key, target[key]);
            updateJsValueFromTransform(jsValues, key, target[key]);
        } else if (key in document.body.style) {
            transitions.push(convertStyleToCss(key) + postfix);
            updateCssValue(cssValues, key, target[key]);
            updateJsValue(jsValues, key, target[key]);
        }
    }

    if (transforms.length > 0) {
        transitions.push("transform" + postfix);
        cssValues[transformStyle] = transforms.join(" ");
    }

    cssValues[transitionStyle] = transitions.join(",");
    
    return {options: options, cssValues: cssValues, jsValues: jsValues};
}

// puer number: z-index, opacity, matrix, scale
// "deg": rotate, skew
// "px": most of others
function defaultUnit(key) {
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

function updateCssTransforms(transforms, key, value) {
    var transformValue = buildCssValueFromTransform(key, value);
    if (transformValue != null) {
        transforms.push(transformValue);
    }
}

function updateCssValue(cssValues, key, value) {
    var cssValue = buildCssValue(key, value);
    if (cssValue != null) {
        cssValues[key] = cssValue;
    }
}

// build css string
// return legal css string for transform
function buildCssValueFromTransform(key, value) {
    // transform: need to be legal string
    if (key == "transform") {
        return value;
    }

    if (typeof value == "string") {
        value = value.trim();
        if (value == "") {
            return "";
        }
        value = value.replace(/^[\(\[]|[\)\]]$/g, "");
        return key + "(" + value + ")";
    }

    return buildCssValue(key, value);
}

function buildCssValue(key, value) {
    if (typeof value == "string") {
        value = value.trim().replace(/^[\(\[]|[\)\]]$/g, "").split(",");
    }

    if (typeof value == "number") {
        return buildCssValueFromNumbers(key, value);
    } else if (Array.isArray(value)) {
        return buildCssValueFromArray(key, value);
    } else {
        return null;
    }
}

function buildCssValueFromNumbers(key, values, unit) {
    if (typeof values == "number") {
        values = [values];
    }

    unit = unit || defaultUnit(key);

    var nums = [];
    for (var i = 0; i < values.length; i++) {
        nums.push(values[i] + unit);
    }

    if (transformKeys.indexOf(key) != -1) {
        return key + "(" + nums.join(",") + ")";
    } else {
        return nums.join(" ");
    }
}

function buildCssValueFromArray(key, values) {
    if (/[Cc]olor/.test(key)) {
        return buildCssValueFromColor(key, values);
    }

    var unit = defaultUnit(key);
    var nums = [];
    for (var i = 0; i < values.length; i++) {
        var value = values[i];
        if (typeof value == "string") {
            var vs = value.trim().split(/(px|deg)$/);
            if (vs.length == 3) {
                unit = vs[1];
            }
        }

        // FIXME: parseFloat("") doesn't mean "0"
        nums.push(parseFloat(value) || 0);
    }

    return buildCssValueFromNumbers(key, nums, unit);
}

function buildCssValueFromColor(key, values) {
    if (values.length == 1) {
        values = values[0];
        if (typeof values == "string") {
            return values;
        }
    } else if (values.length != 3) {
        return null;
    }

    var value = "#";
    for (var i = 0; i < values.length; i++) {
        var v = parseInt(values[i]).toString(16);
        if (v.length == 1) {
            v = "0" + v;
        }
        value += v;
    }

    return value;
}

// build js num value
// update jsValues
function updateJsValue(jsValues, key, value) {
    var jsValue = buildJsValue(key, value);
    if (jsValue != null) {
        jsValues[key] = jsValue;
    }
}

function updateJsValueFromTransform(jsValues, key, value) {
    if (key != "transform") {
        jsValues[key] = buildJsValue(key, value);
        return;
    } else if (value == "") {
        return;
    }

    var vs = value.split(/(\([^\)]+\))/);
    if (vs.length % 2 == 0) {
        return;
    }

    for (var i = 0; i + 1 < vs.length; i += 2) {
        var k = vs[i].trim();
        var v = vs[i + 1].trim();
        updateJsValue(jsValues, k, v);
    }
}

function buildJsValue(key, value) {
    if (typeof value == "string") {
        value = value.trim().replace(/^[\(\[]|[\)\]]$/g, "").split(",");
    }

    if (typeof value == "number") {
        return buildJsValueFromNumber(key, value);
    } else if (Array.isArray(value)) {
        return buildJsValueFromArray(key, value);
    } else {
        return null;
    }
}

function buildJsValueFromNumber(key, value, unit) {
    return {
        target: value,
        unit: unit || defaultUnit(key),
        gen: function (v, u) {
            return v + u;
        }
    };
}

// array item:
// 1. color: #rrggbb, green
// 2. number with optional unit
function buildJsValueFromArray(key, values) {
    if (/[Cc]olor/.test(key)) {
        return buildJsValueFromColor(key, values);
    }

    var unit = defaultUnit(key);
    var nums = [];
    for (var i = 0; i < values.length; i++) {
        var value = values[i];
        if (typeof value == "string") {
            var vs = value.trim().split(/(px|deg)$/);
            if (vs.length == 3) {
                unit = vs[1];
            }
        }

        // FIXME: "" doesn't mean "0"
        nums.push(parseFloat(value) || 0);
    }

    if (nums.length == 1) {
        return buildJsValueFromNumber(key, nums[0], unit);
    }

    return {
        target: nums,
        unit: unit,
        gen: function (ns, unit) {
            var vs = [];
            for (var i = 0; i < ns.length; i++) {
                vs.push(ns[i] + unit);
            }

            return "(" + vs.join(",") + ")";
        }
    };
}

// "" has a special value
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
function buildJsValueFromColor(key, values) {
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

    return {
        target: nums,
        unit: "",
        gen: function (ns) {
            return "#" + ns.join("");
        }
    };
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

        if (node && node != queue[i].options.node) {
            continue;
        }

        var n = queue[i].options.node;
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
    var node = q.options.node;

    var count = 0;

    // "" is not allowed in node.style in IE8
    if (isTransitionAvailable()) {
        node.style[transitionStyle] = q.cssValues[transitionStyle];
    }

    for (var key in q.cssValues) {
        if (key == transitionStyle) {
            continue;
        }

        node.style[key] = q.cssValues[key];
        count++;
    }

    // transitionEnd for every property
    function transitionEndHandler() {
        count--;
        if (count > 0) {
            return;
        }

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
        count = 1;
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
}

function getComputedStyle(node, key) {
    key = convertStyleToCss(key);
    if (window.getComputedStyle) {
        return window.getComputedStyle(node).getPropertyValue(key);
    } else if (node.currentStyle) {
        return window.currentStyle[key];
    }

    return "";
}

})();

