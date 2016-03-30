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
