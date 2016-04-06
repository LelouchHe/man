
require.config({
    paths: {
        "man": "man"
    }
});

require(["man"], function (man) {

var num = 6;
var height = 50;

var playground = document.getElementById("playground");
playground.style.height = (height + 10) * num + "px";

var boxes = [];
for (var i = 0; i < num; i++) {
    boxes[i] = document.getElementById("box" + i);
    boxes[i].style.top = (height + 5) * i + 10 + "px";
}
var timings = [
    "ease", "linear", "ease-in", "ease-out", "ease-in-out",
    "cubic-bezier(0.39, 0.575, 0.565, 1)"
];

var method = document.getElementById("method");
updateMethod();

addEventListener(method, "change", updateMethod);

function updateMethod(evt) {
    var nojs = false;
    var debugjs = false;

    var choice = method.options[method.selectedIndex].value;
    if (choice == "css") {
        nojs = true;
    } else if (choice == "js") {
        debugjs = true;
    }

    man.def("nojs", nojs);
    man.def("debugjs", debugjs);
}

var start = document.getElementById("start");
var reset = document.getElementById("reset");
var queue = document.getElementById("queue");

addEventListener(start, "click", function () {
    for (var i = 0; i < num; i++) {
        man.transit(
            boxes[i],
            {
                left: 120,
                timing: timings[i]
            }
        );
    }
});

addEventListener(reset, "click", function () {
    for (var i = 0; i < num; i++) {
        man.transit(
            boxes[i],
            {
                left: 10,
                timing: timings[i]
            }
        );
    }
});

addEventListener(queue, "click", function () {
    man.queue(
        boxes,
        [
            {
                left: 120,
                backgroundColor: "yellow",
                opacity: "0.5",
                rotate: "1080deg"
            },
            {
                left: 130,
                backgroundColor: "rgb(255, 0, 255)",
                opacity: 0.7,
                rotate: 720
            },
            {
                left: 140,
                backgroundColor: "#00ffff",
                opacity: 0.4,
                scale: "1.5, 2"
            },
            {
                left: 140,
                backgroundColor: [0, 0xff, 0xff],
                scale: "(1, 1.5)",
                rotate: 1080
            },
            {
                left: 130,
                transform: "skew(175deg, 175deg)"
            },
            {
                left: 120
            }
        ]
    )
});

function addEventListener(node, name, func) {
    if (node.addEventListener) {
        node.addEventListener(name, func);
    } else if (node.attachEvent) {
        node.attachEvent("on" + name, func);
    }
}

});
