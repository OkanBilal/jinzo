import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface JournalEditingState {
  entityId: string | null;
  title: string;
  body: string;
  wordCount: number;
  status: "draft" | "published" | null;
}

const initialState: JournalEditingState = {
  entityId: null,
  title: "",
  body: "",
  wordCount: 0,
  status: null,
};

export const journalEditingSlice = createSlice({
  name: "journalEditing",
  initialState,
  reducers: {
    setEditingJournal: (
      state,
      action: PayloadAction<{
        entityId: string;
        title: string;
        body: string;
        status: "draft" | "published";
      }>
    ) => {
      state.entityId = action.payload.entityId;
      state.title = action.payload.title;
      state.body = action.payload.body;
      state.status = action.payload.status;
      state.wordCount = action.payload.body
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    },
    updateEditingTitle: (state, action: PayloadAction<string>) => {
      state.title = action.payload;
    },
    updateEditingBody: (state, action: PayloadAction<string>) => {
      state.body = action.payload;
      state.wordCount = action.payload
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    },
    clearEditingJournal: (state) => {
      state.entityId = null;
      state.title = "";
      state.body = "";
      state.wordCount = 0;
      state.status = null;
    },
  },
});

export const {
  setEditingJournal,
  updateEditingTitle,
  updateEditingBody,
  clearEditingJournal,
} = journalEditingSlice.actions;

export default journalEditingSlice.reducer;
