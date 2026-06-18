import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import chatApi from '../services/chatApi';

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async () => {
    return await chatApi.getConversations();
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ conversationId, body }) => {
    return await chatApi.sendMessage(conversationId, body);
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    conversations: [],
    activeConversation: null,
    messages: {},
    status: 'idle',
  },
  reducers: {
    setActiveConversation(state, action) {
      state.activeConversation = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const msg = action.payload;
        if (!state.messages[msg.conversationId]) {
          state.messages[msg.conversationId] = [];
        }
        state.messages[msg.conversationId].push(msg);
      });
  },
});

export const { setActiveConversation } = chatSlice.actions;
export default chatSlice.reducer;
