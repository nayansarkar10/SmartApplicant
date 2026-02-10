import { GoogleGenAI, Type } from "@google/genai";
import { ResumeFile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface GenerateCoverLetterResult {
  text: string;
  companyName: string;
  matchPercentage: number;
  matchReason: string;
  sources: { title: string; uri: string }[];
}

export const generateCoverLetter = async (
  resume: ResumeFile,
  jobDescription: string
): Promise<GenerateCoverLetterResult> => {
  try {
    // Using gemini-3-pro-preview for complex reasoning and accurate extraction
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: resume.type,
              data: resume.data,
            },
          },
          {
            text: `
              You are an expert career coach and professional writer. 
              
              INPUT:
              1. RESUME (PDF Attached)
              2. JOB DESCRIPTION (Text below)
              
              JOB DESCRIPTION:
              ${jobDescription}

              TASK:
              1. **IDENTIFY COMPANY**: Use 'googleSearch' if needed to identify the exact Company Name from the description.
              2. **JOB MATCH ANALYSIS**: Analyze the RESUME against the JOB DESCRIPTION. Calculate a 'matchPercentage' (0-100) representing how well the candidate fits the role based on skills and experience. Provide a 'matchReason' (max 20 words) explaining the score.
              3. **RESEARCH**: Briefly research the company values to align the letter.
              4. **WRITE COVER LETTER**: Create a tailored cover letter.

              STRICT CONSTRAINTS:
              - **Output Format**: JSON.
              - **Word Count for Body**: STRICTLY around 115 words. Concise and impactful.
              - **Structure (Content)**:
                To,
                The Hiring Manager
                [Company Name]
                
                Application for [Job Title]
                
                [Paragraph 1: Intro, Education/Experience Summary (~40 words)]
                
                [Paragraph 2: Current Role, Specific Skills/Achievements aligned to job (~50 words)]
                
                Key Skills I bring: [Comma separated list of top 3-4 relevant skills]
                
                Looking forward to connecting and discussing this further. Thank you for your time.
                
                Warm regards,
                [Candidate Name]
                [Candidate Mobile Number]

              - **Tone**: Professional, confident, yet human. First person ("I").
            `,
          },
        ],
      },
      config: {
        temperature: 0.5,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            companyName: { type: Type.STRING, description: "The identified company name." },
            matchPercentage: { type: Type.INTEGER, description: "A score from 0 to 100 indicating how well the resume matches the job description." },
            matchReason: { type: Type.STRING, description: "A short explanation (max 20 words) for the match score." },
            coverLetterText: { type: Type.STRING, description: "The full formatted cover letter text with newlines." }
          },
          required: ["companyName", "matchPercentage", "matchReason", "coverLetterText"]
        }
      },
    });

    const jsonResponse = JSON.parse(response.text || "{}");
    const text = jsonResponse.coverLetterText || "Failed to generate cover letter.";
    const companyName = jsonResponse.companyName || "";
    const matchPercentage = jsonResponse.matchPercentage || 0;
    const matchReason = jsonResponse.matchReason || "Analysis unavailable";
    
    // Extract grounding sources
    const sources: { title: string; uri: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || 'Source',
            uri: chunk.web.uri,
          });
        }
      });
    }

    return { text, companyName, matchPercentage, matchReason, sources };
  } catch (error) {
    console.error("Error generating cover letter:", error);
    throw new Error("Failed to generate cover letter. Please try again.");
  }
};

export const generateEmailMessage = async (
  resume: ResumeFile,
  jobDescription: string,
  currentCoverLetter: string
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
           {
            inlineData: {
              mimeType: resume.type,
              data: resume.data,
            },
          },
          {
            text: `
              You are an experienced content writer.
              OBJECTIVE: Write a personalized email/message to the hiring manager.
              
              CONTEXT:
              - Job Description: ${jobDescription}
              - The candidate has already written a cover letter.
              
              GUIDELINES:
              - **Word Count**: STRICTLY around 70 words. Short and punchy.
              - Tone: Refined, humanized, professional but approachable. Use simple words.
              - Perspective: First person ("I").
              - STRICTLY NO underscores ("___"). Use natural language.
              - Purpose: To introduce the candidate and attach the resume/cover letter.
              - Mention the company name if detected in the job description.
            `,
          },
        ],
      },
      config: {
        temperature: 0.7,
      },
    });

    return response.text || "Failed to generate email message.";
  } catch (error) {
    console.error("Error generating email:", error);
    throw new Error("Failed to generate email message.");
  }
};