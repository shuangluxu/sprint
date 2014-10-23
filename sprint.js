var Sprint;

(function() {
  "use strict"

  var d = document
  var matchSelector = Element.prototype.matches ? "matches" : "msMatchesSelector"

  function addEventListeners(listeners, el) {
    var sprintClone = Sprint(el)
    Object.keys(listeners).forEach(function(key) {
      listeners[key].forEach(function(callback) {
        sprintClone.on(key, callback)
      })
    })
  }

  function duplicateEventListeners(el, clone) {
    // duplicate event listeners for the parent element
    var listeners = el.sprintEventListeners 
    listeners && addEventListeners(listeners, clone)

    // and its children
    var elChildren = selectElements("*", el)
    // cloneChildren is defined later to avoid searching descendants if not needed
    var cloneChildren 
    var i = -1
    var l = elChildren.length

    while (++i < l) {
      var listeners = elChildren[i].sprintEventListeners
      if (listeners) {
        if (!cloneChildren) {
          cloneChildren = selectElements("*", clone)
        }
        addEventListeners(listeners, cloneChildren[i])
      }
    }
  }

  function insertHTML(position, content) {
    if (typeof content == "string") {
      this.each(function() {
        this.insertAdjacentHTML(position, content)
      })
    }
    else if (typeof content == "function") {
      this.each(function(index) {
        var callbackValue = content.call(this, index, this.innerHTML)
        insertHTML.call(Sprint(this), position, callbackValue)
      })
    }
    else {
      // DOM node: single existing DOM node, createTextNode() or createElement()
      // Or collection: $("div"), [element1, element2], document.getElementsByTagName, etc.

      var clonedElements = []
      var elementsToInsert = content.nodeType ? [content] : toArray(content)
      position == "afterbegin" && elementsToInsert.reverse()

      var domMethods = {
        afterbegin: function(clone) {
          this.insertBefore(clone, this.firstChild)
        },
        beforebegin: function(clone) {
          this.parentNode.insertBefore(clone, this) 
        },
        beforeend: function(clone) {
          this.appendChild(clone) 
        }
      }

      this.each(function(index) {
        var self = this
        elementsToInsert.forEach(function(el) {
          var clone = el.cloneNode(true)
          domMethods[position].call(self, clone)
          duplicateEventListeners(el, clone)
          clonedElements.push(clone)

          if (index > 0) return
          var prt = el.parentNode
          if (prt) prt.removeChild(el)
        })
      })

      if (content instanceof Init) {
        content.dom = clonedElements
      }
      return clonedElements
    }
  }

  function selectElements(selector, context) {
    context = context || d
    // .class, #id or tagName
    if (/^[\#.]?[\w-]+$/.test(selector)) {
      switch (selector[0]) {
        case ".":
          return context.getElementsByClassName(selector.slice(1))
        case "#":
          return [context.getElementById(selector.slice(1))]
        default:
          if (selector == "body") {
            return [d.body]
          }
          return context.getElementsByTagName(selector)
      }
    }
    return context.querySelectorAll(selector)
  }

  function setStyle(el, prop, value) {
    el.style[prop] = value ? value : "none"
  }

  function setValueUnit(value) {
    var stringValue = typeof value == "string" ? value : value.toString()
    if (!stringValue.match(/\D/)) {
      stringValue += "px"
    }
    return stringValue
  }

  function toArray(obj) {
    // Converts array-like objects to actual arrays.
    // If obj is a Sprint object, the DOM reference gets updated.

    if (obj instanceof Array) return obj
    var isSprintObj = obj instanceof Init
    var dom = [].map.call(isSprintObj ? obj.get() : obj, function(el) {
      return el
    })
    if (isSprintObj) obj.dom = dom
    return dom
  }

  // constructor

  function Init(selector) {
    switch (typeof selector) {
      case "string":
        if (selector[0] == "<") {
          var tmp = d.createElement("div")
          tmp.innerHTML = selector.trim()
          this.dom = [tmp.firstChild]
        }
        else {
          this.dom = selectElements(selector)
        }
        this.length = this.dom.length
        break
      case "function":
        this.dom = [d]
        this.length = 1
        this.on("DOMContentLoaded", selector) 
        break
      default:
        if (selector instanceof Init) return selector
        if (
          selector instanceof Array ||
          selector instanceof NodeList ||
          selector instanceof HTMLCollection
        ) {
          this.dom = selector
        }
        else {
          this.dom = [selector]
        }
        this.length = this.dom.length
    }
  }

  Init.prototype = {
    add: function(selector) {
      var added = Sprint(selector)
      var dom = toArray(added)
      this.each(function() {
        dom.push(this)
      })
      added.length = dom.length
      return added
    },
    addClass: function(name) {
      this.each(function() {
        this.classList.add(name)
      })
      return this
    },
    append: function(content) {
      insertHTML.call(this, "beforeend", content)
      return this
    },
    appendTo: function(selector) {
      return Sprint(insertHTML.call(Sprint(selector), "beforeend", this))
    },
    attr: function(name, value) {
      var stringValue = typeof value == "string"

      if (stringValue || typeof value == "function") {
        this.each(function(i) {
          this.setAttribute(
            name, stringValue ? value : value.call(this, i, this.getAttribute(name))
          )
        })
        return this
      }

      if (typeof name == "object") {
        var attributeNames = Object.keys(name)
        this.each(function(i, el) {
          attributeNames.forEach(function(attribute) {
            el.setAttribute(attribute, name[attribute])
          })
        })
        return this
      }

      if (value === undefined) {
        return this.get(0).getAttribute(name)
      }
    },
    before: function(content) { 
      insertHTML.call(this, "beforebegin", content)
      return this
    },
    children: function(selector) {
      var dom = []
      var self = this
      this.each(function() {
        var nodes = this.children
        var i = -1
        var l = nodes.length

        while (++i < l) {
          var node = nodes[i]
          if (!selector || self.is(selector, node)) {
            dom.push(node)
          }
        }
      })
      return Sprint(dom)
    },
    clone: function(withEvents) {
      var cloned = []
      this.each(function() {
        var clone = this.cloneNode(true)
        withEvents && duplicateEventListeners(this, clone)
        cloned.push(clone)
      })
      return Sprint(cloned)
    },
    closest: function(selector) {
      var dom = []
      var self = this
      this.each(function() {
        var prt = this.parentNode
        var root = d.documentElement
        while (prt != root) {
          if (self.is(selector, prt)) {
            dom.push(prt)
            break
          }
          else {
            prt = prt.parentNode
          }
        }
      })
      return Sprint(dom)
    },
    css: function(property, value) {
      if (value != undefined) {
        // set (string or function)
        var isString = typeof value == "string"
        this.each(function(index) {
          if (!isString) {
            var style = Sprint(this).css(property)
          }
          setStyle(this, property, isString ? value : value(index, style))
        })
        return this
      }
      else {
        // read
        if (typeof property == "string") {
          return getComputedStyle(this.get(0)).getPropertyValue(property)
        }
        // read
        else if (Array.isArray(property)) {
          var o = {}
          var styles = getComputedStyle(this.get(0))
          property.forEach(function(prop) {
            o[prop] = styles.getPropertyValue(prop) 
          })
          return o
        }
        // set (property is an object)
        else {
          var properties = Object.keys(property)
          this.each(function(i, el) {
            properties.forEach(function(prop) {
              setStyle(el, prop, property[prop])
            })
          })
          return this
        }
      }
    },
    each: function(callback) {
      // callback(index, element) where element == this
      var i = -1
      var l = this.length
      var dom = this.dom

      while (++i < l) {
        var node = dom[i]
        callback.call(node, i, node) 
      }
      return this
    },
    empty: function() {
      this.each(function() {
        this.innerHTML = ""
      })
      return this
    },
    eq: function(index) {
      return Sprint(this.get(index))
    },
    filter: function(selector) {
      var dom = []
      switch (typeof selector) {
        case "string":
          var self = this
          this.each(function() {
            self.is(selector, this) && dom.push(this)
          })
          break
        case "function":
          this.each(function(index, el) {
            selector.call(this, index, el) && dom.push(this)
          })
          break
        default:
          return this
      }
      return Sprint(dom)
    },
    find: function(selector) {
      var dom = []
      this.each(function() {
        var nodes = selectElements(selector, this)
        var i = -1
        var l = nodes.length
        while (++i < l) {
          dom.push(nodes[i])
        }
      })
      return Sprint(dom)
    },
    first: function() {
      return this.eq(0)
    },
    get: function(index) {
      if (index === undefined) {
        return this.dom
      }
      if (index < 0) {
        index += this.length
      }
      return this.dom[index]
    },
    has: function(selector) {
      // .has(selector)
      if (typeof selector == "string") {
        var dom = []
        this.each(function() {
          selectElements(selector, this)[0] && dom.push(this)
        })
        return Sprint(dom)
      }

      // .has(contained)
      var i = -1
      var thisLength = this.length
      while (++i < thisLength) {
        var el = this.get(i)
        var descendants = selectElements("*", el)
        var j = -1
        var descendantsLength = descendants.length
        while (++j < descendantsLength) {
          if (descendants[j] === selector) {
            return Sprint(el)
          }
        }
      }
      return Sprint([])
    },
    hasClass: function(name) {
      var classFound = false
      this.each(function() {
        if (!classFound && this.classList.contains(name)) {
          classFound = true
        }
      })
      return classFound
    },
    height: function(value) {
      // read
      if (value === undefined) {
        var el = this.get(0)
        switch (el) {
          // height of HTML document
          case d:
            var offset = d.documentElement.offsetHeight
            var inner = window.innerHeight
            return offset > inner ? offset : inner
          // height of the viewport
          case window:
            return window.innerHeight
          // height of an element
          default:
            return el.getBoundingClientRect().height 
        }
      }
      // set
      else {
        var isFunction = typeof value == "function"
        var stringValue = isFunction ? "" : setValueUnit(value)
        this.each(function(index) {
          if (isFunction) {
            stringValue = setValueUnit(value.call(this, index, Sprint(this).height()))
          }
          setStyle(this, "height", stringValue)
        })
      }
      return this
    },
    index: function(el) {
      var toFind
      var sprintElements
      if (!el) {
        toFind = this.get(0)
        sprintElements = this.first().parent().children()
      }
      else if (typeof el == "string") {
        toFind = this.get(0)
        sprintElements = Sprint(el)
      }
      else {
        toFind = el instanceof Init ? el.get(0) : el
        sprintElements = this
      }
      var elements = sprintElements.get()
      var i = -1
      var l = elements.length
      while (++i < l) {
        if (elements[i] === toFind) return i
      }
      return -1
    },
    is: function(selector, element) {
      // element is undocumented, internal-use only.
      // It gives better perfs as it prevents the creation of many objects in internal methods.

      var set = element ? [element] : this.get()
      var i = -1
      var l = set.length

      if (typeof selector == "string") {
        while (++i < l) {
          if (set[i][matchSelector](selector)) {
            return true
          }
        }
        return false
      }

      if (typeof selector == "object") {
        // Sprint object or DOM element(s)
        var obj
        if (selector instanceof Init) {
          obj = selector.get()
        }
        else {
          obj = selector.length ? selector : [selector]
        }
        var objLength = obj.length
        while (++i < l) {
          var j = -1
          while (++j < objLength) {
            if (set[i] === obj[j]) {
              return true
            }
          }
        }
        return false
      }

      if (typeof selector == "function") {
        while (++i < l) {
          if (selector.call(this, i, this)) {
            return true
          }
        }
        return false
      }
    },
    last: function() {
      return this.eq(-1)
    },
    next: function(selector) {
      var dom = []
      var self = this
      this.each(function() {
        var next = this.nextElementSibling
        if (!selector || self.is(selector, next)) {
          dom.push(next)
        }
      })
      return Sprint(dom)
    },
    not: function(selector) {
      var filtered = []
      this.each(function() {
        Sprint(this).is(selector) || filtered.push(this)
      })
      return Sprint(filtered)
    },
    off: function(type, callback) {
      switch (arguments.length) {
        // .off()
        case 0:
          this.each(function(i, el) {
            if (!this.sprintEventListeners) return
            Object.keys(this.sprintEventListeners).forEach(function(key) {
              el.sprintEventListeners[key].forEach(function(callbackReference) {
                el.removeEventListener(key, callbackReference) 
              })
            }) 
            this.sprintEventListeners = {}
          })
          break

        // .off("click")
        case 1:
          this.each(function(i, el) {
            if (!this.sprintEventListeners) return
            this.sprintEventListeners[type].forEach(function(callbackReference) {
              el.removeEventListener(type, callbackReference) 
            }) 
            this.sprintEventListeners[type] = []
          })
          break

        // .off("click", handler)
        case 2:
          this.each(function() {
            if (!this.sprintEventListeners) return
            var updatedSprintEventListeners = []
            this.sprintEventListeners[type].forEach(function(callbackReference) {
              callback != callbackReference && updatedSprintEventListeners.push(callbackReference)
            }) 
            this.removeEventListener(type, callback) 
            this.sprintEventListeners[type] = updatedSprintEventListeners
          })
          break
      }
      return this
    },
    on: function(type, callback) {
      this.each(function() {
        var callbackReference = callback
        if (!this.sprintEventListeners) {
          this.sprintEventListeners = {}
        }
        if (!this.sprintEventListeners[type]) {
          this.sprintEventListeners[type] = []
        }
        this.sprintEventListeners[type].push(callbackReference)
        this.addEventListener(type, callbackReference)
      })
      return this
    },
    parent: function(selector) {
      var dom = []
      var self = this
      this.each(function() {
        var prt = this.parentNode
        if (!selector || self.is(selector, prt)) {
          dom.push(prt)
        }
      })
      return Sprint(dom)
    },
    position: function() {
      var bounding = {
        first: getBounding(this.get(0)),
        prt: getBounding(this.first().parent().get(0))
      }
      function getBounding(el) {
        return el == d.body ? { top: 0, left: 0 } : el.getBoundingClientRect()
      }
      return {
        top: bounding.first.top - bounding.prt.top,
        left: bounding.first.left - bounding.prt.left
      }
    },
    prepend: function(content) {
      insertHTML.call(this, "afterbegin", content)
      return this
    },
    remove: function(selector) {
      toArray(this)
      this.each(function() {
        if (!selector || Sprint(this).is(selector)) {
          this.parentNode.removeChild(this)
        }
      })
      return this
    },
    removeAttr: function(name) {
      this.each(function() {
        this.removeAttribute(name)
      })
      return this
    },
    removeClass: function(name) {
      name === undefined
        ? this.removeAttr("class")
        : this.each(function() {
            this.classList.remove(name)
          })
      return this
    },
    siblings: function(selector) {
      var siblings = []
      this.each(function(i, el) {
        Sprint(this).parent().children().each(function() {
          if (this == el || (selector && !Sprint(this).is(selector))) return
          siblings.push(this)
        })
      })
      return Sprint(siblings)
    },
    size: function() {
      return this.length
    },
    slice: function(start, end) {
      var dom = this.get()
      var range = []
      var i = start >= 0 ? start : start + this.length
      var l = this.length
      if (end < 0) {
        l += end
      }
      else if (end >= 0) {
        l = end > this.length ? this.length : end
      }
      for (; i < l; i++) {
        range.push(dom[i])
      }
      return Sprint(range)
    },
    text: function(content) {
      if (content === undefined) {
        var texts = []
        this.each(function() {
          texts.push(this.textContent)
        })
        return texts.length == 1 ? texts[0] : texts
      }
      else {
        this.each(function() {
          this.textContent = content
        })
        return this
      }
    },
    toggleClass: function(name) {
      this.each(function() {
        this.classList.toggle(name)
      })
      return this
    },
    wrap: function(element) {
      if (typeof element == "function") {
        this.each(function() {
          Sprint(this).wrap(element.call(this))
        })
      }
      else {
        toArray(this)

        var outerWrap = Sprint(element).get(0)
        var outerWrapHTML = typeof element == "string" ? element : outerWrap.outerHTML
        var nestedElements = outerWrapHTML.match(/</g).length > 2

        this.each(function() {
          var clone = outerWrap.cloneNode(true)
          var prt = this.parentNode
          var next = this.nextSibling
          var elementPrt

          if (nestedElements) {
            // find most inner child
            var innerWrap = clone.firstChild
            while (innerWrap.firstChild) innerWrap = innerWrap.firstChild
            elementPrt = innerWrap
          }
          else {
            elementPrt = clone
          }

          duplicateEventListeners(outerWrap, clone)
          elementPrt.appendChild(this)
          prt.insertBefore(clone, next)
        })
      }

      return this
    }
  }

  // public

  Sprint = function(selector) {
    return new Init(selector)
  }

  if (window.$ === undefined) {
    window.$ = Sprint
  }
})();
