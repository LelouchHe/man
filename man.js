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
    "matrix", "translate", "scale", "rotate", "skew",
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
        cssValues: string (used in assignment)
        jsValues: [number ... ["unit"] = unit] (used in downgrade)
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
        if (transformKeys.indexOf(key) != -1 || key == "transform") {
            if (key == "transform") {
                transforms.push(target[key])
            } else {
                transforms.push(key + "(" + target[key] + ")");
            }
        } else if (key in document.body.style) {
            transitions.push(convertStyleToCss(key) + postfix);
            cssValues[key] = target[key];
        }
    }

    if (transforms.length > 0) {
        transitions.push("transform" + postfix);
        cssValues[transformStyle] = transforms.join(" ");
    }

    cssValues[transitionStyle] = transitions.join(",");
    
    return {options: options, cssValues: cssValues, jsValues: jsValues};
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

})();

