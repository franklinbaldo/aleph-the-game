
export enum Sender {
  System = 'SYSTEM',
  Player = 'PLAYER',
  Borges = 'BORGES', // Internal monologue
  Carlos = 'CARLOS'  // The antagonist/friend
}

export interface Choice {
  id: string;
  text: string;
  sentiment?: 'passive' | 'aggressive' | 'intellectual' | 'obsessive';
}

export interface Objective {
  id: string;
  label: string;
  completed: boolean;
  description?: string;
}

export interface StorySegment {
  id: string;
  sender: Sender;
  text: string[]; // Array of lines for greentext style
  imagePrompt?: string; // For generating/showing context images
  imageUrl?: string; // The generated base64 image
  musicPrompt?: string; // Description for ambient audio
  musicUrl?: string; // The generated base64 audio
  timestamp?: string; // Date and time of the segment
  tone?: string; // Natural language description of the vocal tone (e.g. "whispered", "angry")
}

export interface GameState {
  history: StorySegment[];
  isThinking: boolean;
  choices: Choice[];
  objectives: Objective[];
  gameOver: boolean;
  sanity: number; // Represents "Obsession"
  visitCount: number; // Tracks the number of annual visits (0 to 12)
}

export interface GeminiResponseSchema {
  narrative: {
    sender: string; // "BORGES" or "CARLOS" or "SYSTEM"
    lines: string[];
    timestamp: string;
    imagePrompt?: string;
    imageUrl?: string; // Populated by the service after generation
    musicPrompt?: string; // Description of the ambient sound
    musicUrl?: string; // Populated by the service
    tone?: string; // Instruction for TTS
  }[];
  choices: {
    id: string;
    text: string;
    sentiment: string;
  }[];
  statUpdates?: {
    sanityChange?: number;
    visitCountChange?: number;
  };
  completedObjectiveIds?: string[];
  newObjectives?: Objective[]; // New objectives created dynamically by AI
  gameOver: boolean;
}
