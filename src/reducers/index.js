import { combineReducers } from 'redux-immutable'
import { routerReducer } from 'react-router-redux'

import parser from '../features/parser/reducer'
import simulator from '../features/simulator/reducer'
import notification from '../features/notifications/reducer'
import signup from '../features/signup/reducer'
import documentation from '../features/documentation/reducer'
import feedback from '../features/feedback/reducer'

export default combineReducers({
  routing: routerReducer,
  parser,
  simulator,
  notification,
  signup,
  documentation,
  feedback
})