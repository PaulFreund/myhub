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
        'util'
    ],
    
    //===============================================================================================
    // Init
    init: function(ready) {        
        self = this;
        self.util = require('util');

        // Redirect requests without path to index.html
        self.events.emit('hub.output.simpleweb.registerPath', '/', function(req, res) {
            res.redirect("/index.html");
        });

        // Handle requests for the rss feed
        self.events.emit('hub.output.simpleweb.registerPath', '/feed', self.getFeed);

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
        function getTwoDigitDate(number)
        {
            return (('0' + number).slice(-2));
        },

        function getFeed(req, res)
        {
            var j = 0;
        }
    ],
    
    //===============================================================================================
    // Slots
    slots: [
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
                    self.events.emit('hub.output.simpleweb.callClientFunction', 'onNewEvent', ['event', newEvent]);
                });


                console.log('['+newEvent.date+']' + '['+newEvent.input+']' + '['+newEvent.type+']' + '['+newEvent.source+']' + ' '+newEvent.text+' ('+newEvent.link+') : '+newEvent.excerpt);

                // Pack into object and store, afterwards notify about it
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
