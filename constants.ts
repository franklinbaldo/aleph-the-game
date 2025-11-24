
import { StorySegment, Sender, Objective } from './types';

export const INITIAL_INTRO_TEXT: string[] = [
  ">be me",
  ">scorching February morning",
  ">Beatriz Viterbo just died",
  ">imperious agony, no sentimentality, no fear",
  ">walking through Plaza Constitución",
  ">notice they changed the cigarette ad on the iron panels",
  ">this pisses me off",
  ">realize the universe is already moving on from her",
  ">this is just the first change in an infinite series",
  ">oh god"
];

export const INITIAL_SEGMENTS: StorySegment[] = [
  {
    id: 'intro-1',
    sender: Sender.Borges,
    text: INITIAL_INTRO_TEXT,
    timestamp: 'February 15, 1929',
    imagePrompt: 'Plaza Constitución Buenos Aires 1929, vintage sepia photography, scorching sun, iron panels with cigarette ads, melancholic atmosphere, noir style',
    musicPrompt: 'Low frequency city drone, distant traffic, melancholic cello undertone, hot wind blowing'
  }
];

export const INITIAL_OBJECTIVES: Objective[] = [
  {
    id: 'vow_dedication',
    label: 'The Vow',
    completed: false,
    description: 'The world is changing. Resist it. Consecrate yourself to her memory.'
  },
  {
    id: 'visit_april',
    label: 'The Pilgrimage (1929-1941)',
    completed: false,
    description: 'Endure the ritual. Visit Garay Street every April 30th for 12 years until the prophecy aligns.'
  },
  {
    id: 'waiting_room',
    label: 'The Salon (1941)',
    completed: false,
    description: 'Enter the cluttered salon on the final night and examine the portraits.'
  },
  {
    id: 'carlos_encounter',
    label: 'The Cousin',
    completed: false,
    description: 'Survive the encounter with Carlos Argentino Daneri.'
  },
  {
    id: 'the_poem',
    label: 'The Poem',
    completed: false,
    description: 'Endure the reading of his poem "The Earth".'
  },
  {
    id: 'gain_trust',
    label: 'The Confidant',
    completed: false,
    description: 'Flatter Carlos sufficiently to learn his secret.'
  },
  {
    id: 'unlock_cellar',
    label: 'The Descent',
    completed: false,
    description: 'Secure the invitation to the cellar to see the Aleph.'
  }
];
