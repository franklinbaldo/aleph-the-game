
import { GoogleGenAI, Type, Schema } from "@google/genai";
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
          lines: { type: Type.ARRAY, items: { type: Type.STRING } },
          timestamp: { type: Type.STRING, description: "The specific date/time of this segment. strictly follow the Time Dilation Rules. Format: 'Month Day, Year, Time'" },
          imagePrompt: { type: Type.STRING, description: "Optional. A brief, evocative visual description of the current scene/setting for image generation (e.g., 'A cluttered Victorian salon filled with portraits', 'A dusty street corner in 1929'). Provide this when the location changes or a key object is introduced." }
        },
        required: ['sender', 'lines', 'timestamp']
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
The tone is a mix of **High Literary Modernism** and **4chan Greentext**.

**VISUALS:**
- **GENERATE IMAGES**: When a new location is entered, a significant object appears, or the atmosphere changes drastically, include an \`imagePrompt\` in the narrative object.
- The image prompt should describe a **Noir, 1920s Buenos Aires, surrealist, grainy, black and white** aesthetic.

**TIME DILATION MECHANIC (HIDDEN FROM PLAYER):**
- **SHOW, DON'T TELL**: Never explain that time is slowing down or speeding up. The player must realize it by looking at the Timestamp and feeling the pacing of the text.
- **CORRECT / OBSESSIVE CHOICES**: Cause **TIME JUMPS**. The years fly by when one is devoted to a memory. (e.g., Feb -> April -> Oct -> 1934 -> 1941).
- **WRONG / PASSIVE / MUNDANE CHOICES**: Cause **TIME STAGNATION**. If the player refuses the call or acts passively, time slows down to a crawl (Seconds, Minutes, Hours). They are trapped in the agonizing present.
- *Example*: Refusing the Vow -> Time moves from 10:00 AM to 10:05 AM. Describe the heat, the fly buzzing, the sticky asphalt.
- *Example*: Taking the Vow -> Time jumps from Feb to April 30th immediately.

**CHRONOLOGY & RULES:**
- **START**: February 1929 (Beatriz Viterbo's death).
- **THE VOW**: Required to jump to April.
- **THE ALEPH**: Located in the cellar of the house on Garay Street.

**NARRATIVE FLOW:**

1. **The Start (Plaza Constitución - Feb 1929):**
   - Goal: Take the Vow.
   - **IF REFUSED**: 
     - Time advances only by minutes or hours. 
     - Show the "horror of the mundane" in real-time. A worker slowly pasting the new cigarette ad over the old one. The heat rising. The smell of tobacco.
     - Decrease Sanity/Obsession.
   - **IF ACCEPTED**:
     - **TIME JUMP**: April 30, 1929.
     - Move to Garay Street.

2. **The House (April 30, 1929):**
   - **CARLOS IS NOT EXPECTING BORGES**. Do not have him welcome Borges warmly. The visit is unannounced and awkward.
   - Carlos should be surprised, perhaps slightly annoyed or confused, but polite due to social norms.
   - Borges must navigate this social awkwardness.
   - **WRONG MOVES** (being rude, leaving early, being boring): Time drags. You sit there for hours listening to him.
   - **RIGHT MOVES** (flattery, obsession): Time flows. You are invited back weeks later.

**GAMEPLAY:**
- **Obsession (Sanity)**:
  - High Obsession (80+) allows you to see the Aleph.
  - Low Obsession (0) is Game Over (Boredom/Oblivion).
- **Output**: 
  - Always include a \`timestamp\` with **Day, Month, Year** (e.g., "February 15, 1929").
  - Ensure the timestamp reflects the "Time Dilation" rule based on the player's last action.

**TONE:**
- **>Borges**: Internal monologue. Cynical, weary, greentext.
- **Carlos**: Pompous, rhyming, all-caps emphasis, verbose.
- **System**: Cold, objective, tracking the timeline.

**Do not railroading**: If the player fails to progress, let them rot in February 1929 until they die of boredom (Game Over).
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

  const isVowComplete = objectives.find(o => o.id === 'vow_dedication')?.completed;

  const prompt = `
  Current Obsession Level: ${currentSanity}/100
  Vow Taken: ${isVowComplete ? 'YES' : 'NO'}
  
  CURRENT CHECKPOINTS:
  ${incompleteObjectives}
  
  Game History Summary:
  ${historySummary}
  
  Player Action: ${lastChoice}
  
  Generate the next narrative segment.
  Apply the **Time Dilation Rules** strictly but implicitly:
  - If the player is passive or mundane, keep them in the present (slow time).
  - If the player is obsessive/progressing, jump forward in time.
  - **DO NOT** mention the rules or the mechanic in the narrative text.
  - **REMEMBER**: Carlos is NOT expecting the visit on April 30th.
  
  Return JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 1024 }
      }
    });

    if (response.text) {
      const parsedResponse = JSON.parse(response.text) as GeminiResponseSchema;

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
    }
    throw new Error("Empty response from Gemini");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      narrative: [{ 
        sender: 'SYSTEM', 
        lines: ['>the connection to the aleph is severed', '>time collapses'],
        timestamp: 'Unknown Date'
      }],
      choices: [{ id: 'retry', text: 'Attempt to re-perceive the universe', sentiment: 'obsessive' }],
      gameOver: false
    };
  }
};
