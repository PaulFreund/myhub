# myhub #

Logs events from different sources and provides an interface to access them

## Installation ##

You can install myhub with npm

    npm install myhub

Or by cloning the repository and  install the dependencies

    git clone https://github.com/PaulFreund/myhub.git
    cd myhub
    npm install

Note: Three of the modules in the dependency chain need to be compiled, node-expat is required, node-stringprep and sqlite3 are optional. 
* node-expat requires libexpat ( libexpat-dev on ubuntu )
* node-stringprep requires libicu ( libicu-dev on ubuntu ) 
* sqlite3 requires libsqlite3 >= 3.6 ( libsqlite3-dev on ubuntu )

## Configuration ##

To configure myhub just copy config.json.example to config.json and customize it to fit your needs.

    // Start myhub and use the config.json in the same folder
    node myhub.js
    
    // Start myhub with the specified config file
    node myhub.js customconfig.json

## Usage ##

After startup myhub will provide two basic interfaces via the included webserver

### Event contents ###

    {
        date: 1364806722015,                // Timestamp
        starred: false,                     // Is event starred?
        seen: false,                        // Has event been seen?
        input: 'xmpp',                      // Where does the event come from
        type: 'message',                    // What type of message is it
        source: 'user@example.com',         // Who issued the event ( content depends on input )
        text: 'Hello World!',               // Informational content ( content depends on input )               
        excerpt: '',                        // Excerpt if there is much content ( content depends on input ) 
        link: ''                            // Link to the original content ( content depends on input ) 
    }
    
Different inputs generate different events, I recommend looking at the lib/hub.js file and at generated events to see how they look.

### RSS feed ###

Which events will be included depends on the request url

    /feed                                   // All events
    
You can request all feeds in a specific timespan of the last event    
    
    /feed/latest                            // All events
    /feed/latest/year                       // All events in the year of the last event
    /feed/latest/month                      // All events in the month of the last event
    /feed/latest/date                       // All events on the day of the last event
    /feed/latest/hour                       // All events in the hour of the last event
    
Or in a specific timespan

    /feed/2013/                             // All events in the year 2013
    /feed/2013/04                           // All events in april 2013
    /feed/2013/04/01                        // All events on april 1st 2013
    /feed/2013/04/01/08                     // All events on april 1st 2013 at 8 AM ( whole hour )
    
You can also add filters based on the event fields

    /feed/2013/04?starred=true              // Starred events
    /feed/2013/04?input=xmpp                // Events from xmpp
    /feed/2013/04?input=xmpp&starred=true   // Events from xmpp that are starred ( & = logical AND )
    /feed/2013/04?input=xmpp&type=!status   // Events from xmpp that are not status ( ! = logical NOT )

### Webinterface ###

The webinterface resides in the directory lib/interface and is connected to the backend via nowjs. At the time of writing there is no finished UI, but a interface to the backend for communication.

#### now.getData ####

Request a list of events from the backend, returns list of events from oldest to newest, example:

            now.getData(
                '2013.04.01',               // Timespan: 'all' or YYYY[.MM[.DD[.HH]]], every level after YYYY is optional
                                            // Or 'latest.year', 'latest.month', 'latest.date', 'latest.hour'

                {                           // Passing an object is mandatory, adding filters to it is optional
                    input: 'xmpp',          // Only events where field 'input' has value 'xmpp'
                    type: '!status'         // Only events where field 'type' has not value 'status' ( ! = logical NOT )
                },                          // Filters are combined with logical AND
                
                function(data)              // Callback that takes the returned list of events
                {                           // Example implementation
                    if( data === undefined || data === null )
                        return;
                        
                    for( var item in data )
                    {
                        if( !data.hasOwnProperty(item) ) { continue; }
                            outputEvent(data[item]);
                    }
                }
            );

#### now.getSettings ####

Get settings for webinterface:

    now.getSettings(function(settings)      // Get settings
    {
        // Do something with the settings
    });

#### now.setSettings ####

Set settings for webinterface:

    now.setSettings({...})                  // Set settings


#### now.setStarred ####
    
Set weather an event, identified by its timestamp, is starred, example: 

    now.setStarred(1364806722015, true);    // Set starred
    
#### now.setSeen ####

Set weather an event, identified by its timestamp, has been seen, example: 

    now.setSeen(1364806722015, false);       // Set unseen

#### now.onNewEvent ####

This function gets called by the backend when a new event arrives, example: 

    now.onNewEvent = function(type, data) 
    {                                       // Example implementation
        if( type === 'event' )
            outputEvent(data);
    };