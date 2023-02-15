export interface GeneralError {
  message: string;
  details?: string;
}

export type ShowGeneralErrorMessage = { command: "showGeneralError"; payload: GeneralError };
