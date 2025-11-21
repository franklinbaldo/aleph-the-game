
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Skull, Eye, Target, Clock, Volume2, VolumeX, Share2 } from 'lucide-react';
import { INITIAL_SEGMENTS, INITIAL_OBJECTIVES } from './constants';
import { GameState, Choice, StorySegment, Sender, Objective } from './types';
import { generateNextStorySegment } from './services/geminiService';
import TypingText from './components/TypingText';
import ChoiceButton from './components/ChoiceButton';
import PortraitGallery from './components/PortraitGallery';
import RoomObjects from './components/RoomObjects';
import ObjectiveTracker from './components/ObjectiveTracker';
import ActionInput from './components/ActionInput';
import ToastNotification from './components/ToastNotification';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    history: INITIAL_SEGMENTS,
    isThinking: false,
    choices: [
      { id: 'vow', text: 'Consecrate myself to her memory (Refuse the change)', sentiment: 'obsessive' },
      { id: 'accept', text: 'Accept the universe moves on (Move on)', sentiment: 'passive' },
      { id: 'analyze', text: 'Analyze the semiotics of the cigarette ad', sentiment: 'intellectual' }
    ],
    objectives: INITIAL_OBJECTIVES,
    gameOver: false,
    sanity: 100
  });

  const [segmentsToShow, setSegmentsToShow] = useState<number>(1);
  const [showMobileObjectives, setShowMobileObjectives] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate current game time based on the last visible segment
  const visibleHistory = gameState.history.slice(0, segmentsToShow);
  const currentGameTime = visibleHistory[visibleHistory.length - 1]?.timestamp || "February 15, 1929";

  // Auto-scroll effect
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.history, segmentsToShow, gameState.isThinking]);

  // Progressive disclosure of initial text
  const handleSegmentComplete = () => {
    if (segmentsToShow < gameState.history.length) {
      setSegmentsToShow(prev => prev + 1);
    }
  };

  const handleFullHistoryShare = async (upToIndex: number) => {
    const relevantHistory = gameState.history.slice(0, upToIndex + 1);
    
    let markdown = "# THE ALEPH: INFINITE BORGES\n\n";
    markdown += `*Current Obsession: ${gameState.sanity}%*\n\n---\n\n`;

    relevantHistory.forEach(seg => {
      const timestamp = seg.timestamp ? `\n*${seg.timestamp}*` : '';
      
      if (seg.sender === Sender.Borges || seg.sender === Sender.Player) {
        // Greentext style for Borges/Player
        const lines = seg.text.map(l => `> ${l.replace(/^>/, '')}`).join('\n');
        markdown += `${timestamp}\n${lines}\n\n`;
      } else if (seg.sender === Sender.Carlos) {
        // Dialog style for Carlos
        markdown += `${timestamp}\n**CARLOS ARGENTINO DANERI**:\n"${seg.text.join(' ')}"\n\n`;
      } else {
        // System style
        markdown += `${timestamp}\n**[SYSTEM]**: ${seg.text.join(' ')}\n\n`;
      }
    });
    
    markdown += "---\nPlay the game: [Game Link]";

    const shareData = {
      title: 'The Aleph: Infinite Borges - Transcript',
      text: markdown,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(markdown);
        setNotification("TRANSCRIPT COPIED TO CLIPBOARD");
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  const handlePlayerAction = async (actionText: string, _sentiment: string = 'intellectual') => {
    // 1. Add player choice to history immediately
    // Determine timestamp from previous segment if possible, or use "Now"
    const lastTimestamp = gameState.history[gameState.history.length - 1]?.timestamp || "Unknown Time";
    
    const playerSegment: StorySegment = {
      id: Date.now().toString(),
      sender: Sender.Player,
      text: [`>I decided to: ${actionText}`],
      timestamp: lastTimestamp // Player action happens at the same time as the last event
    };

    const updatedHistory = [...gameState.history, playerSegment];

    setGameState(prev => ({
      ...prev,
      history: updatedHistory,
      isThinking: true,
      choices: [] // clear choices while thinking
    }));

    setSegmentsToShow(updatedHistory.length);

    // 2. Call API
    try {
      // Get last 8 segments for context to ensure continuity
      const historySummary = updatedHistory.slice(-8).map(s => 
        `[${s.timestamp || 'N/A'}] ${s.sender}: ${s.text.join(' ')}`
      ).join('\n');
      
      const response = await generateNextStorySegment(
        actionText, 
        historySummary,
        gameState.sanity,
        gameState.objectives
      );

      // 3. Process response
      const newSegments: StorySegment[] = response.narrative.map((n, idx) => ({
        id: `gen-${Date.now()}-${idx}`,
        sender: n.sender as Sender,
        text: n.lines,
        timestamp: n.timestamp,
        imagePrompt: n.imagePrompt,
        imageUrl: n.imageUrl
      }));

      // Convert API choices to local Choice type
      const newChoices: Choice[] = response.choices.map(c => ({
        id: c.id,
        text: c.text,
        sentiment: c.sentiment as any
      }));

      // Calculate new sanity
      const sanityChange = response.statUpdates?.sanityChange || 0;
      const newSanity = Math.max(0, Math.min(100, gameState.sanity + sanityChange));

      // Update Objectives
      let updatedObjectives = [...gameState.objectives];
      let notificationMessages: string[] = [];

      // Handle New Objectives
      if (response.newObjectives && response.newObjectives.length > 0) {
         const newObjs = response.newObjectives.map(o => ({
           ...o, 
           completed: false // Ensure they start incomplete
         }));
         updatedObjectives = [...updatedObjectives, ...newObjs];
         
         newObjs.forEach(obj => {
           notificationMessages.push(`NEW OBJECTIVE: ${obj.label}`);
         });
      }

      // Handle Completed Objectives
      if (response.completedObjectiveIds && response.completedObjectiveIds.length > 0) {
        updatedObjectives = updatedObjectives.map(obj => {
          if (response.completedObjectiveIds?.includes(obj.id) && !obj.completed) {
            notificationMessages.push(`CHECKPOINT REACHED: ${obj.label}`);
            return { ...obj, completed: true };
          }
          return obj;
        });
      }
      
      // Trigger Toast if there are notifications
      if (notificationMessages.length > 0) {
        setNotification(notificationMessages.join('\n'));
      }

      // Check for sanity-based game over if not already flagged
      let isGameOver = response.gameOver;
      let sanityMessage: StorySegment | null = null;

      if (!isGameOver) {
        if (newSanity <= 0) {
          isGameOver = true;
          sanityMessage = {
            id: 'sanity-death',
            sender: Sender.System,
            text: ['>OBSESSION LEVEL CRITICAL', '>BOREDOM EXCEEDED LIMITS', '>YOU LEFT THE HOUSE'],
            timestamp: 'The End of Meaning'
          };
        }
      }

      // Assemble final segments
      const segmentsToAdd = [...newSegments];
      if (sanityMessage) segmentsToAdd.push(sanityMessage);

      setGameState(prev => ({
        ...prev,
        history: [...prev.history, ...segmentsToAdd],
        choices: newChoices,
        objectives: updatedObjectives,
        isThinking: false,
        gameOver: isGameOver,
        sanity: newSanity
      }));
      
      setSegmentsToShow(prev => prev + segmentsToAdd.length);

    } catch (error) {
      console.error("Failed to generate story", error);
      setGameState(prev => ({
        ...prev,
        isThinking: false,
        choices: [{ id: 'retry', text: 'Try to regain composure...', sentiment: 'passive' }]
      }));
    }
  };

  const handleChoice = (choiceId: string) => {
    const chosenOption = gameState.choices.find(c => c.id === choiceId);
    if (!chosenOption) return;
    handlePlayerAction(chosenOption.text, chosenOption.sentiment || 'passive');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans selection:bg-green-900 selection:text-white flex flex-col">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      
      <ToastNotification message={notification} onClose={() => setNotification(null)} />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 z-40 bg-[#050505] border-b border-white/5 flex items-center justify-between px-4 shadow-lg">
        
        {/* Left: Menu / Title */}
        <div className="flex items-center gap-3 z-10 opacity-80 hover:opacity-100 transition-opacity">
          <div className="p-1.5 rounded bg-green-900/20 border border-green-800/50">
             <BookOpen className="w-4 h-4 text-green-600" />
          </div>
          <h1 className="font-serif text-gray-400 hidden sm:block text-sm tracking-wider">THE ALEPH</h1>
        </div>

        {/* Center: Date/Time Pill */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0a1a0f] border border-green-800/60 shadow-[0_0_15px_rgba(22,101,52,0.1)]">
            <Clock className="w-3 h-3 text-green-600" />
            <span className="font-mono text-green-500 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
              {currentGameTime}
            </span>
          </div>
        </div>

        {/* Right: Controls & Stats */}
        <div className="flex items-center gap-3 z-10">
          
          <button 
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`transition-colors p-1 ${ttsEnabled ? 'text-green-400' : 'text-gray-600'}`}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Mobile Objective Toggle */}
          <button 
            onClick={() => setShowMobileObjectives(!showMobileObjectives)}
            className="lg:hidden text-yellow-600 hover:text-yellow-400 transition-colors p-1"
          >
            <Target className="w-4 h-4" />
          </button>

          {/* Obsession Meter */}
          <div className="flex items-center gap-1.5 bg-gray-900 px-2 py-1 rounded border border-gray-800">
            <Eye className={`w-3 h-3 ${gameState.sanity > 80 ? 'text-red-500' : 'text-gray-500'}`} />
            <span className={`text-xs font-mono ${gameState.sanity > 80 ? 'text-red-400' : 'text-gray-400'}`}>
              {gameState.sanity}%
            </span>
          </div>
        </div>
      </header>

      <ObjectiveTracker objectives={gameState.objectives} />

      {/* Mobile Objective Drawer */}
      {showMobileObjectives && (
        <div className="fixed top-16 left-0 right-0 bg-black/95 border-b border-gray-800 p-4 z-30 lg:hidden">
           <div className="space-y-2">
              {gameState.objectives.map(obj => (
                <div key={obj.id} className={`flex items-center gap-2 text-xs ${obj.completed ? 'text-green-500 line-through' : 'text-yellow-500'}`}>
                   <span>{obj.completed ? '[X]' : '[ ]'}</span>
                   <span>{obj.label}</span>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow w-full max-w-2xl mx-auto pt-24 pb-48 px-6">
        
        <div className="space-y-8">
          {gameState.history.slice(0, segmentsToShow).map((segment, index) => {
            const isPlayer = segment.sender === Sender.Player;
            
            return (
              <div 
                key={segment.id} 
                className={`relative group ${isPlayer ? "pl-4 border-l-2 border-gray-800 opacity-60 my-8" : "my-4"}`}
              >
                {/* Scene Illustration */}
                {segment.imageUrl && (
                  <div className="mb-6 rounded-sm overflow-hidden border border-gray-800/50 shadow-2xl opacity-90 animate-in fade-in duration-1000">
                    <img 
                      src={segment.imageUrl} 
                      alt="Scene visualization" 
                      className="w-full h-auto grayscale contrast-125 brightness-90 sepia-[.2]" 
                    />
                  </div>
                )}

                {/* Contextual Interactions */}
                {segment.sender === Sender.Borges && segment.text.some(t => t.toLowerCase().includes('portraits') || t.toLowerCase().includes('cluttered little room')) && (
                  <>
                    <PortraitGallery />
                    <RoomObjects 
                      onInteract={handlePlayerAction} 
                      disabled={gameState.isThinking || gameState.gameOver}
                    />
                  </>
                )}
                
                <TypingText 
                  lines={segment.text} 
                  sender={segment.sender} 
                  onComplete={handleSegmentComplete}
                  ttsEnabled={ttsEnabled}
                />

                {/* Per-Segment Share Button */}
                <div className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 sm:block hidden">
                  <button 
                    onClick={() => handleFullHistoryShare(index)}
                    className="p-1.5 text-gray-700 hover:text-green-500 transition-colors"
                    title="Share conversation up to this point"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                 {/* Mobile Visible Share Button */}
                 <div className="block sm:hidden mt-2 flex justify-end">
                  <button 
                    onClick={() => handleFullHistoryShare(index)}
                    className="p-1 text-gray-800 hover:text-green-800 transition-colors"
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {/* Loading Indicator */}
        {gameState.isThinking && (
          <div className="flex items-center gap-3 mt-8 text-green-900/50 animate-pulse">
            <div className="w-1.5 h-1.5 bg-green-900 rounded-full" />
            <div className="w-1.5 h-1.5 bg-green-900 rounded-full delay-75" />
            <div className="w-1.5 h-1.5 bg-green-900 rounded-full delay-150" />
          </div>
        )}

        <div ref={scrollRef} />
      </main>

      {/* Footer Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#050505] border-t border-gray-900 p-4 z-40 pb-8">
        <div className="max-w-2xl mx-auto space-y-2">
          
          {/* Predefined Choices - Horizontal Carousel */}
          {!gameState.isThinking && !gameState.gameOver && segmentsToShow >= gameState.history.length && gameState.choices.length > 0 && (
            <div className="flex flex-row gap-3 overflow-x-auto pb-2 mb-2 snap-x snap-mandatory hide-scrollbar">
              {gameState.choices.map((choice) => (
                <ChoiceButton 
                  key={choice.id} 
                  choice={choice} 
                  onClick={handleChoice} 
                  disabled={gameState.isThinking}
                />
              ))}
            </div>
          )}

          {/* Custom Input */}
          {!gameState.gameOver && (
             <ActionInput 
                onSubmit={(text) => handlePlayerAction(text, 'custom')}
                disabled={gameState.isThinking}
                isThinking={gameState.isThinking}
             />
          )}

          {gameState.gameOver && (
            <div className="text-center">
               <button 
                onClick={() => window.location.reload()}
                className="text-red-500 text-xs uppercase tracking-widest hover:text-red-400 transition-colors"
              >
                [ Reset Timeline ]
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default App;
