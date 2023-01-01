# SMART CITY OBSERVER (SCO)
This is example of SCO implementation in NodeJS. It is a part of PhD topic research **Platform for interaction with social networks and Internet of Things in smart cities ** by Emir Ugljanin.

## Requirements
To be able to use it we must ensure that we have access to MongoDB server and MQTT server. Configuration parameters for both services including some additional SCO specific configuration should be listed in .env file (based on .env.example). You should copy content from .env.example to .env and fill in your respective data.

## Configuration
 - MONGODB_URI="mongodb://user:password@mongoserverip:mongoserverport/mongodb?authSource=db"
 - MONGODB_COLLECTION="scod"
 - MONGODB_DATABASE="b2s4b"
 - MQTT_PORT="1883"
 - MQTT_HOST="MQTTHOST"
 - MQTT_USERNAME="USER"
 - MQTT_PASSWORD="PASSWORD"
 - MQTT_RECONNECT_PERIOD="2000"
 - DEBUGGING="yes"
 - SCO_ID="ENTERYOURID"
 - TOLERANCE="20"

## Installation
After cloning this repository and filling the details in `.env` file, you should run `npm run install` to install all dependencies. Once all is prepared SCO could be started with `npm run start`.

## Examples
The examples contained in the folder `sco_definition_example` could be added in the mongodb `MONGODB_DATABASE` and `MONGODB_COLLECTION` that will be used for storing SCO definitions.
