
import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { GeminiResponseSchema, Objective } from '../types';

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
const MODEL_TEXT_PRO = 'gemini-3-pro-preview'; // Primary literary model
const MODEL_TEXT_FAST = 'gemini-2.5-flash';    // Fallback model
const MODEL_IMAGE = 'gemini-2.5-flash-image';  // For illustrations
const MODEL_TTS = 'gemini-2.5-flash-preview-tts'; // For audio and ambient sound

// --- SCHEMA DEFINITION ---
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
          musicPrompt: { type: Type.STRING, description: "Optional. Description of ambient sound/music for the scene (e.g., 'Low cello drone', 'Distant rain')." },
          tone: { type: Type.STRING, description: "Mandatory. Natural language description of the vocal tone/emotion for TTS in ENGLISH. e.g. 'whispered with dread', 'pompous and loud', 'melancholic'." }
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
          text: { type: Type.STRING, description: "Ambiguous, literary choice text. Do not use direct action verbs." },
          sentiment: { type: Type.STRING, enum: ['passive', 'aggressive', 'intellectual', 'obsessive'] }
        },
        required: ['id', 'text']
      }
    },
    statUpdates: {
      type: Type.OBJECT,
      properties: {
        sanityChange: { type: Type.INTEGER, description: "Change in Obsession level (-20 to +20)" },
        visitCountChange: { type: Type.INTEGER, description: "Increment by 1 when a yearly visit is completed." }
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

// --- SYSTEM INSTRUCTIONS & SCENE REGISTRY ---

interface SceneDefinition {
  id: string;
  context: string;
  dos: string[];
  donts: string[];
}

const COMMON_RULES = `
- **FORMAT**: Use "Greentext" style for Borges (lines starting with '>'). Use standard dialogue for Carlos.
- **TONE**: Noir, melancholic, internet-native yet classical. Borges is a tragic "anon".
- **TIME DILATION**: If the player makes "passive" or "move on" choices, time stagnates (remains in current date). If they make "obsessive" choices, time accelerates towards the key dates.
- **PLAYER AGENCY**: Do NOT auto-complete major objectives. If the player examines a desk, describe the desk; do NOT jump to the next year or scene.
- **MUSIC**: Provide 'musicPrompt' for major scene shifts. Describe the texture, instrument, and mood (e.g. "Discordant piano chords", "Wind blowing through iron").
`;

const SCENES: Record<string, SceneDefinition> = {
  THE_VOW: {
    id: 'THE_VOW',
    context: "Date: Feb 1929. Plaza Constitución. Beatriz has just died. The world is changing (ads, street signs). Borges is resisting the change.",
    dos: [
      "Describe the mundane horror of the changing ad.",
      "Pressure the player to 'Move on' or 'Vow' devotion.",
      "If player chooses 'Move on', describe the gray, rotting stagnation of time.",
      "If player chooses 'Vow' (Obsessive), TRIGGER THE TIME JUMP to 1929-1941."
    ],
    donts: [
      "Do NOT jump to April 1941 unless the Vow is taken.",
      "Do NOT introduce Carlos yet."
    ]
  },
  THE_PILGRIMAGE: {
    id: 'THE_PILGRIMAGE',
    context: "Date: April 30th (Year varies 1929-1940). The Loop. Borges visits the house every year. He must endure the ritual to reach 1941.",
    dos: [
      "Describe a specific year's visit briefly (e.g., 'April 30, 1934: It rained').",
      "Increment the year ONLY if the player successfully visits.",
      "Summarize the passage of time as 'dead skin shedding' if the player is obsessive.",
      "If visitCount < 12, keep the date before 1941."
    ],
    donts: [
      "Do NOT skip directly to the poem/cellar.",
      "Do NOT let Carlos reveal the Aleph yet."
    ]
  },
  THE_ARRIVAL_1941: {
    id: 'THE_ARRIVAL_1941',
    context: "Date: April 30, 1941. 7:00 PM. Garay Street. The final visit. Borges stands outside.",
    dos: [
      "Describe the iron gate, the humidity.",
      "Interact with the Maid (Zunino?) or just the door.",
      "Objective is to ENTER the house."
    ],
    donts: [
      "Do NOT enter the salon automatically.",
      "Do NOT show Carlos yet."
    ]
  },
  THE_SALON: {
    id: 'THE_SALON',
    context: "Date: April 30, 1941. 7:15 PM. Inside the house. The Waiting Room.",
    dos: [
      "Describe the 'cluttered little room'.",
      "Describe the PORTRAITS of Beatriz (Communion, Wedding, Carnival).",
      "Trigger the 'RoomObjects' UI by mentioning 'cluttered little room'.",
      "Allow player to inspect items."
    ],
    donts: [
      "Do NOT have Carlos enter until the player has examined the room/portraits.",
      "Do NOT descend to the cellar."
    ]
  },
  THE_ENCOUNTER: {
    id: 'THE_ENCOUNTER',
    context: "Date: April 30, 1941. 8:00 PM. Carlos Argentino Daneri enters.",
    dos: [
      "Carlos is POMPOUS, loud, modern, and annoying.",
      "Carlos wants to read his poem 'The Earth'.",
      "Borges must endure/flatter him."
    ],
    donts: [
      "Do NOT go to the cellar yet.",
      "Do NOT see the Aleph."
    ]
  },
  THE_ALEPH: {
    id: 'THE_ALEPH',
    context: "Date: Oct 1941. The Cellar. The Finale.",
    dos: [
      "Describe the descent.",
      "The darkness.",
      "The vision of the Aleph (infinite simultaneous points).",
      "The letters (obscene details)."
    ],
    donts: []
  }
};

// --- HELPER FUNCTIONS ---

function determineCurrentScene(objectives: Objective[], visitCount: number): SceneDefinition {
  const isVowComplete = objectives.find(o => o.id === 'vow_dedication')?.completed;
  const isPilgrimageComplete = visitCount >= 12; // 1929 to 1941
  const isRoomComplete = objectives.find(o => o.id === 'waiting_room')?.completed;
  const isEncounterComplete = objectives.find(o => o.id === 'carlos_encounter')?.completed;

  if (!isVowComplete) return SCENES.THE_VOW;
  if (!isPilgrimageComplete) return SCENES.THE_PILGRIMAGE;
  if (!isRoomComplete) {
    return SCENES.THE_SALON; 
  }
  if (!isEncounterComplete) return SCENES.THE_ENCOUNTER;
  
  return SCENES.THE_ALEPH;
}

// --- MAIN GENERATION SERVICE ---

export async function generateNextStorySegment(
  playerAction: string,
  historyContext: string,
  sanity: number,
  visitCount: number,
  objectives: Objective[],
  language: string
): Promise<GeminiResponseSchema> {
  
  const scene = determineCurrentScene(objectives, visitCount);

  console.group("--- GEMINI GENERATION REQUEST ---");
  console.log("Scene:", scene.id);
  console.log("Language:", language);
  console.groupEnd();

  const prompt = `
    **GAME MASTER INSTRUCTIONS**
    Current Scene: ${scene.id}
    Context: ${scene.context}
    
    **SCENE RULES (STRICT):**
    DOS:
    ${scene.dos.map(d => `- ${d}`).join('\n')}
    
    DONTS:
    ${scene.donts.map(d => `- ${d}`).join('\n')}

    **GENERAL RULES:**
    ${COMMON_RULES}
    
    **CHOICE GUIDELINES:**
    - **AMBIGUITY IS KEY**: Choices must be ambiguous, poetic fragments, NOT clear actions.
    - **NO DIRECT VERBS**: Do NOT use text like "Go to the house", "Talk to Carlos", "Pick up the book".
    - **CRYPTIC**: The outcome of the choice should be uncertain.

    **LANGUAGE REQUIREMENT:**
    - Narrative Text and Choices MUST be in: "${language}".
    - TTS 'tone' instructions MUST be in ENGLISH.
    - 'musicPrompt' MUST be in ENGLISH.

    **CURRENT STATE:**
    - Obsession (Sanity): ${sanity}%
    - Visit Count: ${visitCount}/12
    - Objectives Status: ${JSON.stringify(objectives.map(o => ({id: o.id, completed: o.completed})))}

    **INPUT:**
    History:
    ${historyContext}
    
    Player Action: "${playerAction}"

    **OUTPUT:**
    Return strictly valid JSON matching the schema.
  `;

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  // Helper to try generation with a specific model
  const tryGenerate = async (modelName: string) => {
    try {
      console.log(`Attempting generation with ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.9,
        }
      });
      return response.text;
    } catch (e) {
      console.warn(`Model ${modelName} failed:`, e);
      throw e;
    }
  };

  let jsonText: string | undefined;

  try {
    try {
      jsonText = await tryGenerate(MODEL_TEXT_PRO);
    } catch {
      console.log("Falling back to Flash model...");
      jsonText = await tryGenerate(MODEL_TEXT_FAST);
    }

    if (!jsonText) throw new Error("Empty response from AI");

    console.group("--- RAW AI RESPONSE ---");
    console.log(jsonText);
    console.groupEnd();

    const parsed = JSON.parse(jsonText) as GeminiResponseSchema;

    // --- ASSET GENERATION (IMAGE & MUSIC) ---
    // Generate these in parallel for performance
    const generationPromises: Promise<void>[] = [];

    for (const segment of parsed.narrative) {
      // 1. Image
      if (segment.imagePrompt) {
        generationPromises.push(
          (async () => {
             try {
               console.log("Generating illustration for:", segment.imagePrompt);
               segment.imageUrl = await generateIllustration(segment.imagePrompt!);
             } catch(e) { console.error("Image gen failed", e); }
          })()
        );
      }
      
      // 2. Music
      if (segment.musicPrompt) {
        generationPromises.push(
          (async () => {
             try {
               console.log("Generating soundtrack for:", segment.musicPrompt);
               segment.musicUrl = await generateSoundtrack(segment.musicPrompt!);
             } catch(e) { console.error("Music gen failed", e); }
          })()
        );
      }
    }

    await Promise.all(generationPromises);

    return parsed;

  } catch (error) {
    console.error("CRITICAL ERROR in generateNextStorySegment:", error);
    return {
      narrative: [{
        sender: 'SYSTEM',
        lines: ['>Error connecting to the Aleph.', '>The universe fractures.'],
        timestamp: 'Unknown',
        tone: 'glitchy'
      }],
      choices: [{ id: 'retry', text: 'Attempt to reconnect', sentiment: 'passive' }],
      gameOver: false
    };
  }
}

// --- ILLUSTRATION SERVICE ---
export async function generateIllustration(prompt: string): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: {
        parts: [{ text: `Noir, high contrast, sketchy, surreal illustration of: ${prompt}` }]
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return undefined;
  } catch (e) {
    console.warn("Illustration failed:", e);
    return undefined;
  }
}

// --- MUSIC SERVICE ---
export async function generateSoundtrack(prompt: string): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  // Note: Using TTS model as a "Sound Generator" to ensure availability without specific MusicLM allowlisting
  // Prompting specifically for "Atmosphere" and non-verbal output.
  const soundPrompt = `Create an ambient background soundscape. 
  Description: ${prompt}. 
  Do not speak words. Hum, drone, or whisper unintelligibly to create this atmosphere. 
  Style: Noir, Lo-fi, Ethereal.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_TTS,
      contents: {
        parts: [{ text: soundPrompt }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' } // 'Kore' often good for softer tones
          }
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    return undefined;
  } catch (e) {
    console.error("Soundtrack generation failed:", e);
    return undefined;
  }
}

// --- TTS SERVICE ---
export async function generateSpeech(text: string, sender: string | any, tone?: string): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const sUpper = String(sender).toUpperCase();
  let voiceName = 'Puck'; 
  
  if (sUpper === 'BORGES') voiceName = 'Enceladus'; 
  if (sUpper === 'CARLOS') voiceName = 'Fenrir';   

  let styleInstruction = "";
  
  if (sUpper === 'BORGES') {
    styleInstruction = `Say in a fast, punchy, noir-detective inner monologue style. Fragmented rhythm. ${tone ? `Emotion: ${tone}.` : ''}`;
  } else if (sUpper === 'CARLOS') {
    styleInstruction = `Say in a loud, pompous, pretentious, and annoying poet voice. ${tone ? `Emotion: ${tone}.` : ''}`;
  } else {
    styleInstruction = `Say in a neutral system notification voice. ${tone ? `Emotion: ${tone}.` : ''}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_TTS,
      contents: {
        parts: [{ text: `${styleInstruction} "${text}"` }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName }
          }
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    return undefined;
  } catch (e) {
    console.error("TTS generation failed:", e);
    return undefined;
  }
}
