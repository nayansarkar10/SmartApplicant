import { GoogleGenAI, Type } from "@google/genai";
import { ResumeFile, ChatMessage, AppStep } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface GenerateCoverLetterResult {
  text: string;
  companyName: string;
  matchPercentage: number;
  matchReason: string;
  strengths: string[];
  weaknesses: string[];
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
              2. **JOB MATCH ANALYSIS**: Analyze the RESUME against the JOB DESCRIPTION. 
                 - Calculate a 'matchPercentage' (0-100).
                 - Provide a 'matchReason' (max 20 words).
                 - Identify 3-5 'strengths' (skills/experience present in resume that match the job).
                 - Identify 2-3 'weaknesses' (skills/experience listed in job but missing/weak in resume).
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
              - **Style**: Do NOT use dashes (-) to separate thoughts or sentences. Use proper punctuation (commas, periods) instead.
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
            strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3-5 matching skills or strengths." },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 2-3 missing skills or weaknesses." },
            coverLetterText: { type: Type.STRING, description: "The full formatted cover letter text with newlines." }
          },
          required: ["companyName", "matchPercentage", "matchReason", "strengths", "weaknesses", "coverLetterText"]
        }
      },
    });

    const jsonResponse = JSON.parse(response.text || "{}");
    const text = jsonResponse.coverLetterText || "Failed to generate cover letter.";
    const companyName = jsonResponse.companyName || "";
    const matchPercentage = jsonResponse.matchPercentage || 0;
    const matchReason = jsonResponse.matchReason || "Analysis unavailable";
    const strengths = jsonResponse.strengths || [];
    const weaknesses = jsonResponse.weaknesses || [];
    
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

    return { text, companyName, matchPercentage, matchReason, strengths, weaknesses, sources };
  } catch (error) {
    console.error("Error generating cover letter:", error);
    throw new Error("Failed to generate cover letter. Please try again.");
  }
};

export interface ChatResponse {
  reply: string;
  updatedContent: string | null;
}

export const processChatInteraction = async (
  step: AppStep,
  resume: ResumeFile | null,
  jobDescription: string,
  currentContent: string,
  chatHistory: ChatMessage[],
  userMessage: string
): Promise<ChatResponse> => {
  try {
    // Construct a context string from history
    const historyContext = chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.text}`).join('\n');

    let systemInstruction = "";
    let contextDescription = "";

    if (step === AppStep.INPUT) {
      systemInstruction = `
        You are a helpful career assistant helping the user prepare their job application.
        The user is currently entering the Job Description.
        
        TASK:
        - Answer questions about the resume (if provided) or job description.
        - If the user asks to format, fix, or summarize the Job Description input, provide the full updated text in 'updatedContent'.
        - Otherwise, 'updatedContent' should be null.
      `;
      contextDescription = `
        CONTEXT:
        1. Resume: ${resume ? "Attached" : "Not uploaded yet"}
        2. Current Job Description Input: 
        """
        ${currentContent}
        """
      `;
    } else if (step === AppStep.COVER_LETTER) {
      systemInstruction = `
        You are a helpful career assistant. You are helping a user refine their cover letter.
        
        TASK:
        - Answer the user's request.
        - If the user asks to modify the cover letter (e.g., "Change company name", "Make it funnier", "Fix typo"), you MUST provide the FULL updated cover letter text in the 'updatedContent' field.
        - If the user just asks a question (e.g., "Is this good?"), provide a 'reply' but leave 'updatedContent' as null.
        - **Constraint**: If you regenerate the cover letter, do NOT use dashes (-) to separate sentences. Use proper punctuation.
      `;
      contextDescription = `
        CONTEXT:
        1. Job Description: ${jobDescription}
        2. Current Cover Letter: 
        """
        ${currentContent}
        """
      `;
    } else if (step === AppStep.EMAIL_MESSAGE) {
      systemInstruction = `
        You are a helpful career assistant. You are helping a user refine their hiring manager email.
        
        TASK:
        - Answer the user's request.
        - If the user asks to modify the email message, provide the FULL updated text in 'updatedContent'.
      `;
      contextDescription = `
        CONTEXT:
        1. Job Description: ${jobDescription}
        2. Current Email Draft: 
        """
        ${currentContent}
        """
      `;
    }

    const parts: any[] = [
      {
        text: `
          ${systemInstruction}
          
          ${contextDescription}
          
          3. Chat History:
          ${historyContext}

          USER REQUEST: "${userMessage}"

          OUTPUT FORMAT: JSON with 'reply' and 'updatedContent'.
        `,
      }
    ];

    if (resume) {
      parts.unshift({
        inlineData: {
          mimeType: resume.type,
          data: resume.data,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        temperature: 0.5,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: "Your conversational response to the user." },
            updatedContent: { type: Type.STRING, description: "The full updated text content if changes were made, or null if not.", nullable: true },
          },
          required: ["reply"]
        }
      },
    });

    const json = JSON.parse(response.text || "{}");
    return {
      reply: json.reply || "I've processed your request.",
      updatedContent: json.updatedContent || null
    };

  } catch (error) {
    console.error("Error chatting:", error);
    throw new Error("Failed to process chat request.");
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
              You are an expert career assistant.
              OBJECTIVE: Write a personalized email application using a STRICT TEMPLATE based on the user's provided preference.

              INPUT DATA:
              1. Resume (Attached)
              2. Job Description: ${jobDescription}

              STRICT TEMPLATE TO FOLLOW:
              
              Subject: Expression of Interest: [Job Title] : [Total Years of Experience from Resume]+ Years of Exp | [Highest Degree from Resume] | [Candidate Name]

              Hi [Hiring Manager Name or "Hiring Manager"]!

              I am writing to express my interest in joining the [Department/Team Name inferred from JD] team at [Company Name].

              I bring [Number] years of experience across [Summarize context of experience, e.g. startups and MNCs], backed by [Degree/Education], excelled in [Top 3-4 Key Skills/Achievements relevant to the job].

              I am based in [Candidate Location] and available to join immediately. My profile is attached for your review, and I would welcome the opportunity to discuss.

              Regards,

              [Candidate Name] | [Candidate Phone Number] | LinkedIN

              INSTRUCTIONS:
              - Fill in the bracketed information using the Resume and Job Description.
              - "LinkedIN" (spelled exactly so) at the end.
              - Ensure the Subject Line is the very first line.
              - Keep the layout exactly as shown.
              - Do not include any meta text like "Here is the email".
            `,
          },
        ],
      },
      config: {
        temperature: 0.3,
      },
    });

    return response.text || "Failed to generate email message.";
  } catch (error) {
    console.error("Error generating email:", error);
    throw new Error("Failed to generate email message.");
  }
};