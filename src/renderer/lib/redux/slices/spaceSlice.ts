import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface SpaceState {
  activeSpaceId: string | null;
  selectedSpaceForEdit: string | null;
}

const initialState: SpaceState = {
  activeSpaceId: null,
  selectedSpaceForEdit: null,
};

const spaceSlice = createSlice({
  name: "space",
  initialState,
  reducers: {
    setActiveSpaceId: (state, action: PayloadAction<string | null>) => {
      state.activeSpaceId = action.payload;
    },
    setSelectedSpaceForEdit: (state, action: PayloadAction<string | null>) => {
      state.selectedSpaceForEdit = action.payload;
    },
  },
});

export const { setActiveSpaceId, setSelectedSpaceForEdit } = spaceSlice.actions;
export default spaceSlice.reducer;
