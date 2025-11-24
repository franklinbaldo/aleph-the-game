import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Skull, Eye, Target, Clock, Volume2, VolumeX, Share2, Globe, Music, Music2, AlertTriangle } from 'lucide-react';
import { INITIAL_SEGMENTS, INITIAL_OBJECTIVES } from './constants';
import { GameState, Choice, StorySegment, Sender, Objective } from './types';
import { generateNextStorySegment, generateIllustration, generateSoundtrack } from './services/geminiService';
import TypingText from './components/TypingText';
import ChoiceButton from './components/ChoiceButton';
import PortraitGallery from './components/PortraitGallery';
import RoomObjects from './components/RoomObjects';
import ObjectiveTracker from './components/ObjectiveTracker';
import ActionInput from './components/ActionInput';
import ToastNotification from './components/ToastNotification';
import LanguageSelector from './components/LanguageSelector';
import AmbientSound from './components/AmbientSound';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    history: INITIAL_SEGMENTS,
    isThinking: false,
    choices: [
      { id: 'vow', text: 'To forget is to kill her again.', sentiment: 'obsessive' },
      { id: 'accept', text: 'The February heat dissolves all things.', sentiment: 'passive' },
      { id: 'analyze', text: 'Catalog the precise decay of the iron.', sentiment: 'intellectual' }
    ],
    objectives: INITIAL_OBJECTIVES,
    gameOver: false,
    sanity: 100,
    visitCount: 0
  });

  const [segmentsToShow, setSegmentsToShow] = useState<number>(1);
  const [showMobileObjectives, setShowMobileObjectives] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(false);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(false);
  
  // Language State
  const [language, setLanguage] = useState<string>('English');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  // Removed hasGeneratedIntroRef to ensure generation attempts on mount

  // Load language preference on mount
  useEffect(() => {
    const savedLang = localStorage.getItem('aleph_language');
    if (savedLang) {
      setLanguage(savedLang);
    }
  }, []);

  // Keyboard Shortcuts for Choices
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isThinking || gameState.gameOver) return;
      const num = parseInt(e.key);
      if (!isNaN(num) && num > 0 && num <= gameState.choices.length) {
        handleChoice(gameState.choices[num - 1].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.choices, gameState.isThinking, gameState.gameOver]);

  // Generate intro assets on load
  useEffect(() => {
    const generateIntroAssets = async () => {
      // Logic simplified to run on mount. If image exists (e.g. state preserved), this is safe as we check props.
      
      const introSegment = gameState.history[0];
      let updatedSegment = { ...introSegment };
      let hasUpdates = false;

      // Image
      if (introSegment.imagePrompt && !introSegment.imageUrl) {
        try {
          const imageUrl = await generateIllustration(introSegment.imagePrompt);
          if (imageUrl) {
            updatedSegment.imageUrl = imageUrl;
            hasUpdates = true;
          }
        } catch (e) {
          console.error("Failed to generate intro image", e);
        }
      }

      // Music
      if (introSegment.musicPrompt && !introSegment.musicUrl) {
         try {
           const musicUrl = await generateSoundtrack(introSegment.musicPrompt);
           if (musicUrl) {
             updatedSegment.musicUrl = musicUrl;
             hasUpdates = true;
           }
         } catch(e) {
           console.error("Failed to generate intro music", e);
         }
      }

      if (hasUpdates) {
        setGameState(prev => {
          const newHistory = [...prev.history];
          newHistory[0] = updatedSegment;
          return { ...prev, history: newHistory };
        });
      }
    };

    generateIntroAssets();
  }, []); 

  // Calculate current game time based on the last visible segment
  const visibleHistory = gameState.history.slice(0, segmentsToShow);
  const currentGameTime = visibleHistory[visibleHistory.length - 1]?.timestamp || "February 15, 1929";
  // Get the most recent music URL from the visible history
  const currentMusicUrl = [...visibleHistory].reverse().find(s => s.musicUrl)?.musicUrl;

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

  const handleLanguageSelectAttempt = (newLang: string) => {
    // Instead of setting immediately, set pending to trigger confirmation
    setPendingLanguage(newLang);
    setShowLanguageSelector(false);
  };

  const confirmLanguageChange = () => {
    if (pendingLanguage) {
      localStorage.setItem('aleph_language', pendingLanguage);
      window.location.reload();
    }
  };

  const cancelLanguageChange = () => {
    setPendingLanguage(null);
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
    const lastTimestamp = gameState.history[gameState.history.length - 1]?.timestamp || "Unknown Time";
    
    const playerSegment: StorySegment = {
      id: Date.now().toString(),
      sender: Sender.Player,
      text: [`>I decided to: ${actionText}`],
      timestamp: lastTimestamp 
    };

    const updatedHistory = [...gameState.history, playerSegment];

    setGameState(prev => ({
      ...prev,
      history: updatedHistory,
      isThinking: true,
      choices: [] 
    }));

    setSegmentsToShow(updatedHistory.length);

    // 2. Call API
    try {
      const historySummary = updatedHistory.slice(-10).map(s => 
        `[${s.timestamp || 'N/A'}] ${s.sender}: ${s.text.join(' ')}`
      ).join('\n');
      
      const response = await generateNextStorySegment(
        actionText, 
        historySummary,
        gameState.sanity,
        gameState.visitCount,
        gameState.objectives,
        language
      );

      // 3. Process response
      const newSegments: StorySegment[] = response.narrative.map((n, idx) => ({
        id: `gen-${Date.now()}-${idx}`,
        sender: n.sender as Sender,
        text: n.lines,
        timestamp: n.timestamp,
        imagePrompt: n.imagePrompt,
        imageUrl: n.imageUrl,
        musicPrompt: n.musicPrompt,
        musicUrl: n.musicUrl,
        tone: n.tone
      }));

      const newChoices: Choice[] = response.choices.map(c => ({
        id: c.id,
        text: c.text,
        sentiment: c.sentiment as any
      }));

      // Calculate stats
      const sanityChange = response.statUpdates?.sanityChange || 0;
      const newSanity = Math.max(0, Math.min(100, gameState.sanity + sanityChange));
      
      const visitIncrement = response.statUpdates?.visitCountChange || 0;
      const newVisitCount = gameState.visitCount + visitIncrement;

      // Update Objectives
      let updatedObjectives = [...gameState.objectives];
      let notificationMessages: string[] = [];

      // Handle New Objectives
      if (response.newObjectives && response.newObjectives.length > 0) {
         const newObjs = response.newObjectives.map(o => ({
           ...o, 
           completed: false 
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
      
      if (notificationMessages.length > 0) {
        setNotification(notificationMessages.join('\n'));
      }

      // Check for game over
      let isGameOver = response.gameOver;
      let sanityMessage: StorySegment | null = null;

      if (!isGameOver) {
        if (newSanity <= 0) {
          isGameOver = true;
          sanityMessage = {
            id: 'sanity-death',
            sender: Sender.System,
            text: ['>OBSESSION LEVEL CRITICAL', '>BOREDOM EXCEEDED LIMITS', '>YOU LEFT THE HOUSE'],
            timestamp: 'The End of Meaning',
            tone: 'cold and final'
          };
        }
      }

      const segmentsToAdd = [...newSegments];
      if (sanityMessage) segmentsToAdd.push(sanityMessage);

      setGameState(prev => ({
        ...prev,
        history: [...prev.history, ...segmentsToAdd],
        choices: newChoices,
        objectives: updatedObjectives,
        isThinking: false,
        gameOver: isGameOver,
        sanity: newSanity,
        visitCount: newVisitCount
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
    <div className="min-h-[100dvh] bg-[#050505] text-gray-300 font-sans selection:bg-green-900 selection:text-white flex flex-col">
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
      <AmbientSound musicUrl={currentMusicUrl} enabled={musicEnabled} />

      {/* CONFIRMATION MODAL FOR LANGUAGE CHANGE */}
      {pendingLanguage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border border-red-900/50 rounded-lg max-w-sm w-full p-6 shadow-[0_0_30px_rgba(185,28,28,0.2)] animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-mono font-bold tracking-widest uppercase">Timeline Reset</h3>
            </div>
            
            <p className="text-gray-400 font-serif mb-6 text-sm leading-relaxed">
              Changing the narrative language to <span className="text-green-400 font-bold uppercase">{pendingLanguage}</span> requires reconstructing the universe from the beginning. 
              <br/><br/>
              Your current progress will be lost.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={cancelLanguageChange}
                className="flex-1 py-2 border border-gray-700 rounded text-gray-400 font-mono text-xs uppercase tracking-wider hover:bg-gray-800 transition-colors"
              >
                Abort
              </button>
              <button 
                onClick={confirmLanguageChange}
                className="flex-1 py-2 bg-red-900/20 border border-red-800 rounded text-red-400 font-mono text-xs uppercase tracking-wider hover:bg-red-900/40 hover:text-red-300 transition-colors shadow-[0_0_10px_rgba(220,38,38,0.1)]"
              >
                Reset & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {showLanguageSelector && (
        <LanguageSelector 
          currentLanguage={language}
          onSelect={handleLanguageSelectAttempt}
          onClose={() => setShowLanguageSelector(false)}
        />
      )}

      <header className="fixed top-0 left-0 right-0 h-14 sm:h-16 z-40 bg-[#050505] border-b border-white/5 flex items-center justify-between px-3 sm:px-4 shadow-lg gap-2">
        
        {/* Left: Icon + Title (Desktop) */}
        <div className="flex items-center gap-2 sm:gap-3 z-10 opacity-80 hover:opacity-100 transition-opacity flex-shrink-0">
          <div className="p-1.5 rounded bg-green-900/20 border border-green-800/50">
             <BookOpen className="w-4 h-4 text-green-600" />
          </div>
          <h1 className="font-serif text-gray-400 hidden sm:block text-sm tracking-wider">THE ALEPH</h1>
        </div>

        {/* Center: Clock (Flexible on mobile, Absolute on Desktop) */}
        <div className="flex-grow flex justify-center sm:absolute sm:left-1/2 sm:top-1/2 sm:transform sm:-translate-x-1/2 sm:-translate-y-1/2">
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#0a1a0f] border border-green-800/60 shadow-[0_0_15px_rgba(22,101,52,0.1)]">
            <Clock className="w-3 h-3 text-green-600 flex-shrink-0" />
            <span className="font-mono text-green-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis max-w-[15ch] sm:max-w-none">
              {currentGameTime}
            </span>
          </div>
        </div>

        {/* Right: Tools */}
        <div className="flex items-center gap-1.5 sm:gap-3 z-10 flex-shrink-0">
          
          <button 
            onClick={() => setShowLanguageSelector(true)}
            className="transition-colors p-1.5 flex items-center gap-1 text-gray-600 hover:text-green-400"
            title={`Current Language: ${language}`}
          >
            <Globe className="w-4 h-4" />
            <span className="text-[10px] font-mono uppercase w-4 text-center truncate max-w-[3ch] hidden sm:block">
              {language.substring(0, 2)}
            </span>
          </button>
          
          <button 
            onClick={() => setMusicEnabled(!musicEnabled)}
            className={`transition-colors p-1.5 flex items-center gap-1 ${musicEnabled ? 'text-green-400' : 'text-gray-600'}`}
            title={musicEnabled ? "Ambient Music ON" : "Ambient Music OFF"}
          >
            {musicEnabled ? <Music2 className="w-4 h-4" /> : <Music className="w-4 h-4" />}
          </button>

          <button 
            onClick={() => setAutoPlayAudio(!autoPlayAudio)}
            className={`transition-colors p-1.5 flex items-center gap-1 ${autoPlayAudio ? 'text-green-400' : 'text-gray-600'}`}
            title={autoPlayAudio ? "Auto-Play Audio ON" : "Auto-Play Audio OFF"}
          >
            {autoPlayAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button 
            onClick={() => setShowMobileObjectives(!showMobileObjectives)}
            className="lg:hidden text-yellow-600 hover:text-yellow-400 transition-colors p-1.5"
          >
            <Target className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 bg-gray-900 px-2 py-1 rounded border border-gray-800">
            <Eye className={`w-3 h-3 ${gameState.sanity > 80 ? 'text-red-500' : 'text-gray-500'}`} />
            <span className={`text-xs font-mono ${gameState.sanity > 80 ? 'text-red-400' : 'text-gray-400'}`}>
              {gameState.sanity}%
            </span>
          </div>
        </div>
      </header>

      <ObjectiveTracker objectives={gameState.objectives} />

      {showMobileObjectives && (
        <div className="fixed top-14 left-0 right-0 bg-black/95 border-b border-gray-800 p-4 z-30 lg:hidden shadow-2xl">
           <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {gameState.objectives.map(obj => (
                <div key={obj.id} className={`flex items-start gap-2 text-xs ${obj.completed ? 'text-green-500' : 'text-yellow-500'}`}>
                   <span className="mt-0.5">{obj.completed ? '[✓]' : '[O]'}</span>
                   <div>
                     <span className={obj.completed ? 'line-through opacity-50' : ''}>{obj.label}</span>
                     {!obj.completed && <p className="text-[10px] text-gray-500 mt-0.5">{obj.description}</p>}
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      <main className="flex-grow w-full max-w-2xl mx-auto pt-20 pb-32 px-4 sm:px-6">
        
        <div className="space-y-8">
          {gameState.history.slice(0, segmentsToShow).map((segment, index) => {
            const isPlayer = segment.sender === Sender.Player;
            
            return (
              <div 
                key={segment.id} 
                className={`relative group ${isPlayer ? "pl-4 border-l-2 border-gray-800 opacity-60 my-2" : "my-2"}`}
              >
                {segment.imageUrl && (
                  <div className="mb-4 rounded-sm overflow-hidden border border-gray-800/50 shadow-2xl opacity-90 animate-in fade-in duration-1000">
                    <img 
                      src={segment.imageUrl} 
                      alt="Scene visualization" 
                      className="w-full h-auto grayscale contrast-125 brightness-90 sepia-[.2]" 
                    />
                  </div>
                )}

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
                  tone={segment.tone}
                  onComplete={handleSegmentComplete}
                  autoPlay={autoPlayAudio && index === segmentsToShow - 1}
                />

                {/* Share Button: Desktop (Hover outside) */}
                <div className="absolute -right-6 top-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden sm:block">
                  <button 
                    onClick={() => handleFullHistoryShare(index)}
                    className="p-1.5 text-gray-700 hover:text-green-500 transition-colors"
                    title="Share conversation up to this point"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                 {/* Share Button: Mobile (Inside, top right, subtle) */}
                 <div className="absolute top-0 right-0 sm:hidden opacity-50">
                  <button 
                    onClick={() => handleFullHistoryShare(index)}
                    className="p-2 text-gray-600 hover:text-green-500 transition-colors"
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {gameState.isThinking && (
          <div className="flex items-center gap-3 mt-8 text-green-900/50 animate-pulse">
            <div className="w-1.5 h-1.5 bg-green-900 rounded-full" />
            <div className="w-1.5 h-1.5 bg-green-900 rounded-full delay-75" />
            <div className="w-1.5 h-1.5 bg-green-900 rounded-full delay-150" />
          </div>
        )}

        <div ref={scrollRef} />
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-[#050505] border-t border-gray-900 p-2 sm:p-4 z-40 pb-3 sm:pb-8 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <div className="max-w-2xl mx-auto space-y-2">
          
          {!gameState.isThinking && !gameState.gameOver && segmentsToShow >= gameState.history.length && gameState.choices.length > 0 && (
            <div className="flex flex-row gap-2 sm:gap-3 overflow-x-auto pb-2 mb-1 snap-x snap-mandatory hide-scrollbar px-1">
              {gameState.choices.map((choice, index) => (
                <ChoiceButton 
                  key={choice.id} 
                  choice={choice} 
                  onClick={handleChoice} 
                  disabled={gameState.isThinking}
                />
              ))}
            </div>
          )}

          {!gameState.gameOver && (
             <ActionInput 
                onSubmit={(text) => handlePlayerAction(text, 'custom')}
                disabled={gameState.isThinking}
                isThinking={gameState.isThinking}
             />
          )}

          {gameState.gameOver && (
            <div className="text-center py-2">
               <button 
                onClick={() => window.location.reload()}
                className="text-red-500 text-xs uppercase tracking-widest hover:text-red-400 transition-colors border border-red-900/30 px-4 py-2 rounded"
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