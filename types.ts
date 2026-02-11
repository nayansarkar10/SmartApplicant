export interface ResumeFile {
  name: string;
  type: string;
  data: string; // Base64
}

export interface GeneratedContent {
  coverLetter: string;
  emailMessage: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isUpdate?: boolean; // To mark messages that updated the content
}

export enum AppStep {
  INPUT = 1,
  COVER_LETTER = 2,
  EMAIL_MESSAGE = 3,
}