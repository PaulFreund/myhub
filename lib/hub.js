//###################################################################################################
/*
    Copyright (c) since 2012 - Paul Freund

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.
*/
//###################################################################################################

var self = null // has to be set to this in init!, required for template access

//###################################################################################################

module.exports = {    
    //===============================================================================================
    
    //===============================================================================================
    // Name
    templateName: 'hub',

    //===============================================================================================
    // Config
    config: [
        'summary',
        'summaryAddress'
    ],
    
    //===============================================================================================
    // Properties
    properties: [
        'util',
        'rss',
        'cron',
        'lastEventTime'
    ],
    
    //===============================================================================================
    // Init
    init: function(ready) {        
        self = this;
        self.util = require('util');
        self.rss = require('rss');
        self.cron = require('cron');

        self.lastEventTime = Date.now();

        // Redirect requests without path to index.html
        self.events.emit('simpleweb.registerPath', '/', function(req, res) {
            res.redirect("/index.html");
        });

        // Handle requests for the rss feed
        self.events.emit('simpleweb.registerPath', '/feed*', self.renderFeed);

        // Get and set settings
        self.events.emit('simpleweb.registerClientFunction', 'getSettings', function(callback) {
            self.events.emit('store.get', 'settings', function(settings) {
                if( settings === null || settings === undefined )
                    settings = {};

                if( callback )
                    callback(settings);
            });
        });

        self.events.emit('simpleweb.registerClientFunction', 'setSettings', function(settings) {
            if( settings !== undefined && settings !== null )
                self.events.emit('store.set', 'settings', settings);
        });

        // Add access to the store
        self.events.emit('simpleweb.registerClientFunction', 'getData', function(timeSpan, filterRules, callback){
            self.getEventList(timeSpan, filterRules, callback);
        });

        // Set data proeprties
        self.events.emit('simpleweb.registerClientFunction', 'setStarred', function(date, isStarred){
            self.setEventValue(date, 'starred', isStarred);
        });

        self.events.emit('simpleweb.registerClientFunction', 'setSeen', function(date, isSeen){
            self.setEventValue(date, 'seen', isSeen);
        });

        self.registerJobs();

        ready();
    },
    
    //===============================================================================================
    // Exit
    exit: function(ready) {
        ready();
    },

    //===============================================================================================
    // Methods
    methods: [
        ////-----------------------------------------------------------------------------------------
        // Returns bare jid
        function jidToBare(jid) {
            return jid.split("/")[0];
        },

        ////-----------------------------------------------------------------------------------------
        // Ensure a date number has two digits
        function getTwoDigitDate(number)
        {
            return (('0' + number).slice(-2));
        },

        ////-----------------------------------------------------------------------------------------
        // Get a rounded number of seconds from milliseconds
        function MSecToSec(MSec)
        {
            var strMSec = MSec.toString();
            var strMSecHigh = strMSec.substr(0,strMSec.length-2); // Cut the last two digits
            var fSec = parseFloat(strMSecHigh) / 10;
            return Math.round(fSec);
        },

        ////-----------------------------------------------------------------------------------------
        // Ensure a date number has two digits
        function dateToPath(date)
        {
            var eventDate = new Date(parseInt(date));
            return  'events'
                + '.'
                + eventDate.getFullYear()
                + '.'
                + self.getTwoDigitDate(eventDate.getMonth()+1)
                + '.'
                + self.getTwoDigitDate(eventDate.getDate())
                + '.'
                + self.getTwoDigitDate(eventDate.getHours())
                + '.'
                + date
            ;
        },

        ////-----------------------------------------------------------------------------------------
        // Returns string to request the smallest matching timespan
        function getTimeSpanDiff(lastTimeStamp)
        {
            var lastTimePoint = self.dateToPath(lastTimeStamp.toString());
            var currentTimePoint = self.dateToPath((Date.now()).toString());

            var lastTimePointParts = lastTimePoint.split('.');
            var currentTimePointParts = currentTimePoint.split('.');

            var requestString = 'all';
            for( var idx in lastTimePointParts )
            {
                if( !lastTimePointParts.hasOwnProperty(idx) )
                    continue;

                if( lastTimePointParts[idx] !== currentTimePointParts[idx] )
                {
                    if( idx === '1' )       { requestString = 'all';            break; }
                    else if( idx === '2' )  { requestString = 'latest.year';    break; }
                    else if( idx === '3' )  { requestString = 'latest.month';   break; }
                    else if( idx === '4' )  { requestString = 'latest.date';    break; }
                    else                    { requestString = 'latest.hour';    break; }
                }
            }

            return requestString;
        },

        ////-----------------------------------------------------------------------------------------
        // Returns string in the format 'yyyy-mm-dd HH:MM'
        function getFullDateString(date)
        {
            return date.getFullYear()+'-'
                + self.getTwoDigitDate(date.getMonth())+'-'
                + self.getTwoDigitDate(date.getDate()) + ' '
                + self.getTwoDigitDate(date.getHours())+':'
                + self.getTwoDigitDate(date.getMinutes())+':'
                + self.getTwoDigitDate(date.getSeconds())
            ;
        },

        ////-----------------------------------------------------------------------------------------
        // Register jobs for email notifications
        function registerJobs()
        {
            for( var summaryIdx in self.config.summary )
            {
                if( !self.config.summary.hasOwnProperty(summaryIdx) ) { continue; }
                var summaryObj = self.config.summary[summaryIdx];

                if( summaryObj === undefined && summaryObj.interval === undefined)
                    continue;

                var job = new self.cron.CronJob(summaryObj.interval, self.executeJob, null, true);
                job.summary = summaryObj;
            }
        },

        ////-----------------------------------------------------------------------------------------
        // Execute jobs for email notifications
        function executeJob()
        {
            var timer = this;
            var summary = timer.summary;
            var timeoutMSecs = timer.cronTime.getTimeout();

            var timeoutSecs = self.MSecToSec(timeoutMSecs);

            var lastTimeStamp = Date.now() - (timeoutSecs*1000);
            var requestString = self.getTimeSpanDiff(lastTimeStamp);

            var enableHTML = false;
            if( summary.links !== undefined && summary.links )
                enableHTML = true;

            self.getEventList(requestString, summary.filter, function( data )
            {
                if( data === undefined || data === null )
                    return;

                var mailText = '';

                // Reverse for backwards iteration
                data.reverse();
                for( var idxItem in data )
                {
                    //// Get item
                    if( !data.hasOwnProperty(idxItem) ) {continue;}
                    var item = data[idxItem];

                    // Empty item
                    if( item === undefined || item === null) { continue; }

                    // If date is too old we are done
                    if( parseInt(item.date) < lastTimeStamp ) { break; }

                    // Get date string
                    var itemDateText = self.getFullDateString(new Date(item.date));

                    // Get Link string if enabled and available
                    var itemLinkText = '';
                    if( enableHTML && item.link !== undefined && item.link.length > 0 )
                        itemLinkText = '<a target="_blank" href="' + item.link + '">[X]</a>';

                    // Append the text
                    mailText = '[' + itemDateText + ']' + ' ' + item.text + ' ' + itemLinkText + '<br />\n' + mailText;
                }

                var mailTitle = summary.title + ' ' + self.getFullDateString(new Date(Date.now()));

                // If there is text send a mail
                if(mailText.length > 0)
                    self.events.emit('smtp.sendMail', enableHTML, self.config.summaryAddress, mailTitle, mailText);
            });
        },

        ////-----------------------------------------------------------------------------------------
        // Sets a value for an event identified with its date
        function setEventValue(date, name, value)
        {
            var path = self.dateToPath(date);
            self.events.emit('store.get', path, function(data)
            {
                if( data !== undefined && data !== null )
                {
                    if( data[name] !== undefined )
                        data[name] = value;

                    self.events.emit('store.set', path, data);
                }
            });
        },

        ////-----------------------------------------------------------------------------------------
        // Return data for timespan
        function getEventList(timeSpan, filterRules, callback)
        {
            if( timeSpan === undefined  )
            {
                callback(undefined);
                return;
            }

            var timeSpanParts = timeSpan.split('.');
            if( timeSpanParts[0] === 'latest')
                timeSpan = self.TimeSpanFromName(timeSpanParts[1]);


            var requestString = (timeSpan === 'all') ? ('events') : ('events.' + timeSpan);

            self.events.emit('store.get', requestString, function(data)
            {
                if( data === null || data === undefined )
                {
                    callback(undefined);
                    return;
                }

                // This gets us the list in reverse chronological order
                var list = self.filterEventList( [], data, filterRules );
                callback(list);
            });
        },

        ////-----------------------------------------------------------------------------------------
        // Recursive function to create item array
        function filterEventList(list, data, filter)
        {
            // Prepare for sorted iteration
            var keys = [];
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                    keys.push(key);
            }
            keys.sort();

            // Iterate over properties in sorted order
            for (var i = 0; i < keys.length; i++)
            {
                var item = data[keys[i]];

                // This is a collection
                if( item.date === undefined )
                {
                    list = self.filterEventList(list, item, filter );
                }
                // This is a event object
                else if( item.date !== undefined )
                {
                    var addItem = true;
                    for( var filterName in filter )
                    {
                        if( !filter.hasOwnProperty(filterName) ) { continue; }
                        var filterValue = filter[filterName];

                        if( item[filterName] !== undefined )
                        {
                            if( filterValue.indexOf('!') === 0 )
                            {
                                filterValue = filterValue.substr(1);
                                if( item[filterName] === filterValue)
                                    addItem = false;
                            }
                            else
                            {
                                if( item[filterName] !== filterValue)
                                    addItem = false;
                            }
                        }
                    }

                    if( addItem )
                        list.push(item);
                }
            }

            return list;
        },

        ////-----------------------------------------------------------------------------------------
        // Render a requested feed
        function renderFeed(req, res)
        {
            var feed = undefined;

            // Get url values
            var requestPath = undefined;
            var requestFilters = undefined;

            var urlParts = req.url.split('?');

            if( urlParts.length > 0 )
                requestPath = urlParts[0];

            if( urlParts.length > 1)
                requestFilters = urlParts[1];

            // Get timespan and filter rules
            var feedTimeSpan = self.getFeedTimeSpan(requestPath);
            var feedFilterRules = self.getFeedFilterRules(requestFilters);

            // Get feed data
            self.getEventList(feedTimeSpan, feedFilterRules, function(feedData)
            {
                // If feed data and timespan is valid, create feed
                if( feedTimeSpan !== undefined && feedFilterRules !== undefined && feedData !== undefined )
                   feed = self.createFeed(feedTimeSpan, feedData);

                // If feed is valid
                if( feed !== undefined )
                {
                    res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
                    res.write(feed);
                }
                else
                {
                    res.writeHead(500, 'Invalid Request');
                }

                res.end();
            });
        },

        ////-----------------------------------------------------------------------------------------
        // Get timespan from a range name
        function TimeSpanFromName(name)
        {
            var timeSpan = '';

            if( name  === undefined || name === null || name === 'all' ) //latest without range - return all
                return 'all';

            // Get latest span type
            var latestDate = new Date(self.lastEventTime);
            var spanLevel = 1; // year

            // Get requested span
            if( name !== undefined)
            {
                switch(name)
                {
                    case 'year':    { spanLevel = 1; break;}
                    case 'month':   { spanLevel = 2; break;}
                    case 'date':    { spanLevel = 3; break;}
                    case 'hour':    { spanLevel = 4; break;}
                }
            }

            // Set year
            if( spanLevel > 0 )
                timeSpan = latestDate.getFullYear();

            // Add month
            if( spanLevel > 1 )
                timeSpan = timeSpan + '.' + self.getTwoDigitDate(latestDate.getMonth()+1);

            // Add date
            if( spanLevel > 2 )
                timeSpan = timeSpan + '.' + self.getTwoDigitDate(latestDate.getDate());

            // Add hour
            if( spanLevel > 3 )
                timeSpan = timeSpan + '.' + self.getTwoDigitDate(latestDate.getHours());

            return timeSpan;
        },

        ////-----------------------------------------------------------------------------------------
        // Return timespan for a given path
        function getFeedTimeSpan(url)
        {
            if( url === undefined )
                return undefined;

            var feedPath = url.substr(url.indexOf('feed'));
            if( feedPath[feedPath.length - 1] === '/' )
                feedPath = feedPath.substr(0, feedPath.length - 1);
            var urlParts = feedPath.split('/');

            // Check if this really is a feed request
            if( urlParts[0] !== 'feed' )
                return undefined;

            if( urlParts.length === 1 ) // no range specified - return all
                return 'all';

            var timeSpan = undefined;

            // If we look for the latest *
            if( urlParts[1] === 'latest' )
            {
                if( urlParts.length === 2 ) //latest without range - return all
                    timeSpan = 'all';
                else if( urlParts.length === 3 )
                    timeSpan = urlParts[1] + '.' + urlParts[2];
            }
            // We look for the exact timespan
            else
            {
                var year = urlParts[1] ? urlParts[1] : undefined;
                if( year )
                {
                    if( year.length === 4 )
                        timeSpan = year;
                    else
                        return undefined;
                }

                var month = urlParts[2] ? urlParts[2] : undefined;
                if( month )
                {
                    var monthValue = parseInt(month);
                    if ( month.length === 2 && monthValue >= 1 && monthValue <= 12)
                        timeSpan = timeSpan + '.' + month;
                    else
                        return undefined;
                }

                var date = urlParts[3] ? urlParts[3] : undefined;
                if( date )
                {
                    var dateValue = parseInt(date);
                    if ( date.length === 2 && dateValue >= 1 && dateValue <= 31)
                        timeSpan = timeSpan + '.' + date;
                    else
                        return undefined;
                }

                var hour = urlParts[4] ? urlParts[4] : undefined;
                if( hour )
                {
                    var hourValue = parseInt(hour);
                    if ( hour.length === 2 && hourValue >= 0 && hourValue <= 23)
                        timeSpan = timeSpan + '.' + hour;
                    else
                        return undefined;
                }
            }

            return timeSpan;
        },

        ////-----------------------------------------------------------------------------------------
        // Return object with filter rules
        function getFeedFilterRules(parameters)
        {
            var filterRules = {};
            if( parameters !== undefined )
            {
                var filterRuleParts = parameters.split('&');
                for( var part in filterRuleParts )
                {
                    if( !filterRuleParts.hasOwnProperty(part) )
                        continue;

                    var rule = filterRuleParts[part];
                    var ruleParts = rule.split('=');
                    if( ruleParts.length == 2 )
                        filterRules[ruleParts[0]] = ruleParts[1];
                }
            }

            return filterRules;
        },

        ////-----------------------------------------------------------------------------------------
        // Render feed XML
        function createFeed(timeSpan, data)
        {
            if( timeSpan === undefined || data === undefined )
                return undefined;

            var feedItem = {};
            feedItem.title = 'myhub';
            feedItem.author = 'myhub';
            feedItem.feed_url = '#';
            feedItem.site_url = '#';
            feedItem.description = 'Feed for ' + timeSpan.replace('.', '/');
            var feed = new self.rss(feedItem);

            // Reverse array, newest first for rss
	        data.reverse();

            for( var idxItem in data )
            {
                //// Get item
                if( !data.hasOwnProperty(idxItem) ) {continue;}
                var item = data[idxItem];

                if( item === undefined || item === null)
                    continue;

                //// Build title
                var title = '';

                // Add starred flag
                if( item.starred )
                    title = '[*] ' + title;

                // Add text
                if( item.text !== undefined )
                    title = title + item.text;


                //// Build description
                var description = '';

                // Add type
                if( item.type !== undefined )
                    description = description + 'Type:  ' + item.type + '\n<br>';

                // Add source
                if( item.source !== undefined )
                    description = description + 'Source:  ' + item.source + '\n<br>';

                // add excerpt
                description = description + '\n<br>';

                if( item.excerpt !== undefined )
                    description = description + item.excerpt + '\n<br>';

                //// Create item
                var rssItem = {};
                if( title       !== undefined ) { rssItem.title = title;                }
                if( description !== undefined ) { rssItem.description = description;    }
                if( item.link   !== undefined ) { rssItem.url = item.link;              }
                if( item.date   !== undefined ) { rssItem.guid = item.date;             }
                if( item.input  !== undefined ) { rssItem.author = item.input;          }
                if( item.date   !== undefined ) { rssItem.date = item.date;             }

                feed.item(rssItem);
            }

            return feed.xml();
        },

        ////-----------------------------------------------------------------------------------------
        // Process incoming events
        function processInput(eventName, args)
        {
            // We don't want to publish this
            if( eventName === 'hub.input.irc.names')
                return;

            var eventRoute = eventName.split('.');

            var newEvent = {
                date: Date.now(),

                starred: false,
                seen: false,

                input: eventRoute[2],
                type: eventRoute[3],
                source: 'myhub',

                text: '',
                excerpt: '',
                link: ''
            };

            if( newEvent.type === 'error' )
            {
                newEvent.text = args[0];
            }
            else if( newEvent.input === 'rss' && newEvent.type === 'message' )
            {
                var from = args[0];
                var published_at = args[1];
                var url = args[2];
                var title = args[3];
                var summary = args[4];
                newEvent.source = from;
                newEvent.text = '['+from+'] '+title;
                newEvent.excerpt = summary;
                newEvent.link = url;
            }
            else if( newEvent.input === 'mail' && newEvent.type === 'message' )
            {
                var from = args[0];
                var to = args[1];
                var date = args[2];
                var subject = args[3];
                newEvent.source = from;
                newEvent.text = '[' + to + '] ' + from + ': ' + subject;
            }
            else if( newEvent.input === 'xmpp' )
            {
                if( newEvent.type === 'message' )
                {
                    var from = args[0];
                    var to = args[1];
                    var message = args[2];
                    var friendlyName = args[3];
                    newEvent.source = self.jidToBare(from);
                    newEvent.text = friendlyName + ' >> ' + message;
                }
                else if( newEvent.type === 'sent' )
                {
                    var from = args[1];
                    var to = args[0];
                    var message = args[2];
                    var friendlyName = args[3];
                    newEvent.type = 'message';
                    newEvent.source = self.jidToBare(from);
                    newEvent.text = friendlyName + ' << ' + message;
                }
                else
                {
                    var xmppType = newEvent.type;
                    newEvent.type = 'status';

                    var from = args[0];
                    var friendlyName = args[1];
                    newEvent.source = from;

                    if( xmppType === 'online' )
                    {
                        var show = args[2];
                        var status = args[3];
                        newEvent.text = friendlyName + ' changed status';

                        if( show !== undefined )
                            newEvent.text = newEvent.text + ' to ' + show;

                        if( status !== undefined )
                            newEvent.text = newEvent.text + ' ( ' + status + ' )';
                    }
                    else if( xmppType === 'offline' )
                    {
                        newEvent.text = friendlyName + ' logged out';
                    }
                    else if( xmppType === 'subscribe')
                    {
                        newEvent.text = friendlyName + ' subscribed to you';
                    }
                    else if( xmppType === 'unsubscribe')
                    {
                        newEvent.text = friendlyName + ' unsubscribed from you';
                    }
                }
            }
            else if( newEvent.input === 'irc' )
            {
                if( newEvent.type === 'message' )
                {
                    var from = args[0];
                    var to = args[1];
                    var message = args[2];
                    newEvent.source = to;
                    newEvent.text = from + ': ' + message;
                }
                else
                {
                    var ircType = newEvent.type;
                    newEvent.type = 'status';

                    var channel = args[0];
                    newEvent.source = channel;

                    if( ircType === 'topic')
                    {
                        var topic = args[1];
                        var nick = args[2];
                        newEvent.text = nick + ' changed topic to: ' + topic;
                    }
                    else if( ircType === 'join' )
                    {
                        var nick = args[1];
                        newEvent.text = nick + ' joined';
                    }
                    else if( ircType === 'part' )
                    {
                        var nick = args[1];
                        newEvent.text = nick + ' parted';
                    }
                    else if( ircType === 'kick' )
                    {
                        var nick = args[1];
                        newEvent.text = nick + ' got kicked';
                    }
                }
            }

            var dateStorePath = self.dateToPath(newEvent.date);

            self.events.emit('store.set', dateStorePath, newEvent, function() {
                self.lastEventTime = newEvent.date;
                self.events.emit('simpleweb.callClientFunction', 'onNewEvent', ['event', newEvent]);
            });

            self.debug('['+newEvent.date+']' + '['+newEvent.input+']' + '['+newEvent.type+']' + '['+newEvent.source+']' + ' '+newEvent.text+' ('+newEvent.link+') : '+newEvent.excerpt);
        }
    ],
    
    //===============================================================================================
    // Slots
    slots: [
        ////-----------------------------------------------------------------------------------------
        // Handle all error events
        {
            key: '*.error',
            value: function()
            {
                self.processInput('hub.input.' + this.event, arguments);
            }
        },

        ////-----------------------------------------------------------------------------------------
        // Handle all input events and forwart them to outputs
        {
            key: 'hub.input.**',
            value: function()
            {
                self.processInput(this.event, arguments);
            }
        }
    ],
    
    //===============================================================================================
    // Exports
    exports: [
    ]
    
    //===============================================================================================
};

//###################################################################################################
