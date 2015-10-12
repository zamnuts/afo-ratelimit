var RateLimit,
	l = require('lodash');

/**
 * @class RateLimit
 * @constructor
 * @param {{}} [config]
 * @param {int} config.checkInterval The polling interval.
 * @param {Object[]} config.rates A collection of rate relationships.
 * @param {int} config.rates[].limit Max number of invocations per time allotment.
 * @param {int} config.rates[].per The time window/allotment in milliseconds.
 */
module.exports = RateLimit = function RateLimit(config) {
	this._queue = {};
	this._ratesPerQueue = {};
	this._interval = null;
	this.updateConfig(config);
	this.startInterval();
};

/**
 * Update the configuration on the fly.
 * @param {{}} config
 */
RateLimit.prototype.updateConfig = function updateConfig(config) {
	this.config = l.merge({
		checkInterval: null,
		rates: []
	},config||{});
	if ( typeof this.config.checkInterval !== 'number' || 
			isNaN(this.config.checkInterval) || 
			this.config.checkInterval < 10 ) {
		this.config.checkInterval = 500;
	}
	if ( typeof this.config.rates === 'object' && l.isArray(this.config.rates) ) {
		this.config.rates = this.config.rates.filter(this._isValidLimitSpec);
	} else if ( typeof this.config.rates === 'object' && this._isValidLimitSpec(this.config.rates) ) {
		this.config.rates = [this.config.rates];
	}
	if ( !l.isArray(this.config.rates) || !this.config.rates.length ) {
		this.config.rates = [ // default rates
			{limit: 1, per: 1000} // 1 per second
			// {limit: 50, per: 1000*60}, // 50 per minute
			// {limit: 2900, per: 1000*60*60} // 2900 per hour
		];
	}
};

/**
 * @param {*} o
 * @returns {boolean}
 * @private
 */
RateLimit.prototype._isValidLimitSpec = function _isValidLimitSpec(o) {
	return (
		typeof o === 'object' &&
		typeof o.limit === 'number' &&
		typeof o.per === 'number' &&
		!isNaN(o.limit) &&
		!isNaN(o.per)
	);
};

/**
 * Run the auto poller.
 */
RateLimit.prototype.startInterval = function startInterval() {
	if ( !this._interval ) {
		this._interval = setInterval(this.resolveQueues.bind(this),this.config.checkInterval);
	}
};

/**
 * Pause the auto poller.
 */
RateLimit.prototype.stopInterval = function stopInterval() {
	if ( this._interval ) {
		clearInterval(this._interval);
		this._interval = null;
	}
};

/**
 * Rate limit a series of function calls per queue ID. Add a function to a queue.
 * @param {string|int} queueId A unique queue identifier to group functions by.
 * @param {function} fn The function to call.
 * @returns {boolean} Whether the queue additional was successful or not.
 */
RateLimit.prototype.addToQueue = function addToQueue(queueId,fn) {
	var args = Array.prototype.slice.call(arguments,0);
	fn		= args.pop() || null;
	queueId	= args.length?args.shift():'unclassified';
	if ( typeof fn !== 'function' ) {
		return false;
	}
	if ( typeof queueId !== 'string' && typeof queueId !== 'number' ) {
		return false;
	}
	this._prepareQueueId(queueId);
	this._queue[queueId].push(fn);
	this.resolveQueues();
	return true;
};

/**
 * @param {string|int} queueId
 * @private
 */
RateLimit.prototype._prepareQueueId = function _prepareQueueId(queueId) {
	if ( !l.isArray(this._queue[queueId]) ) {
		this._queue[queueId] = [];
	}
	if ( !l.isArray(this._ratesPerQueue[queueId]) ) {
		this._ratesPerQueue[queueId] = l.cloneDeep(this.config.rates).map(function(o) {
			o.lastTime = Date.now();
			o.count = 0;
			return o;
		});
	}
};

/**
 * Manually resolve a queue, series of queues, or all queues, based on an optional queue identifier list.
 * @param {string|int|string[]|int[]} [queueIds] The queue ID or list of queue IDs to resolve.
 */
RateLimit.prototype.resolveQueues = function resolveQueues(queueIds) {
	var queues = Object.keys(this._queue);
	if ( typeof queueIds === 'string' || typeof queueIds === 'number' ) {
		queueIds = [queueIds];
	}
	if ( l.isArray(queueIds) && queueIds.length ) {
		queues = l.intersection(queues,queueIds);
	}
	queues.forEach(this._resolveQueueId.bind(this));
};

/**
 * { limit: 30, per: 1000*60, count 0, lastTime: Date.now() }
 * @param {string|int} queueId
 * @private
 */
RateLimit.prototype._resolveQueueId = function _resolveQueueId(queueId) {
	var now = Date.now(),
		rates = this._ratesPerQueue[queueId],
		queue = this._queue[queueId],
		numCanExec = 0,
		execCount = 0,
		rateResults = l.pluck(rates,'limit');
	rates.forEach(function(rate,i) { // reminder: rate is an object, passed by ref
		if ( now - rate.lastTime < rate.per ) { // we are within bounds of this rate limit
			rateResults[i] = Math.max(rate.limit - rate.count,0); // negative is treated as 0
		} else { // we are beyond the rate time bounds, so reset
			rate.count = 0;
			rate.lastTime = Date.now();
			rateResults[i] = rate.limit;
		}
	});
	numCanExec = Math.min(l.min(rateResults),queue.length); // max # of calls we can make is based on the smallest limit
	if ( numCanExec ) {
		for ( var i = 0; i < numCanExec; i++ ) {
			var fn = queue.shift();
			if ( typeof fn === 'function' ) {
				setImmediate(fn);
				execCount++;
			}
		}
		this._incrementRateById(queueId,execCount);
	}
};

/**
 * @param {string|int} queueId
 * @param {int} inc
 * @private
 */
RateLimit.prototype._incrementRateById = function(queueId,inc) {
	if ( !l.isArray(this._ratesPerQueue[queueId]) ) {
		return;
	}
	for ( var i = 0, len = this._ratesPerQueue[queueId].length; i < len; i++ ) {
		this._ratesPerQueue[queueId][i].count += inc;
	}
};

/**
 * Clean/clear all queues.
 */
RateLimit.prototype.clean = function clean() {
	Object.keys(this._queue).forEach(function(queueId) {
		if ( !l.isArray(this._queue[queueId]) || !this._queue[queueId].length ) {
			delete this._queue[queueId];
		}
	}.bind(this));
};
