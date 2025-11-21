
import { StorySegment, Sender, Objective } from './types';

export const INITIAL_INTRO_TEXT: string[] = [
  ">be me",
  ">scorching February morning",
  ">Beahtreez Veetairboh just died",
  ">imperious agony, no sentimentality, no fear",
  ">walking through Plahsah Consteetooseeon",
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
    timestamp: 'February 15, 1929'
  }
];

export const INITIAL_OBJECTIVES: Objective[] = [
  {
    id: 'vow_dedication',
    label: 'The Vow',
    completed: false,
    description: 'The world is changing. Resist it. Consecrate yourself to her memory before you forget.'
  },
  {
    id: 'visit_april',
    label: 'The Visit (April 30th)',
    completed: false,
    description: 'You MUST visit Garay Street on her birthday. This requires the Vow.'
  },
  {
    id: 'waiting_room',
    label: 'The Salon',
    completed: false,
    description: 'Enter the cluttered salon and examine the portraits.'
  },
  {
    id: 'carlos_encounter',
    label: 'The Cousin',
    completed: false,
    description: 'Survive the initial social encounter with Carlos Argentino.'
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