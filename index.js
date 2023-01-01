/*
External dependencies
*/
import colors from 'colors';
import { Engine } from 'json-rules-engine';
import { config } from 'dotenv';

/*
Internal dependencies
*/
import { detectEvent } from './eventDetection.js';
import { actionExecution } from './actionExecution.js';
import {
  connectToMongoCluster,
  connectToMQTT,
  getExpectedEvents,
  getMessageReceivedFrequency,
  getMaximumOccurancesObject,
  getSCOdefinition
} from './utilities.js';

config();

const data = {
  events: [],
  actions: [],
  requests: [],
};

const init = async () => {
  const mongoDbUri = process.env.MONGODB_URI;
  const mqttClient = await connectToMQTT();
  const mongoClient = await connectToMongoCluster( mongoDbUri );
  const scoDefinition = await getSCOdefinition( mongoClient );

  const engine = new Engine( undefined, {
    allowUndefinedFacts: true,
  } );

  if ( scoDefinition == null ) {
    throw new Error(
      `SCO definition ${process.env.SCO_ID} does not exist on server!!!`
    );
  }

  const definedEvents = await getExpectedEvents( scoDefinition );

  scoDefinition?.eventDetection?.forEach( ( item ) => {
    detectEvent( data, engine, mqttClient, item );
  } );

  scoDefinition?.actionExecution?.forEach( ( item ) => {
    engine.addRule( item );
  } );

  /*
   * Detected operator used for evaluating whether action should execute.
   */
  engine.addOperator( 'detected', ( factValue, jsonValue ) => {
    let messageReceivedFrequency;
    const endDate = new Date();

    definedEvents?.forEach( ( event ) => {
      if ( event.type === jsonValue.type ) {
        messageReceivedFrequency = getMessageReceivedFrequency( event.frequency );
      }
    } );

    // How many times the event is detected in some period of time.
    const { startDate, maximumOccurances } = getMaximumOccurancesObject( jsonValue.freshness );

    const maximumOccurancesWithoutTolerance =
			maximumOccurances / messageReceivedFrequency;

    // Calculate how many events should happen in some time frame, based on the message received frequency and tolerance
    const quantity =
      maximumOccurancesWithoutTolerance -
      ( maximumOccurancesWithoutTolerance * process.env.TOLERANCE ) / 100;

    if ( maximumOccurances === 1 ) {
      const exists = factValue?.some( ( k ) => {
        const eventDate = new Date( k.date );
        return (
          eventDate >= startDate &&
          eventDate <= endDate &&
          k.type === jsonValue.type
        );
      } );

      return exists;
    }

    if ( maximumOccurances > 1 ) {
      const exists = factValue?.filter( ( k ) => {
        const eventDate = new Date( k.date );
        return (
          eventDate >= startDate &&
          eventDate <= endDate &&
          k.type === jsonValue.type
        );
      } );

      if ( exists?.length && process.env.DEBUGGING === "yes" ) {
        console.log(
          `${exists[0].type.yellow} \tdetected ${
            exists?.length
          } times of minimum ${parseInt( quantity, 10 )}`
        );
      }

      if ( exists?.length >= parseInt( quantity, 10 ) )
        return true;
    }

    return false;
  } );

  engine
    .on( 'success', async ( event, almanac ) => {
      if ( event.type === 'action' ) {
        console.log( '//////\t\tAction conditions satisfied' );
        actionExecution( data, event.params, mqttClient );
      } else {
        const detectedEvent = {};
        detectedEvent.type = event.type;
        detectedEvent.date = Date.now();
        console.log(
          `******\t\tDetected event ${event.type}\t\t******`.bold.green
        );

        // List all detected events
        if( process.env.DEBUGGING === "yes" )
          console.log( data.events );

        const isEventAlreadyDetected = data.events.some(
          ( i ) => i.type === detectedEvent.type && i.date === detectedEvent.date
        );

        // Add the event at the begining of the events Array
        if( !isEventAlreadyDetected ) {
          data.events.unshift( detectedEvent )
        }

        // Evaluate action rules
        engine.run( data );

      }
    } )
    .on( 'failure', async ( event, almanac ) => {
      // console.error( event );
    } );

}

try {
  await init();
} catch ( e ) {
  console.log( e.message.red );
}
