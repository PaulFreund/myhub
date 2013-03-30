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

        // hub.input.rss    -   update      -   author, published_at, url, title, summary
        // hub.input.rss    -   error       -   message

        // hub.input.mail   -   received    -   from - to - date - subject
        // hub.input.mail   -   error       -   message

        // hub.input.irc    -   message     -   from, to, message
        // hub.input.irc    -   command     -   from, to, message
        // hub.input.irc    -   names       -   channel, names
        // hub.input.irc    -   topic       -   channel, topic, nick
        // hub.input.irc    -   join        -   channel, nick
        // hub.input.irc    -   part        -   channel, nick
        // hub.input.irc    -   quit        -   channels, nick
        // hub.input.irc    -   kick        -   channel, nick
        // hub.input.irc    -   nick        -   oldnick, newnick, channels

        // hub.input.xmpp   -   error       -   stanza error'
        // hub.input.xmpp   -   command     -   from, to, message
        // hub.input.xmpp   -   message     -   from, to, message
        // hub.input.xmpp   -   online      -   from
        // hub.input.xmpp   -   offline     -   from
        // hub.input.xmpp   -   subscribe   -   from
        // hub.input.xmpp   -   unsubscribe -   from
        // hub.input.xmpp   -   presence    -   from, to, stanza


        {
            key: 'hub.input.**',
            value: function() {
                var source = this.event;
                var data = arguments;
                self.log('debug', self.util.inspect(source)+': '+self.util.inspect(data));
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
