(function () {

var man = window.man = {};

var transformKeys = [
    "matrix", "translate", "scale", "rotate", "skew",
];

man.transition = function (obj, target) {
    obj.style.transition = "all 2s ease-out";
    for (var key in target) {
        if (transformKeys.indexOf(key) != -1) {
            obj.style.transform = key + "(" + target[key] + ")";
        } else {
            obj.style[key] = target[key];
        }
    }

    function transitionEndHandler() {
        obj.removeEventListener("transitionend", transitionEndHandler);

        obj.style.transition = "";
        for (var key in target) {
            if (transformKeys.indexOf(key) != -1) {
                obj.style.transform = "";
            } else {
                obj.style[key] = "";
            }
        }
    }

    obj.addEventListener("transitionend", transitionEndHandler);
};

function transitionEndHandler() {
}

})();

