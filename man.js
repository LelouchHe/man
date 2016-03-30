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
    downgrade: {
        type: "boolean",
        def: false
    }
};

var transformKeys = [
    "matrix", "translate", "scale", "rotate", "skew",
];

/*

    key: node
    value: {
        cssValue: string (used in assignment)
    }

*/
var map = {};

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

