import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface MoodState {
  activeMoodId: string | null;
  selectedMoodForEdit: string | null;
}

const initialState: MoodState = {
  activeMoodId: null,
  selectedMoodForEdit: null,
};

const moodSlice = createSlice({
  name: "mood",
  initialState,
  reducers: {
    setActiveMoodId: (state, action: PayloadAction<string | null>) => {
      state.activeMoodId = action.payload;
    },
    setSelectedMoodForEdit: (state, action: PayloadAction<string | null>) => {
      state.selectedMoodForEdit = action.payload;
    },
  },
});

export const { setActiveMoodId, setSelectedMoodForEdit } = moodSlice.actions;
export default moodSlice.reducer;
