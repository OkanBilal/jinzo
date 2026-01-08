import { EMPTY_FORM } from "../components/account";
import { ReactNode } from "react";


export type AccountFormValues = typeof EMPTY_FORM;

export type AccountResponse = AccountFormValues & {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export interface FieldProps {
  label: string;
  description?: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}