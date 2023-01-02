/*
External dependencies
*/
import moment from 'moment'

/*
Internal dependencies
*/
import { postData } from './utilities.js'

let intervalID;

export const isRequestSent = ( requestSent, request ) => {
  const endDate = new Date()
  let startDate = '';
  if ( request.frequency === 'once in an hour' ) {
	  startDate = new Date( moment().subtract( 1, 'hours' ) )
  }
  if ( request.frequency === 'once in 30 minutes' ) {
	  startDate = new Date( moment().subtract( 30, 'minutes' ) )
  }
  if ( request.frequency === 'once in 5 minutes' ) {
	  startDate = new Date( moment().subtract( 5, 'minutes' ) )
  }
  if ( request.frequency === 'once a minute' ) {
	  startDate = new Date( moment().subtract( 1, 'minutes' ) )
  }
  if ( request.frequency === 'once in 30 seconds' ) {
	  startDate = new Date( moment().subtract( 30, 'seconds' ) )
  }
  if ( request.frequency === 'once in 15 seconds' ) {
	  startDate = new Date( moment().subtract( 15, 'seconds' ) )
  }
  if ( request.frequency === 'once in 10 seconds' ) {
	  startDate = new Date( moment().subtract( 10, 'seconds' ) )
  }
  if ( request.frequency === 'once in 5 seconds' ) {
	  startDate = new Date( moment().subtract( 5, 'seconds' ) )
  }
  if ( request.frequency === 'once a second' ) {
	  startDate = new Date( moment().subtract( 1, 'seconds' ) )
  }
  if ( request.frequency === 'once' ) {
	  startDate = new Date( moment().subtract( 1000000, 'hours' ) )
  }

  const exists = requestSent?.some( ( k ) => {
	  const eventDate = new Date( k.date )

	  return (
      eventDate >= startDate &&
			  eventDate <= endDate &&
			  k.campaign === request.campaign &&
			  k.metric === request.metric
	  )
  } )

  return exists
}

export const sendRequest = ( data, engine, eventSource ) => {
  const currentDate = new Date()
  const dateFrom = Date.parse( eventSource.date.from )
  const dateTo = Date.parse( eventSource.date.to )
  if (
    dateFrom <= currentDate.getTime() &&
		dateTo >= currentDate.getTime()
  ) {
    const requestBody = {}
    requestBody.frequency = eventSource.content.frequency
    requestBody.campaign = eventSource.content.campaign
    requestBody.metric = eventSource.content.metric
    requestBody.date = Date.now()

    if ( isRequestSent( data.requests, requestBody ) ) {
      console.log( `\t\tWait until request frequency is met for ${eventSource.name}...`.blue )
    } else {
      console.log( `\t\tSend new request for ${eventSource.name}`.bgYellow )

      postData( 'https://connector.connect.rs/fb-connector.php', { source: eventSource.content.campaign, metric: 'something' } )
        .then( ( response ) => {
	  // Run the engine to evaluate
	  engine.run( response )
        } );

      data.requests.unshift( requestBody )
    }
  } else {
    clearInterval( intervalID )
    throw new Error( 'Request eventDetection timeframe does not allow engine to run' );
  }
}

const subscribeToTopic = ( mqttClient, mqttTopic ) => {
  mqttClient.subscribe(
    mqttTopic,
    ( err ) => {
      console.log( `Waiting for MQTT data for topic ${mqttTopic}` );
    }
  )
}

export async function detectEvent( data, engine, mqttClient, eventSource ) {
  const dateFrom = Date.parse( eventSource.date.from )
  const dateTo = Date.parse( eventSource.date.to )

  // Add rules.
  eventSource.expectedEvents.forEach( ( condition, conditionIndex ) => {
    engine.addRule( condition )
  } )
  /*
	 * FB Connector, sending request to REST service
	 */
  if ( eventSource.sourceType === 'social-connector' ) {
    intervalID = setInterval( sendRequest, 2000, data, engine, eventSource )
  }
  /*
	 * IoT Connector or SCO, receiving messages via MQTT
	 */
  if ( eventSource.sourceType === 'iot-connector' || eventSource.sourceType === 'sco' ) {

    let mqttTopic='';
    if( eventSource.sourceType === 'iot-connector' ) {
      mqttTopic = `/city/${eventSource.name}/status`;
    }
    if( eventSource.sourceType === 'sco' ) {
      mqttTopic = `/sco/${eventSource.location}/status`;
    }

    let currentDate = new Date()

    try{
      if (
        dateFrom <= currentDate.getTime() &&
				  dateTo >= currentDate.getTime()
		  ) {
        // Subscribe for data when connection is reconnected.
        mqttClient.on( 'connect', () => {
          subscribeToTopic( mqttClient, mqttTopic );
        } )

        // Subscribe for data on first run once connection is established.
        if ( mqttClient.connected ) {
          subscribeToTopic( mqttClient, mqttTopic );
        }
		  } else {
			  throw new Error( 'Request eventDetection timeframe does not allow engine to run' );
		  }
    } catch ( e ) {
      console.error( e.message.red );
    }

    mqttClient.on( 'message', ( topic, message ) => {
      // If it is expired delete rule and unsubscribe
      currentDate = new Date()
      if (
        dateFrom > currentDate.getTime() ||
				dateTo < currentDate.getTime()
      ) {
        mqttClient.unsubscribe(
          mqttTopic,
          ( err ) => {
            console.error( err )
		  		}
        )
        eventSource.expectedEvents.forEach( (
          condition,
          conditionIndex
        ) => {
          engine.removeRule( condition )
        } )

        console.log( 'Unsubscribe ----- remove rules ----' )
      }
      // TODO proveri datum, i ako je datum van opsega, odjavi se sa topica, i ukloni pravilo.
      const obj = JSON.parse( message.toString() )
      // console.log(obj.origin, obj.location, obj.time);

      // Run the engine to evaluate only for the messages related to this SCO definition
      if( eventSource.name === obj.origin && eventSource.location === obj.location ) {
        if( obj.sourceType === 'sco' ) {
          /*
					* Delete all already detected events and start detecting from now on when there is an event
					* received from another SCO that is expected. It is a trigger to start monitoring.
					*/
          data.events=[]; // eslint-disable-line no-param-reassign
        }
        engine.run( obj )
      }


      //   client.end()
    } )
  }
}
