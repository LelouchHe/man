(function () {

var man = window.man = {};

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
    // whether to queue squence calls on same node
    // if false, those will happen at same time
    queue: {
        type: "boolean",
        def: true
    }
};

var transformKeys = [
    "matrix", "translate", "scale", "rotate", "skew",
];

/*

    key: node
    value: {
        cssValue: string (used in assignment)
        jsValue: [number ... ["unit"] = unit] (used in downgrade)
    }

*/
var map = {};

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
        transitionStyle = "-" + prefix + "-" + transitionStyle;
        transitionEndEvent = prefix + "TransitionEnd";
    }

    prefix = getStylePrefix(transformStyle);
    if (prefix == null) {
        transformStyle = "";
    } else if (prefix != "") {
        transformStyle = "-" + prefix + "-" + transformStyle;
    }
}

function getStylePrefix(style) {
    var prefixes = ["webkit", "moz", "o", "ms"];
    if (style in document.body.style) {
        return "";
    }

    for (var i = 0; i < prefixes.length; i++) {
        var prefixStyle = "-" + prefixes[i] + "-" + style;
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
        return;
    }

    attr.def = value;
};

man.transit = function (node, target) {
    var options = checkOptions(target);

    var cssValues = {};

    cssValues[transitionStyle] = buildTransition(options, target);
    for (var key in target) {
        if (transformKeys.indexOf(key) != -1) {
            cssValues[transformStyle] = key + "(" + target[key] + ")";
        } else if (key in document.body.style) {
            cssValues[key] = target[key];
        }
    }

    if (!map[node]) {
        map[node] = [];
    }
    var queue = map[node];
    queue.push({options: options, cssValues: cssValues, jsValues: []});

    if (queue.length == 1) {
        run(node, queue);
    }

    return man;
};

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

function buildTransition(options, target) {
    var transitions = [];
    var hasTransform = false;
    
    var postfix = " " + options.duration + "ms " + options.timing + " " + options.delay + "ms";
    
    for (var key in target) {
        if (transformKeys.indexOf(key) != -1) {
            transitions.push("transform " + postfix);
        } else if (key in document.body.style) {
            transitions.push(convertStyleToCss(key) + postfix);
        }
    }
    
    return transitions.join(",");
}

function run(node, queue) {
    if (queue.length == 0) {
        delete queue[node];
        return;
    }

    var q = queue[0];

    var count = 0;
    node.style[transitionStyle] = q.cssValues[transitionStyle];
    for (var key in q.cssValues) {
        if (key == transitionStyle) {
            continue;
        }

        node.style[key] = q.cssValues[key];
        count++;
    }

    function transitionEndHandler(evt) {
        count--;
        if (count > 0) {
            return;
        }

        node.removeEventListener(transitionEndEvent, transitionEndHandler);
        node.style[transitionStyle] = "";
        
        if (q.options.end != null) {
            q.options.end();
        }

        queue.shift();
        run(node, queue);
    }

    node.addEventListener(transitionEndEvent, transitionEndHandler);
}

function convertCssToStyle(name) {
    return name.replace(/(\-[a-z])/g, function (x) {
        return x.slice(1).toUpperCase();
    });
}

function convertStyleToCss(name) {
    return name.replace(/([A-Z])/g, function (x) {
        return "-" + x.toLowerCase();
    });
}

})();

