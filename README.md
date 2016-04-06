# man
mine animation library for js

# target

1. wrap `transform` and `transition` in a simple interface, no need to worry about browser support and free in format
2. fall back to js animation on browser not supporting those new style
3. js-only animation to support multi-object, stagged animation and full-featured monitor callback
4. optimized performace
5. building tool for web game

# API

man.transit(node, target);

node: DOM node

target: {
    key: value,
}

reserved keys:

1. duration: in ms (default 1000)
2. delay: in ms (default 0)
3. timing: string (default linear)
4. end: callback

# revision

`man.transit(node, target)` can't be easily queued to accomplish squence animation.

maybe we can do like `m(node).transit(target).transit(target)`.

# another thought

even if we use `m(node)`, we still need to maintain knid of dict map from node to its own queue, so useless to change the interface.

you can just

    man.transit(node1, target1).transit(node2, target2); // squence

    // if node1 != node2, this happens at same time
    // or, this just like squence above
    man.transit(node1, target1);
    man.transit(node2, target2);

so this gives user more flexibility. I will stick to this.

# final API

    man.transit(node, target);

    man.transit([node1, node2], [target1, target2]);

    man.transit(node, [target1, target2]);
    man.transit([node1, node2], target)

    man.transit([node], [target1, target2]); // nodes can be single
    man.transit(node, [target]); // targets can be single

notice, all in `man.transit` are queued, if you want parellel, you just call `man.transit` seperately:

    man.transit(node1, target1);
    man.transit(node2, target2);

I provided `option` for `man.transit` before, but it's a bad design since user can combine the single queue calls to fullfill their need.

# support browser

IE8+, other modern browser

issue:

1. IE8/9, Opera mini: no support `transition`
2. IE8, Opera mini: no support `transform2D`
3. IE8/9, Opera mini: no support `transform3D`
4. IE8/9, android 4.3: no support `requestAnimationFrame`  (use `setTimeout`)
5. IE8: no support ECMA5, like "Array.indexOf" (partially fixed)
6. IE8: no support `addEventListener` (don't use this when `transition` is unavailable)

# issue

1. no idae why "Object doesn't support attachEvent" happens on IE
2. how seperate calls affect each other (add `.manq` to dom node in animation to determine which queue it's in so we can cancel that when several animations conflict)
3. don't use `transform` directly, which might be a problem is `transform: ""`
4. hard to compute original style when you set `xxx: ""` (maybe we can just set it, and get css style and set it back?)
5. `transform` return `matrix` from current styel. don't touch this now. (matrix turns out to be non-animated, we need to extract value first)
6. since unit may differ between user input and node style, no calc here, just use node style as if they're with same unit
7. still hard to do complex animation (use "queue" as an example. queued from left to right, and simultaneously from rigth to left)

# complex animation

    var id1 = man.transit(node1, target2);
    var id2 = man.transit(node2, target2);
    man.wait([id1, id2], function () {
        man.transit(node3, target3);
    });

`man.wait` will wait for any animation of `[id]` is over, so it's all up to user to determine what will happen.

in test.js, i demonstrate 2 ways to queue all animations: use `target.end` or `man.wait`

