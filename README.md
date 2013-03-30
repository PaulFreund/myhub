# myHub #

Logs events from different sources and provides an interface to access them

## Installation ##

You can install myHub with npm

    npm install myHub

Or by cloning the repository and  install the dependencies

    git clone https://github.com/PaulFreund/myHub.git
    cd myHub
    npm install

Note: Three of the modules in the dependency chain need to be compiled, node-expat is required, node-stringprep and sqlite3 are optional. 
* node-expat requires libexpat ( libexpat-dev on ubuntu )
* node-stringprep requires libicu ( libicu-dev on ubuntu ) 
* sqlite3 requires libsqlite3 >= 3.6 ( libsqlite3-dev on ubuntu )

## Configuration ##

To configure myHub just copy config.json.example to config.json and customize it to fit your needs.

    // Start myHub and use the config.json in the same folder
    node myHub.js
    
    // Start myHub with the specified config file
    node myHub.js customconfig.json

