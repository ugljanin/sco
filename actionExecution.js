/*
External dependencies
*/
import moment from 'moment'
import { config } from 'dotenv'

/*
Internal dependencies
*/
import { postData } from './utilities.js'

config()

export function isLatestExecutedAction( executedActions, action ) {
  const lastExecutedAction = executedActions.at( 0 );
  if( lastExecutedAction.id === action.id ) {
	  return true;
  }

  return false;
}

export function isActionExecutedEver( executedActions, action ) {
  // Checks is there is any action within given timeframe that is executed
  const exists = executedActions?.some( ( k ) => (
	  k.id === action.id
  ) )
  return exists

}

export const executeAction = ( executedActions, action, mqttClient ) => {
  const executedAction = {}
  executedAction.description = action.description
  executedAction.id = action.id
  executedAction.sco = process.env.SCO_ID
  executedAction.event = action.name
  executedAction.source = action.source
  executedAction.date = Date.now()

  const message = {}
  message.id = action.id
  message.location = process.env.SCO_ID
  message.origin = action.name
  message.sourceType = 'sco'
  message.value = 1
  message.time = Date.now()

  if( action.connector === 'iot-connector' ) {
	  postData( 'https://iot-executor.connect.rs/request.php', { nodeid: action.content.nodeid, mutationid: action.content.mutationid } )
      .then( ( data ) => {
		  console.log( "+-+-+-+-+-+-+- Mutation executed -+-+-+-+-+-+-+-+" )
		  console.log( data.status_message )
		  executedActions.unshift( executedAction )

		  console.log( "+-+-+-+-+-+-+- Publish event message -+-+-+-+-+-+-+-+" )
		  mqttClient.publish( `/sco/${process.env.SCO_ID}/status`, JSON.stringify( message ) )
      } );
  }
}

export const isActionExecutedWithinTimeframe = ( executedActions, action ) => {
  const endDate = new Date()
  let startDate;
  if ( action.frequency === 'once in an hour' ) {
	  startDate = new Date( moment().subtract( 1, 'hours' ) )
  }
  if ( action.frequency === 'once in 30 minutes' ) {
	  startDate = new Date( moment().subtract( 30, 'minutes' ) )
  }
  if ( action.frequency === 'once in 5 minutes' ) {
	  startDate = new Date( moment().subtract( 5, 'minutes' ) )
  }
  if ( action.frequency === 'once a minute' ) {
	  startDate = new Date( moment().subtract( 1, 'minutes' ) )
  }
  if ( action.frequency === 'once in 30 seconds' ) {
	  startDate = new Date( moment().subtract( 30, 'seconds' ) )
  }
  if ( action.frequency === 'once in 15 seconds' ) {
	  startDate = new Date( moment().subtract( 15, 'seconds' ) )
  }
  if ( action.frequency === 'once in 10 seconds' ) {
	  startDate = new Date( moment().subtract( 10, 'seconds' ) )
  }
  if ( action.frequency === 'once in 5 seconds' ) {
	  startDate = new Date( moment().subtract( 5, 'seconds' ) )
  }
  if ( action.frequency === 'once a second' ) {
	  startDate = new Date( moment().subtract( 1, 'seconds' ) )
  }
  if ( action.frequency === 'once' ) {
	  startDate = new Date( moment().subtract( 1000000, 'hours' ) )
  }

  // Checks is there is any action within given timeframe that is executed
  const exists = executedActions?.some( ( k ) => {
	  const eventDate = new Date( k.date )
	  return (
      eventDate >= startDate &&
			  eventDate <= endDate &&
			  k.id === action.id
	  )
  } )
  return exists

}

export async function actionExecution( data, action, mqttClient ) {
  console.log( '------\t\tChecking if an action should be executed' )

  // Check if action execution is in the defined range
  const dateFrom = Date.parse( action.date.from )
  const dateTo = Date.parse( action.date.to )
  const currentDate = new Date()

  if ( dateFrom <= currentDate.getTime() && dateTo >= currentDate.getTime() ) {

    // Checks if action execution meets frequency limitation
    if ( isActionExecutedWithinTimeframe( data.actions, action ) ) {
      console.log( '------\t\tAction execution limit reached'.red )
    } else {
      console.log( '++++++\t\tConditions for executing action satisfied'.bgGreen.black )
      /* The action should be executed for the first time anyway, and if this is not the first time,
            * the action should check if the consecutive execution is allowed.
            * if it is allowed, the action should execute again, and if not it will not execute.
            */

      if( !isActionExecutedEver( data.actions, action ) ) {
        // If the action was never executed it should execute for the first time.
        executeAction( data.actions, action, mqttClient );

        /*
				* If the action was executed before check if it can repeat.
				* If it should not repeat, then the last executed action can't be this action.
				*/
      } else if ( isActionExecutedEver( data.actions, action ) && action.allowConsecutive === false ) {
        /*
					* If this action is not last executed action, then it should be executed because it is not repeated.
					* It should be repeated if it is last executed action, so we will execute it again.
					*/
        console.log( "\t\tConsecutive execution dissallowed".red )

        if( !isLatestExecutedAction( data.actions, action ) ) {
          console.log( "\t\tThe action is not the last one" )
          executeAction( data.actions, action, mqttClient );
        } else {
          console.log( "\t\tThe action is the last executed action, and will not repeat".red )
        }

      } else if ( isActionExecutedEver( data.actions, action ) && action.allowConsecutive === true ) {
        // The action could be executed consecutively.
        console.log( "\t\tConsecutive execution allowed" );
      	executeAction( data.actions, action, mqttClient );
      }
    }
  } else {
    console.log(
      'Defined timeframe for action execution does not meet current date'
        .red
    )
  }

  // Execute action for connector and content
}



