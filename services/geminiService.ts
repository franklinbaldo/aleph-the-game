
import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { GeminiResponseSchema, Objective } from '../types';

// Define the schema for the structured output
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sender: { type: Type.STRING, enum: ['BORGES', 'CARLOS', 'SYSTEM'] },
          lines: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "For BORGES, lines MUST start with '>' and use greentext style." 
          },
          timestamp: { type: Type.STRING, description: "The specific date/time. Format: 'Month Day, Year, Time'" },
          imagePrompt: { type: Type.STRING, description: "Optional. Visual description for image generation." },
          tone: { type: Type.STRING, description: "Mandatory. Natural language description of the vocal tone/emotion for TTS. e.g. 'whispered with dread', 'pompous and loud', 'melancholic and slow'." }
        },
        required: ['sender', 'lines', 'timestamp', 'tone']
      }
    },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          sentiment: { type: Type.STRING, enum: ['passive', 'aggressive', 'intellectual', 'obsessive'] }
        },
        required: ['id', 'text']
      }
    },
    statUpdates: {
      type: Type.OBJECT,
      properties: {
        sanityChange: { type: Type.INTEGER, description: "Change in Obsession level (-20 to +20)" }
      },
      nullable: true
    },
    completedObjectiveIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of objective IDs completed in this turn."
    },
    newObjectives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          completed: { type: Type.BOOLEAN },
          description: { type: Type.STRING }
        },
        required: ['id', 'label', 'completed']
      },
      description: "List of NEW objectives to add to the game state if the story branches."
    },
    gameOver: { type: Type.BOOLEAN }
  },
  required: ['narrative', 'choices', 'gameOver']
};

const SYSTEM_INSTRUCTION = `
You are the Game Master for "The Aleph: Infinite Borges".
The protagonist is Jorge Luis Borges (fictionalized).

**MANDATORY GENERATION CHECKLIST - YOU MUST OBEY THESE RULES:**

1. **STRICT FORMATTING & TONE:**
   - **Borges (Internal Monologue):** MUST use "Greentext" format. **EVERY SINGLE LINE MUST START WITH \`>\`.**
     - *Style:* Fragmented, cynical, high literary vocabulary mixed with internet slang. (e.g., ">be me", ">imperious agony", ">tfw the universe forgets her").
   - **Carlos Argentino Daneri:** Pompous, verbose, uses ALL-CAPS for emphasis, archaic adjectives, terrible rhymes. He is oblivious to Borges's disdain.
   - **System:** Cold, objective, metaphysical.

2. **NARRATIVE LOGIC & SCENE SEQUENCING (THE VISIT):**
   - **Phase 1: The Arrival:** Borges arrives at Garay Street. The maid opens the door.
   - **Phase 2: The Salon (MANDATORY WAIT):** The maid leads him to the **"cluttered little room"**. She leaves. Borges is **ALONE**.
     - He MUST have a moment to look at the **"portraits"** of Beatriz.
     - **DO NOT** have Carlos enter immediately upon arrival. Borges must stew in the room first.
   - **Phase 3: The Intrusion:** Only AFTER Borges has examined the room or the portraits does Carlos Argentino Daneri enter (suddenly and loudly).

3. **TIME DILATION MECHANIC (IMPLICIT):**
   - **Obsessive/Correct Choices:** Time skips forward (Months/Years). The years fly by when devoted to memory.
   - **Passive/Wrong Choices:** Time stagnates. The present is agonizingly slow (Seconds/Minutes).
   - **Timestamp:** Update strictly based on this mechanic.

4. **VISUALS:**
   - Provide an \`imagePrompt\` when the location changes or a key narrative object (The Aleph, The Portraits, The Cellar) is focused on.
   - **Style:** Noir, 1920s Buenos Aires, Surrealist, Grainy, Black and White etching.
   
5. **AUDIO/TONE:**
    - For every narrative block, provide a \`tone\` string describing the vocal delivery.
    - Examples: "deep and weary", "whispered with creeping horror", "loud, fast and arrogant", "monotone and robotic".

6. **GAME STATE:**
   - **Obsession (Sanity):** 0 = Boredom (Loss), 100 = Aleph (Win).
   - **Objectives:** Check them off only when narrative conditions are fully met.

**CONTEXT:**
Borges is mourning Beatriz Viterbo. He hates the modern world. He hates Carlos (but needs him to access the cellar). He seeks the Aleph.
`;

const generateIllustration = async (prompt: string): Promise<string | undefined> => {
  if (!process.env.API_KEY) return undefined;
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `A high-contrast, grainy, black and white illustration in the style of a 1920s vintage photograph or etching. Noir atmosphere, surrealist undertones. Subject: ${prompt}` }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.warn("Illustration generation failed:", e);
  }
  return undefined;
};

