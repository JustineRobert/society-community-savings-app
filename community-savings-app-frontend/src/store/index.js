import chatReducer from './chatSlice';
const store = configureStore({
  reducer: {
    chat: chatReducer,
    // other reducers...
  },
});
