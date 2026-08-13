export type AttendeeField = "name" | "phone1" | "phone2" | "phone3" | "birthYear" | "nickname" | "gender" | "experienceRange";

export type AttendeeState = {
  name: string;
  phone1: string;
  phone2: string;
  phone3: string;
  birthYear: string;
  nickname: string;
  gender: string;
  experienceRange: string;
};

export type ValidationError = { field: string; message: string };
