/*
External dependencies
*/
import { MongoClient } from 'mongodb'
import * as mqtt from 'mqtt';
import fetch from 'node-fetch';
import moment from 'moment';
import { config } from 'dotenv';

config();

export async function connectToMongoCluster( uri ) {
  let mongoClient
  try {
    mongoClient = new MongoClient( uri )
    console.log( 'Connecting to MongoDB Atlas cluster...' )
    await mongoClient.connect()
    console.log( 'Successfully connected to MongoDB Atlas!'.green )
  } catch ( error ) {
    console.error( 'Connection to MongoDB Atlas failed!'.red )
    console.error( error )
    process.exit()
  }
  return mongoClient
}

export async function getSCOdefinition( mongoClient ) {
  try {
    const mongoDbDataBase = process.env.MONGODB_DATABASE;
    const mongoDbCollection = process.env.MONGODB_COLLECTION;

    const db = mongoClient.db( mongoDbDataBase )
    const collection = db.collection( mongoDbCollection )

    return await collection.findOne( {
      _id: process.env.SCO_ID,
    } )
  } finally {
    await mongoClient.close()
  }
}

// Connect to MQTT server.
export const connectToMQTT = async () => {

  const mqttConfiguration = {
    port: process.env.MQTT_PORT,
    host: process.env.MQTT_HOST,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: process.env.MQTT_RECONNECT_PERIOD,
  };

  console.log( 'Connecting to MQTT server...' );
  const mqttClient = mqtt.connect( mqttConfiguration );
  mqttClient.on( 'connect', ( e ) => {
    console.log( 'MQTT client is connected!'.green );
  } );
  mqttClient.on( 'close', () => {
    console.log( 'MQTT client has disconnected from the server'.red );
  } );
  mqttClient.on( 'reconnect', () => {
    console.log( 'MQTT client is reconnecting to the server'.yellow );
  } );
  return mqttClient;
}

export const getExpectedEvents = async ( scoDefinition ) => {
  console.log( 'Loading expected events.' );
  let arr=[];

  if ( !scoDefinition.eventDetection ) {
    throw new Error( 'There are no event detection blocks inside SCO definition, please review SCO definition' );
  }
  scoDefinition?.eventDetection.forEach( ( eventDetection ) => {

    eventDetection.expectedEvents.forEach( ( rule ) => {

      const obj={};
      if( eventDetection.sourceType === 'social-connector' ) {
        obj.connector=eventDetection.sourceType;
        obj.frequency=eventDetection.content?.frequency;
      }
      if( eventDetection.sourceType === 'iot-connector' ) {
        obj.connector=eventDetection.sourceType;
        obj.frequency='once in 2 seconds';
      }
      obj.type=rule.event.type;
      arr = [ ...arr, obj ];
    } )
  } )
  return arr;
}

export const getMessageReceivedFrequency = ( timeframe ) => {
  let frequency;

  if ( timeframe === 'once in an hour' ) {
    frequency = 3600;
  }
  if ( timeframe === 'once in 30 minutes' ) {
    frequency = 1800;
  }
  if ( timeframe === 'once in 5 minutes' ) {
    frequency = 300;
  }
  if ( timeframe === 'once a minute' ) {
    frequency = 60;
  }
  if ( timeframe === 'once in 30 seconds' ) {
    frequency = 30;
  }
  if ( timeframe === 'once in 15 seconds' ) {
    frequency = 15;
  }
  if ( timeframe === 'once in 10 seconds' ) {
    frequency = 10;
  }
  if ( timeframe === 'once in 5 seconds' ) {
    frequency = 5;
  }
  if ( timeframe === 'once in 2 seconds' ) {
    frequency = 2;
  }
  if ( timeframe === 'once a second' ) {
    frequency = 1;
  }
  if ( timeframe === 'once' ) {
    frequency = 1;
  }
  return frequency
}

export const postData = async ( url = '', data = {} ) => {
  const response = await fetch( url, {
    method: 'POST',
    body: JSON.stringify( data )
  } );
  return response.json();
}


export const getMaximumOccurancesObject = ( freshness ) => {
  let startDate; let maximumOccurances;
  if ( freshness === 'ever' ) {
    startDate = moment().subtract( 1000000000, 'seconds' ).valueOf();
    maximumOccurances = 1;
  }
  if ( freshness === 'moment ago' ) {
    startDate = moment().subtract( 2, 'seconds' ).valueOf();
    maximumOccurances = 1;
  }
  if ( freshness === 'a minute ago' ) {
    startDate = moment().subtract( 1, 'minutes' ).valueOf();
    maximumOccurances = 60;
  }
  if ( freshness === '5 minutes ago' ) {
    startDate = moment().subtract( 5, 'minutes' ).valueOf();
    maximumOccurances = 300;
  }
  if ( freshness === 'half an hour ago' ) {
    startDate = moment().subtract( 30, 'minutes' ).valueOf();
    maximumOccurances = 1800;
  }
  if ( freshness === 'an hour ago' ) {
    startDate = moment().subtract( 60, 'minutes' ).valueOf();
    maximumOccurances = 3600;
  }
  if ( freshness === 'last day' ) {
    startDate = moment().subtract( 1, 'days' ).valueOf();
    maximumOccurances = 86400;
  }
  if ( freshness === 'last 2 days' ) {
    startDate = moment().subtract( 2, 'days' ).valueOf();
    maximumOccurances = 172800;
  }
  if ( freshness === 'last week' ) {
    startDate = moment().subtract( 7, 'days' ).valueOf();
    maximumOccurances = 604800;
  }
  const obj = {
    startDate,
    maximumOccurances
  };

  return obj;
}

export const addToArrayOfObjects = ( array, element ) => {

  console.log( `Stored ${array.length} events of maximum ${parseInt( process.env.MAXIMUM_NUMBER_OF_DETECTED_EVENTS_STORED, 10 )}` );
  if ( array.length === parseInt( process.env.MAXIMUM_NUMBER_OF_DETECTED_EVENTS_STORED, 10 ) ) {
    array.pop();  // remove the first element
  }
  array.unshift( element );  // add the new element to the end
  return array;
}
