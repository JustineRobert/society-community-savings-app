// src/redux/reducers/rootReducer.js
import { combineReducers } from 'redux';
import { settingsReducer } from './settingsReducer';

const rootReducer = combineReducers({
    settings: settingsReducer,
    // add other reducers like `auth`, `groups`, etc. later
});

export default rootReducer;
