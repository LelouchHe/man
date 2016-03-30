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
