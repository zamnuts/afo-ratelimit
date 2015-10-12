# RateLimit

Queue up a bunch of functions, and let them execute based on invocations per millisecond rules.

```javascript
var RateLimit = require('../index.js');

var rl = new RateLimit({
	checkInterval: 500,
	rates: [
		{limit: 1, per: 1000}, // 1 per second
		{limit: 5, per: 1000*30}, // 5 per 30-seconds
		{limit: 9, per: 1000*60}, // 9 per minute
		{limit: 200, per: 1000*60*60}, // 200 per hour
		{limit: 1000, per: 1000*60*60*24} // 1000 per day
	]
});

function logTime() {
	var hrtime = process.hrtime();
	console.log('example: timestamp %s, hrtime %dns',new Date().toISOString(),hrtime[0]*1e9+hrtime[1]);
}

for ( var i = 0; i < 20; i++ ) {
	rl.addToQueue('unique queue ID',logTime);
}

/*
example: timestamp 2015-10-06T12:49:38.833Z, hrtime 1162041936436785ns
example: timestamp 2015-10-06T12:49:40.790Z, hrtime 1162043933269469ns
example: timestamp 2015-10-06T12:49:41.791Z, hrtime 1162044934806502ns
example: timestamp 2015-10-06T12:49:42.792Z, hrtime 1162045935057011ns
example: timestamp 2015-10-06T12:49:43.793Z, hrtime 1162046935985948ns
example: timestamp 2015-10-06T12:50:08.806Z, hrtime 1162071949138051ns
example: timestamp 2015-10-06T12:50:09.806Z, hrtime 1162072949668703ns
example: timestamp 2015-10-06T12:50:10.806Z, hrtime 1162073949912099ns
example: timestamp 2015-10-06T12:50:11.807Z, hrtime 1162074950196589ns
example: timestamp 2015-10-06T12:50:38.822Z, hrtime 1162101964641538ns
example: timestamp 2015-10-06T12:50:39.823Z, hrtime 1162102965398596ns
example: timestamp 2015-10-06T12:50:40.823Z, hrtime 1162103965747886ns
example: timestamp 2015-10-06T12:50:41.823Z, hrtime 1162104965813871ns
example: timestamp 2015-10-06T12:50:42.824Z, hrtime 1162105966210181ns
example: timestamp 2015-10-06T12:51:08.838Z, hrtime 1162131980659081ns
example: timestamp 2015-10-06T12:51:09.839Z, hrtime 1162132981490818ns
example: timestamp 2015-10-06T12:51:10.839Z, hrtime 1162133981739746ns
example: timestamp 2015-10-06T12:51:11.840Z, hrtime 1162134982114324ns
*/
```
