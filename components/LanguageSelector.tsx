import React, { useState } from 'react';
import { X, Globe } from 'lucide-react';

interface LanguageSelectorProps {
  currentLanguage: string;
  onSelect: (lang: string) => void;
  onClose: () => void;
}

const PRESETS = [
  "English", "Spanish (Rioplatense)", "Portuguese (Brazil)", 
  "French", "German", "Italian", 
  "Japanese", "Latin", "Klingon"
];

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ currentLanguage, onSelect, onClose }) => {
  const [customInput, setCustomInput] = useState('');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelect(customInput.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/30">
          <div className="flex items-center gap-2 text-green-500">
            <Globe className="w-4 h-4" />
            <span className="font-mono text-sm tracking-widest uppercase">Select Narrative Language</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map(lang => (
              <button
                key={lang}
                onClick={() => { onSelect(lang); onClose(); }}
                className={`
                  px-2 py-2 text-[10px] sm:text-xs font-mono uppercase tracking-wider border rounded transition-all truncate
                  ${currentLanguage === lang 
                    ? 'bg-green-900/30 border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                    : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'}
                `}
                title={lang}
              >
                {lang.split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0a0a0a] px-2 text-gray-600 font-mono">Or Custom</span>
            </div>
          </div>

          <form onSubmit={handleCustomSubmit} className="flex gap-2">
            <input 
              type="text" 
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="e.g. Old English, Hexadecimal, Pig Latin..."
              className="flex-grow bg-black border border-gray-800 text-gray-300 text-sm px-3 py-2 focus:outline-none focus:border-green-500/50 font-mono rounded-l placeholder:text-gray-700 placeholder:italic"
            />
            <button 
              type="submit"
              disabled={!customInput.trim()}
              className="px-4 py-2 bg-gray-800 text-gray-300 text-xs font-bold uppercase tracking-wider border border-gray-700 hover:bg-gray-700 disabled:opacity-50 rounded-r transition-colors"
            >
              Set
            </button>
          </form>
          
          <p className="text-[10px] text-gray-600 font-mono text-center italic">
            The narrative will be generated in this style, but audio instructions remain in English.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;