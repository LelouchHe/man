(function () {

var man = window.man = {};

var transformKeys = [
    "matrix", "translate", "scale", "rotate", "skew",
];

man.transit = function (node, target) {
    var options = {};
    
    options.duration = checkOption(target, "duration", "number", 1000);
    options.delay = checkOption(target, "delay", "number", 0);
    options.timing = checkOption(target, "timing", "string", "linear");
    options.end = checkOption(target, "end", "function", null);
    
    node.style.transition = buildTransition(options, target);
    for (var key in target) {
        if (transformKeys.indexOf(key) != -1) {
            node.style.transform = key + "(" + target[key] + ")";
        } else if (key in document.body.style) {
            node.style[key] = target[key];
        }
    }

    function transitionEndHandler() {
        node.removeEventListener("transitionend", transitionEndHandler);
        node.style.transition = "";
        
        if (options.end != null) {
            options.end();
        }
    }

    node.addEventListener("transitionend", transitionEndHandler);
};

function checkOption(target, key, type, def) {
    if (!(key in target)) {
        return def;
    }
    
    var value = target[key];
    delete target[key];
    
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