export const generateSpeech = async (text: string, sender: string, tone?: string): Promise<string | undefined> => {
  if (!process.env.API_KEY) return undefined;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Voice Mapping
  // Borges: Enceladus (Deep, weary, low pitched)
  // Carlos: Puck (Energetic, pompous, high pitched)
  // System: Zephyr (Neutral, glitchy)
  
  let voiceName = 'Enceladus'; 
  
  // Default fallback tone instructions if none provided
  let defaultStyleInstruction = 'Say in a deep, slow, melancholic, and cynical tone:';

  const senderUpper = sender.toUpperCase();
  
  if (senderUpper === 'CARLOS') {
    voiceName = 'Puck';
    defaultStyleInstruction = 'Say in a loud, pompous, fast-paced, and exaggeratedly enthusiastic tone:';
  } else if (senderUpper === 'SYSTEM') {
    voiceName = 'Zephyr';
    defaultStyleInstruction = 'Say in a cold, mechanical, and objective tone:';
  } else if (senderUpper === 'PLAYER') {
    voiceName = 'Enceladus';
    defaultStyleInstruction = 'Say in a quiet, introspective tone:';
  }

  // Use the AI-generated tone if available, otherwise fallback
  const styleInstruction = tone ? `Say in a ${tone} tone:` : defaultStyleInstruction;

  // Construct the prompt with the style instruction
  const fullPrompt = `${styleInstruction}\n"${text}"`;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: {
            parts: [{ text: fullPrompt }]
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName }
                }
            }
        }
    });
    
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) {
      console.error("TTS Generation failed", e);
      return undefined;
  }
};

// Helper to process the raw API text response into the application schema with images
const processStoryResponse = async (responseText: string): Promise<GeminiResponseSchema> => {
    const parsedResponse = JSON.parse(responseText) as GeminiResponseSchema;

    // Process illustrations in parallel
    const narrativeWithImages = await Promise.all(parsedResponse.narrative.map(async (segment) => {
      if (segment.imagePrompt) {
        const imageUrl = await generateIllustration(segment.imagePrompt);
        return { ...segment, imageUrl };
      }
      return segment;
    }));

    return {
      ...parsedResponse,
      narrative: narrativeWithImages
    };
};

export const generateNextStorySegment = async (
  lastChoice: string,
  historySummary: string,
  currentSanity: number,
  objectives: Objective[]
): Promise<GeminiResponseSchema> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Format objectives for the prompt
  const incompleteObjectives = objectives
    .filter(o => !o.completed)
    .map(o => `[ID: ${o.id}] ${o.label}: ${o.description}`)
    .join('\n');

  const isWaitingRoomComplete = objectives.find(o => o.id === 'waiting_room')?.completed;

  const prompt = `
  [GAME STATE]
  - Obsession: ${currentSanity}%
  - Objectives Pending: 
  ${incompleteObjectives}
  - Waiting Room Visited: ${isWaitingRoomComplete ? 'YES' : 'NO'}
  
  [HISTORY SUMMARY]
  ${historySummary}
  
  [PLAYER ACTION]
  ${lastChoice}
  
  [INSTRUCTION]
  Generate the next segment following the **MANDATORY GENERATION CHECKLIST**.
  
  CRITICAL SCENE CHECKS:
  1. **ARRIVAL**: If entering house -> Maid leads to Waiting Room -> Borges is ALONE. Include "cluttered little room" and "portraits" keywords.
  2. **WAITING**: If in Waiting Room -> Borges examines portraits -> THEN Carlos enters.
  3. **CARLOS**: If Carlos is present -> He speaks pompously.
  
  Return JSON.
  `;

  const commonConfig = {
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: 'application/json',
    responseSchema: responseSchema,
    thinkingConfig: { thinkingBudget: 1024 }
  };

  // Attempt 1: Primary Model (Gemini 3 Pro Preview)
  try {
    console.log("Attempting generation with gemini-3-pro-preview");
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: commonConfig
    });

    if (response.text) {
      return await processStoryResponse(response.text);
    }
  } catch (error) {
    console.warn("Primary model (gemini-3-pro-preview) failed. Initiating fallback to Flash.", error);
  }

  // Attempt 2: Fallback Model (Gemini 2.5 Flash)
  try {
    console.log("Fallback generation with gemini-2.5-flash");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: commonConfig
    });

    if (response.text) {
      return await processStoryResponse(response.text);
    }
    throw new Error("Both primary and fallback models failed to return text.");
  } catch (error) {
    console.error("Gemini API Fatal Error:", error);
    return {
      narrative: [{ 
        sender: 'SYSTEM', 
        lines: ['>the connection to the aleph is severed', '>time collapses', '>API ERROR'],
        timestamp: 'Unknown Date',
        tone: 'glitchy and distorted'
      }],
      choices: [{ id: 'retry', text: 'Attempt to re-perceive the universe (Retry)', sentiment: 'obsessive' }],
      gameOver: false
    };
  }
};
