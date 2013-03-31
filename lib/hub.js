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
    ],
    
    //===============================================================================================
    // Properties
    properties: [
        'util',
        'rss',
        'lastEventTime'
    ],
    
    //===============================================================================================
    // Init
    init: function(ready) {        
        self = this;
        self.util = require('util');
        self.rss = require('rss');

        self.lastEventTime = Date.now();

        // Redirect requests without path to index.html
        self.events.emit('hub.output.simpleweb.registerPath', '/', function(req, res) {
            res.redirect("/index.html");
        });

        // Handle requests for the rss feed
        self.events.emit('hub.output.simpleweb.registerPath', '/feed*', self.renderFeed);

        // Add access to the store
        self.events.emit('hub.output.simpleweb.registerClientFunction', 'storeGet', function(path, callback){
            self.events.emit('store.get', path, callback);
        });

        self.events.emit('hub.output.simpleweb.registerClientFunction', 'storeSet', function(path, callback){
            self.events.emit('store.set', path, callback);
        });

        self.events.emit('hub.output.simpleweb.registerClientFunction', 'storeRemove', function(path, callback){
            self.events.emit('store.remove', path, callback);
        });

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
        // Ensure a date number has two digits
        function getTwoDigitDate(number)
        {
            return (('0' + number).slice(-2));
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
            self.getFeedData(feedTimeSpan, feedFilterRules, function(feedData)
            {
                // If feed data and timespan is valid, create feed
                if( feedTimeSpan !== undefined && feedFilterRules !== undefined && feedData !== undefined )
                   feed = self.createFeed(feedTimeSpan, feedFilterRules, feedData);

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
                    return 'all';

                // Get latest span type
                var latestDate = new Date(self.lastEventTime);
                var spanLevel = 1; // year

                // Get requested span
                if( urlParts[2] !== undefined)
                {
                    switch(urlParts[2])
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
        // Return data for timespan
        function getFeedData(timeSpan, filterRules, callback)
        {
            if( timeSpan === undefined  )
            {
                callback(undefined);
                return;
            }

            self.events.emit('store.get', 'events.' + timeSpan, function(data)
            {
                if( data === null || data === undefined )
                    callback(undefined);

                // This gets us the list in reverse chronological order
                var list = self.getEventList( [], data, filterRules );
                callback(list);
            });
        },

        ////-----------------------------------------------------------------------------------------
        // Recursive function to create item array
        function getEventList(list, data, filter)
        {
            for( var idxItem in data )
            {
                if( !data.hasOwnProperty(idxItem) ) { continue; }
                var item = data[idxItem];

                // This is a collection
                if( item.date === undefined )
                {
                    list = self.getEventList(list, item, filter );
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
                            if( item[filterName] !== filterValue)
                                addItem = false;
                        }
                    }

                    if( addItem )
                        list.push(item);
                }
            }

            return list;
        },

        ////-----------------------------------------------------------------------------------------
        // Render feed XML
        function createFeed(timeSpan, data)
        {
            if( timeSpan === undefined || data === undefined )
                return undefined;

            var feed = new self.rss({
                title: 'myHub',
                description: 'description',
                feed_url: 'http://example.com/rss.xml',
                site_url: 'http://example.com',
                image_url: 'http://example.com/icon.png',
                author: 'myHub'
            });

            feed.item({
                title:  'item title',
                description: 'use this for the content. It can include html.',
                url: 'http://example.com/article4?this&that', // link to the item
                guid: '1123', // optional - defaults to url
                author: 'Guest Author', // optional - defaults to feed author property
                date: 'May 27, 2012' // any format that js Date can parse.
            });

            return feed.xml();
        }
    ],
    
    //===============================================================================================
    // Slots
    slots: [
        ////-----------------------------------------------------------------------------------------
        // Handle all input events and forwart them to outputs
        {
            key: 'hub.input.**',
            value: function()
            {
                var eventName = this.event;

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
                    source: 'myHub',

                    text: '',
                    excerpt: '',
                    link: ''
                };

                if( newEvent.type === 'error' )
                {
                    newEvent.text = arguments[0];
                }
                else if( newEvent.input === 'rss' && newEvent.type === 'message' )
                {
                    var from = arguments[0];
                    var published_at = arguments[1];
                    var url = arguments[2];
                    var title = arguments[3];
                    var summary = arguments[4];
                    newEvent.source = from;
                    newEvent.text = title;
                    newEvent.excerpt = summary;
                    newEvent.link = url;
                }
                else if( newEvent.input === 'mail' && newEvent.type === 'message' )
                {
                    var from = arguments[0];
                    var to = arguments[1];
                    var date = arguments[2];
                    var subject = arguments[3];
                    newEvent.source = from;
                    newEvent.text = 'To ' + to + ': ' + subject;
                }
                else if( newEvent.input === 'xmpp' )
                {
                    if( newEvent.type === 'message' )
                    {
                        var from = arguments[0];
                        var to = arguments[1];
                        var message = arguments[2];
                        var friendlyName = arguments[3];
                        newEvent.source = from;
                        newEvent.text = friendlyName + ': ' + message;
                    }
                    else
                    {
                        var xmppType = newEvent.type;
                        newEvent.type = 'status';

                        var from = arguments[0];
                        var friendlyName = arguments[1];
                        newEvent.source = from;

                        if( xmppType === 'online' )
                        {
                            var show = arguments[2];
                            var status = arguments[3];
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
                        var from = arguments[0];
                        var to = arguments[1];
                        var message = arguments[2];
                        newEvent.source = to;
                        newEvent.text = from + ': ' + message;
                    }
                    else
                    {
                        var ircType = newEvent.type;
                        newEvent.type = 'status';

                        var channel = arguments[0];
                        newEvent.source = channel;

                        if( ircType === 'topic')
                        {
                            var topic = arguments[1];
                            var nick = arguments[2];
                            newEvent.text = nick + ' changed topic to: ' + topic;
                        }
                        else if( ircType === 'join' )
                        {
                            var nick = arguments[1];
                            newEvent.text = nick + ' joined';
                        }
                        else if( ircType === 'part' )
                        {
                            var nick = arguments[1];
                            newEvent.text = nick + ' parted';
                        }
                        else if( ircType === 'kick' )
                        {
                            var nick = arguments[1];
                            newEvent.text = nick + ' got kicked';
                        }
                    }
                }

                var eventDate = new Date(newEvent.date);
                var dateStorePath = 'events'
                    + '.'
                    + eventDate.getFullYear()
                    + '.'
                    + self.getTwoDigitDate(eventDate.getMonth()+1)
                    + '.'
                    + self.getTwoDigitDate(eventDate.getDate())
                    + '.'
                    + self.getTwoDigitDate(eventDate.getHours())
                    + '.'
                    + newEvent.date
                ;

                self.events.emit('store.set', dateStorePath, newEvent, function() {
                    self.lastEventTime = newEvent.date;
                    self.events.emit('hub.output.simpleweb.callClientFunction', 'onNewEvent', ['event', newEvent]);
                });

                self.log('debug', '['+newEvent.date+']' + '['+newEvent.input+']' + '['+newEvent.type+']' + '['+newEvent.source+']' + ' '+newEvent.text+' ('+newEvent.link+') : '+newEvent.excerpt);
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
