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
    ],
    
    //===============================================================================================
    // Slots
    slots: [
        {
            key: 'hub.input.**',
            value: function()
            {
                var eventRoute = this.event.split('.');
                var date = Date.now();
                var input = eventRoute[2];
                var type = eventRoute[3];
                var content = undefined;

                if( type === 'error' )
                {
                    content = arguments[0];
                }
                else if( input === 'rss' && type === 'message' )
                {
                    // hub.input.rss    -   message     -   author, published_at, url, title, summary
                }
                else if( input === 'mail' && type === 'message' )
                {
                    // hub.input.mail   -   message     -   from - to - date - subject
                }
                else if( input === 'xmpp' )
                {
                    if( type === 'message' )
                    {
                        // hub.input.xmpp   -   message     -   from, to, message, friendlyName
                    }
                    else
                    {
                        var xmppType = type;
                        type = 'status';

                        if( xmppType === 'online' )
                        {
                            // hub.input.xmpp   -   online      -   from, friendlyName
                        }
                        else if( xmppType === 'offline' )
                        {
                            // hub.input.xmpp   -   offline     -   from, friendlyName
                        }
                        else if( xmppType === 'subscribe')
                        {
                            // hub.input.xmpp   -   subscribe   -   from, friendlyName
                        }
                        else if( xmppType === 'unsubscribe')
                        {
                            // hub.input.xmpp   -   unsubscribe   -   from, friendlyName
                        }
                    }
                }
                else if( input === 'irc' )
                {
                    if( type === 'message' )
                    {
                        // hub.input.irc    -   message     -   from, to, message
                    }
                    else
                    {
                        var ircType = type;
                        type = 'status';

                        if( ircType === 'topic')
                        {
                            // hub.input.irc    -   topic       -   channel, topic, nick
                        }
                        else if( ircType === 'join' )
                        {
                            // hub.input.irc    -   join        -   channel, nick
                        }
                        else if( ircType === 'part' )
                        {
                            // hub.input.irc    -   part        -   channel, nick
                        }
                        else if( ircType === 'kick' )
                        {
                            // hub.input.irc    -   kick        -   channel, nick
                        }
                    }
                }

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
