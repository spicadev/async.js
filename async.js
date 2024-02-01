function createAggregateError(errors, message) {
  if (typeof AggregateError == 'function' && AggregateError instanceof Error) {
    return new AggregateError(errors, 'All promises were rejected')
  } else {
    var error = new Error('All promises were rejected')
    error.name = 'AggregateError'
    error.stack = 'AggregateError: ' + error.message
    error.errors = errors
    return error
  }
}

if(typeof Promise.any != 'function') {
  Promise.any = function any(promises) {
    if(!promises || (typeof Symbol == 'function' && !promises[Symbol.iterator]) || promises.length == 0) {
      return Promise.reject(createAggregateError([], 'No promises in Promises.any was resolved'))
    }
    
    var resolved = false
    var resolvedValue
    var errors = []
    for (var promise of promises) {
      if(resolved) {
        return Promise.resolve(resolvedValue)
      }
      
      Promise.resolve(promise).then(function(res) {
        resolved = true
        resolvedValue = res
      })
      .catch(function(error) {
        errors.push(error)
      })
    }
      
    return Promise.reject(createAggregateError(errors, 'All promises were rejected'))
  }
}

if(typeof Promise.allSettled != 'function') {
  Promise.allSettled = function allSettled(promises) {
    if(!promises || (typeof Symbol == 'function' && !promises[Symbol.iterator]) || promises.length == 0) {
      return Promise.reject(createAggregateError([], 'No promises in Promises.any was resolved'))
    }
    var output = []
    
    return new Promise(function(resolve) {
      for(var promise of promises) {
        Promise.resolve(promise).then(function(res) {
          output.push({ status: 'fulfilled', value: res })
        }).catch(function(error) {
          output.push({ status: 'rejected', reason: error })
        })
      }
      
      resolve(output)
    })
  }
}

if(typeof Promise.withResolvers != 'function') {
  Promise.withResolvers = function withResolvers() {
    var resolve, reject
    var promise = new Promise(function(res, rej) {
      resolve = res
      reject = rej
    })
    return {
      promise: promise,
      resolve: resolve,
      reject: reject
    }
  }
}

function EventEmitter() {
  if(!(this instanceof EventEmitter)) {
    var instance = Object.create(EventEmitter.prototype)
    EventEmitter.apply(instance, arguments)
    return instance
  }
  var events = {}
  
  this.on = function on(eventName, callback, thisArg) {
    if(typeof eventName != 'string') {
      throw new Error('Expected argument 1 "eventName" to be a string, received ' + typeof eventName + ' instead')
    } else if(typeof callback != 'function') {
      throw new Error('Expected argument 2 "callback" to be a function, received ' + typeof callback + ' instead')
    } else if(arguments.length < 3) {
      thisArg = {}
    }
    events[eventName] = events[eventName] || []
    events[eventName].push({ callback: callback, thisArg: thisArg })
    return this
  }
  this.addListener = this.on
  
  this.once = function once(eventName, callback, thisArg) {
    var done = false
    return this.on(eventName, function() {
      if(!done) {
        callback.apply(this, arguments)
        done = true
      }
    }, arguments.length < 3 ? {} : thisArg)
  }
  
  this.off = function off(eventName, callback) {
    if(arguments.length < 1 || typeof eventName != 'string') {
      throw new Error('Expected argument 1 "eventName" to be a string, received ' + typeof eventName + ' instead')
    } else if(arguments.length < 2) {
      events[eventName] = []
    } else if(arguments.length > 2 && typeof callback != 'function') {
      throw new Error('Expected argument 2 "callback" to be a function, received ' + typeof callback + ' instead')
    } else {
      events[eventName] = events[eventName] || []
      for(var i = 0; i < events[eventName].length; i++) {
        if(events[eventName][i] == callback) {
          events[eventName].splice(i, 1)
          break
        }
      }
    }
    
    return this
  }
  this.removeListener = this.off
  
  this.emit = function emit(eventName) {
    var isAsync = false
    if (arguments.length < 1 || (typeof eventName == 'object' && (eventName == null || typeof eventName.eventName != 'string')) || typeof eventName != 'string') {
      throw new Error('Expected argument 1 "eventName" to be a string, received ' + typeof eventName + ' instead')
    } else if(typeof eventName == 'object') {
      if('isAsync' in eventName) {
        isAsync = eventName.isAsync
      }
      eventName = eventName.eventName
    }
    
    events[eventName] = events[eventName] || []
    if(!isAsync) {
      for (var i = 0; i < events[eventName].length; i++) {
        events[eventName][i].callback.apply(events[eventName][i].thisArg, Array.prototype.slice.call(arguments, 1))
      }
    } else {
      setTimeout(function() {
        for (var i = 0; i < events[eventName].length; i++) {
          events[eventName][i].callback.apply(events[eventName][i].thisArg, Array.prototype.slice.call(arguments, 1))
        }
      }, 0)
    }
  }
  this.dispatch = this.emit
  return this
}

function Thread(callback) {
  if(!(this instanceof Thread)) {
    var instance = Object.create(Thread.prototype)
    Thread.apply(instance, arguments)
    return instance
  }
  var self = this
  var queue = []
  var len = 0
  
  function runNext(doneCallback, errorCallback) {
    var task = queue.shift()
    if(typeof task != 'undefined') {
      return task
      .then(function(res) {
        res = res()
        runNext(doneCallback, errorCallback)
        return res
      })
      .catch(function(error) {
        error.taskId = (len || 0) - queue.length
        errorCallback(error)
      })
    } else {
      doneCallback()
    }
  }
  
  this.addTask = function addTask(task) {
    if(typeof task == 'function') {
      queue.push(Promise.resolve(task))
      len++
      return this
    } else {
      throw new Error('Expected argument 1 to be a `function`, received argument with typeof ' + typeof task + ' instead.')
    }
  }
  
  this.destroy = function destroy() {
    queue = null
    len = null
    return null
  }
  
  this.start = function start(errorCallback) {
    return new Promise(function(resolve, reject) {
      runNext(function() {
        self.destroy()
        resolve()
      }, typeof errorCallback == 'function' ? errorCallback : function(err) {
        reject(err)
      })
    })
  }
  
  if(typeof callback == 'function') {
    this.addTask(callback)
  }
}

if(typeof module != 'undefined' && typeof exports == 'object') {
  module.exports = {
    Thread: Thread,
    Promise: Promise,
    EventEmitter: EventEmitter
  }
}

if(typeof require == 'function' && require.arjs) {
  global.Thread = global.Thread || Thread
  global.EventEmitter = global.EventEmitter || EventEmitter
  global.Promise = Promise
}
